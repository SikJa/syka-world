import Phaser from "phaser";
import type { GameController } from "../../application";
import {
  CAFE_NPC_IDS,
  computeSpatialDepth,
  findSpatialPath,
  isSpatialCellWalkable,
  SPATIAL_DEPTH_BASE,
  SPATIAL_DEPTH_SUB_LAYER,
  spatialRenderPartDepth,
  type AgentActivity,
  type AgentId,
  type AgentStateV1,
  type CafeNpcActivity,
  type CafeNpcId,
  type GameStateV1,
  type GridPoint,
  type NpcStateV1,
  type ProfileId,
  type Result,
  type SpatialSceneIndexV1,
  type SpatialRenderPartV1,
} from "../../core";
import {
  AGENT_ACTIVITY_ORDER,
  AGENT_ID_ORDER,
  CITY_TEXTURE_KEYS,
  agentFrameName,
} from "../city/assets";
import {
  CAFE_DECOR_POSITIONS,
  CAFE_DECOR_VISUALS,
  CAFE_HOTSPOTS,
  CAFE_INTERIOR_FLOOR_BOUNDS,
  CAFE_INTERIOR_SPATIAL_GRID,
  getInteriorLighting,
  optionalFurniture,
  type InteriorHotspot,
} from "../interior/interiorModel";
import {
  CAFE_SPATIAL_ENTITIES,
  cafeAnchorCell,
  cafeCellToNormalized,
  cafeOptionalDecorSignature,
  cafeNormalizedToCell,
  compileCafeSpatialScene,
  createCafeSpatialActorSeeds,
} from "../interior/cafeSpatialModel";

export interface CafeInteriorSceneData {
  readonly buildingId: string;
}

export interface InteriorSelectionDetail {
  readonly buildingId: string;
  readonly hotspot: InteriorHotspot;
}

export interface CafeInteriorSceneApi {
  readonly exit: () => void;
  readonly inspect: (hotspotId: InteriorHotspot["id"]) => void;
  readonly installDecor: (slotId: string, furnitureId: string) => boolean;
  readonly getBuildingId: () => string;
  readonly spatial: CafeInteriorSpatialApi;
}

export interface CafeInteriorSpatialApi {
  readonly sceneId: string;
  readonly grid: Readonly<{ width: number; height: number }>;
  readonly isWalkable: (cell: GridPoint) => boolean;
  readonly cellToNormalized: (cell: GridPoint) => readonly [number, number];
  readonly normalizedToCell: (normalizedX: number, normalizedY: number) => GridPoint | null;
}

declare global {
  interface Window {
    __SYKA_INTERIOR__?: CafeInteriorSceneApi;
  }
}

interface InteriorAgentView {
  readonly container: Phaser.GameObjects.Container;
  readonly shadow: Phaser.GameObjects.Graphics;
  readonly sprite: Phaser.GameObjects.Image;
  readonly action: Phaser.GameObjects.Graphics;
  readonly hitZone: Phaser.GameObjects.Zone;
  readonly profileId: ProfileId;
  cell: GridPoint;
  displayHeight: number;
}

interface CafeNpcView {
  readonly container: Phaser.GameObjects.Container;
  readonly shadow: Phaser.GameObjects.Graphics;
  readonly sprite: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  readonly hitZone: Phaser.GameObjects.Zone;
  cell: GridPoint;
  displayHeight: number;
}

interface CompatibleControlActorSnapshot {
  readonly actorId: string;
  readonly profileId?: ProfileId;
  readonly sceneId: string;
  readonly cell: GridPoint;
  readonly path: readonly GridPoint[];
  readonly destination?: GridPoint;
  readonly possessed?: boolean;
}

interface CompatibleControlSnapshot {
  readonly selectedProfileId?: ProfileId;
  readonly possessedProfileId?: ProfileId;
  readonly actors: readonly CompatibleControlActorSnapshot[];
}

const interiorAgentCell = (agent: AgentStateV1): GridPoint | undefined => {
  if (agent.location.kind !== "interior") return undefined;
  const candidate = (agent.location as typeof agent.location & { readonly tile?: unknown }).tile;
  if (!candidate || typeof candidate !== "object") return cafeAnchorCell(agent.location.anchorId);
  const point = candidate as Partial<GridPoint>;
  return Number.isInteger(point.x) && Number.isInteger(point.y)
    ? { x: point.x!, y: point.y! }
    : cafeAnchorCell(agent.location.anchorId);
};

export type CafeActorStance = "standing" | "walking" | "service" | "seated" | "reading";

export interface CafeActorVisualSpec {
  readonly normalizedPosition: readonly [number, number];
  readonly stance: CafeActorStance;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly visibleHeight: number;
  readonly footOriginY: number;
  readonly shadowWidth: number;
  readonly shadowHeight: number;
  readonly shadowAlpha: number;
}

export interface CafeActorOcclusionRegion {
  readonly id: string;
  readonly entityId: string;
  readonly normalizedRect: readonly [number, number, number, number];
}

/**
 * Areas copied from the room raster and rendered above the actors. Safe-floor
 * navigation means only the service counter still needs a foreground slice:
 * café staff may stand behind it, while guests never walk behind other props.
 */
export const CAFE_ACTOR_OCCLUSION_REGIONS: readonly CafeActorOcclusionRegion[] =
  CAFE_SPATIAL_ENTITIES.flatMap(({ entity, normalizedOcclusionRect }) => normalizedOcclusionRect
    ? [{
        id: `${entity.id}-front`,
        entityId: entity.id,
        normalizedRect: normalizedOcclusionRect,
      }]
    : []);

const ACTOR_DEPTH_BASE = SPATIAL_DEPTH_BASE + 600;

export const cafeForegroundDepth = (
  normalizedRect: readonly [number, number, number, number],
  roomTop: number,
  roomHeight: number,
): number => {
  // The foreground crop's depth is derived from its vertical position in the
  // room. We map the normalized rect's bottom edge to a grid Y so the
  // deterministic depth compositor places it above actors standing at that row.
  const gridY = Math.round((normalizedRect[1] + normalizedRect[3]) * 17);
  return computeSpatialDepth({
    cell: { x: 16, y: gridY },
    subLayer: SPATIAL_DEPTH_SUB_LAYER.front,
  }) + ACTOR_DEPTH_BASE;
};

/**
 * Visual actor motion uses the same authored collision grid as manual control.
 * A semantic routine may jump directly between anchors in game state, but the
 * renderer must never interpolate a straight line through painted furniture.
 */
export const cafeActorMovementRoute = (
  scene: SpatialSceneIndexV1,
  from: GridPoint,
  to: GridPoint,
): readonly GridPoint[] => {
  const route = findSpatialPath(scene, from, to);
  return route.ok ? route.value : [];
};

const INTERIOR_AGENT_TINT: Readonly<Record<AgentId, number>> = {
  syka: 0x7ea4ad,
  elen: 0xd6755b,
  astrelis: 0xe0b45f,
  zerny: 0x82a96f,
};

const CAFE_NPC_TEXTURE_KEY = "cafe-npcs-atlas-v1";
const CAFE_NPC_ACTIVITIES = ["idle", "walking", "working", "social"] as const satisfies readonly CafeNpcActivity[];
const npcFrameName = (id: CafeNpcId, activity: CafeNpcActivity): string => `cafe-npc-${id}-${activity}`;

const AGENT_VISIBLE_FRAME_FRACTION: Readonly<Record<AgentId, number>> = {
  syka: 116 / 128,
  elen: 120 / 128,
  astrelis: 58 / 128,
  zerny: 86 / 128,
};

const AGENT_WORLD_HEIGHT_RATIO: Readonly<Record<AgentId, number>> = {
  syka: 1,
  elen: 1,
  astrelis: 0.56,
  zerny: 0.75,
};

const AGENT_FOOT_ORIGIN: Readonly<Record<AgentId, number>> = {
  syka: 125 / 128,
  elen: 126 / 128,
  astrelis: 126 / 128,
  zerny: 125 / 128,
};

const NPC_VISIBLE_FRAME_FRACTION = 152 / 160;
const NPC_FOOT_ORIGIN = 156 / 160;

const ACTOR_POSITION_NUDGE: Readonly<Record<AgentId | CafeNpcId, readonly [number, number]>> = {
  syka: [-0.012, 0],
  elen: [0.012, 0.006],
  astrelis: [-0.024, 0.012],
  zerny: [0.025, 0.014],
  "alma-rios": [-0.006, 0],
  "beni-menta": [0.008, 0.004],
  "iara-luz": [-0.008, 0.003],
  "milo-niebla": [0.006, 0.004],
  "noa-junco": [0.01, 0.006],
};

const actorAnchorPosition = (
  anchorId: string,
  semantic: string | undefined,
  cell?: GridPoint,
): readonly [number, number] => {
  if (cell) return cafeCellToNormalized(cell);
  const workingAtCounter = anchorId === "counter" && (
    semantic === "baking" ||
    semantic === "serve-coffee" ||
    semantic === "serving" ||
    semantic === "brewing"
  );
  return cafeCellToNormalized(cafeAnchorCell(workingAtCounter ? "bartender-station" : anchorId));
};

const actorStance = (anchorId: string, semantic: string | undefined): CafeActorStance => {
  if (anchorId === "entry") return "walking";
  if (
    anchorId === "coffee-machine" ||
    anchorId === "bartender-station" ||
    semantic === "serve-coffee" ||
    semantic === "serving" ||
    semantic === "brewing" ||
    semantic === "baking"
  ) return "service";
  if (anchorId.startsWith("table-seat")) return "seated";
  if (anchorId === "library-chair" || anchorId === "fireplace" || semantic === "read" || semantic === "reading") {
    return "reading";
  }
  return "standing";
};

/** Pure visual calibration shared by the four Hermes actors and five local NPCs. */
export const cafeActorVisualSpec = (
  kind: "agent" | "npc",
  id: AgentId | CafeNpcId,
  anchorId: string,
  roomHeight: number,
  semantic?: string,
  cell?: GridPoint,
): CafeActorVisualSpec => {
  const basePosition = actorAnchorPosition(anchorId, semantic, cell);
  // A free-walking actor must put its feet exactly on the collision cell. The
  // old per-character nudge moved some sprites by almost one whole cell and
  // visually pushed them back inside furniture despite valid pathfinding.
  const nudge = cell ? [0, 0] as const : ACTOR_POSITION_NUDGE[id];
  const normalizedPosition: readonly [number, number] = [basePosition[0] + nudge[0], basePosition[1] + nudge[1]];
  const stance = actorStance(anchorId, semantic);
  const perspective = Phaser.Math.Linear(0.94, 1, Phaser.Math.Clamp((normalizedPosition[1] - 0.3) / 0.58, 0, 1));
  const stanceScale = stance === "seated" ? 0.94 : stance === "reading" ? 0.96 : 1;
  const humanVisibleHeight = Phaser.Math.Clamp(Math.round(roomHeight * 0.14), 44, 52);
  const agentId = kind === "agent" ? id as AgentId : undefined;
  const worldHeightRatio = agentId ? AGENT_WORLD_HEIGHT_RATIO[agentId] : 1;
  const visibleFrameFraction = agentId ? AGENT_VISIBLE_FRAME_FRACTION[agentId] : NPC_VISIBLE_FRAME_FRACTION;
  const visibleHeight = humanVisibleHeight * worldHeightRatio * perspective * stanceScale;
  const displayHeight = Math.round(visibleHeight / visibleFrameFraction);
  const displayWidth = Math.round(displayHeight * (kind === "agent" ? 0.5 : 0.8));
  const footOriginY = agentId ? AGENT_FOOT_ORIGIN[agentId] : NPC_FOOT_ORIGIN;
  const shadowScale = stance === "service" ? 0.5 : stance === "seated" || stance === "reading" ? 0.72 : 1;
  const shadowAlpha = stance === "service" ? 0.1 : stance === "seated" || stance === "reading" ? 0.18 : 0.27;
  return {
    normalizedPosition,
    stance,
    displayWidth,
    displayHeight,
    visibleHeight: Math.round(visibleHeight),
    footOriginY,
    shadowWidth: Math.max(7, Math.round(displayWidth * 0.72 * shadowScale)),
    shadowHeight: Math.max(2, Math.round(visibleHeight * 0.1 * shadowScale)),
    shadowAlpha,
  };
};

export class CafeInteriorScene extends Phaser.Scene {
  private buildingId = "";
  private unsubscribe: (() => void) | undefined;
  private spatialScene: SpatialSceneIndexV1 | undefined;
  private room: Phaser.GameObjects.Image | undefined;
  private readonly actorForeground: Phaser.GameObjects.Image[] = [];
  private spatialControlLayer: Phaser.GameObjects.Graphics | undefined;
  private cityBackdrop: Phaser.GameObjects.Container | undefined;
  private warmPass: Phaser.GameObjects.Graphics | undefined;
  private hotspotLayer: Phaser.GameObjects.Container | undefined;
  private readonly optionalDecorSprites: Phaser.GameObjects.Image[] = [];
  private readonly agentViews = new Map<AgentId, InteriorAgentView>();
  private readonly npcViews = new Map<CafeNpcId, CafeNpcView>();
  private alphaAgentsAvailable = false;
  private cafeNpcsAvailable = false;
  private roomBounds = new Phaser.Geom.Rectangle(74, 74, 572, 336);
  private viewportWidth = 720;
  private viewportHeight = 450;
  private spatialSignature = "";
  private spatialFurnitureSignature = "";
  private spatialVersion = 0;

  constructor(private readonly controller: GameController) {
    super("cafe-interior");
  }

  init(data: CafeInteriorSceneData): void {
    this.buildingId = data.buildingId;
  }

  preload(): void {
    const loadOnce = (key: string, path: string): void => {
      if (!this.textures.exists(key)) this.load.image(key, path);
    };
    loadOnce("alpha-cafe-interior", "/assets/generated/alpha-v1/cafe-interior-v1.png");
    loadOnce("gate-house", "/assets/generated/gate-v2/house-exterior-v1.png");
    loadOnce("gate-cafe", "/assets/generated/gate-v2/cafe-exterior-v1.png");
    loadOnce("alpha-cafe-decor", "/assets/generated/alpha-v1/cafe-optional-decor-sheet-v1.png");
    // CityScene is the canonical owner of the shared actor atlases and always
    // boots first. Re-queueing them here races the loader on interior restore
    // and produces duplicate texture keys.
  }

  create(): void {
    this.viewportWidth = this.scale.width;
    this.viewportHeight = this.scale.height;
    this.refreshSpatialScene(this.controller.getSnapshot().game, true);
    this.registerDecorFrames();
    this.alphaAgentsAvailable = this.registerAgentFrames();
    this.cafeNpcsAvailable = this.registerCafeNpcFrames();
    this.createFallbackAgentTexture();
    this.drawCityBackdrop();
    this.createRoom();
    this.createActorForeground();
    this.spatialControlLayer = this.add.graphics().setDepth(580);
    this.createHotspots();
    this.createWarmPass();
    this.bindInput();
    this.unsubscribe = this.controller.subscribe((state) => this.renderState(state));
    this.exposeApi();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.game.events.emit("syka:interior-ready", { buildingId: this.buildingId });
  }

  activateSpatialControl(): boolean {
    const scene = this.spatialScene;
    if (!scene) return false;
    const state = this.controller.getSnapshot().game;
    const actors = createCafeSpatialActorSeeds(state, this.buildingId);
    const signature = JSON.stringify(
      actors.map((actor) => [actor.actorId, actor.cell.x, actor.cell.y, actor.facing]),
    );
    if (signature !== this.spatialSignature) {
      this.spatialSignature = signature;
      this.spatialVersion += 1;
    }
    const result = this.controller.configureSpatialScene({
      scene: {
        ...scene.definition,
        version: Math.max(scene.definition.version, this.spatialVersion),
      },
      binding: { kind: "interior", buildingId: this.buildingId },
      actors,
    });
    if (!result.ok) this.emitError(result);
    return result.ok;
  }

  private drawCityBackdrop(): void {
    const width = this.viewportWidth;
    const height = this.viewportHeight;
    const graphics = this.add.graphics().setDepth(-100);
    graphics.fillStyle(0x7896aa, 1).fillRect(0, 0, width, height);
    graphics.fillStyle(0x526f78, 0.42).fillPoints([
      new Phaser.Math.Vector2(0, height * 0.71),
      new Phaser.Math.Vector2(width * 0.32, height * 0.45),
      new Phaser.Math.Vector2(width, height * 0.69),
      new Phaser.Math.Vector2(width, height),
      new Phaser.Math.Vector2(0, height),
    ]);
    this.cityBackdrop = this.add.container(0, 0).setDepth(-80);
    const house = this.add.image(width * 0.17, height * 0.59, "gate-house").setOrigin(0.5, 1).setScale(0.055).setAlpha(0.5);
    const cafe = this.add.image(width * 0.84, height * 0.62, "gate-cafe").setOrigin(0.5, 1).setScale(0.052).setAlpha(0.46);
    const veil = this.add.rectangle(width / 2, height / 2, width, Math.max(1, height - 14), 0x274654, 0.38);
    this.cityBackdrop.add([house, cafe, veil]);
  }

  private createRoom(): void {
    const texture = this.textures.get("alpha-cafe-interior");
    const source = texture.getSourceImage() as { width?: number; height?: number };
    const width = source.width ?? 1;
    const height = source.height ?? 1;
    const maximumWidth = Math.min(760, 588 + Math.max(0, this.viewportWidth - 720) * 0.8);
    const maximumHeight = Math.min(346, this.viewportHeight - 82);
    const scale = Math.min(maximumWidth / width, maximumHeight / height);
    const drawWidth = Math.max(1, Math.round(width * scale));
    const drawHeight = Math.max(1, Math.round(height * scale));
    this.roomBounds = new Phaser.Geom.Rectangle(
      Math.round((this.viewportWidth - drawWidth) / 2),
      Math.round(66 + (maximumHeight - drawHeight) / 2),
      drawWidth,
      drawHeight,
    );
    this.room = this.add
      // Actor occlusion slices are added as frames to this same texture. Phaser
      // promotes the first custom frame to `firstFrame`, so omitting the frame
      // here corrupts the room raster after leaving and re-entering the scene.
      .image(this.roomBounds.centerX, this.roomBounds.centerY, "alpha-cafe-interior", "__BASE")
      .setDisplaySize(drawWidth, drawHeight)
      .setDepth(100);
  }

  private createActorForeground(): void {
    const texture = this.textures.get("alpha-cafe-interior");
    const source = texture.getSourceImage() as { width?: number; height?: number };
    const sourceWidth = source.width ?? 1;
    const sourceHeight = source.height ?? 1;
    this.actorForeground.length = 0;
    for (const region of CAFE_ACTOR_OCCLUSION_REGIONS) {
      const [nx, ny, nw, nh] = region.normalizedRect;
      const frameName = `cafe-foreground-${region.id}`;
      if (!texture.has(frameName)) {
        texture.add(
          frameName,
          0,
          Math.round(nx * sourceWidth),
          Math.round(ny * sourceHeight),
          Math.max(1, Math.round(nw * sourceWidth)),
          Math.max(1, Math.round(nh * sourceHeight)),
        );
      }
      this.actorForeground.push(this.add
        .image(
          this.roomBounds.x + (nx + nw / 2) * this.roomBounds.width,
          this.roomBounds.y + (ny + nh / 2) * this.roomBounds.height,
          "alpha-cafe-interior",
          frameName,
        )
        .setDisplaySize(nw * this.roomBounds.width, nh * this.roomBounds.height)
        .setDepth(cafeForegroundDepth(region.normalizedRect, this.roomBounds.y, this.roomBounds.height)));
    }
  }

  private createHotspots(): void {
    this.hotspotLayer = this.add.container(0, 0).setDepth(500);
    for (const hotspot of CAFE_HOTSPOTS) {
      const [nx, ny, nw, nh] = hotspot.normalizedRect;
      const zone = this.add
        .zone(
          this.roomBounds.x + nx * this.roomBounds.width,
          this.roomBounds.y + ny * this.roomBounds.height,
          nw * this.roomBounds.width,
          nh * this.roomBounds.height,
        )
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      const cue = this.createHotspotCue(zone);
      zone.on("pointerover", () => cue.setAlpha(1));
      zone.on("pointerout", () => cue.setAlpha(0));
      zone.on("pointerdown", (
        pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        if (!this.selectInteriorAgentAt(pointer.worldX, pointer.worldY)) this.inspect(hotspot);
      });
      this.hotspotLayer.add([zone, cue]);
    }
  }

  private createHotspotCue(zone: Phaser.GameObjects.Zone): Phaser.GameObjects.Container {
    const cueWidth = Math.min(48, Math.max(18, Math.round(zone.width * 0.22)));
    const cueHeight = Math.min(24, Math.max(10, Math.round(zone.height * 0.18)));
    const marker = this.add.graphics();
    marker
      .fillStyle(0xffd98a, 0.08)
      .fillEllipse(0, 0, cueWidth, cueHeight)
      .lineStyle(1, 0xffe6aa, 0.92)
      .strokeEllipse(0, 0, cueWidth, cueHeight)
      .fillStyle(0xfff1bf, 1)
      .fillRect(-1, -1, 3, 3);
    return this.add
      .container(zone.x + zone.width / 2, zone.y + zone.height / 2, [marker])
      .setAlpha(0);
  }

  private createWarmPass(): void {
    this.warmPass = this.add.graphics().setDepth(350).setBlendMode(Phaser.BlendModes.ADD);
    const fireplaceX = this.roomBounds.x + this.roomBounds.width * 0.76;
    const fireplaceY = this.roomBounds.y + this.roomBounds.height * 0.42;
    const counterX = this.roomBounds.x + this.roomBounds.width * 0.27;
    const counterY = this.roomBounds.y + this.roomBounds.height * 0.7;
    this.warmPass.fillStyle(0xffc96b, 0.09).fillCircle(fireplaceX, fireplaceY, 42);
    this.warmPass.fillStyle(0xffe39a, 0.07).fillCircle(counterX, counterY, 34);
  }

  private bindInput(): void {
    this.input.on("pointerdown", this.handleSpatialPointerDown, this);
    this.input.on("pointermove", this.handleNpcPointerMove, this);
    this.input.on("gameout", this.hideNpcLabels, this);
  }

  private handleSpatialPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button !== 0 || this.selectInteriorAgentAt(pointer.worldX, pointer.worldY)) return;
    const scene = this.spatialScene;
    if (!scene || !this.roomBounds.contains(pointer.worldX, pointer.worldY)) return;
    const normalizedX = (pointer.worldX - this.roomBounds.x) / this.roomBounds.width;
    const normalizedY = (pointer.worldY - this.roomBounds.y) / this.roomBounds.height;
    const cell = cafeNormalizedToCell(normalizedX, normalizedY, scene);
    if (!cell) return;
    this.game.events.emit("syka:spatial-click", { sceneId: scene.definition.id, cell });
  }

  private handleNpcPointerMove(pointer: Phaser.Input.Pointer): void {
    for (const view of this.npcViews.values()) {
      const halfWidth = view.hitZone.width / 2;
      const inside = pointer.worldX >= view.container.x - halfWidth &&
        pointer.worldX <= view.container.x + halfWidth &&
        pointer.worldY >= view.container.y - view.displayHeight - 4 &&
        pointer.worldY <= view.container.y + 4;
      view.label.setVisible(inside);
    }
  }

  private hideNpcLabels(): void {
    for (const view of this.npcViews.values()) view.label.setVisible(false);
  }

  private renderState(state: GameStateV1): void {
    this.refreshSpatialScene(state);
    const lighting = getInteriorLighting(state.clock.minuteOfDay);
    this.cameras.main.setBackgroundColor(lighting.sky);
    this.cityBackdrop?.iterate((child: Phaser.GameObjects.GameObject) => {
      if (child instanceof Phaser.GameObjects.Image) child.setTint(lighting.cityTint);
    });
    this.room?.setTint(lighting.roomTint);
    for (const foreground of this.actorForeground) foreground.setTint(lighting.roomTint);
    this.warmPass?.setAlpha(lighting.warmLightAlpha);
    this.renderOptionalDecor(state);
    this.renderSpatialControl();
    this.renderInteriorAgents(state);
    this.renderCafeNpcs(state);
    if (state.camera.scene === "interior" && state.camera.interiorBuildingId === this.buildingId) {
      this.activateSpatialControl();
    }
  }

  private renderSpatialControl(): void {
    const layer = this.spatialControlLayer;
    const scene = this.spatialScene;
    if (!layer || !scene) return;
    layer.clear();
    const snapshot = this.controller.getSnapshot() as ReturnType<GameController["getSnapshot"]> & {
      readonly control?: CompatibleControlSnapshot;
    };
    const control = snapshot.control;
    if (!control) return;
    const profileId = control.possessedProfileId ?? control.selectedProfileId;
    const actor = control.actors.find((candidate) =>
      candidate.sceneId === scene.definition.id && (
        candidate.possessed ||
        (profileId !== undefined && (candidate.profileId === profileId || candidate.actorId === profileId))
      ));
    if (!actor) return;
    const path = actor.path.length > 0 ? actor.path : [actor.cell];
    if (path.length > 1) {
      layer.lineStyle(2, 0xffd986, 0.72).beginPath();
      path.forEach((cell, index) => {
        const point = this.cafeCellToWorld(cell);
        if (index === 0) layer.moveTo(point.x, point.y);
        else layer.lineTo(point.x, point.y);
      });
      layer.strokePath();
    }
    const destination = actor.destination ?? path[path.length - 1];
    if (!destination) return;
    const point = this.cafeCellToWorld(destination);
    layer
      .fillStyle(0xffe6a6, 0.18)
      .fillCircle(point.x, point.y, 7)
      .lineStyle(1, 0xffefbf, 0.9)
      .strokeCircle(point.x, point.y, 7)
      .fillStyle(0xfff4cf, 0.92)
      .fillCircle(point.x, point.y, 2);
  }

  private cafeCellToWorld(cell: GridPoint): Phaser.Math.Vector2 {
    const [normalizedX, normalizedY] = cafeCellToNormalized(cell);
    return new Phaser.Math.Vector2(
      this.roomBounds.x + normalizedX * this.roomBounds.width,
      this.roomBounds.y + normalizedY * this.roomBounds.height,
    );
  }

  private moveActorView(
    view: Pick<InteriorAgentView, "container" | "cell"> | Pick<CafeNpcView, "container" | "cell">,
    targetCell: GridPoint,
    targetX: number,
    targetY: number,
    millisecondsPerCell: number,
    onStart?: () => void,
    onComplete?: () => void,
  ): void {
    const route = this.spatialScene
      ? cafeActorMovementRoute(this.spatialScene, view.cell, targetCell)
      : [];
    this.tweens.killTweensOf(view.container);
    view.cell = { ...targetCell };

    // A stale save or newly installed blocker can invalidate the previous
    // visual cell. Never draw a straight line through the room as a fallback:
    // relocate with a short fade and let spatial reconciliation own the cell.
    if (route.length < 2) {
      view.container.setPosition(Math.round(targetX), Math.round(targetY)).setAlpha(0.35);
      onStart?.();
      this.tweens.add({
        targets: view.container,
        alpha: 1,
        duration: 140,
        ease: "Sine.Out",
        onComplete: () => onComplete?.(),
      });
      return;
    }

    const lastIndex = route.length - 2;
    const tweens = route.slice(1).map((cell, index) => {
      const point = index === lastIndex
        ? new Phaser.Math.Vector2(targetX, targetY)
        : this.cafeCellToWorld(cell);
      return {
        x: Math.round(point.x),
        y: Math.round(point.y),
        duration: millisecondsPerCell,
        ease: "Linear",
        onUpdate: () => view.container.setDepth(this.actorDepth(view.container.y)),
      };
    });
    this.tweens.chain({
      targets: view.container,
      tweens,
      onStart: () => onStart?.(),
      onComplete: () => onComplete?.(),
    });
  }

  private renderInteriorAgents(state: GameStateV1): void {
    const inside = state.agents.filter(
      (agent) => agent.location.kind === "interior" && agent.location.buildingId === this.buildingId,
    );
    const controlActors = new Map(
      this.controller.getSnapshot().control.actors.map((actor) => [actor.actorId, actor] as const),
    );
    const wanted = new Set(inside.map((agent) => agent.id));
    for (const [id, view] of this.agentViews) {
      if (wanted.has(id)) continue;
      this.tweens.killTweensOf(view.container);
      view.container.destroy(true);
      this.agentViews.delete(id);
    }
    for (const agent of inside) {
      const anchorId = agent.location.kind === "interior" ? agent.location.anchorId : "entry";
      const semantic = agent.location.kind === "interior" ? agent.location.action : undefined;
      const targetCell = controlActors.get(agent.profileId)?.cell ?? interiorAgentCell(agent) ?? cafeAnchorCell(anchorId);
      const spec = cafeActorVisualSpec(
        "agent",
        agent.id,
        anchorId,
        this.roomBounds.height,
        semantic,
        targetCell,
      );
      const x = this.roomBounds.x + this.roomBounds.width * spec.normalizedPosition[0];
      const y = this.roomBounds.y + this.roomBounds.height * spec.normalizedPosition[1];
      let view = this.agentViews.get(agent.id);
      if (!view) {
        view = this.createInteriorAgent(agent, x, y, targetCell, spec);
        this.agentViews.set(agent.id, view);
        view.container.setAlpha(0);
        this.tweens.add({ targets: view.container, alpha: 1, duration: 180, ease: "Sine.Out" });
      } else if (view.cell.x !== targetCell.x || view.cell.y !== targetCell.y) {
        this.moveActorView(view, targetCell, x, y, 170);
      } else if (!this.tweens.isTweening(view.container) &&
        (Math.abs(view.container.x - x) > 0.5 || Math.abs(view.container.y - y) > 0.5)) {
        view.container.setPosition(Math.round(x), Math.round(y));
      }
      view.container.setVisible(state.agentsVisible);
      view.container.setDepth(this.actorDepth(view.container.y));
      this.applyInteriorAgentVisual(view, agent, spec);
    }
  }

  private createInteriorAgent(
    agent: AgentStateV1,
    x: number,
    y: number,
    cell: GridPoint,
    spec: CafeActorVisualSpec,
  ): InteriorAgentView {
    const texture = this.alphaAgentsAvailable ? CITY_TEXTURE_KEYS.alphaAgents : CITY_TEXTURE_KEYS.fallbackAgent;
    const frame = this.alphaAgentsAvailable ? agentFrameName(agent.id, this.interiorAgentActivity(agent)) : undefined;
    const shadow = this.add.graphics();
    const sprite = this.add.image(0, 0, texture, frame).setOrigin(0.5, spec.footOriginY);
    const displayWidth = this.alphaAgentsAvailable ? spec.displayWidth : Math.round(spec.displayHeight * 0.44);
    sprite.setDisplaySize(displayWidth, spec.displayHeight);
    if (!this.alphaAgentsAvailable) sprite.setTint(INTERIOR_AGENT_TINT[agent.id]);
    const action = this.add.graphics();
    const hitZone = this.add
      .zone(0, -spec.displayHeight / 2, Math.max(34, displayWidth + 10), spec.displayHeight + 8)
      .setOrigin(0.5);
    hitZone.setData("profileId", agent.profileId);
    const container = this.add
      .container(Math.round(x), Math.round(y), [shadow, hitZone, sprite, action])
      .setDepth(this.actorDepth(y))
      .setSize(Math.max(34, displayWidth + 10), spec.displayHeight + 8);
    const view = {
      container,
      shadow,
      sprite,
      action,
      hitZone,
      profileId: agent.profileId,
      cell,
      displayHeight: spec.displayHeight,
    };
    this.drawContactShadow(shadow, spec);
    return view;
  }

  private emitInteriorAgentSelection(profileId: ProfileId): void {
    this.game.events.emit("syka:interior-agent-selection", { profileId });
  }

  private selectInteriorAgentAt(worldX: number, worldY: number): boolean {
    const views = [...this.agentViews.values()].reverse();
    for (const view of views) {
      if (!view.container.visible || !view.container.getBounds().contains(worldX, worldY)) continue;
      this.emitInteriorAgentSelection(view.profileId);
      return true;
    }
    return false;
  }

  private applyInteriorAgentVisual(
    view: InteriorAgentView,
    agent: AgentStateV1,
    spec: CafeActorVisualSpec,
  ): void {
    const activity = this.interiorAgentActivity(agent);
    if (this.alphaAgentsAvailable) view.sprite.setFrame(agentFrameName(agent.id, activity));
    const displayWidth = this.alphaAgentsAvailable ? spec.displayWidth : Math.round(spec.displayHeight * 0.44);
    view.sprite.setOrigin(0.5, spec.footOriginY).setDisplaySize(displayWidth, spec.displayHeight);
    view.displayHeight = spec.displayHeight;
    view.hitZone.setPosition(0, -spec.displayHeight / 2).setSize(Math.max(34, displayWidth + 10), spec.displayHeight + 8);
    view.container.setSize(Math.max(34, displayWidth + 10), spec.displayHeight + 8);
    this.drawContactShadow(view.shadow, spec);
    view.action.clear();
    if (agent.location.kind !== "interior" || !agent.location.action) return;
    const actionY = -view.displayHeight - 6;
    view.action.fillStyle(0x3d2c24, 0.86).fillRect(-5, actionY, 10, 7);
    view.action.fillStyle(0xffe3a0, 1);
    if (agent.location.action === "read") {
      view.action.fillRect(-3, actionY + 2, 3, 3).fillRect(1, actionY + 2, 3, 3).fillRect(0, actionY + 2, 1, 4);
    } else if (agent.location.action === "serve-coffee") {
      view.action.fillRect(-3, actionY + 2, 5, 3).fillRect(2, actionY + 3, 2, 2).fillRect(-2, actionY + 1, 1, 1);
    } else if (agent.location.action === "warm-fireplace") {
      view.action.fillStyle(0xe77c4f, 1).fillRect(-2, actionY + 2, 5, 4).fillStyle(0xffd36e, 1).fillRect(0, actionY + 2, 2, 3);
    } else {
      view.action.fillRect(-3, actionY + 3, 7, 2).fillRect(-2, actionY + 5, 1, 2).fillRect(3, actionY + 5, 1, 2);
    }
  }

  private renderCafeNpcs(state: GameStateV1): void {
    const inside = state.npcs.filter(
      (npc) => npc.location.kind === "interior" && npc.location.buildingId === this.buildingId,
    );
    const wanted = new Set(inside.map((npc) => npc.id));
    for (const [id, view] of this.npcViews) {
      if (wanted.has(id)) continue;
      this.tweens.killTweensOf(view.container);
      view.container.destroy(true);
      this.npcViews.delete(id);
    }
    if (!this.cafeNpcsAvailable) return;
    const controlActors = new Map(
      this.controller.getSnapshot().control.actors.map((actor) => [actor.actorId, actor] as const),
    );
    for (const npc of inside) {
      if (npc.location.kind !== "interior") continue;
      const controlledCell = controlActors.get(`npc:${npc.id}`)?.cell;
      const targetCell = controlledCell ?? cafeAnchorCell(npc.location.anchorId);
      const spec = cafeActorVisualSpec(
        "npc",
        npc.id,
        npc.location.anchorId,
        this.roomBounds.height,
        npc.routine,
        targetCell,
      );
      const x = this.roomBounds.x + this.roomBounds.width * spec.normalizedPosition[0];
      const y = this.roomBounds.y + this.roomBounds.height * spec.normalizedPosition[1];
      let view = this.npcViews.get(npc.id);
      if (!view) {
        view = this.createCafeNpc(npc, x, y, targetCell, spec);
        this.npcViews.set(npc.id, view);
        view.container.setAlpha(0);
        this.tweens.add({ targets: view.container, alpha: 1, duration: 220, ease: "Sine.Out" });
      } else if (view.cell.x !== targetCell.x || view.cell.y !== targetCell.y) {
        this.moveActorView(
          view,
          targetCell,
          x,
          y,
          95,
          () => view?.sprite.setFrame(npcFrameName(npc.id, "walking")),
          () => view?.sprite.setFrame(npcFrameName(npc.id, this.npcVisualActivity(npc))),
        );
      } else if (!this.tweens.isTweening(view.container) &&
        (Math.abs(view.container.x - x) > 0.5 || Math.abs(view.container.y - y) > 0.5)) {
        view.container.setPosition(Math.round(x), Math.round(y));
      }
      view.container.setVisible(state.agentsVisible);
      view.container.setDepth(this.actorDepth(view.container.y));
      this.applyCafeNpcVisual(view, npc, spec);
    }
  }

  private createCafeNpc(
    npc: NpcStateV1,
    x: number,
    y: number,
    cell: GridPoint,
    spec: CafeActorVisualSpec,
  ): CafeNpcView {
    const shadow = this.add.graphics();
    const sprite = this.add
      .image(0, 0, CAFE_NPC_TEXTURE_KEY, npcFrameName(npc.id, this.npcVisualActivity(npc)))
      .setOrigin(0.5, spec.footOriginY)
      .setDisplaySize(spec.displayWidth, spec.displayHeight);
    const label = this.add
      .text(0, -spec.displayHeight - 7, `${npc.name} · ${this.npcRoutineLabel(npc)}`, {
        fontFamily: "ui-monospace, Consolas, monospace",
        fontSize: "7px",
        color: "#fff1c7",
        backgroundColor: "rgba(52, 37, 31, 0.92)",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setVisible(false);
    const hitZone = this.add
      .zone(0, -spec.displayHeight / 2, Math.max(36, spec.displayWidth), spec.displayHeight + 8)
      .setOrigin(0.5);
    const container = this.add
      .container(Math.round(x), Math.round(y), [shadow, hitZone, sprite, label])
      .setDepth(this.actorDepth(y))
      .setSize(Math.max(36, spec.displayWidth), spec.displayHeight + 8);
    this.drawContactShadow(shadow, spec);
    return { container, shadow, sprite, label, hitZone, cell, displayHeight: spec.displayHeight };
  }

  private applyCafeNpcVisual(view: CafeNpcView, npc: NpcStateV1, spec: CafeActorVisualSpec): void {
    if (!this.tweens.isTweening(view.container)) {
      view.sprite.setFrame(npcFrameName(npc.id, this.npcVisualActivity(npc)));
    }
    view.sprite.setOrigin(0.5, spec.footOriginY).setDisplaySize(spec.displayWidth, spec.displayHeight);
    view.displayHeight = spec.displayHeight;
    view.hitZone.setPosition(0, -spec.displayHeight / 2).setSize(Math.max(36, spec.displayWidth), spec.displayHeight + 8);
    view.container.setSize(Math.max(36, spec.displayWidth), spec.displayHeight + 8);
    view.label
      .setY(-spec.displayHeight - 7)
      .setText(`${npc.name} · ${this.npcRoutineLabel(npc)}`);
    this.drawContactShadow(view.shadow, spec);
  }

  private npcVisualActivity(npc: NpcStateV1): CafeNpcActivity {
    if (npc.routine === "reading") return npc.location.kind === "interior" && npc.location.anchorId === "fireplace"
      ? "social"
      : "working";
    if (npc.routine === "serving" || npc.routine === "brewing" || npc.routine === "baking" || npc.routine === "illustrating") {
      return "working";
    }
    if (npc.routine === "delivering") return npc.location.kind === "interior" && npc.location.anchorId === "entry"
      ? "walking"
      : "social";
    return npc.activity;
  }

  private drawContactShadow(shadow: Phaser.GameObjects.Graphics, spec: CafeActorVisualSpec): void {
    const width = spec.shadowWidth;
    const height = spec.shadowHeight;
    shadow.clear();
    shadow.fillStyle(0x171311, spec.shadowAlpha * 0.55).fillRect(-Math.floor(width / 2), -1, width, 2);
    shadow.fillStyle(0x171311, spec.shadowAlpha).fillRect(-Math.floor((width - 4) / 2), -Math.ceil(height / 2), Math.max(3, width - 4), height);
    shadow.fillStyle(0x090807, spec.shadowAlpha * 0.62).fillRect(-Math.floor((width - 8) / 2), -1, Math.max(2, width - 8), 2);
  }

  private npcRoutineLabel(npc: NpcStateV1): string {
    const labels: Readonly<Record<NpcStateV1["routine"], string>> = {
      offstage: "fuera de turno",
      serving: "atendiendo la barra",
      brewing: "preparando café",
      baking: "reponiendo pastelería",
      illustrating: "dibujando",
      reading: "leyendo",
      delivering: "haciendo una entrega",
    };
    return labels[npc.routine];
  }

  private actorDepth(y: number): number {
    // Map the world Y back to a grid cell so the deterministic compositor
    // places actors correctly relative to furniture depth. The interior uses
    // a normalized coordinate space; we invert cafeCellToNormalized for Y.
    const normalizedY = (y - this.roomBounds.y) / this.roomBounds.height;
    const floorTop = CAFE_INTERIOR_FLOOR_BOUNDS.top;
    const floorBottom = CAFE_INTERIOR_FLOOR_BOUNDS.bottom;
    const gridHeight = CAFE_INTERIOR_SPATIAL_GRID.height;
    const gridY = Math.round(((normalizedY - floorTop) / (floorBottom - floorTop)) * (gridHeight - 1));
    return computeSpatialDepth({
      cell: { x: 16, y: Math.max(0, Math.min(gridHeight - 1, gridY)) },
      subLayer: SPATIAL_DEPTH_SUB_LAYER.actor,
    }) + ACTOR_DEPTH_BASE;
  }

  private interiorAgentActivity(agent: AgentStateV1): AgentActivity {
    if (agent.location.kind !== "interior") return agent.activity;
    if (agent.location.action === "read") return "thinking";
    if (agent.location.action === "serve-coffee") return "using-tool";
    return agent.activity === "offline" ? "offline" : "idle";
  }

  private renderOptionalDecor(state: GameStateV1): void {
    for (const sprite of this.optionalDecorSprites) sprite.destroy();
    this.optionalDecorSprites.length = 0;
    const interior = state.interiors.find((candidate) => candidate.buildingId === this.buildingId);
    const placements = optionalFurniture(interior);
    placements.forEach((placement) => {
      const visual = CAFE_DECOR_VISUALS[placement.furnitureId as keyof typeof CAFE_DECOR_VISUALS];
      const slotPositions = CAFE_DECOR_POSITIONS[placement.slotId as keyof typeof CAFE_DECOR_POSITIONS];
      const placementVisual = slotPositions?.[placement.furnitureId as keyof typeof slotPositions];
      if (!visual || !placementVisual) return;
      const position = placementVisual.normalizedPosition;
      const marker = this.add
        .image(
          this.roomBounds.x + this.roomBounds.width * position[0],
          this.roomBounds.y + this.roomBounds.height * position[1],
          "alpha-cafe-decor",
          visual.frame,
        )
        .setDisplaySize(visual.draw[0], visual.draw[1])
        .setOrigin(visual.origin[0], visual.origin[1]);
      marker.setData("furnitureId", placement.furnitureId);
      marker.setData("slotId", placement.slotId);
      marker.setData("surface", placementVisual.surface);
      marker.setDepth(placementVisual.surface === "wall"
        ? 360 + placementVisual.depthOffset
        : this.actorDepth(marker.y) + placementVisual.depthOffset);
      this.optionalDecorSprites.push(marker);
    });
  }

  private refreshSpatialScene(state: GameStateV1, force = false): void {
    const interior = state.interiors.find((candidate) => candidate.buildingId === this.buildingId);
    const signature = cafeOptionalDecorSignature(interior);
    if (!force && signature === this.spatialFurnitureSignature) return;
    this.spatialScene = compileCafeSpatialScene(this.buildingId, interior);
    this.spatialFurnitureSignature = signature;
    this.spatialVersion += 1;
  }

  private registerDecorFrames(): void {
    if (!this.textures.exists("alpha-cafe-decor")) return;
    const texture = this.textures.get("alpha-cafe-decor");
    for (const visual of Object.values(CAFE_DECOR_VISUALS)) {
      if (texture.has(visual.frame)) continue;
      const [x, y, width, height] = visual.crop;
      texture.add(visual.frame, 0, x, y, width, height);
    }
  }

  private registerAgentFrames(): boolean {
    if (!this.textures.exists(CITY_TEXTURE_KEYS.alphaAgents)) return false;
    const texture = this.textures.get(CITY_TEXTURE_KEYS.alphaAgents);
    const source = texture.getSourceImage() as { width?: number; height?: number };
    const frameWidth = Math.floor((source.width ?? 0) / AGENT_ACTIVITY_ORDER.length);
    const frameHeight = Math.floor((source.height ?? 0) / AGENT_ID_ORDER.length);
    if (frameWidth < 1 || frameHeight < 1) return false;
    for (let row = 0; row < AGENT_ID_ORDER.length; row += 1) {
      for (let column = 0; column < AGENT_ACTIVITY_ORDER.length; column += 1) {
        const id = AGENT_ID_ORDER[row] ?? "syka";
        const activity = AGENT_ACTIVITY_ORDER[column] ?? "idle";
        const frame = agentFrameName(id, activity);
        if (!texture.has(frame)) texture.add(frame, 0, column * frameWidth, row * frameHeight, frameWidth, frameHeight);
      }
    }
    return true;
  }

  private registerCafeNpcFrames(): boolean {
    if (!this.textures.exists(CAFE_NPC_TEXTURE_KEY)) return false;
    const texture = this.textures.get(CAFE_NPC_TEXTURE_KEY);
    const source = texture.getSourceImage() as { width?: number; height?: number };
    const frameWidth = Math.floor((source.width ?? 0) / CAFE_NPC_IDS.length);
    const frameHeight = Math.floor((source.height ?? 0) / CAFE_NPC_ACTIVITIES.length);
    if (frameWidth < 1 || frameHeight < 1) return false;
    for (let row = 0; row < CAFE_NPC_ACTIVITIES.length; row += 1) {
      for (let column = 0; column < CAFE_NPC_IDS.length; column += 1) {
        const id = CAFE_NPC_IDS[column];
        const activity = CAFE_NPC_ACTIVITIES[row];
        if (!id || !activity) continue;
        const frame = npcFrameName(id, activity);
        if (!texture.has(frame)) texture.add(frame, 0, column * frameWidth, row * frameHeight, frameWidth, frameHeight);
      }
    }
    return true;
  }

  private createFallbackAgentTexture(): void {
    if (this.textures.exists(CITY_TEXTURE_KEYS.fallbackAgent)) return;
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1).fillRect(2, 1, 4, 4).fillRect(2, 6, 4, 7);
    graphics.fillRect(1, 7, 1, 5).fillRect(6, 7, 1, 5).fillRect(2, 13, 1, 5).fillRect(5, 13, 1, 5);
    graphics.generateTexture(CITY_TEXTURE_KEYS.fallbackAgent, 8, 18);
    graphics.destroy();
  }

  private inspect(hotspot: InteriorHotspot): void {
    const detail: InteriorSelectionDetail = { buildingId: this.buildingId, hotspot };
    this.game.events.emit("syka:interior-selection", detail);
  }

  private installDecor(slotId: string, furnitureId: string): boolean {
    const result = this.controller.installFurniture(this.buildingId, slotId, furnitureId);
    if (!result.ok) this.emitError(result);
    return result.ok;
  }

  private exit(): void {
    const result = this.controller.exitInterior();
    if (!result.ok) {
      this.emitError(result);
      return;
    }
    this.game.events.emit("syka:interior-exit", { buildingId: this.buildingId });
  }

  private emitError(result: Result<unknown, unknown>): void {
    if (result.ok) return;
    this.game.events.emit("syka:ui-error", { source: "interior", error: result.error });
  }

  private exposeApi(): void {
    const scene = this.spatialScene;
    if (!scene) return;
    window.__SYKA_INTERIOR__ = {
      exit: () => this.exit(),
      inspect: (hotspotId) => {
        const hotspot = CAFE_HOTSPOTS.find((candidate) => candidate.id === hotspotId);
        if (hotspot) this.inspect(hotspot);
      },
      installDecor: (slotId, furnitureId) => this.installDecor(slotId, furnitureId),
      getBuildingId: () => this.buildingId,
      spatial: {
        sceneId: scene.definition.id,
        grid: scene.definition.grid,
        isWalkable: (cell) => this.spatialScene
          ? isSpatialCellWalkable(this.spatialScene, cell)
          : false,
        cellToNormalized: (cell) => cafeCellToNormalized(cell),
        normalizedToCell: (normalizedX, normalizedY) => this.spatialScene
          ? cafeNormalizedToCell(normalizedX, normalizedY, this.spatialScene)
          : null,
      },
    };
  }

  private cleanup(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.input.off("pointerdown", this.handleSpatialPointerDown, this);
    this.input.off("pointermove", this.handleNpcPointerMove, this);
    this.input.off("gameout", this.hideNpcLabels, this);
    for (const view of this.agentViews.values()) {
      this.tweens.killTweensOf(view.container);
      view.container.destroy(true);
    }
    this.agentViews.clear();
    for (const view of this.npcViews.values()) {
      this.tweens.killTweensOf(view.container);
      view.container.destroy(true);
    }
    this.npcViews.clear();
    for (const foreground of this.actorForeground) foreground.destroy();
    this.actorForeground.length = 0;
    for (const sprite of this.optionalDecorSprites) sprite.destroy();
    this.optionalDecorSprites.length = 0;
    this.room = undefined;
    this.cityBackdrop = undefined;
    this.warmPass = undefined;
    this.hotspotLayer = undefined;
    this.spatialControlLayer = undefined;
    this.spatialScene = undefined;
    this.spatialSignature = "";
    this.spatialFurnitureSignature = "";
    this.spatialVersion = 0;
    delete window.__SYKA_INTERIOR__;
  }
}
