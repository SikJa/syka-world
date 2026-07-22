import { createAlphaAgents } from "./agents";
import { ALPHA_CATALOG, getBuildingDefinition, getInteriorDefinition } from "./catalog";
import {
  BALANCE_VERSION,
  GAME_STATE_SCHEMA,
  INTERIOR_SCHEMA,
  type AgentRoutineBindingsV1,
  type BuildingInstanceV1,
  type CatalogV1,
  type GameStateV1,
  type GridPoint,
  type InteriorStateV1,
  type ProfileId,
  type SectorStateV1,
  type WorldMapV1,
} from "./contracts";
import { createEconomyState } from "./economy";
import { computePlacementGeometry, createWorldMap, occupyBuildingTiles, paintTerrain } from "./map";
import { markExistingCompletionMilestones } from "./progression";
import { advanceNpcRoutines, createCafeNpcs } from "./npcs";
import { createSeededWorldObjects } from "./worldObjects";

export interface InitialStateOptions {
  readonly mode?: "showcase" | "progressive";
  readonly startingBalance?: number;
  readonly width?: number;
  readonly height?: number;
}

const unlockedForLevel = (level: number, catalog: CatalogV1): readonly string[] =>
  catalog.buildings.filter((building) => building.requiredTownLevel <= level).map((building) => building.id);

export const createBlankGameState = (
  options: InitialStateOptions = {},
  catalog: CatalogV1 = ALPHA_CATALOG,
): GameStateV1 => {
  const mode = options.mode ?? "progressive";
  const townLevel = mode === "showcase" ? 3 : 1;
  return {
    schema: GAME_STATE_SCHEMA,
    balanceVersion: BALANCE_VERSION,
    mode,
    map: createWorldMap(options.width ?? 24, options.height ?? 20),
    buildings: [],
    interiors: [],
    worldObjects: [],
    economy: createEconomyState(options.startingBalance ?? (mode === "showcase" ? 999 : 420)),
    progression: {
      townLevel,
      townXp: 0,
      unlockedBuildingIds: unlockedForLevel(townLevel, catalog),
      rewardedMilestones: [],
    },
    clock: { day: 1, minuteOfDay: mode === "showcase" ? 1_050 : 480, totalMinutes: 0, speed: 1 },
    camera: { center: { x: 12, y: 10 }, zoom: 1, scene: "city" },
    agents: [],
    npcs: createCafeNpcs(),
    agentsVisible: true,
  };
};

interface CompletedBuildingSpec {
  readonly id: string;
  readonly definitionId: string;
  readonly origin: GridPoint;
}

const addCompletedBuilding = (
  state: GameStateV1,
  spec: CompletedBuildingSpec,
  catalog: CatalogV1,
): GameStateV1 => {
  const definition = getBuildingDefinition(spec.definitionId, catalog);
  if (!definition) throw new Error(`Missing catalog definition ${spec.definitionId}.`);
  const geometry = computePlacementGeometry(definition, spec.origin, "north");
  const totalMinutes = definition.constructionStages.reduce((total, stage) => total + stage.durationMinutes, 0);
  const building: BuildingInstanceV1 = {
    id: spec.id,
    definitionId: definition.id,
    kind: definition.kind,
    origin: spec.origin,
    orientation: "north",
    occupiedTiles: geometry.occupiedTiles,
    entranceTile: geometry.entranceTile,
    accessTile: geometry.accessTile,
    status: "complete",
    construction: { elapsedMinutes: totalMinutes, totalMinutes, stageIndex: definition.constructionStages.length },
    level: 1,
    visualVariant: definition.id,
    installedUpgrades: [],
    interiorId: definition.interiorId,
  };
  const interiorDefinition = getInteriorDefinition(definition.interiorId, catalog);
  const interior: InteriorStateV1 | undefined = interiorDefinition
    ? {
        schema: INTERIOR_SCHEMA,
        buildingId: building.id,
        definitionId: interiorDefinition.id,
        furniture: interiorDefinition.defaultFurniture.map((placement) => ({
          ...placement,
          instanceId: `${building.id}-${placement.instanceId}`,
        })),
      }
    : undefined;
  return {
    ...state,
    map: occupyBuildingTiles(state.map, building),
    buildings: [...state.buildings, building],
    interiors: interior ? [...state.interiors, interior] : state.interiors,
  };
};

const paintRoadRows = (map: WorldMapV1, rows: readonly number[], columns: readonly number[]): WorldMapV1 => {
  const points: GridPoint[] = [];
  for (const y of rows) {
    for (let x = 0; x < map.size.width; x += 1) points.push({ x, y });
  }
  for (const x of columns) {
    for (let y = 0; y < map.size.height; y += 1) points.push({ x, y });
  }
  return paintTerrain(map, points, "road");
};

const allUnlockedSectors = (): readonly SectorStateV1[] => [
  { id: "meadow-core", name: "Initial meadow", unlocked: true, unlockCost: 0 },
  { id: "east-gardens", name: "East Gardens", unlocked: true, unlockCost: 280 },
];

export const createShowcaseGameState = (catalog: CatalogV1 = ALPHA_CATALOG): GameStateV1 => {
  let state = createBlankGameState({ mode: "showcase", width: 30, height: 24 }, catalog);
  state = { ...state, map: paintRoadRows(createWorldMap(30, 24, allUnlockedSectors()), [7, 14, 20], [0, 7, 19, 27]) };

  const specs: readonly CompletedBuildingSpec[] = [
    { id: "home-syka", definitionId: "home-cozy", origin: { x: 1, y: 4 } },
    { id: "home-elen", definitionId: "home-cozy", origin: { x: 8, y: 4 } },
    { id: "home-astrelis", definitionId: "home-cozy", origin: { x: 14, y: 4 } },
    { id: "home-zerny", definitionId: "home-cozy", origin: { x: 21, y: 4 } },
    { id: "cafe-main", definitionId: "cafe-library", origin: { x: 2, y: 10 } },
    { id: "office-marketing", definitionId: "office-marketing", origin: { x: 9, y: 10 } },
    { id: "office-commercial", definitionId: "office-commercial", origin: { x: 15, y: 10 } },
    { id: "workshop-crm", definitionId: "workshop-crm", origin: { x: 21, y: 10 } },
    { id: "community-main", definitionId: "hall-community", origin: { x: 12, y: 16 } },
  ];
  for (const spec of specs) state = addCompletedBuilding(state, spec, catalog);

  const bindings: Record<ProfileId, AgentRoutineBindingsV1> = {
    default: {
      homeBuildingId: "home-syka",
      cafeBuildingId: "cafe-main",
      workplaceBuildingId: "community-main",
      communityBuildingId: "community-main",
    },
    elen: {
      homeBuildingId: "home-elen",
      cafeBuildingId: "cafe-main",
      workplaceBuildingId: "office-marketing",
      communityBuildingId: "community-main",
    },
    astrelis: {
      homeBuildingId: "home-astrelis",
      cafeBuildingId: "cafe-main",
      workplaceBuildingId: "office-commercial",
      communityBuildingId: "community-main",
    },
    zerny: {
      homeBuildingId: "home-zerny",
      cafeBuildingId: "cafe-main",
      workplaceBuildingId: "workshop-crm",
      communityBuildingId: "community-main",
    },
  };
  const positions: Record<ProfileId, GridPoint> = {
    default: { x: 3, y: 7 },
    elen: { x: 10, y: 7 },
    astrelis: { x: 16, y: 7 },
    zerny: { x: 23, y: 7 },
  };
  let completed: GameStateV1 = {
    ...state,
    // Same vertical projection as the prior center, shifted horizontally so
    // the fourth home remains fully framed in the 720×450 logical viewport.
    camera: { ...state.camera, center: { x: 14, y: 8 } },
    agents: createAlphaAgents(bindings, positions),
  };
  completed = markExistingCompletionMilestones(completed);
  return advanceNpcRoutines({ ...completed, worldObjects: createSeededWorldObjects(completed, catalog) });
};

export const createProgressiveGameState = (catalog: CatalogV1 = ALPHA_CATALOG): GameStateV1 => {
  let state = createBlankGameState({ mode: "progressive", width: 24, height: 20 }, catalog);
  state = { ...state, map: paintRoadRows(state.map, [8], [0]) };
  state = addCompletedBuilding(state, { id: "home-syka", definitionId: "home-cozy", origin: { x: 2, y: 5 } }, catalog);
  const sharedBindings: AgentRoutineBindingsV1 = {
    homeBuildingId: "home-syka",
    cafeBuildingId: "",
    workplaceBuildingId: "home-syka",
    communityBuildingId: "",
  };
  const bindings: Record<ProfileId, AgentRoutineBindingsV1> = {
    default: sharedBindings,
    elen: { ...sharedBindings, workplaceBuildingId: "" },
    astrelis: { ...sharedBindings, workplaceBuildingId: "" },
    zerny: { ...sharedBindings, workplaceBuildingId: "" },
  };
  const positions: Record<ProfileId, GridPoint> = {
    default: { x: 4, y: 8 },
    elen: { x: 3, y: 8 },
    astrelis: { x: 5, y: 8 },
    zerny: { x: 6, y: 8 },
  };
  let progressive = { ...state, agents: createAlphaAgents(bindings, positions) };
  progressive = markExistingCompletionMilestones(progressive);
  return advanceNpcRoutines({ ...progressive, worldObjects: createSeededWorldObjects(progressive, catalog) });
};
