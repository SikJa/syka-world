import { describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "../core";
import { createSimulatedSnapshot, type BridgeEventListener, type BridgeVisualSnapshot } from "../integrations";
import type { BridgePort } from "./GameController";
import {
  AlphaRuntime,
  SafeLocalStorageError,
  createSafeLocalStorageAdapter,
  type AnimationFramePort,
  type LocalStorageLike,
} from "./AlphaRuntime";

class FakeBridge implements BridgePort {
  readonly snapshot = createSimulatedSnapshot(new Date("2026-07-16T12:00:00Z"));
  listener: BridgeEventListener | undefined;
  started = 0;
  stopped = 0;

  async start(): Promise<BridgeVisualSnapshot> {
    this.started += 1;
    return this.snapshot;
  }

  async stop(): Promise<void> {
    this.stopped += 1;
  }

  getState(): BridgeVisualSnapshot {
    return this.snapshot;
  }

  subscribeEvents(listener: BridgeEventListener): () => void {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }
}

class FakeAnimationFrames implements AnimationFramePort {
  private nextHandle = 1;
  private readonly callbacks = new Map<number, FrameRequestCallback>();

  request(callback: FrameRequestCallback): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  fire(timestamp: number): void {
    const pending = [...this.callbacks.entries()];
    this.callbacks.clear();
    for (const [, callback] of pending) callback(timestamp);
  }

  get pending(): number {
    return this.callbacks.size;
  }
}

describe("safe localStorage adapter", () => {
  it("restricts keys to the game namespace", () => {
    const adapter = createSafeLocalStorageAdapter(new MemoryStorage());
    expect(() => adapter.setItem("hermes.config", "no")) .toThrow(SafeLocalStorageError);
    expect(() => adapter.getItem("../../outside")) .toThrow(SafeLocalStorageError);
    expect(() => adapter.removeItem("syka-world.alpha-v1.save")).not.toThrow();
  });

  it("returns a generic privacy-safe error when browser storage fails", () => {
    const broken: LocalStorageLike = {
      getItem: () => {
        throw new Error("C:\\Users\\private\\secret");
      },
      setItem: () => {
        throw new Error("quota details");
      },
      removeItem: () => {
        throw new Error("private key");
      },
    };
    const adapter = createSafeLocalStorageAdapter(broken);
    try {
      adapter.getItem("syka-world.alpha-v1.save");
      throw new Error("expected adapter to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SafeLocalStorageError);
      expect((error as Error).message).toBe("No se pudo acceder al guardado local.");
      expect((error as Error).message).not.toContain("private");
    }
  });

  it("refuses unexpectedly large save payloads", () => {
    const adapter = createSafeLocalStorageAdapter(new MemoryStorage());
    expect(() => adapter.setItem("syka-world.alpha-v1.save", "x".repeat(2_000_001))).toThrow(
      SafeLocalStorageError,
    );
  });
});

describe("AlphaRuntime", () => {
  it("starts and stops the controller and advances deterministic fixed RAF steps", async () => {
    const bridge = new FakeBridge();
    const frames = new FakeAnimationFrames();
    const runtime = new AlphaRuntime({
      mode: "progressive",
      storage: new MemoryStorage(),
      bridge,
      autoLoad: false,
      autosaveIntervalMs: null,
      animationFrame: frames,
      fixedStepMs: 100,
      maximumFrameDeltaMs: 1_000,
    });
    const before = runtime.getSnapshot().game.clock.totalMinutes;

    await runtime.start();
    expect(bridge.started).toBe(1);
    expect(frames.pending).toBe(1);
    frames.fire(0);
    frames.fire(1_000);
    expect(runtime.getSnapshot().game.clock.totalMinutes).toBe(before + 1);

    runtime.actions.setClockSpeed(2);
    frames.fire(1_500);
    expect(runtime.getSnapshot().game.clock.totalMinutes).toBe(before + 2);
    await runtime.stop();
    expect(bridge.stopped).toBe(1);
    expect(frames.pending).toBe(0);
  });

  it("autosaves only after a controlled interval and a state change", async () => {
    const values = new Map<string, string>();
    const setItem = vi.fn((key: string, value: string) => values.set(key, value));
    const storage: LocalStorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem,
      removeItem: (key) => values.delete(key),
    };
    const frames = new FakeAnimationFrames();
    const runtime = new AlphaRuntime({
      storage: createSafeLocalStorageAdapter(storage),
      bridge: new FakeBridge(),
      autoLoad: false,
      autosaveIntervalMs: 1_000,
      animationFrame: frames,
      fixedStepMs: 100,
      maximumFrameDeltaMs: 1_000,
    });
    await runtime.start();
    frames.fire(0);
    frames.fire(500);
    expect(setItem).not.toHaveBeenCalled();

    runtime.actions.setClockSpeed(2);
    frames.fire(1_000);
    expect(setItem).toHaveBeenCalledWith(
      "syka-world.alpha-v1.save",
      expect.stringContaining('"schema":"syka.world.save.v1"'),
    );
    const writesAfterAutosave = setItem.mock.calls.length;
    await runtime.stop();
    expect(setItem).toHaveBeenCalledTimes(writesAfterAutosave);
  });

  it("exposes local game actions without any Hermes write method", async () => {
    const runtime = new AlphaRuntime({
      storage: new MemoryStorage(),
      bridge: new FakeBridge(),
      autoLoad: false,
      animationFrame: new FakeAnimationFrames(),
    });
    await runtime.start();

    expect(Object.keys(runtime.actions).sort()).toEqual(
      [
        "accelerateConstruction",
        "clearControlNotice",
        "clearProfileSelection",
        "clearSpatialScene",
        "clickMove",
        "configureSpatialScene",
        "enterInterior",
        "exitInterior",
        "finishInteraction",
        "getConstructionAccelerationQuote",
        "installFurniture",
        "interact",
        "issueGoToCafeOrder",
        "load",
        "movePossessed",
        "panCamera",
        "placeBuilding",
        "placeWorldObject",
        "planBuildingPlacement",
        "previewFurniturePlacement",
        "releaseLocalControl",
        "removeWorldObject",
        "reset",
        "returnAgentToCity",
        "save",
        "selectProfile",
        "setAgentInteriorAction",
        "setAgentsVisible",
        "setClockSpeed",
        "setZoom",
        "startUpgrade",
        "togglePossession",
        "traversePortal",
        "unlockSector",
        "usePortal",
      ].sort(),
    );
    expect(Object.keys(runtime.actions)).not.toContain("sendTask");
    expect(Object.keys(runtime.actions)).not.toContain("postToHermes");
    expect(runtime.getController()).toBeInstanceOf(Object);
    expect(runtime.development).toBeNull();
    await runtime.stop();
  });

  it("exposes an explicit typed controller getter and opt-in QA actions", () => {
    const runtime = new AlphaRuntime({
      storage: new MemoryStorage(),
      bridge: new FakeBridge(),
      autoLoad: false,
      animationFrame: new FakeAnimationFrames(),
      developmentMode: true,
    });
    const controller = runtime.getController();
    const before = controller.getSnapshot().game.economy.balance;
    expect(runtime.isDevelopmentMode()).toBe(true);
    expect(runtime.development?.addLumenes(500).ok).toBe(true);
    expect(controller.getSnapshot().game.economy.balance).toBe(before + 500);
    expect(runtime.development?.advanceMinutes(60).ok).toBe(true);
    expect(controller.getSnapshot().game.clock.totalMinutes).toBe(60);
  });
});
