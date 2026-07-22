export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface MutableVec2 {
  x: number;
  y: number;
}

export interface WorldRect {
  readonly id: string;
  readonly label: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface ViewTransform {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
}

export const SOURCE_ROOM = Object.freeze({
  width: 1465,
  height: 1073,
  originX: 732,
  originY: 445,
  tileHalfWidth: 77,
  tileHalfHeight: 34.5,
});

export const WORLD_BOUNDS = Object.freeze({ minX: 0.65, maxX: 7.35, minY: 0.65, maxY: 7.35 });
export const ACTOR_RADIUS = 0.24;
const PATH_GRID = 0.25;

export function worldToSource(point: Vec2): Vec2 {
  return {
    x: SOURCE_ROOM.originX + (point.x - point.y) * SOURCE_ROOM.tileHalfWidth,
    y: SOURCE_ROOM.originY + (point.x + point.y) * SOURCE_ROOM.tileHalfHeight,
  };
}

export function sourceToWorld(point: Vec2): Vec2 {
  const horizontal = (point.x - SOURCE_ROOM.originX) / SOURCE_ROOM.tileHalfWidth;
  const vertical = (point.y - SOURCE_ROOM.originY) / SOURCE_ROOM.tileHalfHeight;
  return {
    x: (horizontal + vertical) / 2,
    y: (vertical - horizontal) / 2,
  };
}

export function worldToCanvas(point: Vec2, view: ViewTransform): Vec2 {
  const source = worldToSource(point);
  return {
    x: view.offsetX + source.x * view.scale,
    y: view.offsetY + source.y * view.scale,
  };
}

export function canvasToWorld(point: Vec2, view: ViewTransform): Vec2 {
  return sourceToWorld({
    x: (point.x - view.offsetX) / view.scale,
    y: (point.y - view.offsetY) / view.scale,
  });
}

export function depthOf(point: Vec2): number {
  return point.x + point.y;
}

export function clampToWorld(point: Vec2): Vec2 {
  return {
    x: Math.min(WORLD_BOUNDS.maxX, Math.max(WORLD_BOUNDS.minX, point.x)),
    y: Math.min(WORLD_BOUNDS.maxY, Math.max(WORLD_BOUNDS.minY, point.y)),
  };
}

export function circleOverlapsRect(point: Vec2, radius: number, rect: WorldRect): boolean {
  const closestX = Math.max(rect.minX, Math.min(point.x, rect.maxX));
  const closestY = Math.max(rect.minY, Math.min(point.y, rect.maxY));
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  return dx * dx + dy * dy < radius * radius;
}

export function isWalkable(point: Vec2, colliders: readonly WorldRect[], radius = ACTOR_RADIUS): boolean {
  if (
    point.x - radius < WORLD_BOUNDS.minX ||
    point.x + radius > WORLD_BOUNDS.maxX ||
    point.y - radius < WORLD_BOUNDS.minY ||
    point.y + radius > WORLD_BOUNDS.maxY
  ) {
    return false;
  }
  return !colliders.some((rect) => circleOverlapsRect(point, radius, rect));
}

export interface MoveResult {
  readonly position: Vec2;
  readonly collided: boolean;
}

export function moveWithSliding(
  current: Vec2,
  delta: Vec2,
  colliders: readonly WorldRect[],
  radius = ACTOR_RADIUS,
): MoveResult {
  const full = { x: current.x + delta.x, y: current.y + delta.y };
  if (isWalkable(full, colliders, radius)) return { position: full, collided: false };

  const alongX = { x: current.x + delta.x, y: current.y };
  const alongY = { x: current.x, y: current.y + delta.y };
  const canX = Math.abs(delta.x) > 0.0001 && isWalkable(alongX, colliders, radius);
  const canY = Math.abs(delta.y) > 0.0001 && isWalkable(alongY, colliders, radius);
  if (canX && canY) {
    return Math.abs(delta.x) >= Math.abs(delta.y)
      ? { position: alongX, collided: true }
      : { position: alongY, collided: true };
  }
  if (canX) return { position: alongX, collided: true };
  if (canY) return { position: alongY, collided: true };
  return { position: current, collided: true };
}

interface GridNode {
  readonly gx: number;
  readonly gy: number;
  readonly g: number;
  readonly f: number;
  readonly parent?: string;
}

const NEIGHBORS: readonly Vec2[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

export function findSmoothPath(
  start: Vec2,
  destination: Vec2,
  colliders: readonly WorldRect[],
  radius = ACTOR_RADIUS,
): readonly Vec2[] | null {
  const target = clampToWorld(destination);
  if (!isWalkable(target, colliders, radius)) return null;

  const startGrid = toGrid(start);
  const endGrid = nearestWalkableGrid(target, colliders, radius);
  if (!endGrid) return null;
  const startKey = gridKey(startGrid.gx, startGrid.gy);
  const targetKey = gridKey(endGrid.gx, endGrid.gy);
  const open = new Map<string, GridNode>();
  const all = new Map<string, GridNode>();
  const closed = new Set<string>();
  const initial: GridNode = {
    gx: startGrid.gx,
    gy: startGrid.gy,
    g: 0,
    f: gridHeuristic(startGrid.gx, startGrid.gy, endGrid.gx, endGrid.gy),
  };
  open.set(startKey, initial);
  all.set(startKey, initial);

  while (open.size > 0) {
    let currentKey: string | undefined;
    let current: GridNode | undefined;
    for (const [key, node] of open) {
      if (!current || node.f < current.f) {
        current = node;
        currentKey = key;
      }
    }
    if (!current || !currentKey) break;
    if (currentKey === targetKey) {
      const gridPath = reconstructPath(currentKey, all);
      const points = gridPath.map((node) => fromGrid(node.gx, node.gy));
      if (distance(points.at(-1) ?? start, target) > 0.04) points.push(target);
      return simplifyPath(points, colliders, radius).slice(1);
    }

    open.delete(currentKey);
    closed.add(currentKey);
    for (const offset of NEIGHBORS) {
      const gx = current.gx + offset.x;
      const gy = current.gy + offset.y;
      const key = gridKey(gx, gy);
      if (closed.has(key)) continue;
      const point = fromGrid(gx, gy);
      if (!isWalkable(point, colliders, radius)) continue;
      if (offset.x !== 0 && offset.y !== 0) {
        if (
          !isWalkable(fromGrid(current.gx + offset.x, current.gy), colliders, radius) ||
          !isWalkable(fromGrid(current.gx, current.gy + offset.y), colliders, radius)
        ) {
          continue;
        }
      }
      const stepCost = offset.x !== 0 && offset.y !== 0 ? Math.SQRT2 : 1;
      const nextG = current.g + stepCost;
      const previous = all.get(key);
      if (previous && nextG >= previous.g) continue;
      const next: GridNode = {
        gx,
        gy,
        g: nextG,
        f: nextG + gridHeuristic(gx, gy, endGrid.gx, endGrid.gy),
        parent: currentKey,
      };
      open.set(key, next);
      all.set(key, next);
    }
  }
  return null;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function toGrid(point: Vec2): { readonly gx: number; readonly gy: number } {
  return {
    gx: Math.round((point.x - WORLD_BOUNDS.minX) / PATH_GRID),
    gy: Math.round((point.y - WORLD_BOUNDS.minY) / PATH_GRID),
  };
}

function fromGrid(gx: number, gy: number): Vec2 {
  return {
    x: WORLD_BOUNDS.minX + gx * PATH_GRID,
    y: WORLD_BOUNDS.minY + gy * PATH_GRID,
  };
}

function nearestWalkableGrid(
  point: Vec2,
  colliders: readonly WorldRect[],
  radius: number,
): { readonly gx: number; readonly gy: number } | null {
  const center = toGrid(point);
  for (let ring = 0; ring <= 4; ring += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        if (ring > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const candidate = { gx: center.gx + dx, gy: center.gy + dy };
        if (isWalkable(fromGrid(candidate.gx, candidate.gy), colliders, radius)) return candidate;
      }
    }
  }
  return null;
}

function gridKey(gx: number, gy: number): string {
  return `${gx}:${gy}`;
}

function gridHeuristic(gx: number, gy: number, tx: number, ty: number): number {
  const dx = Math.abs(tx - gx);
  const dy = Math.abs(ty - gy);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function reconstructPath(targetKey: string, nodes: ReadonlyMap<string, GridNode>): GridNode[] {
  const path: GridNode[] = [];
  let key: string | undefined = targetKey;
  while (key) {
    const node: GridNode | undefined = nodes.get(key);
    if (!node) break;
    path.push(node);
    key = node.parent;
  }
  return path.reverse();
}

function simplifyPath(points: readonly Vec2[], colliders: readonly WorldRect[], radius: number): Vec2[] {
  if (points.length <= 2) return [...points];
  const result: Vec2[] = [];
  let anchorIndex = 0;
  result.push(points[0] ?? { x: 0, y: 0 });
  while (anchorIndex < points.length - 1) {
    let furthest = anchorIndex + 1;
    for (let candidate = anchorIndex + 2; candidate < points.length; candidate += 1) {
      const from = points[anchorIndex];
      const to = points[candidate];
      if (!from || !to || !segmentIsWalkable(from, to, colliders, radius)) break;
      furthest = candidate;
    }
    const next = points[furthest];
    if (!next) break;
    result.push(next);
    anchorIndex = furthest;
  }
  return result;
}

function segmentIsWalkable(
  from: Vec2,
  to: Vec2,
  colliders: readonly WorldRect[],
  radius: number,
): boolean {
  const length = distance(from, to);
  const steps = Math.max(1, Math.ceil(length / 0.08));
  for (let index = 1; index <= steps; index += 1) {
    const ratio = index / steps;
    if (!isWalkable({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio }, colliders, radius)) {
      return false;
    }
  }
  return true;
}
