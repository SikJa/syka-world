import {
  ALPHA_CATALOG,
  SPATIAL_SCENE_SCHEMA,
  getBuildingDefinition,
  getExteriorObjectDefinition,
  spatialEntityBlockedCells,
  spatialPointKey,
  type BuildingInstanceV1,
  type CardinalDirection,
  type CatalogV1,
  type GameStateV1,
  type GridPoint,
  type SpatialActorReservationV1,
  type SpatialAnchorV1,
  type SpatialEntityV1,
  type SpatialInteractionV1,
  type ManualSpatialActorSeedV1,
  type SpatialOccupancyV1,
  type SpatialPortalV1,
  type SpatialSceneDefinitionV1,
  type WorldObjectInstanceV1,
} from "../../core";
import { CITY_ASSET_PATHS, CITY_TEXTURE_KEYS } from "./assets";
import { CITY_TILE_HEIGHT, CITY_TILE_WIDTH, CITY_WORLD_ORIGIN } from "./projection";

export interface CitySpatialModelV1 {
  readonly definition: SpatialSceneDefinitionV1;
  readonly occupancy: SpatialOccupancyV1;
}

export const cityBuildingEntityId = (buildingId: string): string =>
  `city:entity:building:${buildingId}`;

export const cityBuildingAccessAnchorId = (buildingId: string): string =>
  `city:anchor:building-access:${buildingId}`;

export const cityBuildingPortalId = (buildingId: string): string =>
  `portal-${buildingId}`;

export const cityInteriorSceneId = (buildingId: string): string =>
  `cafe:${buildingId}`;

export const cityInteriorExitPortalId = (buildingId: string): string =>
  `portal-${buildingId}-exit`;

const cityWorldObjectEntityId = (instanceId: string): string =>
  `city:entity:world-object:${instanceId}`;

const cityWorldObjectInteractionId = (instanceId: string): string =>
  `city:interaction:world-object:${instanceId}`;

const cityBuildingInteractionId = (buildingId: string): string =>
  `city:interaction:building:${buildingId}`;

const samePoint = (left: GridPoint, right: GridPoint): boolean =>
  left.x === right.x && left.y === right.y;

const sortedPointKeys = (points: readonly GridPoint[]): readonly string[] =>
  points.map(spatialPointKey).sort();

const samePointSet = (left: readonly GridPoint[], right: readonly GridPoint[]): boolean => {
  const leftKeys = sortedPointKeys(left);
  const rightKeys = sortedPointKeys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index]);
};

const exactPersistedFootprint = (
  building: BuildingInstanceV1,
): Pick<SpatialEntityV1, "origin" | "orientation" | "footprint" | "blocksMovement"> => {
  if (building.occupiedTiles.length === 0) {
    return {
      origin: building.origin,
      orientation: "north",
      footprint: { width: 1, height: 1 },
      blocksMovement: false,
    };
  }
  const minX = Math.min(...building.occupiedTiles.map((point) => point.x));
  const maxX = Math.max(...building.occupiedTiles.map((point) => point.x));
  const minY = Math.min(...building.occupiedTiles.map((point) => point.y));
  const maxY = Math.max(...building.occupiedTiles.map((point) => point.y));
  return {
    origin: { x: minX, y: minY },
    orientation: "north",
    footprint: {
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      blockedOffsets: building.occupiedTiles
        .map((point) => ({ x: point.x - minX, y: point.y - minY }))
        .sort((left, right) => left.y - right.y || left.x - right.x),
    },
    blocksMovement: true,
  };
};

const createBuildingEntity = (
  building: BuildingInstanceV1,
  catalog: CatalogV1,
): SpatialEntityV1 => {
  const definition = getBuildingDefinition(building.definitionId, catalog);
  const catalogEntity: SpatialEntityV1 | undefined = definition
    ? {
        id: cityBuildingEntityId(building.id),
        kind: "building",
        origin: building.origin,
        orientation: building.orientation,
        footprint: definition.footprint,
        blocksMovement: true,
      }
    : undefined;
  const geometry = catalogEntity && samePointSet(spatialEntityBlockedCells(catalogEntity), building.occupiedTiles)
    ? {
        origin: catalogEntity.origin,
        orientation: catalogEntity.orientation,
        footprint: catalogEntity.footprint,
        blocksMovement: catalogEntity.blocksMovement,
      }
    : exactPersistedFootprint(building);
  return {
    id: cityBuildingEntityId(building.id),
    kind: "building",
    ...geometry,
    variant: building.visualVariant,
    render: {
      visualKey: building.visualVariant,
      depthRule: "ground-cell",
      parts: ["body"],
    },
    tags: ["city", "building", building.kind, building.status, building.interiorId],
    accessibleLabel: definition?.name ?? building.kind,
  };
};

const createWorldObjectEntity = (
  object: WorldObjectInstanceV1,
  catalog: CatalogV1,
): SpatialEntityV1 => {
  const definition = getExteriorObjectDefinition(object.definitionId, catalog);
  return {
    id: cityWorldObjectEntityId(object.instanceId),
    kind: "world-object",
    origin: object.hostTile,
    orientation: object.orientation,
    footprint: { width: 1, height: 1 },
    // Unknown persistent objects fail closed: walking through them would be a
    // less recoverable spatial error than treating one cell as occupied.
    blocksMovement: definition?.physical ?? true,
    ...(object.variant ? { variant: object.variant } : {}),
    render: {
      visualKey: definition?.visualKey ?? object.definitionId,
      depthRule: "ground-cell",
      parts: ["body"],
    },
    tags: [
      "city",
      "world-object",
      definition?.category ?? "unknown",
      object.provenance,
      object.removable ? "removable" : "fixed",
    ],
    accessibleLabel: definition?.name ?? object.definitionId,
  };
};

const directionFromTo = (from: GridPoint, to: GridPoint): CardinalDirection | undefined => {
  if (to.x === from.x && to.y === from.y - 1) return "north";
  if (to.x === from.x + 1 && to.y === from.y) return "east";
  if (to.x === from.x && to.y === from.y + 1) return "south";
  if (to.x === from.x - 1 && to.y === from.y) return "west";
  return undefined;
};

const cardinalNeighbours = (point: GridPoint): readonly GridPoint[] => [
  { x: point.x, y: point.y - 1 },
  { x: point.x + 1, y: point.y },
  { x: point.x, y: point.y + 1 },
  { x: point.x - 1, y: point.y },
];

const createBuildingAnchor = (building: BuildingInstanceV1): SpatialAnchorV1 => {
  const facing = directionFromTo(building.accessTile, building.entranceTile);
  return {
    id: cityBuildingAccessAnchorId(building.id),
    cell: building.accessTile,
    ...(facing ? { facing } : {}),
    entityId: cityBuildingEntityId(building.id),
    reservable: true,
    tags: ["building-access", building.kind, building.status],
  };
};

const createBuildingInteraction = (building: BuildingInstanceV1): SpatialInteractionV1 => ({
  id: cityBuildingInteractionId(building.id),
  entityId: cityBuildingEntityId(building.id),
  action: building.status === "complete" ? "inspect-building" : "inspect-construction",
  anchorIds: [cityBuildingAccessAnchorId(building.id)],
  maxApproachSteps: 1,
  priority: building.status === "complete" ? 20 : 10,
});

const createBuildingPortal = (building: BuildingInstanceV1): SpatialPortalV1 => {
  const requiredFacing = directionFromTo(building.accessTile, building.entranceTile);
  return {
    id: cityBuildingPortalId(building.id),
    cell: building.entranceTile,
    approachAnchorIds: [cityBuildingAccessAnchorId(building.id)],
    ...(requiredFacing ? { requiredFacing } : {}),
    target: {
      sceneId: cityInteriorSceneId(building.id),
      portalId: cityInteriorExitPortalId(building.id),
    },
    enabled: true,
  };
};

const createWorldObjectAnchors = (
  object: WorldObjectInstanceV1,
  walkableKeys: ReadonlySet<string>,
): readonly SpatialAnchorV1[] => cardinalNeighbours(object.hostTile)
  .filter((cell) => walkableKeys.has(spatialPointKey(cell)))
  .map((cell, index) => {
    const facing = directionFromTo(cell, object.hostTile);
    return {
      id: `city:anchor:world-object:${object.instanceId}:${index + 1}`,
      cell,
      ...(facing ? { facing } : {}),
      entityId: cityWorldObjectEntityId(object.instanceId),
      reservable: true,
      tags: ["world-object-approach", object.definitionId],
    };
  });

/**
 * Derives the city's renderer-independent spatial truth from persisted game
 * state. Road tiles are the only floor; sprites never decide collision.
 */
export const createCitySpatialSceneDefinition = (
  state: GameStateV1,
  catalog: CatalogV1 = ALPHA_CATALOG,
): SpatialSceneDefinitionV1 => {
  const walkableCells = state.map.tiles
    .filter((tile) => tile.terrain === "road" && tile.buildingId === undefined)
    .map((tile) => tile.position)
    .sort((left, right) => left.y - right.y || left.x - right.x);
  const walkableKeys = new Set(walkableCells.map(spatialPointKey));
  const buildingsWithAccess = state.buildings.filter((building) =>
    walkableKeys.has(spatialPointKey(building.accessTile)),
  );
  const buildingAnchors = buildingsWithAccess.map(createBuildingAnchor);
  const objectAnchorGroups = state.worldObjects.map((object) => ({
    object,
    anchors: createWorldObjectAnchors(object, walkableKeys),
  }));
  // Café Biblioteca is the only authored isolated interior in v1. Homes and
  // offices keep their access interactions but do not advertise dead portals.
  const completeBuildings = buildingsWithAccess.filter((building) =>
    building.status === "complete" && building.kind === "cafe",
  );
  return {
    schema: SPATIAL_SCENE_SCHEMA,
    id: "city",
    version: 1,
    grid: state.map.size,
    projection: {
      kind: "isometric-fixed",
      tileWidth: CITY_TILE_WIDTH,
      tileHeight: CITY_TILE_HEIGHT,
      origin: CITY_WORLD_ORIGIN,
    },
    walkableCells,
    entities: [
      ...state.buildings.map((building) => createBuildingEntity(building, catalog)),
      ...state.worldObjects.map((object) => createWorldObjectEntity(object, catalog)),
    ],
    anchors: [
      ...buildingAnchors,
      ...objectAnchorGroups.flatMap((group) => group.anchors),
    ],
    interactions: [
      ...buildingsWithAccess.map(createBuildingInteraction),
      ...objectAnchorGroups
        .filter((group) => group.anchors.length > 0)
        .map((group): SpatialInteractionV1 => ({
          id: cityWorldObjectInteractionId(group.object.instanceId),
          entityId: cityWorldObjectEntityId(group.object.instanceId),
          action: "inspect-world-object",
          anchorIds: group.anchors.map((anchor) => anchor.id),
          maxApproachSteps: 1,
          priority: 5,
        })),
    ],
    portals: completeBuildings.map(createBuildingPortal),
    // An access tile is both the return point from an interior and the place
    // from which F may leave the city.
    entryAnchorIds: completeBuildings.map((building) => cityBuildingAccessAnchorId(building.id)),
    exitAnchorIds: completeBuildings.map((building) => cityBuildingAccessAnchorId(building.id)),
    lighting: "inherit-world-clock",
    assets: [
      { key: CITY_TEXTURE_KEYS.terrain, role: "structure", provenance: CITY_ASSET_PATHS.terrain },
      { key: CITY_TEXTURE_KEYS.alphaBuildings, role: "entity", provenance: CITY_ASSET_PATHS.alphaBuildings },
      { key: CITY_TEXTURE_KEYS.props, role: "entity", provenance: CITY_ASSET_PATHS.props },
      { key: CITY_TEXTURE_KEYS.groundDecals, role: "entity", provenance: CITY_ASSET_PATHS.groundDecals },
      { key: CITY_TEXTURE_KEYS.lightFx, role: "lighting", provenance: CITY_ASSET_PATHS.lightFx },
    ],
  };
};

const currentAgentCell = (state: GameStateV1, actorId: string): GridPoint | undefined => {
  const agent = state.agents.find((candidate) => candidate.id === actorId);
  if (!agent || agent.location.kind === "interior") return undefined;
  return agent.location.tile;
};

const currentNpcCell = (state: GameStateV1, actorId: string): GridPoint | undefined => {
  const npc = state.npcs.find((candidate) => candidate.id === actorId);
  return npc?.location.kind === "transit" ? npc.location.tile : undefined;
};

const anchorAtCell = (
  definition: SpatialSceneDefinitionV1,
  cell: GridPoint,
): string | undefined => definition.anchors
  .filter((anchor) => anchor.reservable && samePoint(anchor.cell, cell))
  .map((anchor) => anchor.id)
  .sort()[0];

const reservation = (
  definition: SpatialSceneDefinitionV1,
  actorId: string,
  kind: SpatialActorReservationV1["kind"],
  cell: GridPoint,
): SpatialActorReservationV1 => {
  const anchorId = anchorAtCell(definition, cell);
  return {
    actorId,
    kind,
    cell,
    ...(anchorId ? { anchorId } : {}),
  };
};

/**
 * Creates current/destination reservations for every city actor. Consumers
 * must pass the queried actor id to `isSpatialCellWalkable`/`findSpatialPath`;
 * the shared core then ignores that actor's own reservations while preserving
 * every other actor as a real obstacle.
 */
export const createCitySpatialOccupancy = (
  state: GameStateV1,
  definition: SpatialSceneDefinitionV1 = createCitySpatialSceneDefinition(state),
): SpatialOccupancyV1 => {
  const walkableKeys = new Set(definition.walkableCells.map(spatialPointKey));
  const reservations: SpatialActorReservationV1[] = [];

  for (const agent of [...state.agents].sort((left, right) => left.id.localeCompare(right.id))) {
    const current = currentAgentCell(state, agent.id);
    if (!current || !walkableKeys.has(spatialPointKey(current))) continue;
    reservations.push(reservation(definition, agent.id, "current", current));
    if (
      agent.path.length > 1 &&
      !samePoint(current, agent.destination) &&
      walkableKeys.has(spatialPointKey(agent.destination))
    ) {
      reservations.push(reservation(definition, agent.id, "destination", agent.destination));
    }
  }

  for (const npc of [...state.npcs].sort((left, right) => left.id.localeCompare(right.id))) {
    const current = currentNpcCell(state, npc.id);
    if (!current || npc.location.kind !== "transit" || !walkableKeys.has(spatialPointKey(current))) continue;
    reservations.push(reservation(definition, npc.id, "current", current));
    if (
      !samePoint(current, npc.location.destination) &&
      walkableKeys.has(spatialPointKey(npc.location.destination))
    ) {
      reservations.push(reservation(definition, npc.id, "destination", npc.location.destination));
    }
  }

  return {
    reservations: reservations.sort((left, right) =>
      left.actorId.localeCompare(right.actorId) || left.kind.localeCompare(right.kind),
    ),
  };
};

export const createCitySpatialModel = (
  state: GameStateV1,
  catalog: CatalogV1 = ALPHA_CATALOG,
): CitySpatialModelV1 => {
  const definition = createCitySpatialSceneDefinition(state, catalog);
  return { definition, occupancy: createCitySpatialOccupancy(state, definition) };
};

/** Actor ids deliberately match ProfileId so selection, UI and control share one identity. */
export const createCitySpatialActorSeeds = (
  state: GameStateV1,
): readonly ManualSpatialActorSeedV1[] => {
  const agents = state.agents.flatMap((agent): readonly ManualSpatialActorSeedV1[] => {
    if (agent.location.kind === "interior") return [];
    return [{
      actorId: agent.profileId,
      sceneId: "city",
      possessible: true,
      cell: agent.location.tile,
      facing: "south",
    }];
  });
  const npcs = state.npcs.flatMap((npc): readonly ManualSpatialActorSeedV1[] => {
    if (npc.location.kind !== "transit") return [];
    return [{
      actorId: `npc:${npc.id}`,
      sceneId: "city",
      possessible: false,
      cell: npc.location.tile,
      facing: "south",
    }];
  });
  return [...agents, ...npcs];
};
