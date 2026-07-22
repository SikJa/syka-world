import Phaser from "phaser";
import type { AlphaRuntime, ControllerSnapshot } from "../application/AlphaRuntime";
import type { CardinalDirection, ProfileId, ScreenRelativeMovementKey } from "../core";
import type { CityScene } from "../presentation/scenes/CityScene";

export type QaPeriod = "day" | "twilight" | "night";

export interface QaActionResult {
  readonly ok: boolean;
  readonly error?: string;
}

export interface AlphaPerformanceSnapshot {
  readonly actualFps: number;
  readonly frameMilliseconds: number;
  readonly activeScenes: readonly string[];
  readonly displayObjects: number;
  readonly imageObjects: number;
  readonly textureCount: number;
  readonly renderer: "webgl" | "canvas" | "unknown";
  readonly rendererDrawCount: number | null;
  readonly heapUsedBytes: number | null;
}

export interface AlphaQaApi {
  readonly getSnapshot: () => ControllerSnapshot;
  readonly metrics: () => AlphaPerformanceSnapshot;
  readonly setPeriod: (period: QaPeriod) => QaActionResult;
  readonly advanceMinutes: (minutes: number) => QaActionResult;
  readonly finishConstruction: () => QaActionResult;
  readonly addLumenes: (amount?: number) => QaActionResult;
  readonly placeBuilding: (
    definitionId: string,
    x: number,
    y: number,
    orientation?: CardinalDirection,
  ) => QaActionResult;
  readonly selectBuilding: (buildingId: string | null) => QaActionResult;
  readonly focusGrid: (x: number, y: number) => QaActionResult;
  readonly setZoom: (zoom: 1 | 1.5 | 2) => QaActionResult;
  readonly selectAgent: (profileId: ProfileId) => QaActionResult;
  readonly togglePossession: (profileId?: ProfileId) => QaActionResult;
  readonly clickMove: (sceneId: string, x: number, y: number) => QaActionResult;
  readonly movePossessed: (key: ScreenRelativeMovementKey) => QaActionResult;
  readonly enterCafe: (buildingId?: string) => QaActionResult;
  readonly exitCafe: () => QaActionResult;
  readonly unlockSector: (sectorId: string) => QaActionResult;
  readonly installFurniture: (buildingId: string, slotId: string, furnitureId: string) => QaActionResult;
  readonly previewFurniturePlacement: (buildingId: string, slotId: string, furnitureId: string) => QaActionResult;
  readonly save: () => QaActionResult;
  readonly load: () => QaActionResult;
  readonly reset: (mode: "showcase" | "progressive") => QaActionResult;
}

export interface AlphaQaApiOptions {
  readonly runtime: AlphaRuntime;
  readonly game: Phaser.Game;
  readonly city: CityScene;
  readonly openInterior: (buildingId: string) => void;
  readonly closeInterior: () => void;
}

declare global {
  interface Window {
    __SYKA_ALPHA_QA__?: AlphaQaApi;
  }
}

/** Explicitly local QA surface. It can mutate only the deterministic game state. */
export function installAlphaQaApi(options: AlphaQaApiOptions): () => void {
  const { runtime, game, city, openInterior, closeInterior } = options;
  const development = runtime.development;
  if (!development) return () => undefined;
  const drawCalls = installDrawCallCounter(game);

  const api: AlphaQaApi = {
    getSnapshot: () => runtime.getSnapshot(),
    metrics: () => performanceSnapshot(game, drawCalls.read()),
    setPeriod: (period) => {
      const target = { day: 10 * 60, twilight: 18 * 60 + 30, night: 22 * 60 }[period];
      const current = runtime.getSnapshot().game.clock.minuteOfDay;
      const delta = (target - current + 1_440) % 1_440;
      return delta === 0 ? { ok: true } : resultOf(development.advanceMinutes(delta));
    },
    advanceMinutes: (minutes) => resultOf(development.advanceMinutes(minutes)),
    finishConstruction: () => resultOf(development.finishConstruction()),
    addLumenes: (amount = 500) => resultOf(development.addLumenes(amount)),
    placeBuilding: (definitionId, x, y, orientation = "north") =>
      resultOf(runtime.actions.placeBuilding(definitionId, { x, y }, orientation)),
    selectBuilding: (buildingId) => ({ ok: city.selectBuilding(buildingId) }),
    focusGrid: (x, y) => {
      const center = runtime.getSnapshot().game.camera.center;
      runtime.actions.panCamera({ x: Math.round(x) - center.x, y: Math.round(y) - center.y });
      return { ok: true };
    },
    setZoom: (zoom) => {
      runtime.actions.setZoom(zoom);
      return { ok: true };
    },
    selectAgent: (profileId) => resultOf(runtime.actions.selectProfile(profileId)),
    togglePossession: (profileId) => resultOf(runtime.actions.togglePossession(profileId)),
    clickMove: (sceneId, x, y) => resultOf(runtime.actions.clickMove(sceneId, { x, y })),
    movePossessed: (key) => resultOf(runtime.actions.movePossessed(key)),
    enterCafe: (requestedBuildingId) => {
      const buildingId = requestedBuildingId ?? runtime.getSnapshot().game.buildings.find(
        (building) => building.kind === "cafe" && building.status === "complete",
      )?.id;
      if (!buildingId) return { ok: false, error: "No completed cafe is available." };
      const result = runtime.actions.enterInterior(buildingId);
      if (!result.ok) return resultOf(result);
      openInterior(buildingId);
      return { ok: true };
    },
    exitCafe: () => {
      const result = runtime.actions.exitInterior();
      if (!result.ok) return resultOf(result);
      closeInterior();
      return { ok: true };
    },
    unlockSector: (sectorId) => resultOf(runtime.actions.unlockSector(sectorId)),
    installFurniture: (buildingId, slotId, furnitureId) =>
      resultOf(runtime.actions.installFurniture(buildingId, slotId, furnitureId)),
    previewFurniturePlacement: (buildingId, slotId, furnitureId) => {
      const result = runtime.actions.previewFurniturePlacement(buildingId, slotId, furnitureId);
      return result.ok ? { ok: true } : { ok: false, error: result.message };
    },
    save: () => resultOf(runtime.actions.save()),
    load: () => resultOf(runtime.actions.load()),
    reset: (mode) => resultOf(runtime.actions.reset(mode)),
  };

  window.__SYKA_ALPHA_QA__ = api;
  return () => {
    drawCalls.cleanup();
    if (window.__SYKA_ALPHA_QA__ === api) delete window.__SYKA_ALPHA_QA__;
  };
}

export function performanceSnapshot(game: Phaser.Game, measuredDrawCalls: number | null = null): AlphaPerformanceSnapshot {
  const scenes = game.scene.getScenes(true);
  const objects = scenes.flatMap((scene) => scene.children.list);
  const renderer = game.renderer as Phaser.Renderer.Canvas.CanvasRenderer | Phaser.Renderer.WebGL.WebGLRenderer;
  const rendererDrawCount = measuredDrawCalls ?? ("drawCount" in renderer && typeof renderer.drawCount === "number"
    ? renderer.drawCount
    : null);
  const memory = performance as Performance & { readonly memory?: { readonly usedJSHeapSize?: number } };
  return {
    actualFps: round(game.loop.actualFps),
    frameMilliseconds: round(game.loop.delta),
    activeScenes: scenes.map((scene) => scene.scene.key),
    displayObjects: objects.length,
    imageObjects: objects.filter((object) => object instanceof Phaser.GameObjects.Image).length,
    textureCount: game.textures.getTextureKeys().length,
    renderer: game.renderer.type === Phaser.WEBGL ? "webgl" : game.renderer.type === Phaser.CANVAS ? "canvas" : "unknown",
    rendererDrawCount,
    heapUsedBytes: typeof memory.memory?.usedJSHeapSize === "number" ? memory.memory.usedJSHeapSize : null,
  };
}

interface DrawCallCounter {
  readonly read: () => number | null;
  readonly cleanup: () => void;
}

/** Counts WebGL drawElements calls per rendered frame without shipping production instrumentation. */
function installDrawCallCounter(game: Phaser.Game): DrawCallCounter {
  if (game.renderer.type !== Phaser.WEBGL) return { read: () => null, cleanup: () => undefined };
  const renderer = game.renderer as unknown as {
    drawElements?: (...args: unknown[]) => unknown;
  };
  if (typeof renderer.drawElements !== "function") return { read: () => null, cleanup: () => undefined };
  const original = renderer.drawElements;
  let current = 0;
  let last = 0;
  const wrapped = (...args: unknown[]): unknown => {
    current += 1;
    return original.apply(renderer, args);
  };
  renderer.drawElements = wrapped;
  const before = (): void => {
    current = 0;
  };
  const after = (): void => {
    last = current;
  };
  game.events.on(Phaser.Core.Events.PRE_RENDER, before);
  game.events.on(Phaser.Core.Events.POST_RENDER, after);
  return {
    read: () => last,
    cleanup: () => {
      game.events.off(Phaser.Core.Events.PRE_RENDER, before);
      game.events.off(Phaser.Core.Events.POST_RENDER, after);
      if (renderer.drawElements === wrapped) renderer.drawElements = original;
    },
  };
}

function resultOf(result: { readonly ok: boolean; readonly error?: { readonly code?: string; readonly message?: string } }): QaActionResult {
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error?.code ?? result.error?.message ?? "QA action failed." };
}

function round(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}
