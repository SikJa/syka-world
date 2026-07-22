/**
 * Renderer-agnostic contracts for the Syka World playable alpha.
 *
 * Every persisted or cross-layer object carries a schema discriminator.  The
 * core never imports Phaser, the browser, Hermes, or the bridge implementation.
 */

export const MAP_SCHEMA = "syka.world.map.v1" as const;
export const CATALOG_SCHEMA = "syka.world.catalog.v1" as const;
export const INTERIOR_SCHEMA = "syka.world.interior.v1" as const;
export const AGENT_SCHEMA = "syka.world.agent.v1" as const;
export const NPC_SCHEMA = "syka.world.npc.v1" as const;
export const WORLD_OBJECT_SCHEMA = "syka.world.world-object.v1" as const;
export const BRIDGE_SIGNAL_SCHEMA = "syka.world.bridge-signal.v1" as const;
export const GAME_STATE_SCHEMA = "syka.world.game-state.v1" as const;
export const SAVE_SCHEMA = "syka.world.save.v1" as const;
export const BALANCE_VERSION = "alpha-1" as const;

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export interface GridSize {
  readonly width: number;
  readonly height: number;
}

export type CardinalDirection = "north" | "east" | "south" | "west";
export type TerrainKind = "grass" | "road" | "water" | "rock";

export interface TileV1 {
  readonly position: GridPoint;
  readonly terrain: TerrainKind;
  readonly elevation: number;
  readonly sectorId: string;
  readonly buildingId?: string;
}

export interface SectorStateV1 {
  readonly id: string;
  readonly name: string;
  readonly unlocked: boolean;
  readonly unlockCost: number;
}

export interface WorldMapV1 {
  readonly schema: typeof MAP_SCHEMA;
  readonly size: GridSize;
  readonly tiles: readonly TileV1[];
  readonly sectors: readonly SectorStateV1[];
}

export type BuildingKind =
  | "home"
  | "cafe"
  | "marketing-office"
  | "commercial-office"
  | "crm-workshop"
  | "community-hall";

export type BuildingStatus = "planned" | "foundation" | "framing" | "finishing" | "complete";

export interface FootprintV1 {
  readonly width: number;
  readonly height: number;
}

export interface EntranceDefinitionV1 {
  /** Tile relative to the north-oriented footprint origin. */
  readonly offset: GridPoint;
  readonly facing: CardinalDirection;
}

export interface ConstructionStageDefinitionV1 {
  readonly id: Exclude<BuildingStatus, "planned" | "complete">;
  readonly durationMinutes: number;
}

export interface FurnitureDefinitionV1 {
  readonly id: string;
  readonly name: string;
  readonly category: "table" | "seat" | "light" | "plant" | "storage" | "decor" | "workstation";
  readonly price: number;
  readonly slotTags: readonly string[];
}

export interface FurniturePlacementV1 {
  readonly instanceId: string;
  readonly furnitureId: string;
  readonly slotId: string;
}

export interface FurnitureSlotV1 {
  readonly id: string;
  readonly accepts: readonly string[];
  readonly optional: boolean;
}

export interface InteriorDefinitionV1 {
  readonly schema: typeof INTERIOR_SCHEMA;
  readonly id: string;
  readonly name: string;
  readonly theme: string;
  readonly furnishedByDefault: boolean;
  readonly defaultFurniture: readonly FurniturePlacementV1[];
  readonly slots: readonly FurnitureSlotV1[];
}

export interface BuildingUpgradeDefinitionV1 {
  readonly id: string;
  readonly name: string;
  readonly buildingKind: BuildingKind;
  readonly requiredLevel: number;
  readonly targetLevel: number;
  readonly cost: number;
  readonly constructionMinutes: number;
  readonly visualVariant: string;
}

export interface BuildingDefinitionV1 {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly requiredTownLevel: number;
  readonly footprint: FootprintV1;
  readonly entrance: EntranceDefinitionV1;
  readonly constructionStages: readonly ConstructionStageDefinitionV1[];
  readonly interiorId: string;
  readonly capacity: number;
  readonly tags: readonly string[];
}

export type ExteriorObjectCategory =
  | "ground-cover"
  | "shrub"
  | "hedge"
  | "planter"
  | "street-furniture"
  | "tree";

export type ExteriorPlacementRule = "grass" | "grass-near-road";

export interface WorldObjectLightSourceV1 {
  readonly kind: "warm-compact";
  readonly activePeriod: "night";
}

/** Renderer-independent catalog entry for a persistent exterior object. */
export interface ExteriorObjectDefinitionV1 {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ExteriorObjectCategory;
  readonly visualKey: string;
  readonly price: number;
  readonly removalCost: number;
  readonly placementRule: ExteriorPlacementRule;
  readonly physical: boolean;
  readonly removable: boolean;
  readonly lightSource?: WorldObjectLightSourceV1;
}

export interface CatalogV1 {
  readonly schema: typeof CATALOG_SCHEMA;
  readonly buildings: readonly BuildingDefinitionV1[];
  readonly upgrades: readonly BuildingUpgradeDefinitionV1[];
  readonly interiors: readonly InteriorDefinitionV1[];
  readonly furniture: readonly FurnitureDefinitionV1[];
  readonly exteriorObjects: readonly ExteriorObjectDefinitionV1[];
}

export interface ConstructionProgressV1 {
  readonly elapsedMinutes: number;
  readonly totalMinutes: number;
  readonly stageIndex: number;
}

export interface ActiveUpgradeV1 {
  readonly definitionId: string;
  readonly elapsedMinutes: number;
  readonly totalMinutes: number;
}

export interface BuildingInstanceV1 {
  readonly id: string;
  readonly definitionId: string;
  readonly kind: BuildingKind;
  readonly origin: GridPoint;
  readonly orientation: CardinalDirection;
  readonly occupiedTiles: readonly GridPoint[];
  readonly entranceTile: GridPoint;
  readonly accessTile: GridPoint;
  readonly status: BuildingStatus;
  readonly construction: ConstructionProgressV1;
  readonly level: number;
  readonly visualVariant: string;
  readonly installedUpgrades: readonly string[];
  readonly interiorId: string;
  readonly activeUpgrade?: ActiveUpgradeV1;
}

export interface InteriorStateV1 {
  readonly schema: typeof INTERIOR_SCHEMA;
  readonly buildingId: string;
  readonly definitionId: string;
  readonly furniture: readonly FurniturePlacementV1[];
}

export type WorldObjectProvenance = "seeded" | "player";

export interface WorldObjectInstanceV1 {
  readonly schema: typeof WORLD_OBJECT_SCHEMA;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly hostTile: GridPoint;
  /** For benches this faces the adjacent road; lamps preserve it for stable rendering. */
  readonly orientation: CardinalDirection;
  readonly variant?: string;
  readonly placementState: "placed";
  readonly lightSource?: WorldObjectLightSourceV1;
  readonly removable: boolean;
  readonly provenance: WorldObjectProvenance;
}

export interface EconomyStateV1 {
  readonly balance: number;
  readonly earned: number;
  readonly spent: number;
  readonly rewardDay: number;
  readonly hermesCompletionsToday: Readonly<Record<string, number>>;
  readonly lastLocalRewardTotalMinute: number;
}

export interface ProgressionStateV1 {
  readonly townLevel: number;
  readonly townXp: number;
  readonly unlockedBuildingIds: readonly string[];
  /** Idempotence keys for building and upgrade completion rewards. */
  readonly rewardedMilestones: readonly string[];
}

export interface WorldClockV1 {
  readonly day: number;
  readonly minuteOfDay: number;
  readonly totalMinutes: number;
  readonly speed: 0 | 1 | 2 | 4;
}

export interface CameraStateV1 {
  readonly center: GridPoint;
  readonly zoom: 1 | 1.5 | 2;
  readonly scene: "city" | "interior";
  readonly interiorBuildingId?: string;
  readonly cityViewBeforeInterior?: {
    readonly center: GridPoint;
    readonly zoom: 1 | 1.5 | 2;
  };
}

/**
 * A Hermes profile identifier. This is an external identity discovered at
 * runtime — not a compile-time union. The four-value union was replaced so the
 * public repository can discover zero, one, four, or many profiles without
 * code changes. Validation happens through the runtime profile registry
 * (`integrations/profiles`), not a TypeScript guard that rejects unknowns.
 *
 * The legacy values `default`, `elen`, `astrelis`, `zerny` remain valid for
 * save compatibility and are provided by the optional Sikora preset.
 */
export type ProfileId = string;

/**
 * A stable Syka World character identifier. Unlike `ProfileId`, this is an
 * internal identity that survives a profile going offline and holds
 * world-specific customization. Legacy saves use the same string for both.
 */
export type CharacterId = string;

/**
 * Legacy agent atlas identifier. The renderer still uses this fixed union to
 * index the approved agent sprite atlas. Dynamic profiles that do not match a
 * legacy visual slot fall back to a neutral placeholder until a dedicated
 * sprite is produced. This is a visual concern only — the simulation, bridge
 * and save model all accept arbitrary `ProfileId` strings.
 */
export type AgentId = "syka" | "elen" | "astrelis" | "zerny";
export type AgentActivity =
  | "idle"
  | "thinking"
  | "using-tool"
  | "waiting"
  | "done"
  | "interrupted"
  | "error"
  | "offline";
export type AgentPresence = "online" | "degraded" | "offline" | "unknown";

export interface AgentRoutineBindingsV1 {
  readonly homeBuildingId: string;
  readonly cafeBuildingId: string;
  readonly workplaceBuildingId: string;
  readonly communityBuildingId: string;
}

export interface ActiveAgentSessionV1 {
  readonly sessionId: string;
  readonly activity: Exclude<AgentActivity, "idle" | "done" | "interrupted" | "error" | "offline">;
  readonly taskSummary?: string;
  readonly toolFamily?: string;
  readonly updatedAt: string;
}

export type AgentLocalAction = "sit" | "read" | "serve-coffee" | "warm-fireplace";

export type AgentLocationV1 =
  | { readonly kind: "exterior"; readonly tile: GridPoint }
  | {
      readonly kind: "transit";
      readonly tile: GridPoint;
      readonly destinationBuildingId: string;
    }
  | {
      readonly kind: "interior";
      readonly buildingId: string;
      readonly anchorId: string;
      /** Optional free-walk cell for spatial interiors. Legacy anchor-only saves omit it. */
      readonly tile?: GridPoint;
      readonly action?: AgentLocalAction;
    };

export interface AgentLocalOrderV1 {
  readonly kind: "go-to-cafe";
  readonly targetBuildingId: string;
  readonly action: AgentLocalAction;
  readonly phase: "traveling" | "entering" | "acting" | "staying";
  readonly issuedAtTotalMinute: number;
  readonly phaseUntilTotalMinute?: number;
}

export interface AgentStateV1 {
  readonly schema: typeof AGENT_SCHEMA;
  readonly id: AgentId;
  readonly profileId: ProfileId;
  readonly name: string;
  readonly role: string;
  readonly position: GridPoint;
  /** Persistent spatial truth; `position` remains the last exterior road tile. */
  readonly location: AgentLocationV1;
  readonly destination: GridPoint;
  readonly destinationBuildingId: string;
  readonly path: readonly GridPoint[];
  readonly activity: AgentActivity;
  readonly presence: AgentPresence;
  readonly bindings: AgentRoutineBindingsV1;
  readonly activeSessions: readonly ActiveAgentSessionV1[];
  readonly localOrder?: AgentLocalOrderV1;
  readonly taskSummary?: string;
  readonly stateUntilTotalMinute?: number;
}

/**
 * Local cafe characters are deliberately independent from Hermes profiles and
 * working agents. They never carry sessions, rewards, tasks, or bridge state.
 */
export type CafeNpcId = "alma-rios" | "beni-menta" | "iara-luz" | "milo-niebla" | "noa-junco";

export type CafeNpcAnchorId =
  | "entry"
  | "counter"
  | "table-seat-1"
  | "table-seat-2"
  | "library-chair"
  | "fireplace"
  | "coffee-machine"
  | "bartender-station";

export type CafeNpcActivity = "idle" | "walking" | "working" | "social";

export type CafeNpcRoutine =
  | "offstage"
  | "serving"
  | "brewing"
  | "baking"
  | "illustrating"
  | "reading"
  | "delivering";

export type CafeNpcLocationV1 =
  | { readonly kind: "offstage" }
  | {
      readonly kind: "transit";
      /** Current road tile; the first element of `path` is always this tile. */
      readonly tile: GridPoint;
      readonly destination: GridPoint;
      readonly path: readonly GridPoint[];
      readonly cafeBuildingId: string;
      readonly direction: "arriving" | "departing";
    }
  | {
      readonly kind: "interior";
      readonly buildingId: string;
      readonly anchorId: CafeNpcAnchorId;
    };

export interface NpcStateV1 {
  readonly schema: typeof NPC_SCHEMA;
  readonly id: CafeNpcId;
  readonly name: string;
  readonly role: string;
  readonly visualKey: string;
  readonly activity: CafeNpcActivity;
  readonly routine: CafeNpcRoutine;
  readonly location: CafeNpcLocationV1;
  /** Makes repeated reconciliation at the same world minute idempotent. */
  readonly lastRoutineTotalMinute: number;
}

export type BridgeSignalKind =
  | "activity.started"
  | "activity.waiting"
  | "activity.resumed"
  | "tool.started"
  | "tool.finished"
  | "activity.completed"
  | "activity.failed"
  | "activity.interrupted"
  | "activity.settled"
  | "presence.online"
  | "presence.degraded"
  | "presence.offline";

export interface BridgeSignalV1 {
  readonly schema: typeof BRIDGE_SIGNAL_SCHEMA;
  readonly eventId: string;
  readonly kind: BridgeSignalKind;
  readonly profileId: ProfileId;
  readonly sessionId: string;
  readonly occurredAt: string;
  readonly taskSummary?: string;
  readonly toolFamily?: string;
}

export interface GameStateV1 {
  readonly schema: typeof GAME_STATE_SCHEMA;
  readonly balanceVersion: typeof BALANCE_VERSION;
  readonly mode: "showcase" | "progressive";
  readonly map: WorldMapV1;
  readonly buildings: readonly BuildingInstanceV1[];
  readonly interiors: readonly InteriorStateV1[];
  readonly worldObjects: readonly WorldObjectInstanceV1[];
  readonly economy: EconomyStateV1;
  readonly progression: ProgressionStateV1;
  readonly clock: WorldClockV1;
  readonly camera: CameraStateV1;
  readonly agents: readonly AgentStateV1[];
  readonly npcs: readonly NpcStateV1[];
  readonly agentsVisible: boolean;
  readonly lastBridgeEventId?: string;
}

export interface SaveGameV1 {
  readonly schema: typeof SAVE_SCHEMA;
  readonly savedAt: string;
  readonly game: GameStateV1;
}

/** Explicitly supported pre-alpha migration source. */
export interface LegacySaveV0 {
  readonly schema: "syka.world.save.v0";
  readonly savedAt?: string;
  readonly state: GameStateV1;
}
