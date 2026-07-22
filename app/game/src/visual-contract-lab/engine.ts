export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface MutableVec2 {
  x: number;
  y: number;
}

export interface NavCell {
  readonly x: number;
  readonly y: number;
}

export interface NavGrid {
  readonly originX: number;
  readonly originY: number;
  readonly cellSize: number;
  readonly width: number;
  readonly height: number;
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

export const NAV_GRID: NavGrid = Object.freeze({
  originX: 0.5,
  originY: 0.5,
  cellSize: 0.5,
  width: 14,
  height: 14,
});

export const WORLD_BOUNDS = Object.freeze({ minX: 0.72, maxX: 7.28, minY: 0.72, maxY: 7.28 });
export const ACTOR_RADIUS = 0.17;

const NEIGHBORS: readonly NavCell[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

interface PathNode {
  readonly cell: NavCell;
  readonly g: number;
  readonly f: number;
  readonly parent?: string;
}

export function cellKey(cell: NavCell): string {
  return `${cell.x}:${cell.y}`;
}

export function fillCellRange(minX: number, maxX: number, minY: number, maxY: number): readonly string[] {
  const result: string[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) result.push(cellKey({ x, y }));
  }
  return result;
}

export function isCellInside(cell: NavCell, grid = NAV_GRID): boolean {
  return cell.x >= 0 && cell.x < grid.width && cell.y >= 0 && cell.y < grid.height;
}

export function worldToCell(point: Vec2, grid = NAV_GRID): NavCell {
  return {
    x: Math.floor((point.x - grid.originX) / grid.cellSize),
    y: Math.floor((point.y - grid.originY) / grid.cellSize),
  };
}

export function cellCenter(cell: NavCell, grid = NAV_GRID): Vec2 {
  return {
    x: grid.originX + (cell.x + 0.5) * grid.cellSize,
    y: grid.originY + (cell.y + 0.5) * grid.cellSize,
  };
}

export function isCellWalkable(cell: NavCell, occupied: ReadonlySet<string>, grid = NAV_GRID): boolean {
  return isCellInside(cell, grid) && !occupied.has(cellKey(cell));
}

export function isWorldWalkable(
  point: Vec2,
  occupied: ReadonlySet<string>,
  radius = ACTOR_RADIUS,
  grid = NAV_GRID,
): boolean {
  const samples: readonly Vec2[] = [
    point,
    { x: point.x + radius, y: point.y },
    { x: point.x - radius, y: point.y },
    { x: point.x, y: point.y + radius },
    { x: point.x, y: point.y - radius },
    { x: point.x + radius * 0.72, y: point.y + radius * 0.72 },
    { x: point.x + radius * 0.72, y: point.y - radius * 0.72 },
    { x: point.x - radius * 0.72, y: point.y + radius * 0.72 },
    { x: point.x - radius * 0.72, y: point.y - radius * 0.72 },
  ];
  for (const sample of samples) {
    if (
      sample.x < WORLD_BOUNDS.minX || sample.x > WORLD_BOUNDS.maxX ||
      sample.y < WORLD_BOUNDS.minY || sample.y > WORLD_BOUNDS.maxY
    ) return false;
    if (!isCellWalkable(worldToCell(sample, grid), occupied, grid)) return false;
  }
  return true;
}

export function moveContinuous(
  current: Vec2,
  delta: Vec2,
  occupied: ReadonlySet<string>,
  radius = ACTOR_RADIUS,
): { readonly position: Vec2; readonly collided: boolean } {
  const full = { x: current.x + delta.x, y: current.y + delta.y };
  if (isWorldWalkable(full, occupied, radius)) return { position: full, collided: false };

  const alongX = { x: current.x + delta.x, y: current.y };
  const alongY = { x: current.x, y: current.y + delta.y };
  const canX = Math.abs(delta.x) > 0.00001 && isWorldWalkable(alongX, occupied, radius);
  const canY = Math.abs(delta.y) > 0.00001 && isWorldWalkable(alongY, occupied, radius);
  if (canX && canY) {
    return Math.abs(delta.x) >= Math.abs(delta.y)
      ? { position: alongX, collided: true }
      : { position: alongY, collided: true };
  }
  if (canX) return { position: alongX, collided: true };
  if (canY) return { position: alongY, collided: true };
  return { position: current, collided: true };
}

export function findSmoothPath(
  start: Vec2,
  destination: Vec2,
  occupied: ReadonlySet<string>,
  radius = ACTOR_RADIUS,
  grid = NAV_GRID,
): readonly Vec2[] | null {
  if (!isWorldWalkable(destination, occupied, radius, grid)) return null;

  const startCell = worldToCell(start, grid);
  const targetCell = worldToCell(destination, grid);
  if (!isCellWalkable(startCell, occupied, grid) || !isCellWalkable(targetCell, occupied, grid)) return null;
  const startKey = cellKey(startCell);
  const targetKey = cellKey(targetCell);
  if (startKey === targetKey) return segmentIsWalkable(start, destination, occupied, radius)
    ? [destination]
    : null;

  const open = new Map<string, PathNode>();
  const all = new Map<string, PathNode>();
  const closed = new Set<string>();
  const first: PathNode = { cell: startCell, g: 0, f: heuristic(startCell, targetCell) };
  open.set(startKey, first);
  all.set(startKey, first);

  while (open.size > 0) {
    let currentKey: string | undefined;
    let current: PathNode | undefined;
    for (const [key, node] of open) {
      if (!current || node.f < current.f) {
        current = node;
        currentKey = key;
      }
    }
    if (!current || !currentKey) break;
    if (currentKey === targetKey) {
      const points = reconstruct(currentKey, all).map((node) => cellCenter(node.cell, grid));
      points[0] = start;
      points[points.length - 1] = destination;
      return simplify(points, occupied, radius).slice(1);
    }
    open.delete(currentKey);
    closed.add(currentKey);

    for (const offset of NEIGHBORS) {
      const nextCell = { x: current.cell.x + offset.x, y: current.cell.y + offset.y };
      const key = cellKey(nextCell);
      if (closed.has(key) || !isCellWalkable(nextCell, occupied, grid)) continue;
      const nextCenter = cellCenter(nextCell, grid);
      if (!isWorldWalkable(nextCenter, occupied, radius, grid)) continue;
      if (offset.x !== 0 && offset.y !== 0) {
        const sideX = { x: current.cell.x + offset.x, y: current.cell.y };
        const sideY = { x: current.cell.x, y: current.cell.y + offset.y };
        if (
          !isCellWalkable(sideX, occupied, grid) ||
          !isCellWalkable(sideY, occupied, grid) ||
          !isWorldWalkable(cellCenter(sideX, grid), occupied, radius, grid) ||
          !isWorldWalkable(cellCenter(sideY, grid), occupied, radius, grid)
        ) continue;
      }
      const step = offset.x !== 0 && offset.y !== 0 ? Math.SQRT2 : 1;
      const nextG = current.g + step;
      const previous = all.get(key);
      if (previous && previous.g <= nextG) continue;
      const record: PathNode = {
        cell: nextCell,
        g: nextG,
        f: nextG + heuristic(nextCell, targetCell),
        parent: currentKey,
      };
      open.set(key, record);
      all.set(key, record);
    }
  }
  return null;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function depthOf(point: Vec2): number {
  return point.x + point.y;
}

export function moveToward(current: number, target: number, maximumDelta: number): number {
  if (Math.abs(target - current) <= maximumDelta) return target;
  return current + Math.sign(target - current) * maximumDelta;
}

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
  return { x: view.offsetX + source.x * view.scale, y: view.offsetY + source.y * view.scale };
}

export function canvasToWorld(point: Vec2, view: ViewTransform): Vec2 {
  return sourceToWorld({
    x: (point.x - view.offsetX) / view.scale,
    y: (point.y - view.offsetY) / view.scale,
  });
}

function heuristic(a: NavCell, b: NavCell): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function reconstruct(targetKey: string, nodes: ReadonlyMap<string, PathNode>): PathNode[] {
  const path: PathNode[] = [];
  let key: string | undefined = targetKey;
  while (key) {
    const node: PathNode | undefined = nodes.get(key);
    if (!node) break;
    path.push(node);
    key = node.parent;
  }
  return path.reverse();
}

function simplify(points: readonly Vec2[], occupied: ReadonlySet<string>, radius: number): Vec2[] {
  if (points.length <= 2) return [...points];
  const result: Vec2[] = [points[0] ?? { x: 0, y: 0 }];
  let anchorIndex = 0;
  while (anchorIndex < points.length - 1) {
    let furthest = anchorIndex + 1;
    for (let candidate = anchorIndex + 2; candidate < points.length; candidate += 1) {
      const from = points[anchorIndex];
      const to = points[candidate];
      if (!from || !to || !segmentIsWalkable(from, to, occupied, radius)) break;
      furthest = candidate;
    }
    const next = points[furthest];
    if (!next) break;
    result.push(next);
    anchorIndex = furthest;
  }
  return result;
}

function segmentIsWalkable(from: Vec2, to: Vec2, occupied: ReadonlySet<string>, radius: number): boolean {
  const length = distance(from, to);
  const steps = Math.max(1, Math.ceil(length / 0.06));
  for (let index = 1; index <= steps; index += 1) {
    const ratio = index / steps;
    if (!isWorldWalkable({
      x: from.x + (to.x - from.x) * ratio,
      y: from.y + (to.y - from.y) * ratio,
    }, occupied, radius)) return false;
  }
  return true;
}
