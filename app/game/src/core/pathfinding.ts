import type { GridPoint, Result, TileV1, WorldMapV1 } from "./contracts";
import { getTile, pointKey, samePoint } from "./map";

export interface PathfindingError {
  readonly code: "INVALID_ENDPOINT" | "NO_PATH" | "SEARCH_LIMIT";
  readonly message: string;
  readonly visited: number;
}

export interface PathfindingOptions {
  readonly maxVisited?: number;
  readonly isWalkable?: (tile: TileV1) => boolean;
}

interface OpenNode {
  readonly point: GridPoint;
  readonly g: number;
  readonly h: number;
  readonly f: number;
}

const manhattan = (left: GridPoint, right: GridPoint): number => Math.abs(left.x - right.x) + Math.abs(left.y - right.y);

const neighbours = (point: GridPoint): readonly GridPoint[] => [
  { x: point.x, y: point.y - 1 },
  { x: point.x + 1, y: point.y },
  { x: point.x, y: point.y + 1 },
  { x: point.x - 1, y: point.y },
];

const reconstruct = (cameFrom: ReadonlyMap<string, GridPoint>, current: GridPoint): readonly GridPoint[] => {
  const path: GridPoint[] = [current];
  let cursor = current;
  while (cameFrom.has(pointKey(cursor))) {
    const previous = cameFrom.get(pointKey(cursor));
    if (!previous) break;
    path.push(previous);
    cursor = previous;
  }
  return path.reverse();
};

/**
 * Limited cardinal A* used only for local ambient movement.  It deliberately
 * has no model or bridge dependency and resolves ties by row/column so the same
 * map and endpoints always yield the same route.
 */
export const findPath = (
  map: WorldMapV1,
  start: GridPoint,
  goal: GridPoint,
  options: PathfindingOptions = {},
): Result<readonly GridPoint[], PathfindingError> => {
  const startTile = getTile(map, start);
  const goalTile = getTile(map, goal);
  if (!startTile || !goalTile) {
    return { ok: false, error: { code: "INVALID_ENDPOINT", message: "Path endpoint is outside the map.", visited: 0 } };
  }
  if (samePoint(start, goal)) return { ok: true, value: [start] };

  const maxVisited = options.maxVisited ?? Math.min(map.tiles.length, 2_000);
  const walkable = options.isWalkable ?? ((tile: TileV1) => tile.terrain === "road" && tile.buildingId === undefined);
  const open: OpenNode[] = [{ point: start, g: 0, h: manhattan(start, goal), f: manhattan(start, goal) }];
  const openKeys = new Set([pointKey(start)]);
  const cameFrom = new Map<string, GridPoint>();
  const bestCost = new Map<string, number>([[pointKey(start), 0]]);
  const closed = new Set<string>();
  let visited = 0;

  while (open.length > 0) {
    open.sort((left, right) => left.f - right.f || left.h - right.h || left.point.y - right.point.y || left.point.x - right.point.x);
    const current = open.shift();
    if (!current) break;
    openKeys.delete(pointKey(current.point));
    if (closed.has(pointKey(current.point))) continue;
    closed.add(pointKey(current.point));
    visited += 1;

    if (samePoint(current.point, goal)) return { ok: true, value: reconstruct(cameFrom, current.point) };
    if (visited >= maxVisited) {
      return { ok: false, error: { code: "SEARCH_LIMIT", message: "Path search reached its safety limit.", visited } };
    }

    for (const next of neighbours(current.point)) {
      const tile = getTile(map, next);
      if (!tile || closed.has(pointKey(next))) continue;
      if (!samePoint(next, goal) && !walkable(tile)) continue;
      const tentative = current.g + 1;
      const previousCost = bestCost.get(pointKey(next));
      if (previousCost !== undefined && tentative >= previousCost) continue;
      cameFrom.set(pointKey(next), current.point);
      bestCost.set(pointKey(next), tentative);
      const h = manhattan(next, goal);
      const node = { point: next, g: tentative, h, f: tentative + h };
      if (!openKeys.has(pointKey(next))) {
        open.push(node);
        openKeys.add(pointKey(next));
      } else {
        const index = open.findIndex((candidate) => samePoint(candidate.point, next));
        if (index >= 0) open[index] = node;
      }
    }
  }

  return { ok: false, error: { code: "NO_PATH", message: "No walkable path connects the endpoints.", visited } };
};
