import { ALPHA_CATALOG, getExteriorObjectDefinition } from "./catalog";
import {
  WORLD_OBJECT_SCHEMA,
  type CardinalDirection,
  type CatalogV1,
  type ExteriorObjectDefinitionV1,
  type GameStateV1,
  type GridPoint,
  type Result,
  type WorldObjectInstanceV1,
} from "./contracts";
import { grantLocalReward, spendLumenes } from "./economy";
import { getTile, pointKey } from "./map";

export type WorldObjectMutationErrorCode =
  | "UNKNOWN_WORLD_OBJECT"
  | "INVALID_WORLD_OBJECT_PLACEMENT"
  | "INSUFFICIENT_FUNDS"
  | "WORLD_OBJECT_NOT_FOUND"
  | "WORLD_OBJECT_NOT_REMOVABLE";

export interface WorldObjectMutationError {
  readonly code: WorldObjectMutationErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

export type WorldObjectPlacementErrorCode =
  | "OUT_OF_BOUNDS"
  | "SECTOR_LOCKED"
  | "TERRAIN_BLOCKED"
  | "BUILDING_COLLISION"
  | "OBJECT_COLLISION"
  | "ROAD_ADJACENCY_REQUIRED";

export interface WorldObjectPlacementError {
  readonly code: WorldObjectPlacementErrorCode;
  readonly tile: GridPoint;
  readonly message: string;
}

export interface PlaceWorldObjectRequest {
  readonly definitionId: string;
  readonly hostTile: GridPoint;
  readonly orientation?: CardinalDirection;
  readonly variant?: string;
  readonly instanceId?: string;
}

export interface WorldObjectPlacementPlan {
  readonly definition: ExteriorObjectDefinitionV1;
  readonly hostTile: GridPoint;
  readonly orientation: CardinalDirection;
  readonly variant?: string;
  readonly cost: number;
}

const CARDINAL_DIRECTIONS: readonly {
  readonly orientation: CardinalDirection;
  readonly offset: GridPoint;
}[] = [
  { orientation: "north", offset: { x: 0, y: -1 } },
  { orientation: "east", offset: { x: 1, y: 0 } },
  { orientation: "south", offset: { x: 0, y: 1 } },
  { orientation: "west", offset: { x: -1, y: 0 } },
];

const sectorUnlocked = (state: GameStateV1, sectorId: string): boolean =>
  state.map.sectors.find((sector) => sector.id === sectorId)?.unlocked === true;

export const adjacentRoadFacing = (state: GameStateV1, point: GridPoint): CardinalDirection | undefined =>
  CARDINAL_DIRECTIONS.find(({ offset }) => {
    const tile = getTile(state.map, { x: point.x + offset.x, y: point.y + offset.y });
    return tile?.terrain === "road" && tile.buildingId === undefined && sectorUnlocked(state, tile.sectorId);
  })?.orientation;

export const validateWorldObjectPlacement = (
  state: GameStateV1,
  request: PlaceWorldObjectRequest,
  catalog: CatalogV1 = ALPHA_CATALOG,
): Result<WorldObjectPlacementPlan, readonly WorldObjectPlacementError[]> => {
  const definition = getExteriorObjectDefinition(request.definitionId, catalog);
  if (!definition) {
    return {
      ok: false,
      error: [{ code: "OUT_OF_BOUNDS", tile: request.hostTile, message: `Unknown exterior object ${request.definitionId}.` }],
    };
  }
  const errors: WorldObjectPlacementError[] = [];
  const tile = getTile(state.map, request.hostTile);
  if (!tile) {
    errors.push({ code: "OUT_OF_BOUNDS", tile: request.hostTile, message: "Object leaves the map." });
  } else {
    if (!sectorUnlocked(state, tile.sectorId)) {
      errors.push({ code: "SECTOR_LOCKED", tile: request.hostTile, message: `Sector ${tile.sectorId} is locked.` });
    }
    // Street furniture belongs on the pedestrian grass edge. It is never
    // centered on the road itself, which keeps lamps and benches aligned.
    if (tile.terrain !== "grass") {
      errors.push({ code: "TERRAIN_BLOCKED", tile: request.hostTile, message: "Exterior objects require grass." });
    }
    if (tile.buildingId) {
      errors.push({ code: "BUILDING_COLLISION", tile: request.hostTile, message: "A building occupies this tile." });
    }
  }
  if (state.worldObjects.some((object) => pointKey(object.hostTile) === pointKey(request.hostTile))) {
    errors.push({ code: "OBJECT_COLLISION", tile: request.hostTile, message: "Another exterior object occupies this tile." });
  }
  const roadFacing = adjacentRoadFacing(state, request.hostTile);
  if (definition.placementRule === "grass-near-road" && !roadFacing) {
    errors.push({
      code: "ROAD_ADJACENCY_REQUIRED",
      tile: request.hostTile,
      message: `${definition.name} must sit on grass beside an unlocked road.`,
    });
  }
  if (errors.length > 0) return { ok: false, error: errors };
  return {
    ok: true,
    value: {
      definition,
      hostTile: request.hostTile,
      orientation: roadFacing ?? request.orientation ?? "north",
      ...(request.variant ? { variant: request.variant } : {}),
      cost: definition.price,
    },
  };
};

const nextWorldObjectId = (state: GameStateV1): string => {
  const used = new Set(state.worldObjects.map((object) => object.instanceId));
  let suffix = state.worldObjects.length + 1;
  while (used.has(`object-${suffix}`)) suffix += 1;
  return `object-${suffix}`;
};

export const placeWorldObject = (
  state: GameStateV1,
  request: PlaceWorldObjectRequest,
  catalog: CatalogV1 = ALPHA_CATALOG,
): Result<GameStateV1, WorldObjectMutationError> => {
  const definition = getExteriorObjectDefinition(request.definitionId, catalog);
  if (!definition) {
    return { ok: false, error: { code: "UNKNOWN_WORLD_OBJECT", message: `Unknown exterior object ${request.definitionId}.` } };
  }
  const placement = validateWorldObjectPlacement(state, request, catalog);
  if (!placement.ok) {
    return {
      ok: false,
      error: {
        code: "INVALID_WORLD_OBJECT_PLACEMENT",
        message: `Cannot place ${definition.name} on the selected tile.`,
        details: placement.error,
      },
    };
  }
  const instanceId = request.instanceId ?? nextWorldObjectId(state);
  if (state.worldObjects.some((object) => object.instanceId === instanceId)) {
    return {
      ok: false,
      error: { code: "INVALID_WORLD_OBJECT_PLACEMENT", message: `Exterior object id ${instanceId} already exists.` },
    };
  }
  const payment = spendLumenes(state.economy, placement.value.cost);
  if (!payment.ok) {
    return { ok: false, error: { code: "INSUFFICIENT_FUNDS", message: payment.error.message, details: payment.error } };
  }
  const instance: WorldObjectInstanceV1 = {
    schema: WORLD_OBJECT_SCHEMA,
    instanceId,
    definitionId: definition.id,
    hostTile: request.hostTile,
    orientation: placement.value.orientation,
    ...(placement.value.variant ? { variant: placement.value.variant } : {}),
    placementState: "placed",
    ...(definition.lightSource ? { lightSource: definition.lightSource } : {}),
    removable: definition.removable,
    provenance: "player",
  };
  return {
    ok: true,
    value: { ...state, economy: payment.value, worldObjects: [...state.worldObjects, instance] },
  };
};

export const removeWorldObject = (
  state: GameStateV1,
  instanceId: string,
  catalog: CatalogV1 = ALPHA_CATALOG,
): Result<GameStateV1, WorldObjectMutationError> => {
  const object = state.worldObjects.find((candidate) => candidate.instanceId === instanceId);
  if (!object) {
    return { ok: false, error: { code: "WORLD_OBJECT_NOT_FOUND", message: `Unknown exterior object ${instanceId}.` } };
  }
  if (!object.removable) {
    return { ok: false, error: { code: "WORLD_OBJECT_NOT_REMOVABLE", message: "This exterior object cannot be removed." } };
  }
  const definition = getExteriorObjectDefinition(object.definitionId, catalog);
  const refund = object.provenance === "player" && definition ? Math.floor(definition.price / 2) : 0;
  const economy = refund > 0 ? grantLocalReward(state.economy, refund).economy : state.economy;
  return {
    ok: true,
    value: {
      ...state,
      economy,
      worldObjects: state.worldObjects.filter((candidate) => candidate.instanceId !== instanceId),
    },
  };
};

export const worldObjectsAt = (
  state: Pick<GameStateV1, "worldObjects">,
  points: readonly GridPoint[],
): readonly WorldObjectInstanceV1[] => {
  const wanted = new Set(points.map(pointKey));
  return state.worldObjects.filter((object) => wanted.has(pointKey(object.hostTile)));
};

export const worldObjectCleanupCost = (
  object: WorldObjectInstanceV1,
  catalog: CatalogV1 = ALPHA_CATALOG,
): number => getExteriorObjectDefinition(object.definitionId, catalog)?.removalCost ?? 0;

const seededObject = (
  definitionId: string,
  hostTile: GridPoint,
  index: number,
  state: GameStateV1,
  catalog: CatalogV1,
): WorldObjectInstanceV1 | undefined => {
  const definition = getExteriorObjectDefinition(definitionId, catalog);
  if (!definition) return undefined;
  return {
    schema: WORLD_OBJECT_SCHEMA,
    instanceId: `seeded-${index + 1}`,
    definitionId,
    hostTile,
    orientation: adjacentRoadFacing(state, hostTile) ?? "north",
    placementState: "placed",
    ...(definition.lightSource ? { lightSource: definition.lightSource } : {}),
    removable: definition.removable,
    provenance: "seeded",
  };
};

/**
 * Deterministic authored-looking seed. Tiny grass marks remain procedural;
 * only objects that matter to collision and persistence are created here.
 */
export const createSeededWorldObjects = (
  state: GameStateV1,
  catalog: CatalogV1 = ALPHA_CATALOG,
): readonly WorldObjectInstanceV1[] => {
  const blocked = new Set([
    ...state.buildings.flatMap((building) => building.occupiedTiles.map(pointKey)),
    ...state.buildings.map((building) => pointKey(building.accessTile)),
  ]);
  const selected: Array<{ readonly definitionId: string; readonly hostTile: GridPoint }> = [];
  for (const tile of state.map.tiles) {
    if (tile.terrain !== "grass" || tile.buildingId || blocked.has(pointKey(tile.position))) continue;
    const hash = Math.abs((tile.position.x + 11) * 73_856_093 ^ (tile.position.y + 17) * 19_349_663);
    const roadFacing = adjacentRoadFacing(state, tile.position);
    if (roadFacing && hash % 31 === 0) {
      selected.push({ definitionId: hash % 2 === 0 ? "streetlamp" : "bench", hostTile: tile.position });
      continue;
    }
    if (hash % 37 === 0) {
      selected.push({ definitionId: hash % 3 === 0 ? "tree-narrow" : "tree-round", hostTile: tile.position });
    } else if (hash % 29 === 0) {
      selected.push({ definitionId: hash % 2 === 0 ? "shrub-flowering" : "shrub-round", hostTile: tile.position });
    } else if (hash % 53 === 0) {
      selected.push({ definitionId: "hedge-short", hostTile: tile.position });
    }
  }
  return selected
    .map((candidate, index) => seededObject(candidate.definitionId, candidate.hostTile, index, state, catalog))
    .filter((object): object is WorldObjectInstanceV1 => object !== undefined);
};
