import {
  MemoryStorage,
  type AgentLocalAction,
  type AgentLocalOrderError,
  type BuildingPlacementPlan,
  type CardinalDirection,
  type ConstructionAccelerationMode,
  type ConstructionAccelerationQuote,
  type GameMutationError,
  type GameStateV1,
  type GridPoint,
  type KeyValueStorage,
  type NavigationError,
  type Result,
  type SaveError,
  type ScreenRelativeMovementKey,
  type WorldObjectMutationError,
} from "../core";
import type { BridgeVisualSnapshot } from "../integrations";
import {
  GameController,
  type BridgePort,
  type ControllerSnapshot,
  type DevelopmentActionError,
  type GameControllerOptions,
  type LocalControlReleaseReason,
  type LocalControlSnapshot,
  type SpatialControlActionError,
  type SpatialControlInteractionRequestV1,
  type SpatialControlPortalRequestV1,
  type SpatialControlSceneConfigV1,
  type SpatialPortalTransitionTargetV1,
} from "./GameController";

const STORAGE_PREFIX = "syka-world.";
const MAX_SAVE_CHARACTERS = 2_000_000;

export interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class SafeLocalStorageError extends Error {
  readonly code = "LOCAL_STORAGE_UNAVAILABLE";

  constructor() {
    super("No se pudo acceder al guardado local.");
    this.name = "SafeLocalStorageError";
  }
}

/** Browser storage boundary with a narrow namespace and privacy-safe errors. */
export function createSafeLocalStorageAdapter(
  storage?: LocalStorageLike,
  fallback: KeyValueStorage = new MemoryStorage(),
): KeyValueStorage {
  const target = storage ?? resolveBrowserLocalStorage() ?? fallback;
  return {
    getItem(key): string | null {
      assertSafeStorageKey(key);
      try {
        const value = target.getItem(key);
        if (value !== null && value.length > MAX_SAVE_CHARACTERS) throw new SafeLocalStorageError();
        return value;
      } catch (error) {
        if (error instanceof SafeLocalStorageError) throw error;
        throw new SafeLocalStorageError();
      }
    },
    setItem(key, value): void {
      assertSafeStorageKey(key);
      if (value.length > MAX_SAVE_CHARACTERS) throw new SafeLocalStorageError();
      try {
        target.setItem(key, value);
      } catch {
        throw new SafeLocalStorageError();
      }
    },
    removeItem(key): void {
      assertSafeStorageKey(key);
      try {
        target.removeItem(key);
      } catch {
        throw new SafeLocalStorageError();
      }
    },
  };
}

export interface AnimationFramePort {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface AlphaRuntimeOptions {
  readonly mode?: "showcase" | "progressive";
  readonly storage?: KeyValueStorage;
  readonly bridge?: BridgePort;
  readonly autoLoad?: boolean;
  readonly autosaveIntervalMs?: number | null;
  readonly saveOnStop?: boolean;
  readonly fixedStepMs?: number;
  readonly maximumFrameDeltaMs?: number;
  readonly animationFrame?: AnimationFramePort;
  readonly onAutosaveError?: (error: SaveError) => void;
  readonly controllerFactory?: (options: GameControllerOptions) => GameController;
  /** Exposes local-only QA helpers. It is false in every normal game launch. */
  readonly developmentMode?: boolean;
}

export type AlphaRuntimeListener = (snapshot: ControllerSnapshot) => void;
export type RuntimeMutationResult = Result<GameStateV1, GameMutationError | NavigationError>;

export interface AlphaRuntimeActions {
  readonly setClockSpeed: (speed: 0 | 1 | 2 | 4) => void;
  readonly placeBuilding: (
    definitionId: string,
    origin: GridPoint,
    orientation?: CardinalDirection,
  ) => Result<GameStateV1, GameMutationError>;
  readonly planBuildingPlacement: (
    definitionId: string,
    origin: GridPoint,
    orientation?: CardinalDirection,
  ) => Result<BuildingPlacementPlan, GameMutationError>;
  readonly placeWorldObject: (
    definitionId: string,
    hostTile: GridPoint,
    orientation?: CardinalDirection,
  ) => Result<GameStateV1, WorldObjectMutationError>;
  readonly removeWorldObject: (instanceId: string) => Result<GameStateV1, WorldObjectMutationError>;
  readonly getConstructionAccelerationQuote: (
    buildingId: string,
    mode: ConstructionAccelerationMode,
  ) => Result<ConstructionAccelerationQuote, GameMutationError>;
  readonly accelerateConstruction: (
    buildingId: string,
    mode: ConstructionAccelerationMode,
  ) => Result<GameStateV1, GameMutationError>;
  readonly issueGoToCafeOrder: (
    profileId: GameStateV1["agents"][number]["profileId"],
    action?: AgentLocalAction,
  ) => Result<GameStateV1, AgentLocalOrderError>;
  readonly setAgentInteriorAction: (
    profileId: GameStateV1["agents"][number]["profileId"],
    action: AgentLocalAction,
    preferredAnchorId?: string,
  ) => Result<GameStateV1, AgentLocalOrderError>;
  readonly returnAgentToCity: (
    profileId: GameStateV1["agents"][number]["profileId"],
  ) => Result<GameStateV1, AgentLocalOrderError>;
  readonly startUpgrade: (buildingId: string, upgradeId: string) => Result<GameStateV1, GameMutationError>;
  readonly unlockSector: (sectorId: string) => Result<GameStateV1, GameMutationError>;
  readonly installFurniture: (
    buildingId: string,
    slotId: string,
    furnitureId: string,
  ) => Result<GameStateV1, GameMutationError>;
  readonly previewFurniturePlacement: (
    buildingId: string,
    slotId: string,
    furnitureId: string,
  ) => { readonly ok: boolean; readonly message: string };
  readonly enterInterior: (buildingId: string) => Result<GameStateV1, NavigationError>;
  readonly exitInterior: () => Result<GameStateV1, NavigationError>;
  readonly panCamera: (delta: GridPoint) => void;
  readonly setZoom: (zoom: 1 | 1.5 | 2) => void;
  readonly setAgentsVisible: (visible: boolean) => void;
  readonly configureSpatialScene: (
    config: SpatialControlSceneConfigV1,
  ) => Result<LocalControlSnapshot, SpatialControlActionError>;
  readonly clearSpatialScene: (
    sceneId?: string,
  ) => Result<LocalControlSnapshot, SpatialControlActionError>;
  readonly selectProfile: (profileId: GameStateV1["agents"][number]["profileId"]) =>
    Result<LocalControlSnapshot, SpatialControlActionError>;
  readonly clearProfileSelection: () => Result<LocalControlSnapshot, SpatialControlActionError>;
  readonly togglePossession: (profileId?: GameStateV1["agents"][number]["profileId"]) =>
    Result<LocalControlSnapshot, SpatialControlActionError>;
  readonly releaseLocalControl: (
    reason?: LocalControlReleaseReason,
  ) => Result<LocalControlSnapshot, SpatialControlActionError>;
  readonly clickMove: (sceneId: string, cell: GridPoint) => Result<LocalControlSnapshot, SpatialControlActionError>;
  readonly movePossessed: (key: ScreenRelativeMovementKey) => Result<LocalControlSnapshot, SpatialControlActionError>;
  readonly interact: () => Result<SpatialControlInteractionRequestV1, SpatialControlActionError>;
  readonly finishInteraction: (actorId: string) => Result<LocalControlSnapshot, SpatialControlActionError>;
  readonly usePortal: () => Result<SpatialControlPortalRequestV1, SpatialControlActionError>;
  readonly traversePortal: (
    request: SpatialControlPortalRequestV1,
    target: SpatialPortalTransitionTargetV1,
  ) => Result<LocalControlSnapshot, SpatialControlActionError>;
  readonly clearControlNotice: () => void;
  readonly save: () => Result<void, SaveError>;
  readonly load: () => Result<GameStateV1, SaveError>;
  readonly reset: (mode: "showcase" | "progressive") => Result<void, SaveError>;
}

export interface AlphaDevelopmentActions {
  readonly advanceMinutes: (minutes: number) => Result<GameStateV1, DevelopmentActionError>;
  readonly finishConstruction: () => Result<GameStateV1, DevelopmentActionError>;
  readonly addLumenes: (amount: number) => Result<GameStateV1, DevelopmentActionError>;
}

/**
 * Browser lifecycle for the deterministic GameController. It owns only local
 * frame timing and local save storage; Hermes remains behind the read-only
 * BridgePort exposed by GameController.
 */
export class AlphaRuntime {
  readonly actions: AlphaRuntimeActions;
  readonly development: AlphaDevelopmentActions | null;

  private readonly controller: GameController;
  private readonly animationFrame: AnimationFramePort;
  private readonly autosaveIntervalMs: number | null;
  private readonly saveOnStop: boolean;
  private readonly fixedStepMs: number;
  private readonly maximumFrameDeltaMs: number;
  private readonly onAutosaveError: ((error: SaveError) => void) | undefined;
  private readonly listeners = new Set<AlphaRuntimeListener>();

  private unsubscribeController: (() => void) | null = null;
  private frameHandle: number | null = null;
  private lastFrameTimestamp: number | null = null;
  private fixedStepAccumulator = 0;
  private autosaveElapsed = 0;
  private dirty = false;
  private trackChanges = false;
  private started = false;

  constructor(options: AlphaRuntimeOptions = {}) {
    const storage = options.storage ?? createSafeLocalStorageAdapter();
    const controllerFactory = options.controllerFactory ?? ((controllerOptions) => new GameController(controllerOptions));
    this.controller = controllerFactory({
      mode: options.mode ?? "showcase",
      storage,
      ...(options.bridge ? { bridge: options.bridge } : {}),
      ...(options.autoLoad !== undefined ? { autoLoad: options.autoLoad } : {}),
      ...(options.developmentMode !== undefined ? { developmentMode: options.developmentMode } : {}),
    });
    this.animationFrame = options.animationFrame ?? browserAnimationFrame();
    this.autosaveIntervalMs = normalizeAutosaveInterval(options.autosaveIntervalMs);
    this.saveOnStop = options.saveOnStop ?? true;
    this.fixedStepMs = normalizeFixedStep(options.fixedStepMs ?? 62.5);
    this.maximumFrameDeltaMs = clampFinite(options.maximumFrameDeltaMs ?? 250, this.fixedStepMs, 2_000);
    this.onAutosaveError = options.onAutosaveError;

    this.actions = {
      setClockSpeed: (speed) => this.controller.setClockSpeed(speed),
      placeBuilding: (definitionId, origin, orientation = "north") =>
        this.controller.placeBuilding(definitionId, origin, orientation),
      planBuildingPlacement: (definitionId, origin, orientation = "north") =>
        this.controller.planBuildingPlacement(definitionId, origin, orientation),
      placeWorldObject: (definitionId, hostTile, orientation = "north") =>
        this.controller.placeWorldObject(definitionId, hostTile, orientation),
      removeWorldObject: (instanceId) => this.controller.removeWorldObject(instanceId),
      getConstructionAccelerationQuote: (buildingId, mode) =>
        this.controller.getConstructionAccelerationQuote(buildingId, mode),
      accelerateConstruction: (buildingId, mode) => this.controller.accelerateConstruction(buildingId, mode),
      issueGoToCafeOrder: (profileId, action = "serve-coffee") =>
        this.controller.issueGoToCafeOrder(profileId, action),
      setAgentInteriorAction: (profileId, action, preferredAnchorId) =>
        this.controller.setAgentInteriorAction(profileId, action, preferredAnchorId),
      returnAgentToCity: (profileId) => this.controller.returnAgentToCity(profileId),
      startUpgrade: (buildingId, upgradeId) => this.controller.startUpgrade(buildingId, upgradeId),
      unlockSector: (sectorId) => this.controller.unlockSector(sectorId),
      installFurniture: (buildingId, slotId, furnitureId) =>
        this.controller.installFurniture(buildingId, slotId, furnitureId),
      previewFurniturePlacement: (buildingId, slotId, furnitureId) =>
        this.controller.previewFurniturePlacement(buildingId, slotId, furnitureId),
      enterInterior: (buildingId) => this.controller.enterInterior(buildingId),
      exitInterior: () => this.controller.exitInterior(),
      panCamera: (delta) => this.controller.panCamera(delta),
      setZoom: (zoom) => this.controller.setZoom(zoom),
      setAgentsVisible: (visible) => this.controller.setAgentsVisible(visible),
      configureSpatialScene: (config) => this.controller.configureSpatialScene(config),
      clearSpatialScene: (sceneId) => this.controller.clearSpatialScene(sceneId),
      selectProfile: (profileId) => this.controller.selectProfile(profileId),
      clearProfileSelection: () => this.controller.clearProfileSelection(),
      togglePossession: (profileId) => this.controller.togglePossession(profileId),
      releaseLocalControl: (reason) => this.controller.releaseLocalControl(reason),
      clickMove: (sceneId, cell) => this.controller.clickMove(sceneId, cell),
      movePossessed: (key) => this.controller.movePossessed(key),
      interact: () => this.controller.interact(),
      finishInteraction: (actorId) => this.controller.finishInteraction(actorId),
      usePortal: () => this.controller.usePortal(),
      traversePortal: (request, target) => this.controller.traversePortal(request, target),
      clearControlNotice: () => this.controller.clearControlNotice(),
      save: () => this.saveNow(),
      load: () => this.loadNow(),
      reset: (mode) => this.controller.reset(mode),
    };
    this.development = this.controller.isDevelopmentMode()
      ? {
          advanceMinutes: (minutes) => this.controller.advanceDevelopmentTime(minutes),
          finishConstruction: () => this.controller.finishDevelopmentConstruction(),
          addLumenes: (amount) => this.controller.grantDevelopmentLumenes(amount),
        }
      : null;
  }

  getSnapshot(): ControllerSnapshot {
    return this.controller.getSnapshot();
  }

  /** Explicit typed boundary used by the Phaser bootstrap and scene adapters. */
  getController(): GameController {
    return this.controller;
  }

  isDevelopmentMode(): boolean {
    return this.development !== null;
  }

  isRunning(): boolean {
    return this.started;
  }

  subscribe(listener: AlphaRuntimeListener, emitCurrent = true): () => void {
    this.listeners.add(listener);
    if (emitCurrent) listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<ControllerSnapshot> {
    if (this.started) return this.getSnapshot();
    this.started = true;
    this.unsubscribeController = this.controller.subscribe((game, bridge) => {
      if (this.trackChanges) this.dirty = true;
      this.emit({ game, bridge, bridgeMode: bridge.mode, control: this.controller.getControlSnapshot() });
    }, false);

    try {
      const snapshot = await this.controller.start();
      this.trackChanges = true;
      this.dirty = false;
      this.scheduleFrame();
      this.emit(snapshot);
      return snapshot;
    } catch (error) {
      this.started = false;
      this.unsubscribeController?.();
      this.unsubscribeController = null;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    this.trackChanges = false;
    if (this.frameHandle !== null) this.animationFrame.cancel(this.frameHandle);
    this.frameHandle = null;
    this.lastFrameTimestamp = null;
    this.fixedStepAccumulator = 0;
    if (this.saveOnStop && this.dirty) this.saveNow();
    this.unsubscribeController?.();
    this.unsubscribeController = null;
    await this.controller.stop();
  }

  private scheduleFrame(): void {
    if (!this.started || this.frameHandle !== null) return;
    this.frameHandle = this.animationFrame.request((timestamp) => this.onFrame(timestamp));
  }

  private onFrame(timestamp: number): void {
    this.frameHandle = null;
    if (!this.started) return;
    if (this.lastFrameTimestamp === null) {
      this.lastFrameTimestamp = timestamp;
      this.scheduleFrame();
      return;
    }

    const rawDelta = Number.isFinite(timestamp) ? timestamp - this.lastFrameTimestamp : 0;
    this.lastFrameTimestamp = timestamp;
    const delta = Math.max(0, Math.min(this.maximumFrameDeltaMs, rawDelta));
    this.fixedStepAccumulator += delta;
    this.autosaveElapsed += delta;

    while (this.fixedStepAccumulator + Number.EPSILON >= this.fixedStepMs) {
      this.controller.tick(this.fixedStepMs);
      this.fixedStepAccumulator -= this.fixedStepMs;
    }
    if (this.autosaveIntervalMs !== null && this.autosaveElapsed >= this.autosaveIntervalMs) {
      this.autosaveElapsed %= this.autosaveIntervalMs;
      if (this.dirty) this.saveNow(true);
    }
    this.scheduleFrame();
  }

  private saveNow(isAutosave = false): Result<void, SaveError> {
    const result = this.controller.save();
    if (result.ok) this.dirty = false;
    else if (isAutosave) this.onAutosaveError?.(result.error);
    return result;
  }

  private loadNow(): Result<GameStateV1, SaveError> {
    const result = this.controller.load();
    if (result.ok) this.dirty = false;
    return result;
  }

  private emit(snapshot: ControllerSnapshot): void {
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // A UI subscriber cannot interrupt simulation or local autosave.
      }
    }
  }
}

function resolveBrowserLocalStorage(): LocalStorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function assertSafeStorageKey(key: string): void {
  if (!key.startsWith(STORAGE_PREFIX) || key.length > 160 || /[\u0000-\u001f\u007f]/.test(key)) {
    throw new SafeLocalStorageError();
  }
}

function browserAnimationFrame(): AnimationFramePort {
  if (typeof window === "undefined") {
    return {
      request: () => {
        throw new Error("Animation frames require a browser or an injected port.");
      },
      cancel: () => undefined,
    };
  }
  return {
    request: (callback) => window.requestAnimationFrame(callback),
    cancel: (handle) => window.cancelAnimationFrame(handle),
  };
}

function normalizeAutosaveInterval(value: number | null | undefined): number | null {
  if (value === null || value === 0) return null;
  return clampFinite(value ?? 30_000, 1_000, 10 * 60_000);
}

/** Binary fractions of one second avoid long-session floating point drift. */
function normalizeFixedStep(value: number): number {
  const allowed = [31.25, 62.5, 125, 250] as const;
  const requested = clampFinite(value, allowed[0], allowed.at(-1) ?? 250);
  return allowed.reduce((best, candidate) =>
    Math.abs(candidate - requested) < Math.abs(best - requested) ? candidate : best,
  );
}

function clampFinite(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, value));
}

export type { ControllerSnapshot, BridgeVisualSnapshot };
