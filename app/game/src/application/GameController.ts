import {
  ALPHA_CATALOG,
  accelerateConstruction,
  advanceManualActorStep,
  advanceSimulation,
  applyBridgeSignal,
  compileSpatialScene,
  createManualControlState,
  createProgressiveGameState,
  createShowcaseGameState,
  deserializeGame,
  enterBuildingInterior,
  exitBuildingInterior,
  grantLocalReward,
  getConstructionAccelerationQuote,
  installOptionalFurniture,
  isSpatialCellWalkable,
  finishContextInteraction as finishContextInteractionCore,
  issueSelectedClickMove,
  loadGameFromStorage,
  panCityCamera,
  planBuildingPlacement as createBuildingPlacementPlan,
  placeBuilding,
  placeWorldObject as placeWorldObjectCore,
  removeWorldObject as removeWorldObjectCore,
  issueGoToCafeOrder as issueGoToCafeOrderCore,
  setAgentInteriorAction as setAgentInteriorActionCore,
  returnAgentToCity as returnAgentToCityCore,
  removeGameFromStorage,
  possessSelectedActor,
  releasePossessedActor,
  reconcileManualControlState,
  requestContextInteraction,
  requestPortalUse,
  requestPossessedStep,
  resumeAgentAutonomyFromCurrentPosition,
  saveGameToStorage,
  setAgentsVisible,
  setCameraZoom,
  selectManualActor,
  startBuildingUpgrade,
  unlockSector,
  type CardinalDirection,
  type AgentLocalAction,
  type AgentLocalOrderError,
  type BuildingPlacementPlan,
  type ConstructionAccelerationMode,
  type ConstructionAccelerationQuote,
  type GameMutationError,
  type GameStateV1,
  type GridPoint,
  type KeyValueStorage,
  type NavigationError,
  type ManualControlError,
  type ManualControlStateV1,
  type ManualSpatialActorSeedV1,
  type ProfileId,
  type Result,
  type SaveError,
  type ScreenRelativeMovementKey,
  type SpatialInteractionResolutionV1,
  type SpatialPortalResolutionV1,
  type SpatialSceneDefinitionV1,
  type SpatialSceneIndexV1,
  type SpatialSceneValidationError,
  type WorldObjectMutationError,
} from "../core";
import {
  BridgeClient,
  reconcileCoreWithBridgeSnapshot,
  toCoreBridgeSignalBatch,
  type BridgeConnectionMode,
  type BridgeEventListener,
  type BridgeVisualSnapshot,
} from "../integrations";

export const DEFAULT_SAVE_KEY = "syka-world.alpha-v1.save";

export type GameControllerListener = (state: GameStateV1, bridge: BridgeVisualSnapshot) => void;

export interface BridgePort {
  start(): Promise<BridgeVisualSnapshot>;
  stop(): Promise<void>;
  getState(): BridgeVisualSnapshot;
  subscribeEvents(listener: BridgeEventListener): () => void;
  subscribe?(listener: (snapshot: BridgeVisualSnapshot) => void, emitCurrent?: boolean): () => void;
}

export interface GameControllerOptions {
  readonly mode: "showcase" | "progressive";
  readonly storage: KeyValueStorage;
  readonly bridge?: BridgePort;
  readonly saveKey?: string;
  readonly autoLoad?: boolean;
  /** Local-only QA tools. Disabled unless the bootstrap opts in explicitly. */
  readonly developmentMode?: boolean;
}

export interface DevelopmentActionError {
  readonly code: "DEVELOPMENT_DISABLED" | "INVALID_DEVELOPMENT_VALUE" | "NOTHING_TO_FINISH";
  readonly message: string;
}

export interface ControllerSnapshot {
  readonly game: GameStateV1;
  readonly bridge: BridgeVisualSnapshot;
  readonly bridgeMode: BridgeConnectionMode;
  readonly control: LocalControlSnapshot;
}

export type SpatialControlBindingV1 =
  | { readonly kind: "city" }
  | { readonly kind: "interior"; readonly buildingId: string };

export interface SpatialControlSceneConfigV1 {
  readonly scene: SpatialSceneDefinitionV1;
  readonly binding: SpatialControlBindingV1;
  readonly actors: readonly ManualSpatialActorSeedV1[];
}

export interface LocalControlActorSnapshot {
  readonly actorId: string;
  readonly profileId?: ProfileId;
  readonly sceneId: string;
  readonly cell: GridPoint;
  readonly facing: CardinalDirection;
  readonly path: readonly GridPoint[];
  readonly destination?: GridPoint;
  readonly intent: ManualControlStateV1["actors"][number]["intent"];
  readonly possessed: boolean;
}

export type LocalControlNoticeCode =
  | "CONTROL_RELEASED"
  | "CLICK_ORDER_COMPLETED"
  | "HERMES_TAKEN_OVER"
  | "MOVE_BLOCKED"
  | "CONTROL_ERROR";

export interface LocalControlNotice {
  readonly code: LocalControlNoticeCode;
  readonly tone: "info" | "warning" | "error";
  readonly message: string;
  readonly revision: number;
}

export interface LocalControlSnapshot {
  readonly configured: boolean;
  readonly sceneId?: string;
  readonly binding?: SpatialControlBindingV1;
  readonly selectedProfileId?: ProfileId;
  readonly possessedProfileId?: ProfileId;
  readonly actors: readonly LocalControlActorSnapshot[];
  readonly notice?: LocalControlNotice;
  readonly revision: number;
}

export interface SpatialControlConfigurationError {
  readonly code: "SCENE_NOT_CONFIGURED" | "SCENE_MISMATCH" | "PROFILE_NOT_IN_SCENE" | "NO_LOCAL_CONTROL";
  readonly message: string;
}

export type SpatialControlActionError =
  | SpatialControlConfigurationError
  | SpatialSceneValidationError
  | ManualControlError
  | NavigationError;

export interface SpatialControlInteractionRequestV1 {
  readonly sceneId: string;
  readonly actorId: string;
  readonly profileId?: ProfileId;
  readonly interaction: SpatialInteractionResolutionV1;
}

export interface SpatialControlPortalRequestV1 {
  readonly sceneId: string;
  readonly actorId: string;
  readonly profileId?: ProfileId;
  readonly portal: SpatialPortalResolutionV1;
}

export interface SpatialPortalTransitionTargetV1 {
  readonly binding: SpatialControlBindingV1;
  readonly cell: GridPoint;
  readonly anchorId?: string;
}

export type LocalControlReleaseReason = "manual" | "click-timeout" | "scene-change" | "hermes" | "load" | "reset";

export type ControllerMutationError =
  | GameMutationError
  | NavigationError
  | SaveError
  | WorldObjectMutationError
  | AgentLocalOrderError;

/**
 * Single application boundary between renderer/UI and the deterministic core.
 * It never exposes Hermes payloads and cannot send bridge commands.
 */
export class GameController {
  private state: GameStateV1;
  private readonly storage: KeyValueStorage;
  private readonly bridge: BridgePort;
  private readonly saveKey: string;
  private readonly developmentMode: boolean;
  private readonly listeners = new Set<GameControllerListener>();
  private unsubscribeBridge: (() => void) | undefined;
  private unsubscribeBridgeSnapshot: (() => void) | undefined;
  private started = false;
  private minuteRemainder = 0;
  private manualMovementRemainderMs = 0;
  private spatialRuntime: {
    readonly signature: string;
    readonly scene: SpatialSceneIndexV1;
    readonly binding: SpatialControlBindingV1;
    state: ManualControlStateV1;
  } | undefined;
  private lastSpatialConfigurationFailure: {
    readonly signature: string;
    readonly error: SpatialControlActionError;
  } | undefined;
  private readonly controlledProfiles = new Set<ProfileId>();
  /** -1 means the click route is still travelling; non-negative values are its remaining arrival hold. */
  private readonly clickOrderHoldMs = new Map<ProfileId, number>();
  /** Released interior actors finish by walking to the authored exit before autonomy resumes outside. */
  private readonly interiorAutoExitProfiles = new Set<ProfileId>();
  private readonly interiorAutoExitGraceMs = new Map<ProfileId, number>();
  private controlNotice: LocalControlNotice | undefined;
  private controlRevision = 0;

  constructor(options: GameControllerOptions) {
    this.storage = options.storage;
    this.bridge = options.bridge ?? new BridgeClient({ baseUrl: "/bridge" });
    this.saveKey = options.saveKey ?? DEFAULT_SAVE_KEY;
    this.developmentMode = options.developmentMode ?? false;
    this.state = options.mode === "showcase" ? createShowcaseGameState() : createProgressiveGameState();
    if (options.autoLoad ?? true) {
      const loaded = loadGameFromStorage(this.storage, this.saveKey);
      if (loaded.ok) this.state = loaded.value.save.game;
    }
  }

  getSnapshot(): ControllerSnapshot {
    const bridge = this.bridge.getState();
    return { game: this.state, bridge, bridgeMode: bridge.mode, control: this.getControlSnapshot() };
  }

  getControlSnapshot(): LocalControlSnapshot {
    const runtime = this.spatialRuntime;
    if (!runtime) {
      return {
        configured: false,
        actors: [],
        revision: this.controlRevision,
        ...(this.controlNotice ? { notice: this.controlNotice } : {}),
      };
    }
    const selectedProfileId = this.profileForActor(runtime.state.selectedActorId);
    const possessedProfileId = this.profileForActor(runtime.state.possessedActorId);
    return {
      configured: true,
      sceneId: runtime.scene.definition.id,
      binding: runtime.binding,
      ...(selectedProfileId ? { selectedProfileId } : {}),
      ...(possessedProfileId ? { possessedProfileId } : {}),
      actors: runtime.state.actors.map((actor): LocalControlActorSnapshot => {
        const profileId = this.profileForActor(actor.actorId);
        return {
          actorId: actor.actorId,
          ...(profileId ? { profileId } : {}),
          sceneId: actor.sceneId,
          cell: actor.cell,
          facing: actor.facing,
          path: actor.path,
          ...(actor.destination ? { destination: actor.destination } : {}),
          intent: actor.intent,
          possessed: runtime.state.possessedActorId === actor.actorId,
        };
      }),
      revision: this.controlRevision,
      ...(this.controlNotice ? { notice: this.controlNotice } : {}),
    };
  }

  isDevelopmentMode(): boolean {
    return this.developmentMode;
  }

  subscribe(listener: GameControllerListener, emitCurrent = true): () => void {
    this.listeners.add(listener);
    if (emitCurrent) listener(this.state, this.bridge.getState());
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<ControllerSnapshot> {
    if (!this.started) {
      this.started = true;
      this.unsubscribeBridgeSnapshot = this.bridge.subscribe?.((snapshot) => {
        this.state = reconcileCoreWithBridgeSnapshot(this.state, snapshot);
        this.releaseForHermesSnapshot(snapshot);
        this.emit(snapshot);
      }, false);
      this.unsubscribeBridge = this.bridge.subscribeEvents((events, snapshot) => {
        // Reconcile the transport snapshot first, then let the ordered event
        // batch win. Some bridge doubles and reconnect windows can expose a
        // snapshot that trails the event cursor by one update.
        this.state = reconcileCoreWithBridgeSnapshot(this.state, snapshot);
        const signals = toCoreBridgeSignalBatch(events);
        for (const signal of signals) {
          this.state = applyBridgeSignal(this.state, signal);
          if (!signal.kind.startsWith("presence.")) this.yieldProfileControl(signal.profileId, "hermes", false);
        }
        this.releaseForHermesSnapshot(snapshot);
        this.emit(snapshot);
      });
      const bridge = await this.bridge.start();
      this.state = reconcileCoreWithBridgeSnapshot(this.state, bridge);
      this.releaseForHermesSnapshot(bridge);
      this.emit(bridge);
    }
    return this.getSnapshot();
  }

  async stop(): Promise<void> {
    this.unsubscribeBridge?.();
    this.unsubscribeBridge = undefined;
    this.unsubscribeBridgeSnapshot?.();
    this.unsubscribeBridgeSnapshot = undefined;
    this.started = false;
    await this.bridge.stop();
  }

  /** One real second advances one simulated minute at speed 1. */
  tick(realMilliseconds: number): void {
    if (!Number.isFinite(realMilliseconds) || realMilliseconds <= 0) return;
    const controlChanged = this.advanceManualMovement(realMilliseconds);
    const autoExitChanged = this.advanceInteriorAutoExits(realMilliseconds);
    const clickHoldChanged = this.advanceClickOrderHolds(realMilliseconds);
    let simulationChanged = false;
    if (this.state.clock.speed !== 0) {
      this.minuteRemainder += (realMilliseconds / 1000) * this.state.clock.speed;
      const wholeMinutes = Math.floor(this.minuteRemainder);
      if (wholeMinutes >= 1) {
        this.minuteRemainder -= wholeMinutes;
        this.state = this.advanceSimulationPreservingLocalControl(wholeMinutes);
        simulationChanged = true;
      }
    }
    if (controlChanged || autoExitChanged || clickHoldChanged || simulationChanged) this.emit();
  }

  step(minutes: number): void {
    this.state = this.advanceSimulationPreservingLocalControl(minutes);
    this.emit();
  }

  advanceDevelopmentTime(minutes: number): Result<GameStateV1, DevelopmentActionError> {
    if (!this.developmentMode) return developmentDisabled();
    if (!Number.isSafeInteger(minutes) || minutes <= 0 || minutes > 10_080) {
      return {
        ok: false,
        error: { code: "INVALID_DEVELOPMENT_VALUE", message: "Development minutes are outside the safe range." },
      };
    }
    this.state = this.advanceSimulationPreservingLocalControl(minutes);
    this.emit();
    return { ok: true, value: this.state };
  }

  finishDevelopmentConstruction(): Result<GameStateV1, DevelopmentActionError> {
    if (!this.developmentMode) return developmentDisabled();
    const remaining = this.state.buildings.reduce((maximum, building) => {
      const construction = building.status === "complete"
        ? 0
        : Math.max(0, building.construction.totalMinutes - building.construction.elapsedMinutes);
      const upgrade = building.activeUpgrade
        ? Math.max(0, building.activeUpgrade.totalMinutes - building.activeUpgrade.elapsedMinutes)
        : 0;
      return Math.max(maximum, construction, upgrade);
    }, 0);
    if (remaining <= 0) {
      return {
        ok: false,
        error: { code: "NOTHING_TO_FINISH", message: "No construction is currently active." },
      };
    }
    this.state = this.advanceSimulationPreservingLocalControl(remaining);
    this.emit();
    return { ok: true, value: this.state };
  }

  grantDevelopmentLumenes(amount: number): Result<GameStateV1, DevelopmentActionError> {
    if (!this.developmentMode) return developmentDisabled();
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000) {
      return {
        ok: false,
        error: { code: "INVALID_DEVELOPMENT_VALUE", message: "Development currency is outside the safe range." },
      };
    }
    this.state = { ...this.state, economy: grantLocalReward(this.state.economy, amount).economy };
    this.emit();
    return { ok: true, value: this.state };
  }

  setClockSpeed(speed: 0 | 1 | 2 | 4): void {
    this.state = { ...this.state, clock: { ...this.state.clock, speed } };
    this.emit();
  }

  placeBuilding(
    definitionId: string,
    origin: GridPoint,
    orientation: CardinalDirection = "north",
  ): Result<GameStateV1, GameMutationError> {
    return this.applyMutation(placeBuilding(this.state, { definitionId, origin, orientation }));
  }

  planBuildingPlacement(
    definitionId: string,
    origin: GridPoint,
    orientation: CardinalDirection = "north",
  ): Result<BuildingPlacementPlan, GameMutationError> {
    return createBuildingPlacementPlan(this.state, { definitionId, origin, orientation });
  }

  placeWorldObject(
    definitionId: string,
    hostTile: GridPoint,
    orientation: CardinalDirection = "north",
  ): Result<GameStateV1, WorldObjectMutationError> {
    return this.applyMutation(placeWorldObjectCore(this.state, { definitionId, hostTile, orientation }));
  }

  removeWorldObject(instanceId: string): Result<GameStateV1, WorldObjectMutationError> {
    return this.applyMutation(removeWorldObjectCore(this.state, instanceId));
  }

  getConstructionAccelerationQuote(
    buildingId: string,
    mode: ConstructionAccelerationMode,
  ): Result<ConstructionAccelerationQuote, GameMutationError> {
    return getConstructionAccelerationQuote(this.state, buildingId, mode);
  }

  accelerateConstruction(
    buildingId: string,
    mode: ConstructionAccelerationMode,
  ): Result<GameStateV1, GameMutationError> {
    return this.applyMutation(accelerateConstruction(this.state, buildingId, mode));
  }

  issueGoToCafeOrder(
    profileId: GameStateV1["agents"][number]["profileId"],
    action: AgentLocalAction = "serve-coffee",
  ): Result<GameStateV1, AgentLocalOrderError> {
    return this.applyMutation(issueGoToCafeOrderCore(this.state, profileId, action));
  }

  setAgentInteriorAction(
    profileId: GameStateV1["agents"][number]["profileId"],
    action: AgentLocalAction,
    preferredAnchorId?: string,
  ): Result<GameStateV1, AgentLocalOrderError> {
    return this.applyMutation(setAgentInteriorActionCore(this.state, profileId, action, preferredAnchorId));
  }

  returnAgentToCity(
    profileId: GameStateV1["agents"][number]["profileId"],
  ): Result<GameStateV1, AgentLocalOrderError> {
    return this.applyMutation(returnAgentToCityCore(this.state, profileId));
  }

  startUpgrade(buildingId: string, upgradeId: string): Result<GameStateV1, GameMutationError> {
    return this.applyMutation(startBuildingUpgrade(this.state, buildingId, upgradeId));
  }

  unlockSector(sectorId: string): Result<GameStateV1, GameMutationError> {
    return this.applyMutation(unlockSector(this.state, sectorId));
  }

  installFurniture(
    buildingId: string,
    slotId: string,
    furnitureId: string,
  ): Result<GameStateV1, GameMutationError> {
    return this.applyMutation(installOptionalFurniture(this.state, buildingId, slotId, furnitureId));
  }

  /**
   * Placement editor slice: validates whether a furniture item can be installed
   * at a given slot. The v1 slice checks that the interior exists and is
   * associated with a completed building. The full spatial validation (blocked
   * overlaps, surface rules) is performed by the UI layer using
   * `validateSpatialPlacement` from the core spatial contract, which keeps the
   * application layer free of presentation dependencies.
   */
  previewFurniturePlacement(
    buildingId: string,
    _slotId: string,
    _furnitureId: string,
  ): { readonly ok: boolean; readonly message: string } {
    const interior = this.state.interiors.find((i) => i.buildingId === buildingId);
    if (!interior) {
      return { ok: false, message: "No interior found for this building." };
    }
    const building = this.state.buildings.find((b) => b.id === buildingId);
    if (!building || building.status !== "complete") {
      return { ok: false, message: "The building must be complete before placing furniture." };
    }
    return {
      ok: true,
      message: "Placement pre-validated: interior and building are ready.",
    };
  }

  enterInterior(buildingId: string): Result<GameStateV1, NavigationError> {
    return this.applyMutation(enterBuildingInterior(this.state, buildingId));
  }

  exitInterior(): Result<GameStateV1, NavigationError> {
    return this.applyMutation(exitBuildingInterior(this.state));
  }

  panCamera(delta: GridPoint): void {
    this.state = panCityCamera(this.state, delta);
    this.emit();
  }

  setZoom(zoom: 1 | 1.5 | 2): void {
    this.state = setCameraZoom(this.state, zoom);
    this.emit();
  }

  setAgentsVisible(visible: boolean): void {
    this.state = setAgentsVisible(this.state, visible);
    this.emit();
  }

  configureSpatialScene(
    config: SpatialControlSceneConfigV1,
  ): Result<LocalControlSnapshot, SpatialControlActionError> {
    const signature = spatialConfigSignature(config);
    if (this.spatialRuntime?.signature === signature) {
      return { ok: true, value: this.getControlSnapshot() };
    }
    if (this.lastSpatialConfigurationFailure?.signature === signature) {
      return { ok: false, error: this.lastSpatialConfigurationFailure.error };
    }
    const compiled = compileSpatialScene(config.scene);
    if (!compiled.ok) return this.failSpatialConfiguration(signature, compiled.error);

    const previous = this.spatialRuntime;
    const previousSelected = previous?.state.selectedActorId;
    const previousPossessed = previous?.state.possessedActorId;
    const actorIds = new Set(config.actors.map((actor) => actor.actorId));
    const seeds = config.actors.map((seed): ManualSpatialActorSeedV1 => {
      const profileId = this.profileForActor(seed.actorId);
      const persisted = profileId ? this.persistedCellForBinding(profileId, config.binding) : undefined;
      const preferred = persisted ?? seed.cell;
      return {
        ...seed,
        sceneId: config.scene.id,
        cell: isSpatialCellWalkable(compiled.value, preferred) ? preferred : seed.cell,
      };
    });
    const sameScene = previous?.scene.definition.id === config.scene.id;
    const emptyState: ManualControlStateV1 = { actors: [], occupancy: { reservations: [] } };
    const reconciled = reconcileManualControlState(
      compiled.value,
      sameScene && previous ? previous.state : emptyState,
      seeds,
      { preserveActorIds: sameScene ? [...this.controlledProfiles] : [] },
    );
    if (!reconciled.ok) return this.failSpatialConfiguration(signature, reconciled.error);
    let manualState = reconciled.value;
    if (!sameScene && previousSelected && actorIds.has(previousSelected)) {
      const selected = selectManualActor(manualState, previousSelected);
      if (selected.ok) manualState = selected.value;
    }
    if (!sameScene && previousPossessed && actorIds.has(previousPossessed)) {
      if (manualState.selectedActorId !== previousPossessed) {
        const selected = selectManualActor(manualState, previousPossessed);
        if (selected.ok) manualState = selected.value;
      }
      const possessed = possessSelectedActor(manualState);
      if (possessed.ok) manualState = possessed.value;
    }
    for (const profileId of [...this.controlledProfiles]) {
      if (!actorIds.has(profileId)) this.yieldProfileControl(profileId, "scene-change", true);
    }
    this.spatialRuntime = {
      signature,
      scene: compiled.value,
      binding: config.binding,
      state: manualState,
    };
    this.lastSpatialConfigurationFailure = undefined;
    this.manualMovementRemainderMs = 0;
    this.syncManualActorsToGame();
    this.bumpControlRevision();
    this.emit();
    return { ok: true, value: this.getControlSnapshot() };
  }

  clearSpatialScene(sceneId?: string): Result<LocalControlSnapshot, SpatialControlActionError> {
    if (!this.spatialRuntime) {
      this.lastSpatialConfigurationFailure = undefined;
      return { ok: true, value: this.getControlSnapshot() };
    }
    if (sceneId && this.spatialRuntime.scene.definition.id !== sceneId) {
      return this.failControl({ code: "SCENE_MISMATCH", message: `Spatial scene ${sceneId} is not active.` });
    }
    for (const profileId of [...this.controlledProfiles]) this.yieldProfileControl(profileId, "scene-change", true);
    this.spatialRuntime = undefined;
    this.lastSpatialConfigurationFailure = undefined;
    this.manualMovementRemainderMs = 0;
    this.bumpControlRevision();
    this.emit();
    return { ok: true, value: this.getControlSnapshot() };
  }

  selectProfile(profileId: ProfileId): Result<LocalControlSnapshot, SpatialControlActionError> {
    const runtime = this.spatialRuntime;
    if (!runtime) return this.failControl(sceneNotConfigured());
    const previousProfile = this.profileForActor(runtime.state.selectedActorId);
    if (previousProfile && previousProfile !== profileId && this.controlledProfiles.has(previousProfile)) {
      this.yieldProfileControl(previousProfile, "manual", true);
    }
    const selected = selectManualActor(runtime.state, profileId);
    if (!selected.ok) {
      return this.failControl({ code: "PROFILE_NOT_IN_SCENE", message: `El perfil ${profileId} no está en esta escena.` });
    }
    runtime.state = selected.value;
    this.controlNotice = undefined;
    this.bumpControlRevision();
    this.emit();
    return { ok: true, value: this.getControlSnapshot() };
  }

  clearProfileSelection(): Result<LocalControlSnapshot, SpatialControlActionError> {
    const runtime = this.spatialRuntime;
    if (!runtime) return { ok: true, value: this.getControlSnapshot() };
    const selectedProfile = this.profileForActor(runtime.state.selectedActorId);
    if (selectedProfile && this.controlledProfiles.has(selectedProfile)) {
      this.yieldProfileControl(selectedProfile, "manual", true);
    }
    this.rebuildManualState();
    this.controlNotice = undefined;
    this.bumpControlRevision();
    this.emit();
    return { ok: true, value: this.getControlSnapshot() };
  }

  togglePossession(profileId?: ProfileId): Result<LocalControlSnapshot, SpatialControlActionError> {
    const runtime = this.spatialRuntime;
    if (!runtime) return this.failControl(sceneNotConfigured());
    if (runtime.state.possessedActorId) return this.releaseLocalControl("manual");
    let manualState = runtime.state;
    if (profileId) {
      const selected = selectManualActor(manualState, profileId);
      if (!selected.ok) {
        return this.failControl({ code: "PROFILE_NOT_IN_SCENE", message: `El perfil ${profileId} no está en esta escena.` });
      }
      manualState = selected.value;
    }
    const possessed = possessSelectedActor(manualState);
    if (!possessed.ok) return this.failControl(possessed.error);
    runtime.state = possessed.value;
    const controlled = this.profileForActor(runtime.state.possessedActorId);
    if (controlled) {
      this.controlledProfiles.add(controlled);
      this.clickOrderHoldMs.delete(controlled);
      this.interiorAutoExitProfiles.delete(controlled);
      this.interiorAutoExitGraceMs.delete(controlled);
    }
    this.controlNotice = undefined;
    this.syncManualActorsToGame();
    this.bumpControlRevision();
    this.emit();
    return { ok: true, value: this.getControlSnapshot() };
  }

  releaseLocalControl(
    reason: LocalControlReleaseReason = "manual",
  ): Result<LocalControlSnapshot, SpatialControlActionError> {
    const runtime = this.spatialRuntime;
    if (!runtime) return this.failControl(sceneNotConfigured());
    const actorId = runtime.state.possessedActorId ?? runtime.state.selectedActorId;
    const profileId = this.profileForActor(actorId);
    if (!profileId || !this.controlledProfiles.has(profileId)) {
      return this.failControl({ code: "NO_LOCAL_CONTROL", message: "No hay un perfil bajo control local." });
    }
    if (runtime.state.possessedActorId) {
      const released = releasePossessedActor(runtime.state);
      if (!released.ok) return this.failControl(released.error);
      runtime.state = released.value;
    }
    if (reason !== "hermes" && this.beginInteriorAutoExit(profileId)) {
      this.bumpControlRevision();
      this.emit();
      return { ok: true, value: this.getControlSnapshot() };
    }
    this.yieldProfileControl(profileId, reason, reason !== "hermes");
    this.rebuildManualState(actorId);
    this.bumpControlRevision();
    this.emit();
    return { ok: true, value: this.getControlSnapshot() };
  }

  clickMove(sceneId: string, cell: GridPoint): Result<LocalControlSnapshot, SpatialControlActionError> {
    const runtime = this.requireSpatialScene(sceneId);
    if (!runtime.ok) return this.failControl(runtime.error);
    const moved = issueSelectedClickMove(runtime.value.scene, runtime.value.state, cell);
    if (!moved.ok) return this.failControl(moved.error);
    runtime.value.state = moved.value;
    const profileId = this.profileForActor(moved.value.selectedActorId);
    if (profileId) {
      this.controlledProfiles.add(profileId);
      this.clickOrderHoldMs.set(profileId, -1);
      this.interiorAutoExitProfiles.delete(profileId);
      this.interiorAutoExitGraceMs.delete(profileId);
    }
    this.controlNotice = undefined;
    this.syncManualActorsToGame();
    this.bumpControlRevision();
    this.emit();
    return { ok: true, value: this.getControlSnapshot() };
  }

  movePossessed(key: ScreenRelativeMovementKey): Result<LocalControlSnapshot, SpatialControlActionError> {
    const runtime = this.spatialRuntime;
    if (!runtime) return this.failControl(sceneNotConfigured());
    const moved = requestPossessedStep(runtime.scene, runtime.state, key);
    if (!moved.ok) return this.failControl(moved.error);
    runtime.state = moved.value;
    const profileId = this.profileForActor(moved.value.possessedActorId);
    if (profileId) {
      this.controlledProfiles.add(profileId);
      this.clickOrderHoldMs.delete(profileId);
      this.interiorAutoExitProfiles.delete(profileId);
      this.interiorAutoExitGraceMs.delete(profileId);
    }
    this.controlNotice = undefined;
    this.syncManualActorsToGame();
    this.bumpControlRevision();
    this.emit();
    return { ok: true, value: this.getControlSnapshot() };
  }

  interact(): Result<SpatialControlInteractionRequestV1, SpatialControlActionError> {
    const runtime = this.spatialRuntime;
    if (!runtime) return this.failControl(sceneNotConfigured());
    const actorId = runtime.state.possessedActorId ?? runtime.state.selectedActorId;
    const requested = requestContextInteraction(runtime.scene, runtime.state);
    if (!requested.ok) return this.failControl(requested.error);
    runtime.state = requested.value.state;
    const profileId = this.profileForActor(actorId);
    if (profileId) {
      this.controlledProfiles.add(profileId);
      this.clickOrderHoldMs.set(profileId, -1);
      this.interiorAutoExitProfiles.delete(profileId);
      this.interiorAutoExitGraceMs.delete(profileId);
    }
    this.controlNotice = undefined;
    this.syncManualActorsToGame();
    this.bumpControlRevision();
    this.emit();
    return {
      ok: true,
      value: {
        sceneId: runtime.scene.definition.id,
        actorId: actorId!,
        ...(profileId ? { profileId } : {}),
        interaction: requested.value.interaction,
      },
    };
  }

  finishInteraction(actorId: string): Result<LocalControlSnapshot, SpatialControlActionError> {
    const runtime = this.spatialRuntime;
    if (!runtime) return this.failControl(sceneNotConfigured());
    const finished = finishContextInteractionCore(runtime.scene, runtime.state, actorId);
    if (!finished.ok) return this.failControl(finished.error);
    runtime.state = finished.value;
    const profileId = this.profileForActor(actorId);
    if (profileId && runtime.state.possessedActorId !== actorId) this.clickOrderHoldMs.set(profileId, -1);
    this.syncManualActorsToGame();
    this.bumpControlRevision();
    this.emit();
    return { ok: true, value: this.getControlSnapshot() };
  }

  usePortal(): Result<SpatialControlPortalRequestV1, SpatialControlActionError> {
    const runtime = this.spatialRuntime;
    if (!runtime) return this.failControl(sceneNotConfigured());
    const requested = requestPortalUse(runtime.scene, runtime.state);
    if (!requested.ok) return this.failControl(requested.error);
    const profileId = this.profileForActor(requested.value.actorId);
    return {
      ok: true,
      value: {
        sceneId: runtime.scene.definition.id,
        actorId: requested.value.actorId,
        ...(profileId ? { profileId } : {}),
        portal: requested.value.portal,
      },
    };
  }

  traversePortal(
    request: SpatialControlPortalRequestV1,
    target: SpatialPortalTransitionTargetV1,
  ): Result<LocalControlSnapshot, SpatialControlActionError> {
    const runtime = this.requireSpatialScene(request.sceneId);
    if (!runtime.ok) return this.failControl(runtime.error);
    const fresh = requestPortalUse(runtime.value.scene, runtime.value.state);
    if (
      !fresh.ok ||
      fresh.value.actorId !== request.actorId ||
      fresh.value.portal.portalId !== request.portal.portalId ||
      fresh.value.portal.target.sceneId !== request.portal.target.sceneId
    ) {
      return this.failControl({ code: "SCENE_MISMATCH", message: "El portal cambió antes de poder cruzarlo." });
    }
    const profileId = this.profileForActor(request.actorId);
    if (!profileId) {
      return this.failControl({ code: "PROFILE_NOT_IN_SCENE", message: "Sólo un perfil controlable puede cruzar este portal." });
    }
    if (!this.isValidPortalTarget(target)) {
      return this.failControl({ code: "SCENE_MISMATCH", message: "El destino del portal no es válido en la partida actual." });
    }
    const navigation = target.binding.kind === "city"
      ? this.state.camera.scene === "interior"
        ? exitBuildingInterior(this.state)
        : { ok: true as const, value: this.state }
      : this.state.camera.scene === "interior" && this.state.camera.interiorBuildingId === target.binding.buildingId
        ? { ok: true as const, value: this.state }
        : enterBuildingInterior(this.state, target.binding.buildingId);
    if (!navigation.ok) return this.failControl(navigation.error);
    const navigatedState = navigation.value;
    this.state = {
      ...navigatedState,
      agents: navigatedState.agents.map((agent) => {
        if (agent.profileId !== profileId) return agent;
        const { localOrder: _localOrder, ...base } = agent;
        if (target.binding.kind === "city") {
          return {
            ...base,
            position: target.cell,
            location: { kind: "exterior", tile: target.cell },
            destination: target.cell,
            destinationBuildingId: "",
            path: [target.cell],
          };
        }
        return {
          ...base,
          location: {
            kind: "interior",
            buildingId: target.binding.buildingId,
            anchorId: target.anchorId ?? "entry",
            tile: target.cell,
          },
          destination: agent.position,
          destinationBuildingId: target.binding.buildingId,
          path: [agent.position],
        };
      }),
    };
    this.controlledProfiles.add(profileId);
    this.interiorAutoExitProfiles.delete(profileId);
    this.interiorAutoExitGraceMs.delete(profileId);
    if (runtime.value.state.possessedActorId !== request.actorId) this.clickOrderHoldMs.set(profileId, -1);
    this.controlNotice = undefined;
    this.bumpControlRevision();
    this.emit();
    return { ok: true, value: this.getControlSnapshot() };
  }

  clearControlNotice(): void {
    if (!this.controlNotice) return;
    this.controlNotice = undefined;
    this.bumpControlRevision();
    this.emit();
  }

  save(): Result<void, SaveError> {
    return saveGameToStorage(this.storage, this.saveKey, this.state);
  }

  load(): Result<GameStateV1, SaveError> {
    const loaded = loadGameFromStorage(this.storage, this.saveKey);
    if (!loaded.ok) return loaded;
    this.state = loaded.value.save.game;
    this.resetLocalControl("load");
    this.emit();
    return { ok: true, value: this.state };
  }

  importSave(serialized: string): Result<GameStateV1, SaveError> {
    const loaded = deserializeGame(serialized);
    if (!loaded.ok) return loaded;
    this.state = loaded.value.save.game;
    this.resetLocalControl("load");
    this.emit();
    return { ok: true, value: this.state };
  }

  reset(mode: "showcase" | "progressive"): Result<void, SaveError> {
    const removed = removeGameFromStorage(this.storage, this.saveKey);
    if (!removed.ok) return removed;
    this.state = mode === "showcase" ? createShowcaseGameState() : createProgressiveGameState();
    this.minuteRemainder = 0;
    this.resetLocalControl("reset");
    this.emit();
    return { ok: true, value: undefined };
  }

  private requireSpatialScene(
    sceneId: string,
  ): Result<NonNullable<GameController["spatialRuntime"]>, SpatialControlConfigurationError> {
    if (!this.spatialRuntime) return { ok: false, error: sceneNotConfigured() };
    if (this.spatialRuntime.scene.definition.id !== sceneId) {
      return { ok: false, error: { code: "SCENE_MISMATCH", message: `Spatial scene ${sceneId} is not active.` } };
    }
    return { ok: true, value: this.spatialRuntime };
  }

  private profileForActor(actorId: string | undefined): ProfileId | undefined {
    if (!actorId) return undefined;
    return this.state.agents.find((agent) => agent.profileId === actorId)?.profileId;
  }

  private persistedCellForBinding(profileId: ProfileId, binding: SpatialControlBindingV1): GridPoint | undefined {
    const agent = this.state.agents.find((candidate) => candidate.profileId === profileId);
    if (!agent) return undefined;
    if (binding.kind === "city") return agent.location.kind === "interior" ? undefined : agent.position;
    return agent.location.kind === "interior" && agent.location.buildingId === binding.buildingId
      ? agent.location.tile
      : undefined;
  }

  private syncManualActorsToGame(): void {
    const runtime = this.spatialRuntime;
    if (!runtime || this.controlledProfiles.size === 0) return;
    this.state = {
      ...this.state,
      agents: this.state.agents.map((agent) => {
        if (!this.controlledProfiles.has(agent.profileId)) return agent;
        const actor = runtime.state.actors.find((candidate) => candidate.actorId === agent.profileId);
        if (!actor) return agent;
        const { localOrder: _localOrder, ...base } = agent;
        if (runtime.binding.kind === "city") {
          return {
            ...base,
            position: actor.cell,
            location: actor.path.length > 1
              ? { kind: "transit", tile: actor.cell, destinationBuildingId: "" }
              : { kind: "exterior", tile: actor.cell },
            destination: actor.destination ?? actor.cell,
            destinationBuildingId: "",
            path: actor.path,
          };
        }
        const previousAnchor = agent.location.kind === "interior" && agent.location.buildingId === runtime.binding.buildingId
          ? agent.location.anchorId
          : undefined;
        const previousAction = agent.location.kind === "interior" && agent.location.buildingId === runtime.binding.buildingId
          ? agent.location.action
          : undefined;
        return {
          ...base,
          location: {
            kind: "interior",
            buildingId: runtime.binding.buildingId,
            anchorId: actor.pendingInteraction?.anchorId ?? previousAnchor ?? "free-walk",
            tile: actor.cell,
            ...(previousAction ? { action: previousAction } : {}),
          },
          destination: agent.position,
          destinationBuildingId: runtime.binding.buildingId,
          path: [agent.position],
        };
      }),
    };
  }

  private advanceManualMovement(realMilliseconds: number): boolean {
    const runtime = this.spatialRuntime;
    if (!runtime) return false;
    this.manualMovementRemainderMs += realMilliseconds;
    let changed = false;
    let iterations = 0;
    while (this.manualMovementRemainderMs + Number.EPSILON >= MANUAL_MOVEMENT_STEP_MS && iterations < 16) {
      const moving = runtime.state.actors.filter((actor) => actor.path.length > 1);
      if (moving.length === 0) {
        this.manualMovementRemainderMs = 0;
        break;
      }
      this.manualMovementRemainderMs -= MANUAL_MOVEMENT_STEP_MS;
      iterations += 1;
      for (const actor of moving) {
        const advanced = advanceManualActorStep(runtime.scene, runtime.state, actor.actorId);
        if (!advanced.ok) {
          const profileId = this.profileForActor(actor.actorId);
          if (profileId) this.yieldProfileControl(profileId, "manual", true);
          this.setControlNotice("MOVE_BLOCKED", "warning", "El camino cambió y el control local se liberó.");
          this.manualMovementRemainderMs = 0;
          return true;
        }
        runtime.state = advanced.value;
        changed = true;
      }
    }
    if (changed) {
      this.syncManualActorsToGame();
      this.bumpControlRevision();
    }
    return changed;
  }

  private advanceClickOrderHolds(realMilliseconds: number): boolean {
    const runtime = this.spatialRuntime;
    if (!runtime || this.clickOrderHoldMs.size === 0) return false;
    let changed = false;
    for (const [profileId, remaining] of [...this.clickOrderHoldMs]) {
      if (runtime.state.possessedActorId === profileId) {
        this.clickOrderHoldMs.delete(profileId);
        continue;
      }
      const actor = runtime.state.actors.find((candidate) => candidate.actorId === profileId);
      if (!actor || !this.controlledProfiles.has(profileId)) {
        this.clickOrderHoldMs.delete(profileId);
        continue;
      }
      if (actor.path.length > 1 || actor.pendingInteraction) {
        if (remaining !== -1) this.clickOrderHoldMs.set(profileId, -1);
        continue;
      }
      if (remaining < 0) {
        this.clickOrderHoldMs.set(profileId, CLICK_ORDER_ARRIVAL_HOLD_MS);
        continue;
      }
      const next = remaining - realMilliseconds;
      if (next > 0) {
        this.clickOrderHoldMs.set(profileId, next);
        continue;
      }
      this.clickOrderHoldMs.delete(profileId);
      changed = this.yieldProfileControl(profileId, "click-timeout", true) || changed;
    }
    return changed;
  }

  private beginInteriorAutoExit(profileId: ProfileId): boolean {
    const runtime = this.spatialRuntime;
    if (!runtime || runtime.binding.kind !== "interior") return false;
    const actor = runtime.state.actors.find((candidate) => candidate.actorId === profileId);
    if (!actor) return false;
    const exitAnchor = runtime.scene.definition.exitAnchorIds
      .map((anchorId) => runtime.scene.anchorsById.get(anchorId))
      .find((anchor) => anchor !== undefined);
    if (!exitAnchor) return false;
    let state = runtime.state;
    if (state.selectedActorId !== actor.actorId) {
      const selected = selectManualActor(state, actor.actorId);
      if (!selected.ok) return false;
      state = selected.value;
    }
    const routed = issueSelectedClickMove(runtime.scene, state, exitAnchor.cell);
    if (!routed.ok) return false;
    runtime.state = routed.value;
    this.controlledProfiles.add(profileId);
    this.interiorAutoExitProfiles.add(profileId);
    this.interiorAutoExitGraceMs.set(profileId, INTERIOR_AUTONOMY_EXIT_GRACE_MS);
    this.clickOrderHoldMs.delete(profileId);
    const name = this.state.agents.find((agent) => agent.profileId === profileId)?.name ?? profileId;
    this.setControlNotice("CONTROL_RELEASED", "info", `Control liberado; ${name} camina hacia la salida.`);
    this.syncManualActorsToGame();
    return true;
  }

  private advanceInteriorAutoExits(realMilliseconds: number): boolean {
    const runtime = this.spatialRuntime;
    if (!runtime || runtime.binding.kind !== "interior" || this.interiorAutoExitProfiles.size === 0) return false;
    const interiorBuildingId = runtime.binding.buildingId;
    for (const profileId of [...this.interiorAutoExitProfiles]) {
      const grace = this.interiorAutoExitGraceMs.get(profileId) ?? 0;
      if (grace > 0) {
        this.interiorAutoExitGraceMs.set(profileId, Math.max(0, grace - realMilliseconds));
        continue;
      }
      const actor = runtime.state.actors.find((candidate) => candidate.actorId === profileId);
      if (!actor || actor.path.length > 1) continue;
      let portalState = runtime.state;
      if (portalState.selectedActorId !== actor.actorId) {
        const selected = selectManualActor(portalState, actor.actorId);
        if (!selected.ok) continue;
        portalState = selected.value;
      }
      const portal = requestPortalUse(runtime.scene, portalState);
      if (!portal.ok || portal.value.actorId !== actor.actorId) continue;
      const building = this.state.buildings.find((candidate) => candidate.id === interiorBuildingId);
      if (!building) continue;
      const navigated = exitBuildingInterior(this.state);
      if (!navigated.ok) continue;
      this.state = {
        ...navigated.value,
        agents: navigated.value.agents.map((agent) => agent.profileId === profileId
          ? {
              ...agent,
              position: building.accessTile,
              location: { kind: "exterior" as const, tile: building.accessTile },
              destination: building.accessTile,
              destinationBuildingId: "",
              path: [building.accessTile],
            }
          : agent),
      };
      this.interiorAutoExitProfiles.delete(profileId);
      this.interiorAutoExitGraceMs.delete(profileId);
      this.controlledProfiles.delete(profileId);
      this.clickOrderHoldMs.delete(profileId);
      const resumed = resumeAgentAutonomyFromCurrentPosition(this.state, profileId);
      if (resumed.ok) this.state = resumed.value;
      this.setControlNotice("CONTROL_RELEASED", "info", "La rutina retomó desde la puerta, sin teletransporte.");
      this.bumpControlRevision();
      return true;
    }
    return false;
  }

  private advanceSimulationPreservingLocalControl(minutes: number): GameStateV1 {
    if (this.controlledProfiles.size === 0) return advanceSimulation(this.state, minutes, ALPHA_CATALOG);
    const held = new Map(
      this.state.agents
        .filter((agent) => this.controlledProfiles.has(agent.profileId))
        .map((agent) => [agent.profileId, agent] as const),
    );
    const advanced = advanceSimulation(this.state, minutes, ALPHA_CATALOG);
    return {
      ...advanced,
      agents: advanced.agents.map((agent) => {
        const local = held.get(agent.profileId);
        if (!local) return agent;
        const { localOrder: _advancedOrder, ...advancedWithoutOrder } = agent;
        return {
          ...advancedWithoutOrder,
          position: local.position,
          location: local.location,
          destination: local.destination,
          destinationBuildingId: local.destinationBuildingId,
          path: local.path,
        };
      }),
    };
  }

  private yieldProfileControl(profileId: ProfileId, reason: LocalControlReleaseReason, replan: boolean): boolean {
    const runtime = this.spatialRuntime;
    const possessed = runtime?.state.possessedActorId === profileId;
    if (!this.controlledProfiles.has(profileId) && !possessed) return false;
    this.controlledProfiles.delete(profileId);
    this.clickOrderHoldMs.delete(profileId);
    this.interiorAutoExitProfiles.delete(profileId);
    this.interiorAutoExitGraceMs.delete(profileId);
    if (replan) {
      const resumed = resumeAgentAutonomyFromCurrentPosition(this.state, profileId);
      if (resumed.ok) this.state = resumed.value;
    }
    const selected = runtime?.state.selectedActorId;
    this.rebuildManualState(selected);
    if (reason === "hermes") {
      const name = this.state.agents.find((agent) => agent.profileId === profileId)?.name ?? profileId;
      this.setControlNotice("HERMES_TAKEN_OVER", "info", `${name} volvió al control de Hermes por una actividad real.`);
    } else if (reason === "manual") {
      this.setControlNotice("CONTROL_RELEASED", "info", "Control local liberado; la rutina retomó desde la posición real.");
    } else if (reason === "click-timeout") {
      this.setControlNotice("CLICK_ORDER_COMPLETED", "info", "Destino alcanzado; la rutina retomó desde esa casilla.");
    }
    this.bumpControlRevision();
    return true;
  }

  private releaseForHermesSnapshot(snapshot: BridgeVisualSnapshot): void {
    if (snapshot.source !== "bridge") return;
    for (const agent of snapshot.agents) {
      if (
        this.controlledProfiles.has(agent.profileId) &&
        (agent.activeSessionCount > 0 || agent.status === "working" || agent.status === "waiting")
      ) {
        this.yieldProfileControl(agent.profileId, "hermes", false);
      }
    }
  }

  private rebuildManualState(selectedActorId?: string, possessedActorId?: string): void {
    const runtime = this.spatialRuntime;
    if (!runtime) return;
    const seeds: ManualSpatialActorSeedV1[] = runtime.state.actors.map((actor) => ({
      actorId: actor.actorId,
      sceneId: actor.sceneId,
      possessible: actor.possessible,
      cell: actor.cell,
      facing: actor.facing,
    }));
    const rebuilt = createManualControlState(runtime.scene, seeds);
    if (!rebuilt.ok) return;
    let state = rebuilt.value;
    if (selectedActorId) {
      const selected = selectManualActor(state, selectedActorId);
      if (selected.ok) state = selected.value;
    }
    if (possessedActorId) {
      if (state.selectedActorId !== possessedActorId) {
        const selected = selectManualActor(state, possessedActorId);
        if (selected.ok) state = selected.value;
      }
      const possessed = possessSelectedActor(state);
      if (possessed.ok) state = possessed.value;
    }
    runtime.state = state;
  }

  private isValidPortalTarget(target: SpatialPortalTransitionTargetV1): boolean {
    if (!Number.isSafeInteger(target.cell.x) || !Number.isSafeInteger(target.cell.y)) return false;
    if (target.binding.kind === "city") {
      return this.state.map.tiles.some((tile) =>
        tile.position.x === target.cell.x &&
        tile.position.y === target.cell.y &&
        tile.terrain === "road" &&
        !tile.buildingId,
      );
    }
    const buildingId = target.binding.buildingId;
    return this.state.buildings.some((building) =>
      building.id === buildingId && building.status === "complete",
    ) && this.state.interiors.some((interior) => interior.buildingId === buildingId);
  }

  private resetLocalControl(_reason: "load" | "reset"): void {
    this.spatialRuntime = undefined;
    this.lastSpatialConfigurationFailure = undefined;
    this.controlledProfiles.clear();
    this.clickOrderHoldMs.clear();
    this.interiorAutoExitProfiles.clear();
    this.interiorAutoExitGraceMs.clear();
    this.controlNotice = undefined;
    this.manualMovementRemainderMs = 0;
    this.bumpControlRevision();
  }

  private setControlNotice(
    code: LocalControlNoticeCode,
    tone: LocalControlNotice["tone"],
    message: string,
  ): void {
    this.bumpControlRevision();
    this.controlNotice = { code, tone, message, revision: this.controlRevision };
  }

  private bumpControlRevision(): void {
    this.controlRevision += 1;
  }

  private failControl<T>(error: SpatialControlActionError): Result<T, SpatialControlActionError> {
    this.setControlNotice("CONTROL_ERROR", "error", error.message);
    this.emit();
    return { ok: false, error };
  }

  private failSpatialConfiguration(
    signature: string,
    error: SpatialControlActionError,
  ): Result<LocalControlSnapshot, SpatialControlActionError> {
    this.lastSpatialConfigurationFailure = { signature, error };
    return this.failControl(error);
  }

  private applyMutation<E>(result: Result<GameStateV1, E>): Result<GameStateV1, E> {
    if (!result.ok) return result;
    this.state = result.value;
    this.emit();
    return result;
  }

  private emit(bridge = this.bridge.getState()): void {
    for (const listener of this.listeners) listener(this.state, bridge);
  }
}

const MANUAL_MOVEMENT_STEP_MS = 160;
/** Deterministic real-time pause after a click route reaches its destination. */
export const CLICK_ORDER_ARRIVAL_HOLD_MS = 3_000;
/** Gives the player a clear release state before an autonomous doorway transition may complete. */
export const INTERIOR_AUTONOMY_EXIT_GRACE_MS = 1_200;

function sceneNotConfigured(): SpatialControlConfigurationError {
  return { code: "SCENE_NOT_CONFIGURED", message: "La escena espacial todavía no está configurada." };
}

function spatialConfigSignature(config: SpatialControlSceneConfigV1): string {
  const binding = config.binding.kind === "city" ? "city" : `interior:${config.binding.buildingId}`;
  const actors = config.actors.map((actor) => actor.actorId).sort().join(",");
  return `${config.scene.id}@${config.scene.version}|${binding}|${actors}`;
}

function developmentDisabled(): Result<never, DevelopmentActionError> {
  return {
    ok: false,
    error: { code: "DEVELOPMENT_DISABLED", message: "Development actions require explicit opt-in." },
  };
}
