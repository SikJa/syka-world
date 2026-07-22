import {
  NPC_SCHEMA,
  type CafeNpcActivity,
  type CafeNpcAnchorId,
  type CafeNpcId,
  type CafeNpcRoutine,
  type GameStateV1,
  type GridPoint,
  type NpcStateV1,
} from "./contracts";
import { samePoint } from "./map";
import { findPath } from "./pathfinding";

export const CAFE_NPC_IDS = ["alma-rios", "beni-menta", "iara-luz", "milo-niebla", "noa-junco"] as const;

export const CAFE_NPC_ANCHOR_IDS = [
  "entry",
  "counter",
  "table-seat-1",
  "table-seat-2",
  "library-chair",
  "fireplace",
  "coffee-machine",
  "bartender-station",
] as const satisfies readonly CafeNpcAnchorId[];

const NPC_TILES_PER_MINUTE = 2;

interface CafeNpcSeed {
  readonly id: CafeNpcId;
  readonly name: string;
  readonly role: string;
  readonly visualKey: string;
}

const CAFE_NPC_SEEDS: readonly CafeNpcSeed[] = [
  { id: "alma-rios", name: "Alma Ríos", role: "Barista anfitriona", visualKey: "alma-rios" },
  { id: "beni-menta", name: "Beni Menta", role: "Pastelero", visualKey: "beni-menta" },
  { id: "iara-luz", name: "Iara Luz", role: "Ilustradora habitual", visualKey: "iara-luz" },
  { id: "milo-niebla", name: "Milo Niebla", role: "Lector y archivista", visualKey: "milo-niebla" },
  { id: "noa-junco", name: "Noa Junco", role: "Repartidor de plantas", visualKey: "noa-junco" },
] as const;

export const createCafeNpcs = (totalMinute = 0): readonly NpcStateV1[] =>
  CAFE_NPC_SEEDS.map((seed) => ({
    schema: NPC_SCHEMA,
    ...seed,
    activity: "idle",
    routine: "offstage",
    location: { kind: "offstage" },
    lastRoutineTotalMinute: totalMinute,
  }));

interface CafeRoutinePose {
  readonly activity: CafeNpcActivity;
  readonly routine: Exclude<CafeNpcRoutine, "offstage">;
  readonly anchorId: CafeNpcAnchorId;
}

const inWindow = (minuteOfDay: number, start: number, end: number): boolean =>
  minuteOfDay >= start && minuteOfDay < end;

/** Pure clock-driven routine. Its active windows intentionally cap cafe life at three NPCs. */
const routinePose = (id: CafeNpcId, minuteOfDay: number): CafeRoutinePose | undefined => {
  switch (id) {
    case "alma-rios": {
      if (!inWindow(minuteOfDay, 420, 1_260)) return undefined;
      const brewing = Math.floor(minuteOfDay / 30) % 2 === 1;
      return {
        activity: "working",
        routine: brewing ? "brewing" : "serving",
        anchorId: brewing ? "coffee-machine" : "bartender-station",
      };
    }
    case "beni-menta":
      return inWindow(minuteOfDay, 420, 720)
        ? { activity: "working", routine: "baking", anchorId: "counter" }
        : undefined;
    case "iara-luz":
      if (!inWindow(minuteOfDay, 720, 1_020)) return undefined;
      return {
        activity: "working",
        routine: "illustrating",
        anchorId: Math.floor(minuteOfDay / 60) % 2 === 0 ? "table-seat-1" : "table-seat-2",
      };
    case "milo-niebla":
      if (!inWindow(minuteOfDay, 960, 1_260)) return undefined;
      return {
        activity: "idle",
        routine: "reading",
        anchorId: Math.floor(minuteOfDay / 60) % 2 === 0 ? "library-chair" : "fireplace",
      };
    case "noa-junco":
      if (inWindow(minuteOfDay, 600, 780)) {
        return { activity: "walking", routine: "delivering", anchorId: "entry" };
      }
      return inWindow(minuteOfDay, 1_080, 1_200)
        ? { activity: "social", routine: "delivering", anchorId: "counter" }
        : undefined;
  }
};

const completedCafe = (state: GameStateV1): GameStateV1["buildings"][number] | undefined => {
  const completed = state.buildings.filter((building) => building.kind === "cafe" && building.status === "complete");
  const cafe = completed.find((building) => building.id === "cafe-main") ?? completed[0];
  return cafe && state.interiors.some((interior) => interior.buildingId === cafe.id) ? cafe : undefined;
};

const npcPhase: Readonly<Record<CafeNpcId, number>> = {
  "alma-rios": 0,
  "beni-menta": 2,
  "iara-luz": 4,
  "milo-niebla": 6,
  "noa-junco": 8,
};

interface EdgeRoute {
  readonly edge: GridPoint;
  readonly path: readonly GridPoint[];
}

/** Picks a nearby connected road border deterministically for each identity. */
const routeFromEdge = (
  state: GameStateV1,
  npcId: CafeNpcId,
  cafeAccess: GridPoint,
): EdgeRoute | undefined => {
  const { width, height } = state.map.size;
  const candidates = state.map.tiles
    .filter((tile) =>
      tile.terrain === "road" &&
      tile.buildingId === undefined &&
      (tile.position.x === 0 || tile.position.y === 0 || tile.position.x === width - 1 || tile.position.y === height - 1),
    )
    .flatMap((tile): readonly EdgeRoute[] => {
      const route = findPath(state.map, tile.position, cafeAccess);
      return route.ok ? [{ edge: tile.position, path: route.value }] : [];
    })
    .sort((left, right) =>
      left.path.length - right.path.length ||
      left.edge.y - right.edge.y ||
      left.edge.x - right.edge.x,
    );
  if (candidates.length === 0) return undefined;
  const poolSize = Math.min(10, candidates.length);
  return candidates[npcPhase[npcId] % poolSize];
};

const transit = (
  npc: NpcStateV1,
  cafeBuildingId: string,
  path: readonly GridPoint[],
  direction: "arriving" | "departing",
  totalMinute: number,
  routine: CafeNpcRoutine,
): NpcStateV1 => ({
  ...npc,
  activity: "walking",
  routine,
  location: {
    kind: "transit",
    tile: path[0]!,
    destination: path[path.length - 1]!,
    path,
    cafeBuildingId,
    direction,
  },
  lastRoutineTotalMinute: totalMinute,
});

const inside = (
  npc: NpcStateV1,
  cafeBuildingId: string,
  pose: CafeRoutinePose,
  totalMinute: number,
): NpcStateV1 => ({
  ...npc,
  activity: pose.activity,
  routine: pose.routine,
  location: { kind: "interior", buildingId: cafeBuildingId, anchorId: pose.anchorId },
  lastRoutineTotalMinute: totalMinute,
});

const offstage = (npc: NpcStateV1, totalMinute: number): NpcStateV1 => ({
  ...npc,
  activity: "idle",
  routine: "offstage",
  location: { kind: "offstage" },
  lastRoutineTotalMinute: totalMinute,
});

const startArrival = (
  state: GameStateV1,
  npc: NpcStateV1,
  cafe: GameStateV1["buildings"][number],
  pose: CafeRoutinePose,
): NpcStateV1 => {
  const route = routeFromEdge(state, npc.id, cafe.accessTile);
  if (!route) return offstage(npc, state.clock.totalMinutes);
  return route.path.length <= 1
    ? inside(npc, cafe.id, pose, state.clock.totalMinutes)
    : transit(npc, cafe.id, route.path, "arriving", state.clock.totalMinutes, pose.routine);
};

const startDeparture = (
  state: GameStateV1,
  npc: NpcStateV1,
  cafe: GameStateV1["buildings"][number],
): NpcStateV1 => {
  const route = routeFromEdge(state, npc.id, cafe.accessTile);
  if (!route) return offstage(npc, state.clock.totalMinutes);
  const path = [...route.path].reverse();
  return path.length <= 1
    ? offstage(npc, state.clock.totalMinutes)
    : transit(npc, cafe.id, path, "departing", state.clock.totalMinutes, "offstage");
};

const rerouteTransit = (
  state: GameStateV1,
  npc: NpcStateV1,
  cafe: GameStateV1["buildings"][number],
  direction: "arriving" | "departing",
  pose: CafeRoutinePose | undefined,
): NpcStateV1 => {
  if (npc.location.kind !== "transit") return npc;
  const edgeRoute = routeFromEdge(state, npc.id, cafe.accessTile);
  if (!edgeRoute) return offstage(npc, state.clock.totalMinutes);
  const destination = direction === "arriving" ? cafe.accessTile : edgeRoute.edge;
  const route = findPath(state.map, npc.location.tile, destination);
  if (!route.ok) return offstage(npc, state.clock.totalMinutes);
  if (route.value.length <= 1) {
    return direction === "arriving" && pose
      ? inside(npc, cafe.id, pose, state.clock.totalMinutes)
      : offstage(npc, state.clock.totalMinutes);
  }
  return transit(
    npc,
    cafe.id,
    route.value,
    direction,
    state.clock.totalMinutes,
    direction === "arriving" && pose ? pose.routine : "offstage",
  );
};

const advanceTransit = (
  state: GameStateV1,
  npc: NpcStateV1,
  pose: CafeRoutinePose | undefined,
): NpcStateV1 => {
  if (npc.location.kind !== "transit") return npc;
  const elapsed = Math.max(0, state.clock.totalMinutes - npc.lastRoutineTotalMinute);
  if (elapsed === 0) return npc;
  const steps = Math.min(npc.location.path.length - 1, elapsed * NPC_TILES_PER_MINUTE);
  const path = npc.location.path.slice(steps);
  if (path.length <= 1) {
    return npc.location.direction === "arriving" && pose
      ? inside(npc, npc.location.cafeBuildingId, pose, state.clock.totalMinutes)
      : offstage(npc, state.clock.totalMinutes);
  }
  return transit(
    npc,
    npc.location.cafeBuildingId,
    path,
    npc.location.direction,
    state.clock.totalMinutes,
    npc.location.direction === "arriving" && pose ? pose.routine : "offstage",
  );
};

const sameLocation = (left: NpcStateV1["location"], right: NpcStateV1["location"]): boolean => {
  if (left.kind !== right.kind) return false;
  if (left.kind === "offstage") return true;
  if (left.kind === "interior" && right.kind === "interior") {
    return left.buildingId === right.buildingId && left.anchorId === right.anchorId;
  }
  if (left.kind !== "transit" || right.kind !== "transit") return false;
  return left.cafeBuildingId === right.cafeBuildingId &&
    left.direction === right.direction &&
    samePoint(left.tile, right.tile) &&
    samePoint(left.destination, right.destination) &&
    left.path.length === right.path.length &&
    left.path.every((point, index) => samePoint(point, right.path[index]!));
};

/**
 * Reconciles five local NPCs from world time. Shifts visibly enter from and
 * leave through connected map-border roads; there is no bridge or economy input.
 */
export const advanceNpcRoutines = (state: GameStateV1): GameStateV1 => {
  const cafe = completedCafe(state);
  const npcs = state.npcs.map((npc): NpcStateV1 => {
    const pose = cafe ? routinePose(npc.id, state.clock.minuteOfDay) : undefined;
    let next: NpcStateV1;
    if (!cafe) {
      next = offstage(npc, state.clock.totalMinutes);
    } else if (npc.location.kind === "offstage") {
      next = pose ? startArrival(state, npc, cafe, pose) : npc;
    } else if (npc.location.kind === "interior") {
      next = !pose || npc.location.buildingId !== cafe.id
        ? startDeparture(state, npc, cafe)
        : inside(npc, cafe.id, pose, npc.lastRoutineTotalMinute);
    } else if (npc.location.direction === "arriving" && !pose) {
      next = rerouteTransit(state, npc, cafe, "departing", undefined);
    } else if (npc.location.direction === "departing" && pose) {
      next = rerouteTransit(state, npc, cafe, "arriving", pose);
    } else {
      next = advanceTransit(state, npc, pose);
    }
    return npc.activity === next.activity &&
      npc.routine === next.routine &&
      npc.lastRoutineTotalMinute === next.lastRoutineTotalMinute &&
      sameLocation(npc.location, next.location)
      ? npc
      : next;
  });
  return npcs.every((npc, index) => npc === state.npcs[index]) ? state : { ...state, npcs };
};

export const activeCafeNpcs = (state: GameStateV1): readonly NpcStateV1[] =>
  state.npcs.filter((npc) => npc.location.kind === "interior");

