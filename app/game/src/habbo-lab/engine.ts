export interface Tile {
  readonly x: number;
  readonly y: number;
}

export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface RoomGrid {
  readonly width: number;
  readonly height: number;
}

const NEIGHBORS: readonly Tile[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

interface NodeRecord {
  readonly tile: Tile;
  readonly g: number;
  readonly f: number;
  readonly parent?: string;
}

export function tileKey(tile: Tile): string {
  return `${tile.x}:${tile.y}`;
}

export function sameTile(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}

export function tileCenter(tile: Tile): Position {
  return { x: tile.x + 0.5, y: tile.y + 0.5 };
}

export function isTileInside(tile: Tile, room: RoomGrid): boolean {
  return tile.x >= 0 && tile.x < room.width && tile.y >= 0 && tile.y < room.height;
}

export function isTileWalkable(tile: Tile, room: RoomGrid, occupied: ReadonlySet<string>): boolean {
  return isTileInside(tile, room) && !occupied.has(tileKey(tile));
}

export function findTilePath(
  start: Tile,
  target: Tile,
  room: RoomGrid,
  occupied: ReadonlySet<string>,
): readonly Tile[] | null {
  if (!isTileWalkable(target, room, occupied)) return null;
  if (sameTile(start, target)) return [];

  const startKey = tileKey(start);
  const targetKey = tileKey(target);
  const open = new Map<string, NodeRecord>();
  const all = new Map<string, NodeRecord>();
  const closed = new Set<string>();
  const initial: NodeRecord = { tile: start, g: 0, f: heuristic(start, target) };
  open.set(startKey, initial);
  all.set(startKey, initial);

  while (open.size > 0) {
    let currentKey: string | undefined;
    let current: NodeRecord | undefined;
    for (const [key, node] of open) {
      if (!current || node.f < current.f) {
        current = node;
        currentKey = key;
      }
    }
    if (!current || !currentKey) break;
    if (currentKey === targetKey) return reconstruct(currentKey, all).slice(1);

    open.delete(currentKey);
    closed.add(currentKey);
    for (const offset of NEIGHBORS) {
      const next = { x: current.tile.x + offset.x, y: current.tile.y + offset.y };
      const key = tileKey(next);
      if (closed.has(key) || !isTileWalkable(next, room, occupied)) continue;
      if (offset.x !== 0 && offset.y !== 0) {
        const sideX = { x: current.tile.x + offset.x, y: current.tile.y };
        const sideY = { x: current.tile.x, y: current.tile.y + offset.y };
        if (!isTileWalkable(sideX, room, occupied) || !isTileWalkable(sideY, room, occupied)) continue;
      }
      const nextG = current.g + (offset.x !== 0 && offset.y !== 0 ? Math.SQRT2 : 1);
      const previous = all.get(key);
      if (previous && previous.g <= nextG) continue;
      const record: NodeRecord = {
        tile: next,
        g: nextG,
        f: nextG + heuristic(next, target),
        parent: currentKey,
      };
      open.set(key, record);
      all.set(key, record);
    }
  }
  return null;
}

export function interpolate(from: Position, to: Position, progress: number): Position {
  const clamped = Math.max(0, Math.min(1, progress));
  const eased = clamped < 0.5
    ? 2 * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
  };
}

export function depthAt(position: Position): number {
  return position.x + position.y;
}

function heuristic(a: Tile, b: Tile): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function reconstruct(targetKey: string, nodes: ReadonlyMap<string, NodeRecord>): Tile[] {
  const result: Tile[] = [];
  let key: string | undefined = targetKey;
  while (key) {
    const node: NodeRecord | undefined = nodes.get(key);
    if (!node) break;
    result.push(node.tile);
    key = node.parent;
  }
  return result.reverse();
}
