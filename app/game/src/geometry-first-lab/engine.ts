import { AUTHORED_SPATIAL_ASSETS, colliderFromSpatialAsset } from "./spatialAssets";

export interface Vec2 {
  readonly x: number;
  readonly z: number;
}

export interface MutableVec2 {
  x: number;
  z: number;
}

export interface RectCollider {
  readonly id: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface WorldBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface MoveResult {
  readonly position: Vec2;
  readonly collided: boolean;
}

export const WORLD_BOUNDS: WorldBounds = Object.freeze({
  minX: -3.72,
  maxX: 3.72,
  minZ: -3.18,
  maxZ: 3.18,
});

// The feet/body radius is intentionally smaller than the authored coat and
// bag. A separate comfort margin keeps those visual pixels from grazing solid
// furniture while the depth relief handles natural front/behind overlap.
export const ACTOR_BODY_RADIUS = 0.28;
export const ACTOR_VISUAL_CLEARANCE = 0.08;
export const ACTOR_RADIUS = ACTOR_BODY_RADIUS + ACTOR_VISUAL_CLEARANCE;

export const LAB_COLLIDERS: readonly RectCollider[] = Object.freeze([
  { id: "chair-west", minX: -2.03, maxX: -1.25, minZ: 0.30, maxZ: 1.18 },
  { id: "chair-south", minX: -0.91, maxX: -0.13, minZ: 1.58, maxZ: 2.42 },
  ...AUTHORED_SPATIAL_ASSETS.map(colliderFromSpatialAsset),
]);

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, z: a.z + b.z };
}

export function scale(vector: Vec2, amount: number): Vec2 {
  return { x: vector.x * amount, z: vector.z * amount };
}

export function normalize(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.z);
  if (length < 0.000001) return { x: 0, z: 0 };
  return { x: vector.x / length, z: vector.z / length };
}

export function expandCollider(collider: RectCollider, amount: number): RectCollider {
  return {
    id: collider.id,
    minX: collider.minX - amount,
    maxX: collider.maxX + amount,
    minZ: collider.minZ - amount,
    maxZ: collider.maxZ + amount,
  };
}

export function isWorldWalkable(
  point: Vec2,
  colliders: readonly RectCollider[] = LAB_COLLIDERS,
  radius = ACTOR_RADIUS,
  bounds: WorldBounds = WORLD_BOUNDS,
): boolean {
  if (
    point.x - radius < bounds.minX ||
    point.x + radius > bounds.maxX ||
    point.z - radius < bounds.minZ ||
    point.z + radius > bounds.maxZ
  ) return false;

  return !colliders.some((collider) => {
    const expanded = expandCollider(collider, radius);
    return point.x > expanded.minX && point.x < expanded.maxX &&
      point.z > expanded.minZ && point.z < expanded.maxZ;
  });
}

export function moveWithCollision(
  current: Vec2,
  delta: Vec2,
  colliders: readonly RectCollider[] = LAB_COLLIDERS,
  radius = ACTOR_RADIUS,
): MoveResult {
  const magnitude = Math.hypot(delta.x, delta.z);
  if (magnitude < 0.000001) return { position: { ...current }, collided: false };

  const steps = Math.max(1, Math.ceil(magnitude / 0.045));
  const increment = { x: delta.x / steps, z: delta.z / steps };
  let position: Vec2 = { ...current };
  let collided = false;

  for (let index = 0; index < steps; index += 1) {
    const full = add(position, increment);
    if (isWorldWalkable(full, colliders, radius)) {
      position = full;
      continue;
    }

    collided = true;
    const alongX = { x: position.x + increment.x, z: position.z };
    const alongZ = { x: position.x, z: position.z + increment.z };
    const canX = Math.abs(increment.x) > 0.000001 && isWorldWalkable(alongX, colliders, radius);
    const canZ = Math.abs(increment.z) > 0.000001 && isWorldWalkable(alongZ, colliders, radius);

    if (canX && canZ) {
      position = Math.abs(increment.x) >= Math.abs(increment.z) ? alongX : alongZ;
    } else if (canX) {
      position = alongX;
    } else if (canZ) {
      position = alongZ;
    }
  }

  return { position, collided };
}

export function segmentIsWalkable(
  from: Vec2,
  to: Vec2,
  colliders: readonly RectCollider[] = LAB_COLLIDERS,
  radius = ACTOR_RADIUS,
): boolean {
  const length = distance(from, to);
  const samples = Math.max(1, Math.ceil(length / 0.035));
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const point = {
      x: from.x + (to.x - from.x) * t,
      z: from.z + (to.z - from.z) * t,
    };
    if (!isWorldWalkable(point, colliders, radius)) return false;
  }
  return true;
}

interface GraphNode {
  readonly point: Vec2;
  readonly label: string;
}

export function findVisibilityPath(
  start: Vec2,
  target: Vec2,
  colliders: readonly RectCollider[] = LAB_COLLIDERS,
  radius = ACTOR_RADIUS,
): readonly Vec2[] | null {
  if (!isWorldWalkable(start, colliders, radius) || !isWorldWalkable(target, colliders, radius)) return null;
  if (segmentIsWalkable(start, target, colliders, radius)) return [{ ...target }];

  const nodes: GraphNode[] = [
    { point: { ...start }, label: "start" },
    { point: { ...target }, label: "target" },
  ];

  for (const collider of colliders) {
    const clearance = radius + 0.075;
    const expanded = expandCollider(collider, clearance);
    const corners: readonly Vec2[] = [
      { x: expanded.minX, z: expanded.minZ },
      { x: expanded.maxX, z: expanded.minZ },
      { x: expanded.maxX, z: expanded.maxZ },
      { x: expanded.minX, z: expanded.maxZ },
    ];
    corners.forEach((point, index) => {
      if (isWorldWalkable(point, colliders, radius)) {
        nodes.push({ point, label: `${collider.id}-${index}` });
      }
    });
  }

  const count = nodes.length;
  const distances = new Array<number>(count).fill(Number.POSITIVE_INFINITY);
  const parents = new Array<number>(count).fill(-1);
  const visited = new Array<boolean>(count).fill(false);
  distances[0] = 0;

  for (let iteration = 0; iteration < count; iteration += 1) {
    let current = -1;
    let best = Number.POSITIVE_INFINITY;
    for (let index = 0; index < count; index += 1) {
      const candidate = distances[index];
      if (!visited[index] && candidate !== undefined && candidate < best) {
        best = candidate;
        current = index;
      }
    }
    if (current < 0) break;
    if (current === 1) break;
    visited[current] = true;

    const from = nodes[current];
    if (!from) continue;
    for (let next = 0; next < count; next += 1) {
      if (visited[next] || next === current) continue;
      const destination = nodes[next];
      if (!destination || !segmentIsWalkable(from.point, destination.point, colliders, radius)) continue;
      const proposal = best + distance(from.point, destination.point);
      const known = distances[next];
      if (known !== undefined && proposal < known) {
        distances[next] = proposal;
        parents[next] = current;
      }
    }
  }

  const targetDistance = distances[1];
  if (targetDistance === undefined || !Number.isFinite(targetDistance)) return null;

  const reversed: Vec2[] = [];
  let cursor = 1;
  while (cursor > 0) {
    const node = nodes[cursor];
    if (!node) return null;
    reversed.push({ ...node.point });
    cursor = parents[cursor] ?? -1;
    if (cursor < 0) return null;
  }
  return reversed.reverse();
}

export function advanceAlongPath(
  current: Vec2,
  path: readonly Vec2[],
  maximumDistance: number,
): { readonly position: Vec2; readonly remaining: readonly Vec2[]; readonly arrived: boolean } {
  if (path.length === 0 || maximumDistance <= 0) {
    return { position: { ...current }, remaining: path, arrived: path.length === 0 };
  }

  let position: Vec2 = { ...current };
  let budget = maximumDistance;
  let index = 0;

  while (index < path.length && budget > 0) {
    const target = path[index];
    if (!target) break;
    const gap = distance(position, target);
    if (gap <= budget + 0.000001) {
      position = { ...target };
      budget -= gap;
      index += 1;
      continue;
    }
    const direction = normalize({ x: target.x - position.x, z: target.z - position.z });
    position = add(position, scale(direction, budget));
    budget = 0;
  }

  const remaining = path.slice(index);
  return { position, remaining, arrived: remaining.length === 0 };
}
