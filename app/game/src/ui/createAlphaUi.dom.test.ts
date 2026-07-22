// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { AlphaRuntime } from "../application/AlphaRuntime";
import {
  MemoryStorage,
  SPATIAL_SCENE_SCHEMA,
  validateWorldObjectPlacement,
  type ProfileId,
} from "../core";
import { createSimulatedSnapshot, type BridgeEventListener, type BridgeVisualSnapshot } from "../integrations";
import type { BridgePort } from "../application/GameController";
import type { AnimationFramePort } from "../application/AlphaRuntime";
import type { AlphaSceneCallbacks } from "./types";
import { createAlphaUi } from "./createAlphaUi";

afterEach(() => {
  document.body.replaceChildren();
});

describe("alpha UI DOM flows", () => {
  it("unlocks the first real locked sector with visible cost and feedback", async () => {
    const runtime = new AlphaRuntime({
      mode: "progressive",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene: sceneCallbacks(), confirmReset: () => true });
    const unlock = root.querySelector<HTMLButtonElement>('button[data-sector-id="east-gardens"]');

    expect(unlock).not.toBeNull();
    expect(unlock?.textContent).toContain("280 Lumens");
    expect(unlock?.disabled).toBe(false);
    unlock?.click();

    expect(runtime.getSnapshot().game.map.sectors.find((sector) => sector.id === "east-gardens")?.unlocked).toBe(true);
    expect(runtime.getSnapshot().game.economy.balance).toBe(140);
    expect(root.textContent).toContain("East Gardens is now part of the town.");
    expect(root.querySelector('button[data-sector-id="east-gardens"]')).toBeNull();
    ui.destroy();
    await runtime.stop();
  });

  it("buys and installs a catalog-valid optional furniture item inside the café", async () => {
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const cafe = runtime.getSnapshot().game.buildings.find((building) => building.kind === "cafe");
    expect(cafe).toBeDefined();
    expect(runtime.actions.enterInterior(cafe!.id).ok).toBe(true);
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene: sceneCallbacks(), confirmReset: () => true });
    const option = root.querySelector<HTMLButtonElement>(
      'button[data-slot-id="decor-window"][data-furniture-id="fern"]',
    );

    expect(option).not.toBeNull();
    expect(option?.textContent).toContain("Helecho");
    expect(option?.textContent).toContain("9 Lumens");
    const before = runtime.getSnapshot().game.economy.balance;
    option?.click();

    const interior = runtime.getSnapshot().game.interiors.find((item) => item.buildingId === cafe!.id);
    expect(interior?.furniture).toContainEqual(
      expect.objectContaining({ slotId: "decor-window", furnitureId: "fern" }),
    );
    expect(runtime.getSnapshot().game.economy.balance).toBe(before - 9);
    expect(root.textContent).toContain("Helecho quedó instalado.");
    expect(
      root.querySelector<HTMLButtonElement>('button[data-slot-id="decor-window"][data-furniture-id="fern"]')?.disabled,
    ).toBe(true);
    ui.destroy();
    await runtime.stop();
  });

  it("opens useful cafe actions from an object without debug labels", async () => {
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const cafe = runtime.getSnapshot().game.buildings.find((building) => building.kind === "cafe");
    expect(runtime.actions.enterInterior(cafe!.id).ok).toBe(true);
    const scene = { ...sceneCallbacks(), runInteriorAction: vi.fn(() => true) };
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene });
    ui.setSelectedAgent("default");

    ui.setInteriorHotspot({
      id: "tables",
      label: "Mesa junto al fuego",
      description: "Un rincón cálido para descansar.",
      actions: [{ id: "sit", label: "Sentarse", agentAction: true }],
    });
    expect(root.textContent).toContain("Mesa junto al fuego");
    expect(root.textContent).not.toContain("Zona de mesas");
    root.querySelector<HTMLButtonElement>('[data-interior-action="sit"]')?.click();
    expect(scene.runInteriorAction).toHaveBeenCalledWith("default", "tables", "sit");

    ui.destroy();
    await runtime.stop();
  });

  it("renders QA tools only for explicit local development mode", async () => {
    const normal = new AlphaRuntime({
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await normal.start();
    const normalRoot = host();
    const normalUi = createAlphaUi({ root: normalRoot, runtime: normal, scene: sceneCallbacks() });
    expect(normalRoot.querySelector("[data-qa-action]")).toBeNull();
    normalUi.destroy();
    await normal.stop();

    const qa = new AlphaRuntime({
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      developmentMode: true,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await qa.start();
    const qaRoot = host();
    const qaUi = createAlphaUi({ root: qaRoot, runtime: qa, scene: sceneCallbacks() });
    expect(qaRoot.textContent).toContain("QA LOCAL");
    expect(qaRoot.textContent).toContain("nunca Hermes");
    const beforeBalance = qa.getSnapshot().game.economy.balance;
    qaRoot.querySelector<HTMLButtonElement>('[data-qa-action="add-lumenes"]')?.click();
    expect(qa.getSnapshot().game.economy.balance).toBe(beforeBalance + 500);
    const beforeTime = qa.getSnapshot().game.clock.totalMinutes;
    qaRoot.querySelector<HTMLButtonElement>('[data-qa-action="advance-time"]')?.click();
    expect(qa.getSnapshot().game.clock.totalMinutes).toBe(beforeTime + 60);
    qaUi.destroy();
    await qa.stop();
  });

  it("updates selected-building UI without feeding selection back into the scene", async () => {
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const scene = sceneCallbacks();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene });
    const cafe = runtime.getSnapshot().game.buildings.find((building) => building.kind === "cafe");
    ui.setSelectedBuilding(cafe?.id ?? null);
    expect(root.textContent).toContain("Café Biblioteca");
    expect(scene.focusBuilding).not.toHaveBeenCalled();
    ui.destroy();
    await runtime.stop();
  });

  it("focuses an agent and exposes destination, location and role", async () => {
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const scene = sceneCallbacks();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene });

    root.querySelector<HTMLButtonElement>('button[data-profile-id="elen"]')?.click();

    expect(scene.focusAgent).toHaveBeenCalledWith("elen");
    expect(root.textContent).toContain("Marketing y comunicación");
    expect(root.textContent).toContain("Casa acogedora");
    expect(root.querySelector('button[data-profile-id="elen"]')?.classList.contains("is-selected")).toBe(true);
    ui.destroy();
    await runtime.stop();
  });

  it("offers Poseer and Liberar only from the selected agent inspector", async () => {
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    configureSpatialControl(runtime, "elen");
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene: sceneCallbacks() });

    expect(root.querySelector('[data-agent-action="possess"]')).toBeNull();
    root.querySelector<HTMLButtonElement>('button[data-profile-id="elen"]')?.click();

    const possess = root.querySelector<HTMLButtonElement>('.alpha-inspector [data-agent-action="possess"]');
    expect(possess?.textContent).toBe("Possess");
    expect(root.querySelector('.alpha-agent-list [data-agent-action="possess"]')).toBeNull();
    expect(root.querySelectorAll('[data-agent-action="possess"]')).toHaveLength(1);
    possess?.click();

    expect(runtime.getSnapshot().control.possessedProfileId).toBe("elen");
    expect(root.querySelector<HTMLButtonElement>('.alpha-inspector [data-agent-action="release-possession"]')?.textContent)
      .toBe("Release");
    expect(root.querySelectorAll('[data-agent-action="release-possession"]')).toHaveLength(1);
    expect(root.querySelector<HTMLElement>(".alpha-possession-hud")?.hidden).toBe(false);
    expect(root.querySelector(".alpha-possession-hud")?.textContent).toContain("WASD");

    root.querySelector<HTMLButtonElement>('.alpha-inspector [data-agent-action="release-possession"]')?.click();
    expect(runtime.getSnapshot().control.possessedProfileId).toBeUndefined();
    const cafe = runtime.getSnapshot().game.buildings.find((building) => building.kind === "cafe");
    ui.setSelectedBuilding(cafe?.id ?? null);
    expect(root.querySelector('[data-agent-action="possess"], [data-agent-action="release-possession"]')).toBeNull();

    ui.destroy();
    await runtime.stop();
  });

  it("maps P, WASD, E, F and Esc to the active local-control contract", async () => {
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    configureSpatialControl(runtime, "elen");
    const scene = {
      ...sceneCallbacks(),
      interactContext: vi.fn(() => true),
      usePortal: vi.fn(() => true),
    };
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene });
    ui.setSelectedAgent("elen");
    const toggle = vi.spyOn(runtime.actions, "togglePossession");
    const move = vi.spyOn(runtime.actions, "movePossessed");
    const release = vi.spyOn(runtime.actions, "releaseLocalControl");

    expect(dispatchKey(document, "p").defaultPrevented).toBe(true);
    expect(toggle).toHaveBeenCalledWith("elen");
    expect(runtime.getSnapshot().control.possessedProfileId).toBe("elen");

    for (const key of ["w", "a", "s", "d"] as const) {
      expect(dispatchKey(document, key).defaultPrevented).toBe(true);
    }
    expect(move.mock.calls.map(([key]) => key)).toEqual(["w", "a", "s", "d"]);

    expect(dispatchKey(document, "e").defaultPrevented).toBe(true);
    expect(scene.interactContext).toHaveBeenCalledOnce();
    expect(dispatchKey(document, "f").defaultPrevented).toBe(true);
    expect(scene.usePortal).toHaveBeenCalledOnce();

    expect(dispatchKey(document, "p").defaultPrevented).toBe(true);
    expect(runtime.getSnapshot().control.possessedProfileId).toBeUndefined();
    expect(dispatchKey(document, "p").defaultPrevented).toBe(true);
    expect(runtime.getSnapshot().control.possessedProfileId).toBe("elen");
    expect(toggle).toHaveBeenCalledTimes(3);

    expect(dispatchKey(document, "Escape").defaultPrevented).toBe(true);
    expect(release).toHaveBeenCalledWith("manual");
    expect(runtime.getSnapshot().control.possessedProfileId).toBeUndefined();
    expect(root.querySelector<HTMLElement>(".alpha-possession-hud")?.hidden).toBe(true);

    ui.destroy();
    await runtime.stop();
  });

  it("uses the first Escape to release possession and only the second to leave an interior", async () => {
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const cafe = runtime.getSnapshot().game.buildings.find((building) => building.kind === "cafe");
    expect(cafe).toBeDefined();
    expect(runtime.actions.enterInterior(cafe!.id).ok).toBe(true);
    configureSpatialControl(runtime, "default", { kind: "interior", buildingId: cafe!.id });
    const scene = sceneCallbacks();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene });
    ui.setSelectedAgent("default");
    dispatchKey(document, "p");

    dispatchKey(document, "Escape");
    expect(runtime.getSnapshot().control.possessedProfileId).toBeUndefined();
    expect(runtime.getSnapshot().game.camera.scene).toBe("interior");
    expect(scene.exitCafe).not.toHaveBeenCalled();

    dispatchKey(document, "Escape");
    expect(runtime.getSnapshot().game.camera.scene).toBe("city");
    expect(scene.exitCafe).toHaveBeenCalledOnce();

    ui.destroy();
    await runtime.stop();
  });

  it.each([
    ["input", () => document.createElement("input")],
    ["textarea", () => document.createElement("textarea")],
    ["select", () => document.createElement("select")],
    ["contenteditable", () => {
      const editable = document.createElement("div");
      editable.setAttribute("contenteditable", "true");
      editable.tabIndex = 0;
      return editable;
    }],
  ] as const)("does not intercept game controls while a %s is focused", async (_label, createEditable) => {
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    configureSpatialControl(runtime, "elen");
    const scene = {
      ...sceneCallbacks(),
      interactContext: vi.fn(() => true),
      usePortal: vi.fn(() => true),
    };
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene });
    ui.setSelectedAgent("elen");
    dispatchKey(document, "p");
    expect(runtime.getSnapshot().control.possessedProfileId).toBe("elen");

    const toggle = vi.spyOn(runtime.actions, "togglePossession");
    const move = vi.spyOn(runtime.actions, "movePossessed");
    const release = vi.spyOn(runtime.actions, "releaseLocalControl");
    const editable = createEditable();
    root.append(editable);
    editable.focus();
    expect(document.activeElement).toBe(editable);

    for (const key of ["p", "w", "a", "s", "d", "e", "f", "Escape"] as const) {
      expect(dispatchKey(editable, key).defaultPrevented).toBe(false);
    }
    expect(toggle).not.toHaveBeenCalled();
    expect(move).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(scene.interactContext).not.toHaveBeenCalled();
    expect(scene.usePortal).not.toHaveBeenCalled();
    expect(runtime.getSnapshot().control.possessedProfileId).toBe("elen");

    ui.destroy();
    await runtime.stop();
  });

  it("keeps the cafe action stable while unrelated clock ticks render", async () => {
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const scene = sceneCallbacks();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene });
    const cafe = runtime.getSnapshot().game.buildings.find((building) => building.kind === "cafe");
    ui.setSelectedBuilding(cafe?.id ?? null);
    const before = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Enter Cafe Library"),
    );

    runtime.getController().step(1);
    const after = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Enter Cafe Library"),
    );
    expect(after).toBe(before);
    after?.click();
    expect(scene.enterCafe).toHaveBeenCalledWith(cafe?.id);
    expect(runtime.getSnapshot().game.camera.scene).toBe("interior");

    ui.destroy();
    await runtime.stop();
  });

  it("keeps pointer input inside the UI from reaching the world behind it", async () => {
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene: sceneCallbacks() });
    const control = root.querySelector<HTMLButtonElement>("button");
    const worldPointerUp = vi.fn();
    const worldClick = vi.fn();
    document.addEventListener("pointerup", worldPointerUp);
    document.addEventListener("click", worldClick);

    control?.dispatchEvent(new Event("pointerup", { bubbles: true }));
    control?.dispatchEvent(new Event("click", { bubbles: true }));

    expect(worldPointerUp).not.toHaveBeenCalled();
    expect(worldClick).not.toHaveBeenCalled();
    document.removeEventListener("pointerup", worldPointerUp);
    document.removeEventListener("click", worldClick);
    ui.destroy();
    await runtime.stop();
  });

  it("keeps construction and empty inspectors out of the city until requested", async () => {
    const runtime = new AlphaRuntime({
      mode: "progressive",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene: sceneCallbacks() });
    const palette = root.querySelector<HTMLElement>(".alpha-palette");
    const inspector = root.querySelector<HTMLElement>(".alpha-inspector");
    const open = root.querySelector<HTMLButtonElement>('.alpha-action--build');

    expect(palette?.hidden).toBe(true);
    expect(inspector?.hidden).toBe(true);
    expect(open?.getAttribute("aria-expanded")).toBe("false");
    open?.click();
    expect(palette?.hidden).toBe(false);
    expect(open?.getAttribute("aria-expanded")).toBe("true");
    root.querySelector<HTMLButtonElement>(".alpha-palette__close")?.click();
    expect(palette?.hidden).toBe(true);

    ui.destroy();
    await runtime.stop();
  });

  it.each(["showcase", "progressive"] as const)("keeps the Construir CTA explicit in %s mode", async (mode) => {
    const runtime = new AlphaRuntime({
      mode,
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene: sceneCallbacks() });
    const primary = root.querySelector<HTMLButtonElement>('[data-action="build-or-return"]');

    expect(primary?.textContent).toContain("Build");
    expect(primary?.getAttribute("aria-label")).toBe("Open build catalog");
    expect(primary?.classList.contains("alpha-action--return")).toBe(false);
    primary?.click();
    expect(root.querySelector<HTMLElement>(".alpha-palette")?.hidden).toBe(false);

    ui.destroy();
    await runtime.stop();
  });

  it("turns the primary CTA into a working return action inside the café", async () => {
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const cafe = runtime.getSnapshot().game.buildings.find((building) => building.kind === "cafe");
    expect(runtime.actions.enterInterior(cafe!.id).ok).toBe(true);
    const scene = sceneCallbacks();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene });
    const primary = root.querySelector<HTMLButtonElement>('[data-action="build-or-return"]');

    expect(primary?.textContent).toContain("Back to town");
    expect(primary?.getAttribute("aria-expanded")).toBe("false");
    expect(primary?.classList.contains("alpha-action--return")).toBe(true);
    primary?.click();
    expect(runtime.getSnapshot().game.camera.scene).toBe("city");
    expect(scene.exitCafe).toHaveBeenCalled();
    expect(primary?.textContent).toContain("Build");

    ui.destroy();
    await runtime.stop();
  });

  it("names Ciudad de muestra explicitly and exposes a closable reference gallery", async () => {
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene: sceneCallbacks() });
    const modeOptions = Array.from(root.querySelectorAll<HTMLOptionElement>(".alpha-select option"));
    const references = root.querySelector<HTMLButtonElement>(".alpha-reference-trigger");
    const modal = root.querySelector<HTMLElement>(".alpha-reference-modal");

    expect(modeOptions.map((item) => item.textContent)).toEqual(["Showcase town", "New game"]);
    expect(references?.textContent).toBe("References");
    expect(modal?.hidden).toBe(true);
    references?.click();
    expect(modal?.hidden).toBe(false);
    expect(modal?.getAttribute("role")).toBe("dialog");
    expect(modal?.getAttribute("aria-modal")).toBe("true");
    expect(root.querySelectorAll<HTMLImageElement>('.alpha-reference-card__image[src^="/assets/reference/"]')).toHaveLength(4);
    expect(root.querySelector<HTMLAnchorElement>('.alpha-reference-dialog__gate')?.getAttribute("href")).toBe("?gate=1");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(modal?.hidden).toBe(true);
    expect(document.activeElement).toBe(references);

    references?.click();
    modal?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal?.hidden).toBe(true);

    ui.destroy();
    await runtime.stop();
  });

  it("offers the nine exterior objects in a dedicated construction tab", async () => {
    const runtime = new AlphaRuntime({
      mode: "progressive",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const scene = { ...sceneCallbacks(), setExteriorTool: vi.fn(() => true) };
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene });
    root.querySelector<HTMLButtonElement>(".alpha-action--build")?.click();
    Array.from(root.querySelectorAll<HTMLButtonElement>(".alpha-catalog-tab"))
      .find((button) => button.textContent === "Exterior")
      ?.click();

    expect(root.querySelectorAll("[data-exterior-id]")).toHaveLength(9);
    expect(root.textContent).toContain("Farola");
    expect(root.textContent).toContain("Árbol alto");
    root.querySelector<HTMLButtonElement>('[data-exterior-id="tree-round"]')?.click();
    expect(scene.setExteriorTool).toHaveBeenCalledWith("tree-round");
    expect(root.querySelector<HTMLElement>(".alpha-palette")?.hidden).toBe(true);

    ui.destroy();
    await runtime.stop();
  });

  it("explains the exact core reason for an invalid building footprint", async () => {
    const runtime = new AlphaRuntime({
      mode: "progressive",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene: sceneCallbacks() });
    ui.setPlacementPreview({
      definitionId: "home-cozy",
      origin: { x: 0, y: 0 },
      orientation: "north",
      valid: false,
      occupiedTiles: [],
      accessTile: { x: 0, y: 0 },
      footprintWidth: 4,
      footprintHeight: 3,
      roadTiles: [],
      connectorPath: [],
      removedObjectIds: [],
      costs: { building: 110, road: 0, cleanup: 0, total: 110 },
      affordable: true,
      errors: ["COLLISION"],
    });
    expect(root.querySelector(".alpha-placement-receipt")?.textContent).toContain("Otro edificio ocupa parte de esa huella.");
    ui.destroy();
    await runtime.stop();
  });

  it("keeps transient notices compact, deduplicated and capped at two", async () => {
    const runtime = new AlphaRuntime({
      mode: "progressive",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene: sceneCallbacks() });
    ui.showToast("Primero");
    ui.showToast("Segundo");
    ui.showToast("Segundo");
    ui.showToast("Tercero");

    expect(Array.from(root.querySelectorAll(".alpha-toast")).map((toast) => toast.textContent)).toEqual([
      "Segundo",
      "Tercero",
    ]);
    ui.destroy();
    await runtime.stop();
  });

  it("accelerates a selected real construction from its contextual inspector", async () => {
    const runtime = new AlphaRuntime({
      mode: "progressive",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const placed = runtime.actions.placeBuilding("cafe-library", { x: 8, y: 4 }, "north");
    expect(placed.ok).toBe(true);
    const cafe = runtime.getSnapshot().game.buildings.find((building) => building.kind === "cafe");
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene: sceneCallbacks() });
    ui.setSelectedBuilding(cafe?.id ?? null);

    const oneHour = root.querySelector<HTMLButtonElement>('[data-construction-action="one-hour"]');
    expect(oneHour?.textContent).toContain("Speed up 1 hour");
    oneHour?.click();
    expect(runtime.getSnapshot().game.buildings.find((building) => building.id === cafe?.id)?.construction.elapsedMinutes).toBe(60);

    root.querySelector<HTMLButtonElement>('[data-construction-action="finish-now"]')?.click();
    expect(runtime.getSnapshot().game.buildings.find((building) => building.id === cafe?.id)?.status).toBe("complete");
    ui.destroy();
    await runtime.stop();
  });

  it("issues the local cafe loop and lets the selected inhabitant leave explicitly", async () => {
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene: sceneCallbacks() });
    ui.setSelectedAgent("default");
    root.querySelector<HTMLButtonElement>('[data-agent-action="go-to-cafe"]')?.click();
    expect(runtime.getSnapshot().game.agents.find((agent) => agent.profileId === "default")?.localOrder?.kind).toBe("go-to-cafe");

    for (let minute = 0; minute < 240; minute += 1) {
      runtime.getController().step(1);
      if (runtime.getSnapshot().game.agents.find((agent) => agent.profileId === "default")?.location.kind === "interior") break;
    }
    expect(root.querySelector<HTMLButtonElement>('[data-agent-action="return-to-city"]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[data-agent-action="return-to-city"]')?.click();
    expect(runtime.getSnapshot().game.agents.find((agent) => agent.profileId === "default")?.location.kind).toBe("exterior");
    ui.destroy();
    await runtime.stop();
  });

  it("selects and removes a persistent exterior object with confirmation and refund", async () => {
    const runtime = new AlphaRuntime({
      mode: "progressive",
      storage: new MemoryStorage(),
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const state = runtime.getSnapshot().game;
    const hostTile = state.map.tiles.find((tile) =>
      validateWorldObjectPlacement(state, { definitionId: "tree-round", hostTile: tile.position }).ok,
    )?.position;
    expect(hostTile).toBeDefined();
    const placed = runtime.actions.placeWorldObject("tree-round", hostTile!);
    expect(placed.ok).toBe(true);
    const object = runtime.getSnapshot().game.worldObjects.find((candidate) => candidate.provenance === "player");
    const beforeRemoval = runtime.getSnapshot().game.economy.balance;
    const scene = sceneCallbacks();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene, confirmAction: () => true });
    ui.setSelectedWorldObject(object?.instanceId ?? null);

    const remove = root.querySelector<HTMLButtonElement>('[data-world-object-action="remove"]');
    expect(remove?.textContent).toContain("+10 Lumens");
    remove?.click();
    expect(runtime.getSnapshot().game.worldObjects.some((candidate) => candidate.instanceId === object?.instanceId)).toBe(false);
    expect(runtime.getSnapshot().game.economy.balance).toBe(beforeRemoval + 10);
    expect(scene.selectWorldObject).toHaveBeenCalledWith(null);
    ui.destroy();
    await runtime.stop();
  });

  it("restores an interior save and asks the scene adapter to match persisted camera state", async () => {
    const storage = new MemoryStorage();
    const runtime = new AlphaRuntime({
      mode: "showcase",
      storage,
      autoLoad: false,
      autosaveIntervalMs: null,
      bridge: new FakeBridge(),
      animationFrame: new IdleFrames(),
    });
    await runtime.start();
    const cafe = runtime.getSnapshot().game.buildings.find((building) => building.kind === "cafe");
    expect(runtime.actions.enterInterior(cafe!.id).ok).toBe(true);
    expect(runtime.actions.save().ok).toBe(true);
    expect(runtime.actions.exitInterior().ok).toBe(true);
    const scene = sceneCallbacks();
    const root = host();
    const ui = createAlphaUi({ root, runtime, scene });
    Array.from(root.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Load"))
      ?.click();

    expect(runtime.getSnapshot().game.camera).toMatchObject({ scene: "interior", interiorBuildingId: cafe!.id });
    expect(scene.syncSceneFromState).toHaveBeenCalled();
    ui.destroy();
    await runtime.stop();
  });
});

function host(): HTMLElement {
  const root = document.createElement("div");
  document.body.append(root);
  return root;
}

function configureSpatialControl(
  runtime: AlphaRuntime,
  profileId: ProfileId,
  binding: { readonly kind: "city" } | { readonly kind: "interior"; readonly buildingId: string } = { kind: "city" },
): void {
  const game = runtime.getSnapshot().game;
  const agent = game.agents.find((candidate) => candidate.profileId === profileId);
  expect(agent).toBeDefined();
  const sceneId = binding.kind === "city" ? "ui-control-city" : `ui-control-cafe:${binding.buildingId}`;
  const walkableCells = Array.from({ length: game.map.size.height }, (_, y) =>
    Array.from({ length: game.map.size.width }, (_unused, x) => ({ x, y })),
  ).flat();
  const configured = runtime.actions.configureSpatialScene({
    scene: {
      schema: SPATIAL_SCENE_SCHEMA,
      id: sceneId,
      version: 1,
      grid: game.map.size,
      projection: { kind: "isometric-fixed", tileWidth: 64, tileHeight: 32, origin: { x: 0, y: 0 } },
      walkableCells,
      entities: [],
      anchors: [],
      interactions: [],
      portals: [],
      entryAnchorIds: [],
      exitAnchorIds: [],
      lighting: "inherit-world-clock",
      assets: [],
    },
    binding,
    actors: [{
      actorId: profileId,
      sceneId,
      possessible: true,
      cell: agent!.position,
      facing: "south",
    }],
  });
  expect(configured.ok).toBe(true);
}

function dispatchKey(target: EventTarget, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

class FakeBridge implements BridgePort {
  private readonly snapshot = createSimulatedSnapshot(new Date("2026-07-16T12:00:00Z"));

  async start(): Promise<BridgeVisualSnapshot> {
    return this.snapshot;
  }

  async stop(): Promise<void> {}

  getState(): BridgeVisualSnapshot {
    return this.snapshot;
  }

  subscribeEvents(_listener: BridgeEventListener): () => void {
    return () => undefined;
  }
}

class IdleFrames implements AnimationFramePort {
  private next = 1;

  request(_callback: FrameRequestCallback): number {
    return this.next++;
  }

  cancel(_handle: number): void {}
}

function sceneCallbacks(): AlphaSceneCallbacks {
  return {
    setBuildTool: vi.fn(),
    rotateBuildTool: vi.fn(),
    cancelBuildTool: vi.fn(),
    enterCafe: vi.fn(),
    exitCafe: vi.fn(),
    focusAgent: vi.fn(),
    focusBuilding: vi.fn(),
    resetWorld: vi.fn(),
    runInteriorAction: vi.fn(() => true),
    setExteriorTool: vi.fn(() => true),
    selectWorldObject: vi.fn(() => true),
    syncSceneFromState: vi.fn(),
  };
}
