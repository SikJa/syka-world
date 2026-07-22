import Phaser from "phaser";
import {
  ALPHA_CATALOG,
  CAFE_NPC_IDS,
  getBuildingDefinition,
  getExteriorObjectDefinition,
  isAgentTraveling,
  SPATIAL_DEPTH_SUB_LAYER,
  validateWorldObjectPlacement,
  type AgentActivity,
  type AgentId,
  type AgentStateV1,
  type BuildingInstanceV1,
  type CafeNpcActivity,
  type CafeNpcId,
  type CardinalDirection,
  type GameStateV1,
  type GridPoint,
  type NpcStateV1,
  type WorldObjectInstanceV1,
} from "../../core";
import type { GameController } from "../../application/GameController";
import {
  AGENT_ACTIVITY_ORDER,
  AGENT_ID_ORDER,
  BUILDING_VISUAL_CALIBRATIONS,
  BUILDING_KIND_ORDER,
  CITY_ASSET_PATHS,
  CITY_TEXTURE_KEYS,
  ENVIRONMENT_CORRECTION_SOURCE_FRAMES,
  FALLBACK_BUILDING_SOURCE_FRAMES,
  GROUND_DECAL_SOURCE_FRAMES,
  LIGHT_FX_SOURCE_FRAMES,
  PROP_SOURCE_FRAMES,
  agentFrameName,
  correctionGroundFrame,
  normalizeBuildingOrientation,
  resolveBuildingVisual,
  resolveBuildingUpgradeComposition,
  resolveBuildingSpriteOffset,
  resolveConstructionVisual,
  type CityGroundDecalFrame,
  type CityLightFxFrame,
  type CityPropFrame,
  type EnvironmentCorrectionFrame,
} from "../city/assets";
import {
  createCityDecorPlan,
  type CityAmbientDetailKind,
  type CityAmbientDetailPlacement,
} from "../city/decor";
import {
  createCityBoundaryFencePlan,
  createCityGrassTexturePlan,
  createCityMapSlabGeometry,
  type CityGrassTextureTone,
} from "../city/base";
import {
  getCityLighting,
  resolvedLightAlpha,
  type CityLightFamily,
} from "../city/lighting";
import { createPlacementPreview, type CityPlacementPreview } from "../city/placement";
import {
  CITY_HALF_TILE_HEIGHT,
  CITY_HALF_TILE_WIDTH,
  CITY_TILE_HEIGHT,
  CITY_TILE_WIDTH,
  buildingBasePoint,
  cityDepth,
  cityEntityDepth,
  projectFootprint,
  projectGridCenter,
  projectGridTop,
  snapWorldPointToGrid,
} from "../city/projection";
import { selectTerrainVisual } from "../city/terrain";
import {
  createCitySpatialActorSeeds,
  createCitySpatialSceneDefinition,
} from "../city/spatialModel";
import {
  CITY_SCENE_EVENTS,
  type CityBuildToolState,
  type CitySceneErrorPayload,
  type CitySceneEventMap,
  type CitySceneSelection,
  type CityWorldObjectSelection,
} from "../city/types";

const CITY_SCENE_KEY = "city";
const ZOOM_LEVELS = [1, 1.5, 2] as const;
// Leaves a little more breathing room for the bottom inhabitant rail while
// keeping the fixed isometric world comfortably below the top HUD.
const CITY_CAMERA_VERTICAL_BIAS = 12;
const AGENT_VISUAL_PIXELS_PER_SECOND = 20;
const MAX_VISUAL_MOTION_DELTA_MS = 64;
const BUTTERFLY_FLAP_FRAME_MS = 110;
const BUTTERFLY_FLAP_SEQUENCE = [0, 1, 2, 1] as const;
const AGENT_WALK_FRAME_MS = 170;
const AGENT_ENTRY_DURATION_MS = 240;
const CITY_CAFE_NPC_TEXTURE_KEY = "cafe-npcs-atlas-v1";
const CITY_CAFE_NPC_ASSET_PATH = "/assets/generated/npc-v1/cafe-npcs-atlas-v1.png";
const CITY_CAFE_NPC_ACTIVITIES = ["idle", "walking", "working", "social"] as const satisfies readonly CafeNpcActivity[];
const CITY_NPC_VISUAL_PIXELS_PER_SECOND = 38;
const CITY_NPC_TRANSITION_DURATION_MS = 220;

export const CITY_CAFE_NPC_VISUAL_SPEC = Object.freeze({
  displayWidth: 22,
  displayHeight: 29,
  footOriginY: 156 / 160,
  shadowWidth: 11,
  shadowHeight: 3,
});

export const cityCafeNpcFrameName = (id: CafeNpcId, activity: CafeNpcActivity): string =>
  `cafe-npc-${id}-${activity}`;

export interface CityAgentVisualCalibration {
  /** Full atlas-cell draw size. Non-human silhouettes need a larger cell. */
  readonly displayWidth: number;
  readonly displayHeight: number;
  /** Bottom of the painted silhouette inside its 64 x 128 atlas cell. */
  readonly footOriginY: number;
  readonly shadowWidth: number;
  readonly shadowHeight: number;
  readonly markerY: number;
}

/**
 * The agent atlas has uniform cells but deliberately non-uniform silhouettes.
 * These measurements normalize apparent height while pinning every character's
 * painted feet/paws to the same isometric ground point.
 */
export const CITY_AGENT_VISUAL_CALIBRATIONS: Readonly<Record<AgentId, CityAgentVisualCalibration>> = {
  syka: {
    displayWidth: 18,
    displayHeight: 34,
    footOriginY: 0.97,
    shadowWidth: 11,
    shadowHeight: 3.4,
    markerY: -35,
  },
  elen: {
    displayWidth: 18,
    displayHeight: 34,
    footOriginY: 0.965,
    shadowWidth: 10,
    shadowHeight: 3.2,
    markerY: -35,
  },
  astrelis: {
    displayWidth: 30,
    displayHeight: 58,
    footOriginY: 0.89,
    shadowWidth: 14,
    shadowHeight: 3.8,
    markerY: -34,
  },
  zerny: {
    displayWidth: 24,
    displayHeight: 46,
    footOriginY: 0.975,
    shadowWidth: 13,
    shadowHeight: 3.6,
    markerY: -34,
  },
};

export interface CityAgentAnimationState {
  readonly frameActivity: AgentActivity;
  readonly liftY: number;
  readonly shadowScaleX: number;
  readonly shadowAlpha: number;
}

/** Pixel-step animation shared by all four exterior profiles. */
export const cityAgentAnimationState = (
  nowMilliseconds: number,
  moving: boolean,
  phase = 0,
): CityAgentAnimationState => {
  if (!moving) {
    return { frameActivity: "idle", liftY: 0, shadowScaleX: 1, shadowAlpha: 0.3 };
  }
  const now = Number.isFinite(nowMilliseconds) ? Math.max(0, nowMilliseconds) : 0;
  const normalizedPhase = Number.isFinite(phase) ? ((phase % 1) + 1) % 1 : 0;
  const step = Math.floor((now + normalizedPhase * AGENT_WALK_FRAME_MS * 4) / AGENT_WALK_FRAME_MS) % 4;
  const raised = step === 1 || step === 3;
  return {
    frameActivity: step < 2 ? "done" : "interrupted",
    liftY: raised ? 1 : 0,
    shadowScaleX: raised ? 0.88 : 1,
    shadowAlpha: raised ? 0.23 : 0.3,
  };
};

export interface CityAgentEntryState {
  readonly alpha: number;
  readonly scale: number;
  readonly liftY: number;
}

/** Short doorway transition after the avatar has visually reached its target. */
export const cityAgentEntryState = (progress: number): CityAgentEntryState => {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const eased = safeProgress * safeProgress * (3 - 2 * safeProgress);
  return {
    alpha: 1 - eased,
    scale: 1 - eased * 0.16,
    liftY: eased * 4,
  };
};

export interface CityAgentVisualStep {
  readonly x: number;
  readonly y: number;
  /** Fraction of the remaining segment consumed by this rendered frame. */
  readonly progress: number;
}

/**
 * Advances only the rendered avatar. The deterministic core remains on whole
 * grid tiles while this presentation helper crosses the isometric segment at
 * a bounded speed. Keeping the fractional coordinates is important: rounding
 * every frame can permanently stall an 8 px isometric Y delta.
 */
export const advanceCityAgentVisual = (
  current: Readonly<{ x: number; y: number }>,
  target: Readonly<{ x: number; y: number }>,
  deltaMilliseconds: number,
  clockSpeed: number,
  pixelsPerSecond = AGENT_VISUAL_PIXELS_PER_SECOND,
): CityAgentVisualStep => {
  const deltaX = target.x - current.x;
  const deltaY = target.y - current.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= 0.01) return { x: target.x, y: target.y, progress: 1 };

  const safeDelta = Number.isFinite(deltaMilliseconds)
    ? Math.max(0, Math.min(MAX_VISUAL_MOTION_DELTA_MS, deltaMilliseconds))
    : 0;
  // A paused simulation may still have one visual segment to finish.
  const speedMultiplier = Number.isFinite(clockSpeed) ? Math.max(1, clockSpeed) : 1;
  const safePixelsPerSecond = Number.isFinite(pixelsPerSecond) && pixelsPerSecond > 0
    ? pixelsPerSecond
    : AGENT_VISUAL_PIXELS_PER_SECOND;
  const maximumDistance = safePixelsPerSecond * speedMultiplier * (safeDelta / 1_000);
  if (maximumDistance <= 0) return { x: current.x, y: current.y, progress: 0 };
  if (maximumDistance >= distance) return { x: target.x, y: target.y, progress: 1 };

  const progress = maximumDistance / distance;
  return {
    x: current.x + deltaX * progress,
    y: current.y + deltaY * progress,
    progress,
  };
};

export interface CityButterflyVisualState {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly flapFrame: 0 | 1 | 2;
}

/** Stable, non-random micro-motion shared by every rendered butterfly. */
export const cityButterflyVisualState = (nowMilliseconds: number, phase: number): CityButterflyVisualState => {
  const now = Number.isFinite(nowMilliseconds) ? Math.max(0, nowMilliseconds) : 0;
  const normalizedPhase = Number.isFinite(phase) ? ((phase % 1) + 1) % 1 : 0;
  const seconds = now / 1_000;
  const phaseAngle = normalizedPhase * Math.PI * 2;
  const longDrift = seconds * 0.72 + phaseAngle;
  const offsetX = Math.sin(longDrift) * 5 + Math.sin(seconds * 0.19 + phaseAngle * 1.7) * 1.5;
  const offsetY = -4 + Math.cos(seconds * 0.58 + phaseAngle) * 2.1 + Math.sin(seconds * 0.27 + phaseAngle * 2.3) * 0.8;
  const flapIndex = Math.floor((now + normalizedPhase * BUTTERFLY_FLAP_FRAME_MS * 4) / BUTTERFLY_FLAP_FRAME_MS);
  const flapFrame = BUTTERFLY_FLAP_SEQUENCE[flapIndex % BUTTERFLY_FLAP_SEQUENCE.length] ?? 0;
  return { offsetX, offsetY, flapFrame };
};

export interface CitySceneOptions {
  readonly controller: GameController;
  readonly key?: string;
}

interface BuildingView {
  readonly sprite: Phaser.GameObjects.Image;
  readonly objects: readonly Phaser.GameObjects.GameObject[];
}

interface AgentView {
  readonly agentId: AgentId;
  readonly container: Phaser.GameObjects.Container;
  readonly shadow: Phaser.GameObjects.Graphics;
  readonly sprite: Phaser.GameObjects.Image;
  readonly activity: Phaser.GameObjects.Graphics;
  readonly phase: number;
  targetX: number;
  targetY: number;
  targetDepth: number;
  moving: boolean;
  facing: -1 | 1;
  activityFrame: AgentActivity;
  presenceAlpha: number;
  entering: boolean;
  entryProgress: number;
}

interface CityCafeNpcView {
  readonly npcId: CafeNpcId;
  readonly container: Phaser.GameObjects.Container;
  readonly shadow: Phaser.GameObjects.Graphics;
  readonly sprite: Phaser.GameObjects.Image;
  readonly phase: number;
  targetX: number;
  targetY: number;
  destinationX: number;
  destinationY: number;
  destinationDepth: number;
  targetDepth: number;
  facing: -1 | 1;
  appearingProgress: number;
  retiring: boolean;
  retiringProgress: number;
}

type TransitCafeNpc = NpcStateV1 & {
  readonly location: Extract<NpcStateV1["location"], { readonly kind: "transit" }>;
};

interface AmbientDetailView {
  readonly container: Phaser.GameObjects.Container;
  readonly kind: CityAmbientDetailKind;
  readonly baseX: number;
  readonly baseY: number;
  readonly phase: number;
  readonly butterflyFrames?: readonly Phaser.GameObjects.Graphics[];
}

interface LightView {
  readonly sprite: Phaser.GameObjects.Image;
  readonly family: CityLightFamily;
  readonly strength: number;
}

interface ImageSourceSize {
  readonly width: number;
  readonly height: number;
}

const multiplyTint = (base: number, ambient: number): number => {
  const baseRed = (base >> 16) & 0xff;
  const baseGreen = (base >> 8) & 0xff;
  const baseBlue = base & 0xff;
  const ambientRed = (ambient >> 16) & 0xff;
  const ambientGreen = (ambient >> 8) & 0xff;
  const ambientBlue = ambient & 0xff;
  return (
    (Math.round((baseRed * ambientRed) / 255) << 16) |
    (Math.round((baseGreen * ambientGreen) / 255) << 8) |
    Math.round((baseBlue * ambientBlue) / 255)
  );
};

const agentTint: Readonly<Record<AgentId, number>> = {
  syka: 0x7ea4ad,
  elen: 0xd6755b,
  astrelis: 0xe0b45f,
  zerny: 0x82a96f,
};

const activityTint: Readonly<Record<AgentActivity, number>> = {
  idle: 0x8ea88b,
  thinking: 0xffd87d,
  "using-tool": 0x79b7d1,
  waiting: 0xd8a95c,
  done: 0x9fd676,
  interrupted: 0xc7a67d,
  error: 0xdf7567,
  offline: 0x72808a,
};

export class CityScene extends Phaser.Scene {
  private readonly controller: GameController;
  private state: GameStateV1;
  private unsubscribeController: (() => void) | undefined;
  private readonly failedAssets = new Set<string>();
  private alphaBuildingsAvailable = false;
  private alphaConstructionAvailable = false;
  private alphaAgentsAvailable = false;
  private cafeNpcsAvailable = false;

  private readonly terrainObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly decorObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly exteriorGhostObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly ambientDetailViews: AmbientDetailView[] = [];
  private readonly buildingViews = new Map<string, BuildingView>();
  private readonly agentViews = new Map<AgentId, AgentView>();
  private readonly cafeNpcViews = new Map<CafeNpcId, CityCafeNpcView>();
  private readonly tintables = new Map<Phaser.GameObjects.Image, number>();
  private readonly streetLights: LightView[] = [];
  private readonly buildingLights: LightView[] = [];

  private selectionGraphics: Phaser.GameObjects.Graphics | undefined;
  private agentPathGraphics: Phaser.GameObjects.Graphics | undefined;
  private possessionGraphics: Phaser.GameObjects.Graphics | undefined;
  private placementGraphics: Phaser.GameObjects.Graphics | undefined;
  private nightOverlay: Phaser.GameObjects.Graphics | undefined;
  private selectedBuildingId: string | undefined;
  private selectedAgentId: AgentId | undefined;
  private selectedWorldObjectId: string | undefined;
  private hoveredBuildingId: string | undefined;
  private hoveredWorldObjectId: string | undefined;
  private buildTool: CityBuildToolState | undefined;
  private exteriorToolDefinitionId: string | undefined;
  private ghostOrigin: GridPoint | undefined;
  private lastPlacementPreview: CityPlacementPreview | undefined;

  private mapSignature = "";
  private buildingSignature = "";
  private cameraSignature = "";
  private lightingMinute = -1;
  private pointerCandidate = false;
  private dragging = false;
  private dragDistance = 0;
  private readonly dragStart = new Phaser.Math.Vector2();
  private readonly cameraStart = new Phaser.Math.Vector2();
  private lastBuildingClick?: { readonly id: string; readonly at: number };
  private spatialSignature = "";
  private spatialVersion = 0;

  constructor(options: CitySceneOptions) {
    super({ key: options.key ?? CITY_SCENE_KEY });
    this.controller = options.controller;
    this.state = options.controller.getSnapshot().game;
  }

  preload(): void {
    this.load.on("loaderror", (file: { readonly key?: string }) => {
      if (file.key) this.failedAssets.add(file.key);
    });
    this.load.spritesheet(CITY_TEXTURE_KEYS.terrain, CITY_ASSET_PATHS.terrain, {
      frameWidth: 320,
      frameHeight: 160,
    });
    this.load.image(CITY_TEXTURE_KEYS.props, CITY_ASSET_PATHS.props);
    this.load.image(CITY_TEXTURE_KEYS.groundDecals, CITY_ASSET_PATHS.groundDecals);
    this.load.image(CITY_TEXTURE_KEYS.environmentCorrections, CITY_ASSET_PATHS.environmentCorrections);
    this.load.image(CITY_TEXTURE_KEYS.lightFx, CITY_ASSET_PATHS.lightFx);
    this.load.image(CITY_TEXTURE_KEYS.fallbackHouse, CITY_ASSET_PATHS.fallbackHouse);
    this.load.image(CITY_TEXTURE_KEYS.fallbackCafe, CITY_ASSET_PATHS.fallbackCafe);
    this.load.image(CITY_TEXTURE_KEYS.alphaBuildings, CITY_ASSET_PATHS.alphaBuildings);
    this.load.image(CITY_TEXTURE_KEYS.alphaConstruction, CITY_ASSET_PATHS.alphaConstruction);
    this.load.image(CITY_TEXTURE_KEYS.alphaAgents, CITY_ASSET_PATHS.alphaAgents);
    this.load.image(CITY_CAFE_NPC_TEXTURE_KEY, CITY_CAFE_NPC_ASSET_PATH);
  }

  create(): void {
    this.cameras.main.setRoundPixels(true);
    this.input.setTopOnly(true);
    this.registerAssetFrames();
    this.createFallbackAgentTexture();
    this.configureCameraBounds();

    this.selectionGraphics = this.add.graphics().setDepth(850_000);
    this.agentPathGraphics = this.add.graphics().setDepth(849_000);
    this.possessionGraphics = this.add.graphics().setDepth(848_500);
    this.placementGraphics = this.add.graphics().setDepth(860_000);
    this.nightOverlay = this.add.graphics().setScrollFactor(0).setDepth(900_000);
    this.nightOverlay.fillStyle(0x163041, 1).fillRect(0, 0, this.scale.width, this.scale.height).setAlpha(0);

    this.createInputControls();
    this.unsubscribeController = this.controller.subscribe((state) => this.syncState(state));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.time.delayedCall(0, () => {
      for (const key of this.failedAssets) {
        this.emitError(
          "ASSET_FALLBACK",
          `No se pudo cargar ${key}; la escena usa el fallback raster declarado cuando está disponible.`,
        );
      }
    });
  }

  /** Reclaims the shared control context after waking from an interior scene. */
  activateSpatialControl(): boolean {
    const definition = createCitySpatialSceneDefinition(this.state);
    const actors = createCitySpatialActorSeeds(this.state);
    const signature = JSON.stringify([
      definition.walkableCells,
      definition.entities.map((item) => [item.id, item.origin, item.orientation, item.footprint]),
      definition.portals.map((item) => [item.id, item.enabled]),
      actors.map((actor) => [actor.actorId, actor.cell.x, actor.cell.y, actor.facing]),
    ]);
    if (signature !== this.spatialSignature) {
      this.spatialSignature = signature;
      this.spatialVersion += 1;
    }
    const result = this.controller.configureSpatialScene({
      scene: { ...definition, version: Math.max(1, this.spatialVersion) },
      binding: { kind: "city" },
      actors,
    });
    if (!result.ok) this.emitError(result.error.code, result.error.message);
    return result.ok;
  }

  update(_time: number, delta: number): void {
    for (const [agentId, view] of this.agentViews) {
      const motion = advanceCityAgentVisual(
        view.container,
        { x: view.targetX, y: view.targetY },
        delta,
        this.state.clock.speed,
      );
      const visuallyMoving = motion.progress < 1 || (!view.entering && view.moving);
      if (visuallyMoving) {
        const directionX = view.targetX - view.container.x;
        if (Math.abs(directionX) > 0.05) view.facing = directionX < 0 ? -1 : 1;
      }

      if (view.entering && motion.progress >= 1) {
        const safeDelta = Number.isFinite(delta) ? Math.max(0, Math.min(MAX_VISUAL_MOTION_DELTA_MS, delta)) : 0;
        view.entryProgress = Math.min(1, view.entryProgress + safeDelta / AGENT_ENTRY_DURATION_MS);
      }
      const entry = cityAgentEntryState(view.entering ? view.entryProgress : 0);
      view.container
        .setPosition(motion.x, motion.y)
        .setScale(entry.scale)
        .setAlpha(view.presenceAlpha * entry.alpha);
      view.container.setDepth(Phaser.Math.Linear(view.container.depth, view.targetDepth, motion.progress));

      const animation = cityAgentAnimationState(this.time.now, visuallyMoving, view.phase);
      if (this.alphaAgentsAvailable) {
        view.sprite.setFrame(agentFrameName(view.agentId, visuallyMoving ? animation.frameActivity : view.activityFrame));
      }
      view.sprite.setY(-animation.liftY - entry.liftY).setFlipX(view.facing < 0);
      view.activity.setY(-entry.liftY);
      view.shadow.setScale(animation.shadowScaleX, 1).setAlpha(animation.shadowAlpha);

      if (view.entering && view.entryProgress >= 1) {
        view.container.destroy(true);
        this.agentViews.delete(agentId);
      }
    }
    for (const [npcId, view] of this.cafeNpcViews) {
      const motion = advanceCityAgentVisual(
        view.container,
        { x: view.targetX, y: view.targetY },
        delta,
        this.state.clock.speed,
        CITY_NPC_VISUAL_PIXELS_PER_SECOND,
      );
      const directionX = view.targetX - view.container.x;
      if (Math.abs(directionX) > 0.05) view.facing = directionX < 0 ? -1 : 1;
      const safeDelta = Number.isFinite(delta) ? Math.max(0, Math.min(MAX_VISUAL_MOTION_DELTA_MS, delta)) : 0;
      view.appearingProgress = Math.min(
        1,
        view.appearingProgress + safeDelta / CITY_NPC_TRANSITION_DURATION_MS,
      );
      if (view.retiring && motion.progress >= 1) {
        view.retiringProgress = Math.min(
          1,
          view.retiringProgress + safeDelta / CITY_NPC_TRANSITION_DURATION_MS,
        );
      }
      const appearance = 1 - cityAgentEntryState(view.appearingProgress).alpha;
      const retirement = cityAgentEntryState(view.retiring ? view.retiringProgress : 0);
      const stepping = motion.progress < 1;
      const lift = stepping
        ? (Math.floor((this.time.now + view.phase * 680) / 170) % 2 === 0 ? 0 : 1)
        : 0;
      view.container
        .setPosition(motion.x, motion.y)
        .setDepth(Phaser.Math.Linear(view.container.depth, view.targetDepth, motion.progress))
        .setScale(retirement.scale)
        .setAlpha(appearance * retirement.alpha);
      view.sprite
        .setFrame(cityCafeNpcFrameName(view.npcId, stepping ? "walking" : "idle"))
        .setFlipX(view.facing < 0)
        .setY(-lift - retirement.liftY);
      view.shadow
        .setScale(stepping && lift > 0 ? 0.88 : 1, 1)
        .setAlpha(stepping && lift > 0 ? 0.2 : 0.28);

      if (view.retiring && view.retiringProgress >= 1) {
        view.container.destroy(true);
        this.cafeNpcViews.delete(npcId);
      }
    }
    this.updateAmbientDetails(this.time.now);
  }

  setBuildTool(definitionId: string | null, orientation: CardinalDirection = "north"): boolean {
    if (definitionId === null) {
      this.cancelBuild();
      return true;
    }
    const definition = getBuildingDefinition(definitionId, ALPHA_CATALOG);
    if (!definition) {
      this.emitError("UNKNOWN_BUILDING", `No existe el edificio ${definitionId}.`);
      return false;
    }
    if (!this.state.progression.unlockedBuildingIds.includes(definitionId)) {
      this.emitError("BUILDING_LOCKED", `${definition.name} todavía no está desbloqueado.`);
      return false;
    }
    this.buildTool = { definitionId, orientation: normalizeBuildingOrientation(definition.kind, orientation) };
    this.exteriorToolDefinitionId = undefined;
    this.selectedBuildingId = undefined;
    this.selectedAgentId = undefined;
    this.clearWorldObjectSelection();
    this.emitCityEvent(CITY_SCENE_EVENTS.selection, null);
    this.redrawSelection();
    this.redrawAgentPath();
    this.redrawPlacementGhost();
    return true;
  }

  setExteriorTool(definitionId: string | null): boolean {
    if (definitionId === null) {
      this.exteriorToolDefinitionId = undefined;
      if (!this.buildTool) {
        this.ghostOrigin = undefined;
        this.placementGraphics?.clear();
      }
      return true;
    }
    const definition = getExteriorObjectDefinition(definitionId, ALPHA_CATALOG);
    if (!definition) {
      this.emitError("UNKNOWN_WORLD_OBJECT", `No existe el objeto exterior ${definitionId}.`);
      return false;
    }
    this.buildTool = undefined;
    this.exteriorToolDefinitionId = definition.id;
    this.selectedBuildingId = undefined;
    this.selectedAgentId = undefined;
    this.clearWorldObjectSelection();
    this.emitCityEvent(CITY_SCENE_EVENTS.selection, null);
    this.lastPlacementPreview = undefined;
    this.emitCityEvent(CITY_SCENE_EVENTS.placementPreview, null);
    this.redrawSelection();
    this.redrawAgentPath();
    this.redrawPlacementGhost();
    return true;
  }

  cancelBuild(): void {
    this.buildTool = undefined;
    this.exteriorToolDefinitionId = undefined;
    this.ghostOrigin = undefined;
    this.lastPlacementPreview = undefined;
    this.placementGraphics?.clear();
    this.destroyObjects(this.exteriorGhostObjects);
    this.emitCityEvent(CITY_SCENE_EVENTS.placementPreview, null);
  }

  rotateBuild(): CardinalDirection {
    if (!this.buildTool) return "north";
    const definition = getBuildingDefinition(this.buildTool.definitionId, ALPHA_CATALOG);
    if (!definition) return this.buildTool.orientation;
    const supported = BUILDING_VISUAL_CALIBRATIONS[definition.kind].supportedOrientations;
    const current = supported.indexOf(this.buildTool.orientation);
    const orientation = supported[(Math.max(0, current) + 1) % supported.length] ?? "north";
    this.buildTool = { ...this.buildTool, orientation };
    this.redrawPlacementGhost();
    return orientation;
  }

  setBuildOrientation(orientation: CardinalDirection): boolean {
    if (!this.buildTool) {
      this.emitError("NO_BUILD_TOOL", "Select a building before changing its orientation.");
      return false;
    }
    const definition = getBuildingDefinition(this.buildTool.definitionId, ALPHA_CATALOG);
    if (!definition) return false;
    this.buildTool = {
      ...this.buildTool,
      orientation: normalizeBuildingOrientation(definition.kind, orientation),
    };
    this.redrawPlacementGhost();
    return true;
  }

  selectBuilding(buildingId: string | null): boolean {
    if (buildingId === null) {
      this.selectedBuildingId = undefined;
      this.selectedAgentId = undefined;
      this.clearWorldObjectSelection();
      this.redrawSelection();
      this.emitCityEvent(CITY_SCENE_EVENTS.selection, null);
      return true;
    }
    const building = this.state.buildings.find((candidate) => candidate.id === buildingId);
    if (!building) {
      this.emitError("UNKNOWN_BUILDING", `No existe el edificio ${buildingId}.`);
      return false;
    }
    this.selectedBuildingId = buildingId;
    this.selectedAgentId = undefined;
    this.buildTool = undefined;
    this.exteriorToolDefinitionId = undefined;
    this.clearWorldObjectSelection();
    this.placementGraphics?.clear();
    this.redrawSelection();
    this.redrawAgentPath();
    this.emitCityEvent(CITY_SCENE_EVENTS.selection, this.selectionFromBuilding(building));
    return true;
  }

  focusBuilding(buildingId: string): boolean {
    const building = this.state.buildings.find((candidate) => candidate.id === buildingId);
    if (!building) {
      this.emitError("UNKNOWN_BUILDING", `No existe el edificio ${buildingId}.`);
      return false;
    }
    const minX = Math.min(...building.occupiedTiles.map((tile) => tile.x));
    const minY = Math.min(...building.occupiedTiles.map((tile) => tile.y));
    const maxX = Math.max(...building.occupiedTiles.map((tile) => tile.x));
    const maxY = Math.max(...building.occupiedTiles.map((tile) => tile.y));
    this.focusGridPoint({ x: Math.round((minX + maxX) / 2), y: Math.round((minY + maxY) / 2) });
    return this.selectBuilding(buildingId);
  }

  focusAgent(profileOrAgentId: string): boolean {
    // Accept either a ProfileId (external Hermes identity) or a legacy AgentId.
    // The legacy preset maps `default` -> `syka`; other legacy profiles share
    // the same string for both ids.
    const agentId: AgentId = profileOrAgentId === "default" ? "syka" : profileOrAgentId as AgentId;
    const agent = this.state.agents.find((candidate) => candidate.id === agentId);
    if (!agent) {
      this.emitError("UNKNOWN_AGENT", `No existe el agente ${profileOrAgentId}.`);
      return false;
    }
    this.selectedAgentId = agentId;
    this.selectedBuildingId = undefined;
    this.buildTool = undefined;
    this.exteriorToolDefinitionId = undefined;
    this.clearWorldObjectSelection();
    this.redrawSelection();
    this.redrawAgentPath();
    const projected = projectGridCenter(agent.position.x, agent.position.y);
    // Selecting a visible inhabitant should reveal their route without
    // destroying the carefully composed city framing. Only pan when the
    // inhabitant is genuinely outside the current camera view.
    if (!this.cameras.main.worldView.contains(projected.x, projected.y)) {
      this.focusGridPoint(agent.position);
    }
    this.emitCityEvent(CITY_SCENE_EVENTS.selection, null);
    this.emitCityEvent(CITY_SCENE_EVENTS.agentSelection, agentId);
    return true;
  }

  selectWorldObject(instanceId: string | null): boolean {
    if (instanceId === null) {
      this.clearWorldObjectSelection();
      this.redrawSelection();
      return true;
    }
    const object = this.state.worldObjects.find((candidate) => candidate.instanceId === instanceId);
    if (!object) {
      this.emitError("WORLD_OBJECT_NOT_FOUND", `No existe el objeto exterior ${instanceId}.`);
      return false;
    }
    this.selectedWorldObjectId = instanceId;
    this.selectedBuildingId = undefined;
    this.selectedAgentId = undefined;
    this.buildTool = undefined;
    this.exteriorToolDefinitionId = undefined;
    this.placementGraphics?.clear();
    this.emitCityEvent(CITY_SCENE_EVENTS.selection, null);
    this.emitCityEvent(CITY_SCENE_EVENTS.worldObjectSelection, this.selectionFromWorldObject(object));
    this.redrawSelection();
    this.redrawAgentPath();
    return true;
  }

  enterSelected(): boolean {
    const building = this.state.buildings.find((candidate) => candidate.id === this.selectedBuildingId);
    if (!building) {
      this.emitError("NO_SELECTION", "Seleccioná un edificio antes de entrar.");
      return false;
    }
    if (building.status !== "complete") {
      this.emitError("BUILDING_INCOMPLETE", "El interior abre cuando termina la construcción.");
      return false;
    }
    if (!this.state.interiors.some((interior) => interior.buildingId === building.id)) {
      this.emitError("INTERIOR_UNAVAILABLE", "Este edificio todavía no tiene un interior disponible.");
      return false;
    }
    this.emitCityEvent(CITY_SCENE_EVENTS.interior, {
      buildingId: building.id,
      kind: building.kind,
      interiorId: building.interiorId,
    });
    return true;
  }

  getSelection(): CitySceneSelection | null {
    const building = this.state.buildings.find((candidate) => candidate.id === this.selectedBuildingId);
    return building ? this.selectionFromBuilding(building) : null;
  }

  onCityEvent<K extends keyof CitySceneEventMap>(
    event: K,
    listener: (payload: CitySceneEventMap[K]) => void,
    context?: object,
  ): this {
    this.events.on(event, listener, context);
    return this;
  }

  offCityEvent<K extends keyof CitySceneEventMap>(
    event: K,
    listener: (payload: CitySceneEventMap[K]) => void,
    context?: object,
  ): this {
    this.events.off(event, listener, context);
    return this;
  }

  private emitCityEvent<K extends keyof CitySceneEventMap>(event: K, payload: CitySceneEventMap[K]): void {
    this.events.emit(event, payload);
  }

  private emitError(code: string, message: string): void {
    const payload: CitySceneErrorPayload = { code, message };
    this.emitCityEvent(CITY_SCENE_EVENTS.error, payload);
  }

  private handleShutdown(): void {
    this.unsubscribeController?.();
    this.unsubscribeController = undefined;
  }

  private textureAvailable(key: string): boolean {
    return !this.failedAssets.has(key) && this.textures.exists(key);
  }

  private registerAssetFrames(): void {
    this.registerFrameSet(CITY_TEXTURE_KEYS.fallbackHouse, {
      body: FALLBACK_BUILDING_SOURCE_FRAMES.house.crop,
    });
    this.registerFrameSet(CITY_TEXTURE_KEYS.fallbackCafe, {
      body: FALLBACK_BUILDING_SOURCE_FRAMES.cafe.crop,
    });
    this.registerFrameSet(
      CITY_TEXTURE_KEYS.props,
      Object.fromEntries(Object.entries(PROP_SOURCE_FRAMES).map(([id, spec]) => [id, spec.crop])),
    );
    this.registerFrameSet(
      CITY_TEXTURE_KEYS.groundDecals,
      Object.fromEntries(Object.entries(GROUND_DECAL_SOURCE_FRAMES).map(([id, spec]) => [id, spec.crop])),
    );
    this.registerFrameSet(
      CITY_TEXTURE_KEYS.environmentCorrections,
      Object.fromEntries(Object.entries(ENVIRONMENT_CORRECTION_SOURCE_FRAMES).map(([id, spec]) => [id, spec.crop])),
    );
    this.registerFrameSet(
      CITY_TEXTURE_KEYS.lightFx,
      Object.fromEntries(Object.entries(LIGHT_FX_SOURCE_FRAMES).map(([id, spec]) => [id, spec.crop])),
    );

    this.alphaBuildingsAvailable = this.registerGridFrames(
      CITY_TEXTURE_KEYS.alphaBuildings,
      BUILDING_KIND_ORDER.length,
      1,
      (column) => `building-${BUILDING_KIND_ORDER[column] ?? "home"}`,
    );
    this.alphaConstructionAvailable = this.registerGridFrames(
      CITY_TEXTURE_KEYS.alphaConstruction,
      3,
      1,
      (column) => `construction-${["foundation", "framing", "finishing"][column] ?? "foundation"}`,
    );
    this.alphaAgentsAvailable = this.registerGridFrames(
      CITY_TEXTURE_KEYS.alphaAgents,
      AGENT_ACTIVITY_ORDER.length,
      AGENT_ID_ORDER.length,
      (column, row) => agentFrameName(
        AGENT_ID_ORDER[row] ?? "syka",
        AGENT_ACTIVITY_ORDER[column] ?? "idle",
      ),
    );
    this.cafeNpcsAvailable = this.registerGridFrames(
      CITY_CAFE_NPC_TEXTURE_KEY,
      CAFE_NPC_IDS.length,
      CITY_CAFE_NPC_ACTIVITIES.length,
      (column, row) => cityCafeNpcFrameName(
        CAFE_NPC_IDS[column] ?? "alma-rios",
        CITY_CAFE_NPC_ACTIVITIES[row] ?? "idle",
      ),
    );
  }

  private registerFrameSet(
    textureKey: string,
    frames: Readonly<Record<string, readonly [number, number, number, number]>>,
  ): void {
    if (!this.textureAvailable(textureKey)) return;
    const texture = this.textures.get(textureKey);
    for (const [name, crop] of Object.entries(frames)) {
      if (texture.has(name)) continue;
      texture.add(name, 0, crop[0], crop[1], crop[2], crop[3]);
    }
  }

  private registerGridFrames(
    textureKey: string,
    columns: number,
    rows: number,
    frameName: (column: number, row: number) => string,
  ): boolean {
    if (!this.textureAvailable(textureKey)) return false;
    const texture = this.textures.get(textureKey);
    const source = texture.getSourceImage() as ImageSourceSize;
    const frameWidth = Math.floor(source.width / columns);
    const frameHeight = Math.floor(source.height / rows);
    if (frameWidth < 1 || frameHeight < 1) return false;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const name = frameName(column, row);
        if (!texture.has(name)) texture.add(name, 0, column * frameWidth, row * frameHeight, frameWidth, frameHeight);
      }
    }
    return true;
  }

  private createFallbackAgentTexture(): void {
    if (this.textures.exists(CITY_TEXTURE_KEYS.fallbackAgent)) return;
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(2, 1, 4, 4);
    graphics.fillRect(2, 6, 4, 7);
    graphics.fillRect(1, 7, 1, 5);
    graphics.fillRect(6, 7, 1, 5);
    graphics.fillRect(2, 13, 1, 5);
    graphics.fillRect(5, 13, 1, 5);
    graphics.generateTexture(CITY_TEXTURE_KEYS.fallbackAgent, 8, 18);
    graphics.destroy();
  }

  private configureCameraBounds(): void {
    const { width, height } = this.state.map.size;
    const corners = [
      projectGridTop(0, 0),
      projectGridTop(width, 0),
      projectGridTop(width, height),
      projectGridTop(0, height),
    ];
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    const minX = Math.min(...xs) - 260;
    const minY = Math.min(...ys) - 220;
    const maxX = Math.max(...xs) + 260;
    const maxY = Math.max(...ys) + 260;
    this.cameras.main.setBounds(minX, minY, maxX - minX, maxY - minY);
  }

  private syncState(state: GameStateV1): void {
    this.state = state;
    if (this.selectedWorldObjectId && !state.worldObjects.some((object) => object.instanceId === this.selectedWorldObjectId)) {
      this.clearWorldObjectSelection();
    }
    const nextMapSignature = [
      state.map.size.width,
      state.map.size.height,
      ...state.map.sectors.map((sector) => `${sector.id}:${sector.unlocked ? 1 : 0}`),
      ...state.map.tiles.map((tile) => `${tile.terrain}:${tile.elevation}:${tile.buildingId ?? ""}`),
      ...state.worldObjects.map((object) => [
        object.instanceId,
        object.definitionId,
        object.hostTile.x,
        object.hostTile.y,
        object.orientation,
        object.variant ?? "",
      ].join(":")),
    ].join("|");
    if (nextMapSignature !== this.mapSignature) {
      this.mapSignature = nextMapSignature;
      this.renderTerrain();
      this.renderDecor();
      this.configureCameraBounds();
    }

    const nextBuildingSignature = state.buildings
      .map((building) => [
        building.id,
        building.status,
        building.level,
        building.visualVariant,
        building.orientation,
        building.origin.x,
        building.origin.y,
        building.activeUpgrade?.definitionId ?? "",
      ].join(":"))
      .join("|");
    if (nextBuildingSignature !== this.buildingSignature) {
      this.buildingSignature = nextBuildingSignature;
      this.renderBuildings();
    }

    this.syncAgents();
    this.syncCafeNpcs();
    this.syncCamera();
    this.syncLighting();
    this.redrawSelection();
    this.redrawPlacementGhost();
    if (state.camera.scene === "city") this.activateSpatialControl();
  }

  private renderTerrain(): void {
    this.destroyObjects(this.terrainObjects);
    this.drawMapSlab();
    for (const tile of this.state.map.tiles) {
      const visual = selectTerrainVisual(this.state.map, tile);
      const center = projectGridCenter(tile.position.x, tile.position.y, tile.elevation);
      const image = this.add
        .image(center.x, center.y, CITY_TEXTURE_KEYS.terrain, visual.frame)
        .setOrigin(0.5)
        .setDisplaySize(CITY_TILE_WIDTH, CITY_TILE_HEIGHT)
        .setDepth(-10_000 + tile.position.x + tile.position.y);
      this.trackTint(image, visual.tint);
      this.terrainObjects.push(image);
    }
    this.drawGrassTexture();
    this.drawBoundaryFences();
    this.lightingMinute = -1;
  }

  private drawMapSlab(): void {
    const geometry = createCityMapSlabGeometry(this.state.map.size.width, this.state.map.size.height);
    const vectors = (points: readonly { readonly x: number; readonly y: number }[]) =>
      points.map((point) => new Phaser.Math.Vector2(point.x, point.y));
    const slab = this.add.graphics().setDepth(-20_000);
    slab
      .fillStyle(0x24302e, 0.3)
      .fillPoints(vectors(geometry.shadow), true)
      .fillStyle(0x62442f, 1)
      .fillPoints(vectors(geometry.southeastFace), true)
      .fillStyle(0x765139, 1)
      .fillPoints(vectors(geometry.southwestFace), true)
      .lineStyle(1, 0x3c2d25, 0.95)
      .strokePoints(vectors(geometry.southeastFace), true)
      .strokePoints(vectors(geometry.southwestFace), true)
      .lineStyle(1, 0xa1724a, 0.42)
      .lineBetween(
        geometry.southeastFace[2]!.x,
        geometry.southeastFace[2]!.y - 3,
        geometry.southeastFace[3]!.x,
        geometry.southeastFace[3]!.y - 3,
      )
      .lineBetween(
        geometry.southwestFace[2]!.x,
        geometry.southwestFace[2]!.y - 3,
        geometry.southwestFace[3]!.x,
        geometry.southwestFace[3]!.y - 3,
      );
    this.terrainObjects.push(slab);
  }

  private drawGrassTexture(): void {
    const marks = createCityGrassTexturePlan(this.state.map);
    if (marks.length === 0) return;
    const texture = this.add.graphics().setDepth(-9_000);
    const colors: Readonly<Record<CityGrassTextureTone, readonly [number, number]>> = {
      light: [0xd2dc8b, 0.16],
      deep: [0x3f683f, 0.18],
      warm: [0xb58b52, 0.14],
    };
    for (const mark of marks) {
      const point = projectGridCenter(mark.position.x, mark.position.y);
      const [color, alpha] = colors[mark.tone];
      texture.fillStyle(color, alpha).fillRect(Math.round(point.x), Math.round(point.y), 1, 1);
      if (mark.doublePixel) texture.fillRect(Math.round(point.x) + 1, Math.round(point.y) - 1, 1, 1);
    }
    this.terrainObjects.push(texture);
  }

  private drawBoundaryFences(): void {
    const blockedTiles = [
      ...this.state.buildings.flatMap((building) => building.occupiedTiles),
      ...this.state.worldObjects.map((object) => object.hostTile),
    ];
    for (const segment of createCityBoundaryFencePlan(this.state.map, blockedTiles)) {
      const fence = this.add.graphics().setDepth(cityDepth(segment.hostTile.x, segment.hostTile.y, 72));
      const start = segment.start;
      const end = segment.end;
      fence
        .lineStyle(3, 0x26312d, 0.2)
        .lineBetween(start.x, start.y + 1, end.x, end.y + 1)
        .lineStyle(2, 0x503522, 1)
        .lineBetween(start.x, start.y - 7, end.x, end.y - 7)
        .lineBetween(start.x, start.y - 3, end.x, end.y - 3)
        .lineStyle(1, 0xb47d4c, 0.94)
        .lineBetween(start.x, start.y - 8, end.x, end.y - 8)
        .lineBetween(start.x, start.y - 4, end.x, end.y - 4)
        .fillStyle(0x49301f, 1)
        .fillRect(Math.round(start.x) - 1, Math.round(start.y) - 10, 3, 11)
        .fillRect(Math.round(end.x) - 1, Math.round(end.y) - 10, 3, 11)
        .fillStyle(0xc18a55, 0.92)
        .fillRect(Math.round(start.x), Math.round(start.y) - 9, 1, 8)
        .fillRect(Math.round(end.x), Math.round(end.y) - 9, 1, 8);
      this.terrainObjects.push(fence);
    }
  }

  private renderDecor(): void {
    this.ambientDetailViews.length = 0;
    this.hoveredWorldObjectId = undefined;
    this.destroyObjects(this.decorObjects);
    this.destroyLights(this.streetLights);
    const plan = createCityDecorPlan(this.state.map, {
      occupiedTiles: this.state.buildings.flatMap((building) => building.occupiedTiles),
      worldObjects: this.state.worldObjects,
    });
    for (const detail of plan.groundDetails) this.placeGroundDetail(detail.frame, detail.position.x, detail.position.y);
    for (const object of this.state.worldObjects) this.placeWorldObject(object);
    for (const placement of plan.ambientDetails) this.placeAmbientDetail(placement);
    this.lightingMinute = -1;
  }

  private placeAmbientDetail(placement: CityAmbientDetailPlacement): void {
    const point = projectGridCenter(placement.position.x, placement.position.y);
    const children: Phaser.GameObjects.GameObject[] = [];
    let butterflyFrames: readonly Phaser.GameObjects.Graphics[] | undefined;
    if (placement.kind === "sparrow-pair") {
      const drawing = this.add.graphics();
      drawing
        .fillStyle(0x59483b, 1)
        .fillRect(-5, -2, 3, 2)
        .fillRect(-3, -3, 1, 1)
        .fillStyle(0xd49a4d, 1)
        .fillRect(-2, -2, 1, 1)
        .fillStyle(0x765d48, 1)
        .fillRect(1, 0, 3, 2)
        .fillRect(2, -1, 1, 1)
        .fillStyle(0xd49a4d, 1)
        .fillRect(4, 0, 1, 1);
      children.push(drawing);
    } else if (placement.kind === "snail") {
      const drawing = this.add.graphics();
      drawing
        .fillStyle(0xb18a4c, 1)
        .fillRect(-2, -2, 3, 3)
        .fillStyle(0x5c754e, 1)
        .fillRect(-3, 0, 6, 2)
        .fillRect(2, -1, 1, 2)
        .fillStyle(0xe4c880, 1)
        .fillRect(-1, -1, 1, 1);
      children.push(drawing);
    } else {
      const wing = placement.kind === "butterfly-coral" ? 0xd87356 : 0xf3dc9b;
      const highlight = placement.kind === "butterfly-coral" ? 0xf2aa78 : 0xffedb0;
      butterflyFrames = [0, 1, 2].map((frame) => this.createButterflyFrame(frame, wing, highlight));
      butterflyFrames.forEach((frame, index) => frame.setVisible(index === 0));
      children.push(...butterflyFrames);
    }
    const container = this.add
      .container(point.x, point.y, children)
      .setDepth(cityDepth(placement.position.x, placement.position.y, 94));
    this.ambientDetailViews.push({
      container,
      kind: placement.kind,
      baseX: point.x,
      baseY: point.y,
      phase: placement.phase,
      ...(butterflyFrames ? { butterflyFrames } : {}),
    });
    this.decorObjects.push(container);
  }

  private createButterflyFrame(frame: number, wing: number, highlight: number): Phaser.GameObjects.Graphics {
    const drawing = this.add.graphics();
    const outline = 0x3c2d2b;
    if (frame === 0) {
      drawing
        .fillStyle(outline, 1)
        .fillRect(-6, -4, 5, 4)
        .fillRect(-5, 0, 4, 3)
        .fillRect(2, -4, 5, 4)
        .fillRect(2, 0, 4, 3)
        .fillStyle(wing, 1)
        .fillRect(-5, -3, 3, 2)
        .fillRect(-4, 0, 2, 2)
        .fillRect(3, -3, 3, 2)
        .fillRect(3, 0, 2, 2)
        .fillStyle(highlight, 1)
        .fillRect(-4, -3, 1, 1)
        .fillRect(4, -3, 1, 1);
    } else if (frame === 1) {
      drawing
        .fillStyle(outline, 1)
        .fillRect(-4, -4, 3, 6)
        .fillRect(2, -4, 3, 6)
        .fillStyle(wing, 1)
        .fillRect(-3, -3, 2, 4)
        .fillRect(2, -3, 2, 4)
        .fillStyle(highlight, 1)
        .fillRect(-3, -2, 1, 1)
        .fillRect(3, -2, 1, 1);
    } else {
      drawing
        .fillStyle(outline, 1)
        .fillRect(-3, -5, 2, 7)
        .fillRect(2, -5, 2, 7)
        .fillStyle(wing, 1)
        .fillRect(-2, -4, 1, 5)
        .fillRect(2, -4, 1, 5)
        .fillStyle(highlight, 1)
        .fillRect(-2, -3, 1, 1)
        .fillRect(2, -3, 1, 1);
    }
    return drawing
      .fillStyle(0x302728, 1)
      .fillRect(-1, -4, 2, 7)
      .fillRect(-1, -6, 2, 2)
      .fillRect(-2, -7, 1, 2)
      .fillRect(1, -7, 1, 2);
  }

  private updateAmbientDetails(now: number): void {
    const seconds = now / 1_000;
    for (const detail of this.ambientDetailViews) {
      if (!detail.container.active) continue;
      const cycle = seconds + detail.phase * 6.283;
      if (detail.kind.startsWith("butterfly")) {
        const visual = cityButterflyVisualState(now, detail.phase);
        detail.container.setPosition(detail.baseX + visual.offsetX, detail.baseY + visual.offsetY);
        detail.butterflyFrames?.forEach((frame, index) => frame.setVisible(index === visual.flapFrame));
      } else if (detail.kind === "sparrow-pair") {
        const hop = Math.max(0, Math.sin(cycle * 1.15) - 0.82) * 8;
        detail.container.setPosition(Math.round(detail.baseX), Math.round(detail.baseY - hop));
      } else {
        detail.container.setPosition(
          Math.round(detail.baseX + Math.sin(cycle * 0.18) * 1.5),
          Math.round(detail.baseY),
        );
      }
    }
  }

  private renderBuildings(): void {
    for (const view of this.buildingViews.values()) this.destroyObjects([...view.objects]);
    this.buildingViews.clear();
    this.destroyLights(this.buildingLights);

    for (const building of this.state.buildings) {
      const definition = getBuildingDefinition(building.definitionId, ALPHA_CATALOG);
      if (!definition) continue;
      const minX = Math.min(...building.occupiedTiles.map((tile) => tile.x));
      const minY = Math.min(...building.occupiedTiles.map((tile) => tile.y));
      const maxX = Math.max(...building.occupiedTiles.map((tile) => tile.x));
      const maxY = Math.max(...building.occupiedTiles.map((tile) => tile.y));
      const renderedFootprint = { width: maxX - minX + 1, height: maxY - minY + 1 };
      const base = buildingBasePoint({ x: minX, y: minY }, renderedFootprint);
      const visual = resolveBuildingVisual(building.kind, this.alphaBuildingsAvailable);
      const construction = resolveConstructionVisual(building.status, this.alphaConstructionAvailable);
      const [spriteOffsetX, spriteOffsetY] = resolveBuildingSpriteOffset(visual, renderedFootprint);
      const spriteBase = { x: base.x + spriteOffsetX, y: base.y + spriteOffsetY };
      const texture = construction.useConstructionSheet ? CITY_TEXTURE_KEYS.alphaConstruction : visual.texture;
      const frame = construction.useConstructionSheet ? construction.frame : visual.frame;
      if (!frame || !this.textureAvailable(texture)) {
        this.emitError("BUILDING_ASSET_MISSING", `No hay sprite raster disponible para ${definition.name}.`);
        continue;
      }

      const depth = cityDepth(
        Math.max(...building.occupiedTiles.map((tile) => tile.x)),
        Math.max(...building.occupiedTiles.map((tile) => tile.y)),
        120,
      );
      const shadow = this.add.graphics().setDepth(depth - 2);
      shadow.fillStyle(0x273a3a, 0.22).fillEllipse(
        spriteBase.x,
        spriteBase.y - 1,
        Math.max(52, (definition.footprint.width + definition.footprint.height) * 12),
        Math.max(16, (definition.footprint.width + definition.footprint.height) * 3.2),
      );
      const sprite = this.add
        .image(spriteBase.x, spriteBase.y, texture, frame)
        .setOrigin(
          construction.useConstructionSheet ? 0.5 : visual.pivot[0],
          construction.useConstructionSheet ? 1 : visual.pivot[1],
        )
        .setDisplaySize(visual.draw[0], visual.draw[1])
        .setDepth(depth)
        .setAlpha(construction.alpha);
      this.trackTint(sprite, multiplyTint(visual.tint, construction.tint));
      sprite.setData("buildingId", building.id);
      sprite.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 1 });
      sprite.on("pointerover", () => {
        this.hoveredBuildingId = building.id;
        this.redrawSelection();
      });
      sprite.on("pointerout", () => {
        if (this.hoveredBuildingId === building.id) this.hoveredBuildingId = undefined;
        this.redrawSelection();
      });
      sprite.on(
        "pointerup",
        (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) =>
          this.handleBuildingPointerUp(building, pointer, event),
      );

      const variant = this.drawBuildingUpgradeComposition(building, spriteBase, depth + 1);
      const stage = this.drawBuildingStage(building, spriteBase, depth + 3);
      const objects: Phaser.GameObjects.GameObject[] = [shadow, sprite, ...variant, ...stage];
      this.buildingViews.set(building.id, { sprite, objects });

      if (building.status === "complete") {
        const access = projectGridCenter(building.accessTile.x, building.accessTile.y);
        this.createLight(
          this.buildingLights,
          "doorway",
          "streetlamp-pool-small",
          access.x,
          access.y + 2,
          depth - 3,
          building.kind === "cafe" ? 0.58 : 0.42,
        );
        this.createLight(
          this.buildingLights,
          "window",
          "window-halo",
          spriteBase.x,
          spriteBase.y - visual.draw[1] * 0.45,
          depth + 1,
          building.kind === "cafe" ? 0.44 : 0.28,
        );
      }
    }
    this.lightingMinute = -1;
  }

  private drawBuildingStage(
    building: BuildingInstanceV1,
    base: { readonly x: number; readonly y: number },
    depth: number,
  ): readonly Phaser.GameObjects.GameObject[] {
    if (building.status === "complete" && building.level <= 1 && !building.activeUpgrade) return [];
    const marker = this.add.graphics().setDepth(depth);
    if (building.status !== "complete") {
      const completed = { planned: 0, foundation: 1, framing: 2, finishing: 3, complete: 3 }[building.status];
      marker.fillStyle(0x263b3d, 0.88).fillRect(base.x - 9, base.y + 3, 18, 4);
      for (let index = 0; index < 3; index += 1) {
        marker.fillStyle(index < completed ? 0xffd27d : 0x6e756c, 1).fillRect(base.x - 7 + index * 5, base.y + 4, 4, 2);
      }
    } else {
      marker.fillStyle(0xffdf88, 1).fillRect(base.x - 1, base.y - 6, 3, 3);
      marker.fillRect(base.x, base.y - 8, 1, 7).fillRect(base.x - 3, base.y - 5, 7, 1);
    }
    return [marker];
  }

  private drawBuildingUpgradeComposition(
    building: BuildingInstanceV1,
    base: { readonly x: number; readonly y: number },
    depth: number,
  ): readonly Phaser.GameObjects.GameObject[] {
    const composition = resolveBuildingUpgradeComposition(building.kind, building.visualVariant);
    if (!composition || !this.textureAvailable(CITY_TEXTURE_KEYS.props)) return [];
    const objects: Phaser.GameObjects.GameObject[] = [];
    for (const addon of composition.addons) {
      const image = this.add
        .image(base.x + addon.offset[0], base.y + addon.offset[1], CITY_TEXTURE_KEYS.props, addon.frame)
        .setOrigin(addon.origin[0], addon.origin[1])
        .setDisplaySize(addon.draw[0], addon.draw[1])
        .setDepth(depth);
      this.trackTint(image, 0xffffff);
      objects.push(image);
    }

    const signX = base.x + composition.signOffset[0];
    const signY = base.y + composition.signOffset[1];
    const sign = this.add.graphics().setDepth(depth + 1);
    sign
      .fillStyle(0x4f352b, 1)
      .fillRect(signX - 8, signY - 5, 16, 10)
      .lineStyle(1, 0xe8b861, 1)
      .strokeRect(signX - 8, signY - 5, 16, 10)
      .fillStyle(0xffefc4, 1)
      .fillRect(signX - 5, signY - 2, 4, 5)
      .fillRect(signX + 1, signY - 2, 4, 5)
      .fillStyle(0xd87356, 1)
      .fillRect(signX, signY - 2, 1, 5)
      .fillStyle(0x8bb07d, 1)
      .fillRect(signX - 5, signY + 3, 10, 1);
    objects.push(sign);

    this.createLight(
      this.buildingLights,
      "accent",
      "bulb-halo-small",
      base.x + composition.lightOffset[0],
      base.y + composition.lightOffset[1],
      depth + 2,
      0.72,
    );
    return objects;
  }

  private placeWorldObject(object: WorldObjectInstanceV1): void {
    const definition = getExteriorObjectDefinition(object.definitionId, ALPHA_CATALOG);
    if (!definition) return;
    let image: Phaser.GameObjects.Image | undefined;
    if (definition.visualKey in GROUND_DECAL_SOURCE_FRAMES) {
      image = this.placeGroundDetail(definition.visualKey as CityGroundDecalFrame, object.hostTile.x, object.hostTile.y);
    } else if (definition.visualKey in PROP_SOURCE_FRAMES) {
      const offset = {
        north: { x: 0, y: -0.16 },
        east: { x: 0.16, y: 0 },
        south: { x: 0, y: 0.16 },
        west: { x: -0.16, y: 0 },
      }[object.orientation];
      const frame = definition.visualKey as CityPropFrame;
      const gridX = object.hostTile.x + (definition.placementRule === "grass-near-road" ? offset.x : 0);
      const gridY = object.hostTile.y + (definition.placementRule === "grass-near-road" ? offset.y : 0);
      image = this.placeProp(frame, gridX, gridY, object.hostTile);
      if (object.lightSource && frame === "streetlamp") {
        const ground = projectGridCenter(gridX, gridY);
        this.createLight(
          this.streetLights,
          "streetlamp",
          "streetlamp-pool-small",
          ground.x,
          ground.y + 2,
          -650 + gridX + gridY,
          0.68,
        );
      }
    }
    if (!image) return;
    image
      .setData("worldObjectId", object.instanceId)
      .setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 1 });
    image.on("pointerover", () => {
      if (this.buildTool || this.exteriorToolDefinitionId) return;
      this.hoveredWorldObjectId = object.instanceId;
      this.redrawSelection();
    });
    image.on("pointerout", () => {
      if (this.hoveredWorldObjectId === object.instanceId) this.hoveredWorldObjectId = undefined;
      this.redrawSelection();
    });
    image.on(
      "pointerup",
      (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) =>
        this.handleWorldObjectPointerUp(object, pointer, event),
    );
  }

  private placeProp(frame: CityPropFrame, gridX: number, gridY: number, hostTile?: GridPoint): Phaser.GameObjects.Image | undefined {
    const correctionFrame = this.correctionFurnitureFrame(frame, gridX, gridY, hostTile);
    const useCorrection = correctionFrame !== undefined && this.textureAvailable(CITY_TEXTURE_KEYS.environmentCorrections);
    const texture = useCorrection ? CITY_TEXTURE_KEYS.environmentCorrections : CITY_TEXTURE_KEYS.props;
    if (!this.textureAvailable(texture)) return undefined;
    const point = projectGridCenter(gridX, gridY);
    const correction = correctionFrame ? ENVIRONMENT_CORRECTION_SOURCE_FRAMES[correctionFrame] : undefined;
    const size = useCorrection && correction ? correction.draw : PROP_SOURCE_FRAMES[frame].draw;
    const origin = useCorrection && correction ? correction.origin : ([0.5, 1] as const);
    const image = this.add
      .image(point.x, point.y + 1, texture, useCorrection ? correctionFrame : frame)
      .setOrigin(origin[0], origin[1])
      .setDisplaySize(size[0], size[1])
      .setDepth(cityEntityDepth(gridX, gridY, SPATIAL_DEPTH_SUB_LAYER.body, 80));
    if (!useCorrection && frame === "bench" && (Math.round(gridX + gridY) & 1) === 1) image.setFlipX(true);
    this.trackTint(image, 0xffffff);
    this.decorObjects.push(image);
    return image;
  }

  private correctionFurnitureFrame(
    frame: CityPropFrame,
    gridX: number,
    gridY: number,
    hostTile?: GridPoint,
  ): EnvironmentCorrectionFrame | undefined {
    if (frame === "streetlamp") {
      return (Math.round((hostTile?.x ?? gridX) + (hostTile?.y ?? gridY)) & 1) === 0
        ? "streetlamp-left"
        : "streetlamp-right";
    }
    if (frame !== "bench") return undefined;
    const deltaX = Math.abs(gridX - (hostTile?.x ?? Math.round(gridX)));
    const deltaY = Math.abs(gridY - (hostTile?.y ?? Math.round(gridY)));
    return deltaX >= deltaY ? "bench-axis-a" : "bench-axis-b";
  }

  private placeGroundDetail(frame: CityGroundDecalFrame, gridX: number, gridY: number): Phaser.GameObjects.Image | undefined {
    const correctionFrame = correctionGroundFrame(frame, gridX, gridY);
    const useCorrection = correctionFrame !== undefined && this.textureAvailable(CITY_TEXTURE_KEYS.environmentCorrections);
    const texture = useCorrection ? CITY_TEXTURE_KEYS.environmentCorrections : CITY_TEXTURE_KEYS.groundDecals;
    if (!this.textureAvailable(texture)) return undefined;
    const point = projectGridCenter(gridX, gridY);
    const correction = correctionFrame ? ENVIRONMENT_CORRECTION_SOURCE_FRAMES[correctionFrame] : undefined;
    const size = useCorrection && correction ? correction.draw : GROUND_DECAL_SOURCE_FRAMES[frame].draw;
    const origin = useCorrection && correction ? correction.origin : ([0.5, 1] as const);
    const image = this.add
      .image(point.x, point.y + 1, texture, useCorrection ? correctionFrame : frame)
      .setOrigin(origin[0], origin[1])
      .setDisplaySize(size[0], size[1])
      .setDepth(-850 + gridX + gridY);
    this.trackTint(image, 0xffffff);
    this.decorObjects.push(image);
    return image;
  }

  private createLight(
    target: LightView[],
    family: CityLightFamily,
    frame: CityLightFxFrame,
    x: number,
    y: number,
    depth: number,
    strength: number,
  ): void {
    if (!this.textureAvailable(CITY_TEXTURE_KEYS.lightFx)) return;
    const size = LIGHT_FX_SOURCE_FRAMES[frame].draw;
    const sprite = this.add
      .image(x, y, CITY_TEXTURE_KEYS.lightFx, frame)
      .setOrigin(0.5)
      .setDisplaySize(size[0], size[1])
      .setDepth(depth)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    target.push({ sprite, family, strength });
  }

  private syncCafeNpcs(): void {
    const transitNpcs = this.state.npcs.filter(
      (npc): npc is TransitCafeNpc => npc.location.kind === "transit",
    );
    const wanted = new Set(transitNpcs.map((npc) => npc.id));
    for (const [id, view] of this.cafeNpcViews) {
      if (wanted.has(id) || view.retiring) continue;
      // Core switches to interior/offstage as soon as the route is consumed.
      // Presentation still completes the last visual segment to the stored
      // doorway/map-edge destination before retiring the sprite.
      view.retiring = true;
      view.retiringProgress = 0;
      view.targetX = view.destinationX;
      view.targetY = view.destinationY;
      view.targetDepth = view.destinationDepth;
    }
    if (!this.cafeNpcsAvailable) return;

    for (const npc of transitNpcs) {
      const point = projectGridCenter(npc.location.tile.x, npc.location.tile.y);
      const destination = projectGridCenter(npc.location.destination.x, npc.location.destination.y);
      let view = this.cafeNpcViews.get(npc.id);
      if (!view) {
        view = this.createCafeNpcView(npc, point.x, point.y, destination.x, destination.y);
        this.cafeNpcViews.set(npc.id, view);
      } else if (view.retiring) {
        view.retiring = false;
        view.retiringProgress = 0;
        view.container.setScale(1).setAlpha(1);
        view.sprite.setY(0);
      }
      view.targetX = point.x;
      view.targetY = point.y;
      view.destinationX = destination.x;
      view.destinationY = destination.y;
      view.targetDepth = cityDepth(npc.location.tile.x, npc.location.tile.y, 188);
      view.destinationDepth = cityDepth(npc.location.destination.x, npc.location.destination.y, 188);
      view.container.setVisible(this.state.agentsVisible);
    }
  }

  private createCafeNpcView(
    npc: TransitCafeNpc,
    x: number,
    y: number,
    destinationX: number,
    destinationY: number,
  ): CityCafeNpcView {
    const spec = CITY_CAFE_NPC_VISUAL_SPEC;
    const shadow = this.add.graphics();
    shadow
      .fillStyle(0x172529, 1)
      .fillEllipse(0, -1, spec.shadowWidth, spec.shadowHeight)
      .setAlpha(0.28);
    const sprite = this.add
      .image(0, 0, CITY_CAFE_NPC_TEXTURE_KEY, cityCafeNpcFrameName(npc.id, "walking"))
      .setOrigin(0.5, spec.footOriginY)
      .setDisplaySize(spec.displayWidth, spec.displayHeight);
    const container = this.add
      .container(x, y, [shadow, sprite])
      .setName(`city-cafe-npc-${npc.id}`)
      .setData("npcId", npc.id)
      .setData("actorKind", "cafe-npc")
      .setDepth(cityDepth(npc.location.tile.x, npc.location.tile.y, 188))
      .setAlpha(0);
    return {
      npcId: npc.id,
      container,
      shadow,
      sprite,
      phase: Math.max(0, CAFE_NPC_IDS.indexOf(npc.id)) / CAFE_NPC_IDS.length,
      targetX: x,
      targetY: y,
      destinationX,
      destinationY,
      targetDepth: container.depth,
      destinationDepth: cityDepth(npc.location.destination.x, npc.location.destination.y, 188),
      facing: npc.location.direction === "arriving" ? 1 : -1,
      appearingProgress: 0,
      retiring: false,
      retiringProgress: 0,
    };
  }

  private syncAgents(): void {
    const exteriorAgents = this.state.agents.filter((agent) => agent.location.kind !== "interior");
    const wanted = new Set(exteriorAgents.map((agent) => agent.id));
    for (const [id, view] of this.agentViews) {
      if (wanted.has(id)) continue;
      if (view.entering) continue;
      // Let the rendered avatar finish the last few pixels to the doorway,
      // then retire it with a short grounded transition instead of popping.
      view.entering = true;
      view.entryProgress = 0;
      view.moving = false;
      view.activity.clear();
    }
    for (const agent of exteriorAgents) {
      const point = projectGridCenter(agent.position.x, agent.position.y);
      let view = this.agentViews.get(agent.id);
      if (!view) {
        view = this.createAgentView(agent, point.x, point.y);
        this.agentViews.set(agent.id, view);
      }
      if (view.entering) {
        view.entering = false;
        view.entryProgress = 0;
        view.container.setScale(1).setAlpha(view.presenceAlpha);
        view.sprite.setY(0);
        view.activity.setY(0);
      }
      view.targetX = point.x;
      view.targetY = point.y;
      view.targetDepth = cityDepth(agent.position.x, agent.position.y, 190);
      view.container.setVisible(this.state.agentsVisible);
      this.applyAgentVisual(view, agent);
    }
    this.redrawAgentPath();
    this.redrawPossession();
  }

  private redrawPossession(): void {
    const graphics = this.possessionGraphics;
    if (!graphics) return;
    graphics.clear();
    const profileId = this.controller.getSnapshot().control.possessedProfileId;
    const agent = profileId ? this.state.agents.find((candidate) => candidate.profileId === profileId) : undefined;
    if (!agent || agent.location.kind === "interior" || !this.state.agentsVisible) return;
    const point = projectGridCenter(agent.position.x, agent.position.y);
    graphics
      .fillStyle(0xffd67d, 0.14)
      .fillEllipse(point.x, point.y - 1, 22, 10)
      .lineStyle(2, 0xffe6a8, 0.96)
      .strokeEllipse(point.x, point.y - 1, 22, 10)
      .fillStyle(0x5f3a2c, 0.9)
      .fillCircle(point.x, point.y - 9, 2);
  }

  private createAgentView(agent: AgentStateV1, x: number, y: number): AgentView {
    const texture = this.alphaAgentsAvailable ? CITY_TEXTURE_KEYS.alphaAgents : CITY_TEXTURE_KEYS.fallbackAgent;
    const frame = this.alphaAgentsAvailable ? agentFrameName(agent.id, agent.activity) : undefined;
    const calibration = CITY_AGENT_VISUAL_CALIBRATIONS[agent.id];
    const shadow = this.add.graphics();
    shadow
      .fillStyle(0x172529, 1)
      .fillEllipse(0, -1, calibration.shadowWidth, calibration.shadowHeight)
      .setAlpha(0.3);
    const sprite = this.add
      .image(0, 0, texture, frame)
      .setOrigin(0.5, this.alphaAgentsAvailable ? calibration.footOriginY : 1);
    if (this.alphaAgentsAvailable) sprite.setDisplaySize(calibration.displayWidth, calibration.displayHeight);
    else sprite.setDisplaySize(10, 22);
    const activity = this.add.graphics();
    const hitWidth = Math.max(22, calibration.shadowWidth + 8);
    const hitHeight = 40;
    const container = this.add
      .container(x, y, [shadow, sprite, activity])
      .setDepth(cityDepth(agent.position.x, agent.position.y, 190))
      .setSize(hitWidth, hitHeight)
      .setInteractive(
        new Phaser.Geom.Rectangle(-hitWidth / 2, -38, hitWidth, hitHeight),
        Phaser.Geom.Rectangle.Contains,
      );
    container.on(
      "pointerup",
      (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        if (this.pointerTargetsUi(pointer) || this.dragDistance > 5 || this.buildTool) return;
        event.stopPropagation();
        this.focusAgent(agent.id);
      },
    );
    return {
      agentId: agent.id,
      container,
      shadow,
      sprite,
      activity,
      phase: Math.max(0, AGENT_ID_ORDER.indexOf(agent.id)) / AGENT_ID_ORDER.length,
      targetX: x,
      targetY: y,
      targetDepth: container.depth,
      moving: false,
      facing: 1,
      activityFrame: agent.activity,
      presenceAlpha: 1,
      entering: false,
      entryProgress: 0,
    };
  }

  private applyAgentVisual(view: AgentView, agent: AgentStateV1): void {
    const traveling = isAgentTraveling(agent);
    view.moving = traveling;
    view.activityFrame = traveling ? "idle" : agent.activity;
    if (this.alphaAgentsAvailable) view.sprite.setFrame(agentFrameName(agent.id, traveling ? "idle" : agent.activity));
    else view.sprite.setTint(agentTint[agent.id]);
    view.presenceAlpha = agent.presence === "offline" || agent.activity === "offline"
      ? 0.48
      : agent.presence === "degraded"
        ? 0.76
        : 1;
    if (!view.entering) view.container.setAlpha(view.presenceAlpha);
    view.sprite.setAlpha(1);
    const marker = view.activity;
    const markerY = CITY_AGENT_VISUAL_CALIBRATIONS[agent.id].markerY;
    marker.clear();
    if (traveling) {
      marker.fillStyle(0x21363a, 0.82).fillCircle(0, markerY, 4);
      marker.fillStyle(0xffd889, 1).fillCircle(-2, markerY, 0.8).fillCircle(1, markerY, 0.8);
      return;
    }
    if (agent.activity === "idle") return;
    const color = activityTint[agent.activity];
    marker.fillStyle(0x21363a, 0.88).fillRect(-5, markerY - 1, 10, 7);
    marker.fillStyle(color, 1);
    if (agent.activity === "thinking") {
      marker.fillRect(-3, markerY + 2, 1, 1).fillRect(0, markerY + 2, 1, 1).fillRect(3, markerY + 2, 1, 1);
    } else if (agent.activity === "using-tool") {
      marker.fillRect(-3, markerY + 1, 6, 2).fillRect(1, markerY + 3, 2, 2);
    } else if (agent.activity === "waiting") {
      marker.fillRect(-2, markerY + 1, 5, 1).fillRect(-1, markerY + 2, 3, 3).fillRect(-2, markerY + 5, 5, 1);
    } else if (agent.activity === "done") {
      marker.fillRect(0, markerY, 1, 6).fillRect(-3, markerY + 3, 7, 1);
    } else {
      marker.fillRect(-2, markerY + 1, 5, 5).fillStyle(0x21363a, 1).fillRect(0, markerY + 2, 1, 2);
    }
  }

  private redrawAgentPath(): void {
    const graphics = this.agentPathGraphics;
    if (!graphics) return;
    graphics.clear();
    const agent = this.state.agents.find((candidate) => candidate.id === this.selectedAgentId);
    if (!agent || !this.state.agentsVisible || agent.path.length < 2) return;
    const points = agent.path.map((tile) => projectGridCenter(tile.x, tile.y));
    const first = points[0];
    if (!first) return;
    graphics.lineStyle(1, 0xffd68a, 0.68);
    graphics.beginPath().moveTo(first.x, first.y - 1);
    for (const point of points.slice(1)) graphics.lineTo(point.x, point.y - 1);
    graphics.strokePath();
    for (const point of points.slice(1, -1)) {
      graphics.fillStyle(0xffe3a8, 0.72).fillCircle(point.x, point.y - 1, 1.2);
    }
    const destination = points.at(-1);
    if (!destination) return;
    graphics
      .fillStyle(0x21363a, 0.72)
      .fillPoints([
        new Phaser.Math.Vector2(destination.x, destination.y - 7),
        new Phaser.Math.Vector2(destination.x + 5, destination.y - 3),
        new Phaser.Math.Vector2(destination.x, destination.y + 1),
        new Phaser.Math.Vector2(destination.x - 5, destination.y - 3),
      ], true)
      .lineStyle(1, 0xffdfa0, 0.96)
      .strokePoints([
        new Phaser.Math.Vector2(destination.x, destination.y - 7),
        new Phaser.Math.Vector2(destination.x + 5, destination.y - 3),
        new Phaser.Math.Vector2(destination.x, destination.y + 1),
        new Phaser.Math.Vector2(destination.x - 5, destination.y - 3),
      ], true);
  }

  private syncCamera(): void {
    const cameraState = this.state.camera;
    const signature = `${cameraState.scene}:${cameraState.center.x}:${cameraState.center.y}:${cameraState.zoom}`;
    if (signature === this.cameraSignature || this.dragging || cameraState.scene !== "city") return;
    this.cameraSignature = signature;
    const center = projectGridCenter(cameraState.center.x, cameraState.center.y);
    this.cameras.main.setZoom(cameraState.zoom);
    this.cameras.main.centerOn(Math.round(center.x), Math.round(center.y + CITY_CAMERA_VERTICAL_BIAS));
  }

  private syncLighting(): void {
    const minute = this.state.clock.minuteOfDay;
    if (minute === this.lightingMinute) return;
    this.lightingMinute = minute;
    const lighting = getCityLighting(minute);
    for (const [image, baseTint] of this.tintables) {
      if (image.active) image.setTint(multiplyTint(baseTint, lighting.ambientTint));
    }
    for (const light of [...this.streetLights, ...this.buildingLights]) {
      light.sprite.setAlpha(resolvedLightAlpha(light.family, light.strength, lighting));
    }
    this.nightOverlay?.setAlpha(lighting.overlayAlpha);
    this.cameras.main.setBackgroundColor(lighting.backgroundColor);
  }

  private trackTint(image: Phaser.GameObjects.Image, tint: number): void {
    image.setTint(tint);
    this.tintables.set(image, tint);
  }

  private createInputControls(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.pointerTargetsUi(pointer)) {
        this.cancelPointerGesture();
        return;
      }
      if (!pointer.leftButtonDown()) return;
      this.pointerCandidate = true;
      this.dragging = false;
      this.dragDistance = 0;
      this.dragStart.set(pointer.x, pointer.y);
      this.cameraStart.set(this.cameras.main.scrollX, this.cameras.main.scrollY);
      this.updateGhostOrigin(pointer);
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.pointerTargetsUi(pointer)) {
        this.cancelPointerGesture();
        return;
      }
      this.updateGhostOrigin(pointer);
      if (!this.pointerCandidate || !pointer.isDown) return;
      this.dragDistance = Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, pointer.x, pointer.y);
      if (this.dragDistance > 5) this.dragging = true;
      if (!this.dragging) return;
      const camera = this.cameras.main;
      camera.scrollX = Math.round(this.cameraStart.x - (pointer.x - this.dragStart.x) / camera.zoom);
      camera.scrollY = Math.round(this.cameraStart.y - (pointer.y - this.dragStart.y) / camera.zoom);
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.pointerTargetsUi(pointer)) {
        this.cancelPointerGesture();
        return;
      }
      if (!this.pointerCandidate) return;
      this.updateGhostOrigin(pointer);
      if (this.dragging) this.commitCameraPan();
      else if ((this.buildTool || this.exteriorToolDefinitionId) && this.ghostOrigin) this.commitPlacement();
      else if (this.ghostOrigin) {
        this.game.events.emit("syka:spatial-click", { sceneId: "city", cell: this.ghostOrigin });
      }
      this.pointerCandidate = false;
      this.dragging = false;
      this.dragDistance = 0;
    });
    this.input.on("wheel", (pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      if (this.pointerTargetsUi(pointer)) return;
      const current = this.state.camera.zoom;
      const currentIndex = ZOOM_LEVELS.indexOf(current);
      const nextIndex = Phaser.Math.Clamp(currentIndex + (dy > 0 ? -1 : 1), 0, ZOOM_LEVELS.length - 1);
      const zoom = ZOOM_LEVELS[nextIndex] ?? 1;
      this.cameraSignature = "";
      this.controller.setZoom(zoom);
    });
  }

  private pointerTargetsUi(pointer: Phaser.Input.Pointer): boolean {
    const target = pointer.event?.target as { closest?: (selector: string) => Element | null } | null | undefined;
    return typeof target?.closest === "function" && target.closest(".syka-alpha-ui") !== null;
  }

  private cancelPointerGesture(): void {
    this.pointerCandidate = false;
    this.dragging = false;
    this.dragDistance = 0;
  }

  private updateGhostOrigin(pointer: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.ghostOrigin = snapWorldPointToGrid(world);
    this.redrawPlacementGhost();
  }

  private commitCameraPan(): void {
    const camera = this.cameras.main;
    const center = snapWorldPointToGrid({
      x: camera.midPoint.x,
      y: camera.midPoint.y - CITY_CAMERA_VERTICAL_BIAS,
    });
    const delta = {
      x: center.x - this.state.camera.center.x,
      y: center.y - this.state.camera.center.y,
    };
    this.cameraSignature = "";
    this.controller.panCamera(delta);
  }

  private focusGridPoint(point: GridPoint): void {
    const delta = {
      x: point.x - this.state.camera.center.x,
      y: point.y - this.state.camera.center.y,
    };
    this.cameraSignature = "";
    this.controller.panCamera(delta);
  }

  private commitPlacement(): void {
    if (!this.ghostOrigin) return;
    if (this.exteriorToolDefinitionId) {
      const preview = validateWorldObjectPlacement(this.state, {
        definitionId: this.exteriorToolDefinitionId,
        hostTile: this.ghostOrigin,
      }, ALPHA_CATALOG);
      if (!preview.ok) {
        const first = preview.error[0];
        this.emitError(first?.code ?? "INVALID_WORLD_OBJECT_PLACEMENT", first?.message ?? "No se puede colocar aquí.");
        return;
      }
      const result = this.controller.placeWorldObject(
        this.exteriorToolDefinitionId,
        this.ghostOrigin,
        preview.value.orientation,
      );
      if (!result.ok) this.emitError(result.error.code, result.error.message);
      return;
    }
    if (!this.buildTool) return;
    const preview = createPlacementPreview(
      this.state,
      this.buildTool.definitionId,
      this.ghostOrigin,
      this.buildTool.orientation,
    );
    if (!preview.valid) {
      this.emitError("PLACEMENT_INVALID", `No se puede construir aquí: ${preview.errors.join(", ")}.`);
      return;
    }
    const result = this.controller.placeBuilding(
      this.buildTool.definitionId,
      this.ghostOrigin,
      this.buildTool.orientation,
    );
    if (!result.ok) this.emitError(result.error.code, result.error.message);
  }

  private handleBuildingPointerUp(
    building: BuildingInstanceV1,
    pointer: Phaser.Input.Pointer,
    event?: Phaser.Types.Input.EventData,
  ): void {
    if (this.pointerTargetsUi(pointer)) return;
    if (this.dragDistance > 5 || this.buildTool || this.exteriorToolDefinitionId) return;
    event?.stopPropagation();
    const now = this.time.now;
    const doubleClick = this.lastBuildingClick?.id === building.id && now - this.lastBuildingClick.at <= 350;
    this.lastBuildingClick = { id: building.id, at: now };
    this.selectBuilding(building.id);
    if (doubleClick && building.kind === "cafe") this.enterSelected();
  }

  private handleWorldObjectPointerUp(
    object: WorldObjectInstanceV1,
    pointer: Phaser.Input.Pointer,
    event?: Phaser.Types.Input.EventData,
  ): void {
    if (this.pointerTargetsUi(pointer)) return;
    if (this.dragDistance > 5 || this.buildTool || this.exteriorToolDefinitionId) return;
    event?.stopPropagation();
    this.selectWorldObject(object.instanceId);
  }

  private redrawSelection(): void {
    const graphics = this.selectionGraphics;
    if (!graphics) return;
    graphics.clear();
    const id = this.hoveredBuildingId ?? this.selectedBuildingId;
    const building = this.state.buildings.find((candidate) => candidate.id === id);
    if (!building) {
      const objectId = this.hoveredWorldObjectId ?? this.selectedWorldObjectId;
      const object = this.state.worldObjects.find((candidate) => candidate.instanceId === objectId);
      if (!object) return;
      const top = projectGridTop(object.hostTile.x, object.hostTile.y);
      const diamond = [
        new Phaser.Math.Vector2(top.x, top.y),
        new Phaser.Math.Vector2(top.x + CITY_HALF_TILE_WIDTH, top.y + CITY_HALF_TILE_HEIGHT),
        new Phaser.Math.Vector2(top.x, top.y + CITY_TILE_HEIGHT),
        new Phaser.Math.Vector2(top.x - CITY_HALF_TILE_WIDTH, top.y + CITY_HALF_TILE_HEIGHT),
      ];
      const selected = object.instanceId === this.selectedWorldObjectId;
      graphics.fillStyle(selected ? 0xd7805f : 0xffd98a, selected ? 0.2 : 0.1).fillPoints(diamond, true);
      graphics.lineStyle(1, selected ? 0xffd99a : 0xffedc0, 1).strokePoints(diamond, true);
      return;
    }
    const minX = Math.min(...building.occupiedTiles.map((tile) => tile.x));
    const minY = Math.min(...building.occupiedTiles.map((tile) => tile.y));
    const maxX = Math.max(...building.occupiedTiles.map((tile) => tile.x));
    const maxY = Math.max(...building.occupiedTiles.map((tile) => tile.y));
    const polygon = projectFootprint({ x: minX, y: minY }, maxX - minX + 1, maxY - minY + 1)
      .map((point) => new Phaser.Math.Vector2(point.x, point.y));
    const selected = building.id === this.selectedBuildingId;
    graphics.fillStyle(selected ? 0xd7805f : 0xffd98a, selected ? 0.2 : 0.12).fillPoints(polygon, true);
    graphics.lineStyle(1, selected ? 0xffd99a : 0xffedc0, 1).strokePoints(polygon, true);
  }

  private redrawPlacementGhost(): void {
    const graphics = this.placementGraphics;
    if (!graphics) return;
    graphics.clear();
    this.destroyObjects(this.exteriorGhostObjects);
    if (!this.ghostOrigin || (!this.buildTool && !this.exteriorToolDefinitionId)) {
      this.emitCityEvent(CITY_SCENE_EVENTS.placementPreview, null);
      return;
    }
    if (this.exteriorToolDefinitionId) {
      const definition = getExteriorObjectDefinition(this.exteriorToolDefinitionId, ALPHA_CATALOG);
      if (!definition) return;
      const preview = validateWorldObjectPlacement(this.state, {
        definitionId: this.exteriorToolDefinitionId,
        hostTile: this.ghostOrigin,
      }, ALPHA_CATALOG);
      const top = projectGridTop(this.ghostOrigin.x, this.ghostOrigin.y);
      const diamond = [
        new Phaser.Math.Vector2(top.x, top.y),
        new Phaser.Math.Vector2(top.x + CITY_HALF_TILE_WIDTH, top.y + CITY_HALF_TILE_HEIGHT),
        new Phaser.Math.Vector2(top.x, top.y + CITY_TILE_HEIGHT),
        new Phaser.Math.Vector2(top.x - CITY_HALF_TILE_WIDTH, top.y + CITY_HALF_TILE_HEIGHT),
      ];
      const valid = preview.ok && this.state.economy.balance >= definition.price;
      const color = valid ? 0x9bd27e : 0xe07062;
      graphics.fillStyle(color, 0.24).fillPoints(diamond, true);
      graphics.lineStyle(1, color, 0.95).strokePoints(diamond, true);
      const center = projectGridCenter(this.ghostOrigin.x, this.ghostOrigin.y);
      graphics.lineStyle(2, color, 0.96).lineBetween(center.x - 4, center.y, center.x + 4, center.y).lineBetween(center.x, center.y - 4, center.x, center.y + 4);
      this.drawExteriorPlacementGhost(definition, preview, valid);
      this.emitCityEvent(CITY_SCENE_EVENTS.placementPreview, null);
      return;
    }
    if (!this.buildTool) return;
    const preview = createPlacementPreview(
      this.state,
      this.buildTool.definitionId,
      this.ghostOrigin,
      this.buildTool.orientation,
    );
    this.lastPlacementPreview = preview;
    this.emitCityEvent(CITY_SCENE_EVENTS.placementPreview, preview);
    const color = preview.valid ? 0x9bd27e : 0xe07062;
    for (const tile of preview.occupiedTiles) {
      const top = projectGridTop(tile.x, tile.y);
      const diamond = [
        new Phaser.Math.Vector2(top.x, top.y),
        new Phaser.Math.Vector2(top.x + CITY_HALF_TILE_WIDTH, top.y + CITY_HALF_TILE_HEIGHT),
        new Phaser.Math.Vector2(top.x, top.y + CITY_TILE_HEIGHT),
        new Phaser.Math.Vector2(top.x - CITY_HALF_TILE_WIDTH, top.y + CITY_HALF_TILE_HEIGHT),
      ];
      graphics.fillStyle(color, 0.24).fillPoints(diamond, true);
      graphics.lineStyle(1, color, 0.9).strokePoints(diamond, true);
    }
    for (const tile of preview.roadTiles) {
      const top = projectGridTop(tile.x, tile.y);
      const diamond = [
        new Phaser.Math.Vector2(top.x, top.y),
        new Phaser.Math.Vector2(top.x + CITY_HALF_TILE_WIDTH, top.y + CITY_HALF_TILE_HEIGHT),
        new Phaser.Math.Vector2(top.x, top.y + CITY_TILE_HEIGHT),
        new Phaser.Math.Vector2(top.x - CITY_HALF_TILE_WIDTH, top.y + CITY_HALF_TILE_HEIGHT),
      ];
      graphics.fillStyle(0x5f777a, 0.36).fillPoints(diamond, true);
      graphics.lineStyle(1, 0xffd78b, 0.92).strokePoints(diamond, true);
    }
    const removed = new Set(preview.removedObjectIds);
    for (const object of this.state.worldObjects) {
      if (!removed.has(object.instanceId)) continue;
      const center = projectGridCenter(object.hostTile.x, object.hostTile.y);
      graphics
        .fillStyle(0xd66f55, 0.18)
        .fillCircle(center.x, center.y - 2, 9)
        .lineStyle(1, 0xffc07f, 0.95)
        .strokeCircle(center.x, center.y - 2, 9)
        .lineBetween(center.x - 4, center.y - 6, center.x + 4, center.y + 2)
        .lineBetween(center.x + 4, center.y - 6, center.x - 4, center.y + 2);
    }
    const accessTop = projectGridTop(preview.accessTile.x, preview.accessTile.y);
    const accessDiamond = [
      new Phaser.Math.Vector2(accessTop.x, accessTop.y),
      new Phaser.Math.Vector2(accessTop.x + 6, accessTop.y + 3),
      new Phaser.Math.Vector2(accessTop.x, accessTop.y + 6),
      new Phaser.Math.Vector2(accessTop.x - 6, accessTop.y + 3),
    ];
    graphics.lineStyle(1, preview.valid ? 0xffdd88 : color, 1).strokePoints(accessDiamond, true);
  }

  private drawExteriorPlacementGhost(
    definition: NonNullable<ReturnType<typeof getExteriorObjectDefinition>>,
    preview: ReturnType<typeof validateWorldObjectPlacement>,
    valid: boolean,
  ): void {
    if (!this.ghostOrigin) return;
    const orientation = preview.ok ? preview.value.orientation : "north";
    const offset = {
      north: { x: 0, y: -0.16 },
      east: { x: 0.16, y: 0 },
      south: { x: 0, y: 0.16 },
      west: { x: -0.16, y: 0 },
    }[orientation];
    const gridX = this.ghostOrigin.x + (definition.placementRule === "grass-near-road" ? offset.x : 0);
    const gridY = this.ghostOrigin.y + (definition.placementRule === "grass-near-road" ? offset.y : 0);
    const point = projectGridCenter(gridX, gridY);
    let image: Phaser.GameObjects.Image | undefined;

    if (definition.visualKey in GROUND_DECAL_SOURCE_FRAMES) {
      const frame = definition.visualKey as CityGroundDecalFrame;
      const correctionFrame = correctionGroundFrame(frame, gridX, gridY);
      const useCorrection = correctionFrame !== undefined && this.textureAvailable(CITY_TEXTURE_KEYS.environmentCorrections);
      const texture = useCorrection ? CITY_TEXTURE_KEYS.environmentCorrections : CITY_TEXTURE_KEYS.groundDecals;
      if (this.textureAvailable(texture)) {
        const correction = correctionFrame ? ENVIRONMENT_CORRECTION_SOURCE_FRAMES[correctionFrame] : undefined;
        const size = useCorrection && correction ? correction.draw : GROUND_DECAL_SOURCE_FRAMES[frame].draw;
        const origin = useCorrection && correction ? correction.origin : ([0.5, 1] as const);
        image = this.add.image(point.x, point.y + 1, texture, useCorrection ? correctionFrame : frame)
          .setOrigin(origin[0], origin[1])
          .setDisplaySize(size[0], size[1]);
      }
    } else if (definition.visualKey in PROP_SOURCE_FRAMES) {
      const frame = definition.visualKey as CityPropFrame;
      const correctionFrame = this.correctionFurnitureFrame(frame, gridX, gridY, this.ghostOrigin);
      const useCorrection = correctionFrame !== undefined && this.textureAvailable(CITY_TEXTURE_KEYS.environmentCorrections);
      const texture = useCorrection ? CITY_TEXTURE_KEYS.environmentCorrections : CITY_TEXTURE_KEYS.props;
      if (this.textureAvailable(texture)) {
        const correction = correctionFrame ? ENVIRONMENT_CORRECTION_SOURCE_FRAMES[correctionFrame] : undefined;
        const size = useCorrection && correction ? correction.draw : PROP_SOURCE_FRAMES[frame].draw;
        const origin = useCorrection && correction ? correction.origin : ([0.5, 1] as const);
        image = this.add.image(point.x, point.y + 1, texture, useCorrection ? correctionFrame : frame)
          .setOrigin(origin[0], origin[1])
          .setDisplaySize(size[0], size[1]);
      }
    }
    if (image) {
      image.setDepth(860_001).setAlpha(0.72).setTint(valid ? 0xc8ffbf : 0xffa595);
      this.exteriorGhostObjects.push(image);
    }

    const reason = valid
      ? "Click para colocar"
      : preview.ok
        ? `Faltan ${Math.max(0, definition.price - this.state.economy.balance)} L`
        : this.exteriorPlacementReason(preview.error[0]?.code);
    const label = this.add.text(point.x, point.y - 30, `${definition.name} · ${definition.price} L\n${reason}`, {
      fontFamily: '"Courier New", monospace',
      fontSize: "8px",
      color: valid ? "#fff0c9" : "#ffd0c2",
      align: "center",
      backgroundColor: "rgba(36, 49, 49, 0.9)",
      padding: { x: 5, y: 3 },
      resolution: 2,
    }).setOrigin(0.5, 1).setDepth(860_002);
    this.exteriorGhostObjects.push(label);
  }

  private exteriorPlacementReason(code: string | undefined): string {
    const labels: Readonly<Record<string, string>> = {
      OUT_OF_BOUNDS: "Fuera del mapa",
      SECTOR_LOCKED: "Sector cerrado",
      TERRAIN_BLOCKED: "Sólo sobre pasto",
      BUILDING_COLLISION: "Hay un edificio",
      OBJECT_COLLISION: "Lugar ocupado",
      ROAD_ADJACENCY_REQUIRED: "Debe ir junto al camino",
    };
    return code ? labels[code] ?? "No se puede colocar aquí" : "No se puede colocar aquí";
  }

  private selectionFromBuilding(building: BuildingInstanceV1): CitySceneSelection {
    const definition = getBuildingDefinition(building.definitionId, ALPHA_CATALOG);
    return {
      buildingId: building.id,
      definitionId: building.definitionId,
      kind: building.kind,
      name: definition?.name ?? building.definitionId,
      status: building.status,
      level: building.level,
      interiorId: building.interiorId,
    };
  }

  private selectionFromWorldObject(object: WorldObjectInstanceV1): CityWorldObjectSelection {
    const definition = getExteriorObjectDefinition(object.definitionId, ALPHA_CATALOG);
    return {
      instanceId: object.instanceId,
      definitionId: object.definitionId,
      name: definition?.name ?? object.definitionId,
      category: definition?.category ?? "ground-cover",
      removable: object.removable,
    };
  }

  private clearWorldObjectSelection(): void {
    const hadSelection = this.selectedWorldObjectId !== undefined;
    this.selectedWorldObjectId = undefined;
    this.hoveredWorldObjectId = undefined;
    if (hadSelection) this.emitCityEvent(CITY_SCENE_EVENTS.worldObjectSelection, null);
  }

  private destroyObjects(objects: Phaser.GameObjects.GameObject[]): void {
    for (const object of objects.splice(0)) {
      if (object instanceof Phaser.GameObjects.Image) this.tintables.delete(object);
      object.destroy();
    }
  }

  private destroyLights(lights: LightView[]): void {
    for (const light of lights.splice(0)) light.sprite.destroy();
  }
}
