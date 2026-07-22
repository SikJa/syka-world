import type { GameStateV1, GridPoint, Result } from "./contracts";
import { getTile, pointKey } from "./map";
import { worldObjectsAt } from "./worldObjects";

export const ROAD_TILE_COST = 3;

export interface RoadConnectorPlan {
  /** Full route from access tile through the first existing road tile. */
  readonly path: readonly GridPoint[];
  /** New road tiles only; the existing road target is not charged twice. */
  readonly roadTiles: readonly GridPoint[];
  readonly removedObjectIds: readonly string[];
  readonly cost: number;
}

export interface RoadConnectorError {
  readonly code: "INVALID_ACCESS_TILE" | "NO_EXISTING_ROAD" | "NO_ROAD_ROUTE";
  readonly message: string;
  readonly tile: GridPoint;
}

const neighbours = (point: GridPoint): readonly GridPoint[] => [
  { x: point.x, y: point.y - 1 },
  { x: point.x + 1, y: point.y },
  { x: point.x, y: point.y + 1 },
  { x: point.x - 1, y: point.y },
];

const reconstruct = (cameFrom: ReadonlyMap<string, GridPoint>, goal: GridPoint): readonly GridPoint[] => {
  const path: GridPoint[] = [goal];
  let cursor = goal;
  while (cameFrom.has(pointKey(cursor))) {
    const previous = cameFrom.get(pointKey(cursor));
    if (!previous) break;
    path.push(previous);
    cursor = previous;
  }
  return path.reverse();
};

const sectorUnlocked = (state: GameStateV1, sectorId: string): boolean =>
  state.map.sectors.find((sector) => sector.id === sectorId)?.unlocked === true;

export const planRoadConnector = (
  state: GameStateV1,
  accessTile: GridPoint,
  forbiddenTiles: readonly GridPoint[],
): Result<RoadConnectorPlan, RoadConnectorError> => {
  const forbidden = new Set(forbiddenTiles.map(pointKey));
  const nonRemovableObjects = new Set(
    state.worldObjects.filter((object) => !object.removable).map((object) => pointKey(object.hostTile)),
  );
  const start = getTile(state.map, accessTile);
  if (
    !start ||
    !sectorUnlocked(state, start.sectorId) ||
    !["grass", "road"].includes(start.terrain) ||
    start.buildingId ||
    forbidden.has(pointKey(accessTile)) ||
    nonRemovableObjects.has(pointKey(accessTile))
  ) {
    return {
      ok: false,
      error: { code: "INVALID_ACCESS_TILE", message: "The building access tile cannot start a road connector.", tile: accessTile },
    };
  }
  const existingRoad = state.map.tiles.some(
    (tile) => tile.terrain === "road" && !tile.buildingId && sectorUnlocked(state, tile.sectorId),
  );
  if (!existingRoad) {
    return {
      ok: false,
      error: { code: "NO_EXISTING_ROAD", message: "No unlocked road exists for the connector.", tile: accessTile },
    };
  }
  const queue: GridPoint[] = [accessTile];
  const visited = new Set([pointKey(accessTile)]);
  const cameFrom = new Map<string, GridPoint>();
  let goal: GridPoint | undefined;
  while (queue.length > 0 && visited.size <= state.map.tiles.length) {
    const current = queue.shift();
    if (!current) break;
    const tile = getTile(state.map, current);
    if (tile?.terrain === "road") {
      goal = current;
      break;
    }
    for (const candidate of neighbours(current)) {
      const key = pointKey(candidate);
      if (visited.has(key) || forbidden.has(key) || nonRemovableObjects.has(key)) continue;
      const candidateTile = getTile(state.map, candidate);
      if (
        !candidateTile ||
        !sectorUnlocked(state, candidateTile.sectorId) ||
        !["grass", "road"].includes(candidateTile.terrain) ||
        candidateTile.buildingId
      ) continue;
      visited.add(key);
      cameFrom.set(key, current);
      queue.push(candidate);
    }
  }
  if (!goal) {
    return {
      ok: false,
      error: { code: "NO_ROAD_ROUTE", message: "No valid route connects this access to the road network.", tile: accessTile },
    };
  }
  const path = reconstruct(cameFrom, goal);
  const roadTiles = path.filter((point) => getTile(state.map, point)?.terrain !== "road");
  const removedObjectIds = worldObjectsAt(state, roadTiles).map((object) => object.instanceId);
  return {
    ok: true,
    value: { path, roadTiles, removedObjectIds, cost: roadTiles.length * ROAD_TILE_COST },
  };
};
