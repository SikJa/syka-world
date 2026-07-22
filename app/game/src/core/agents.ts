import {
  AGENT_SCHEMA,
  BRIDGE_SIGNAL_SCHEMA,
  type ActiveAgentSessionV1,
  type AgentActivity,
  type AgentId,
  type AgentLocalAction,
  type AgentRoutineBindingsV1,
  type AgentStateV1,
  type BuildingKind,
  type BridgeSignalV1,
  type GameStateV1,
  type GridPoint,
  type ProfileId,
  type Result,
} from "./contracts";
import { grantHermesCompletionReward } from "./economy";
import { getTile, pointKey, samePoint } from "./map";
import { findPath } from "./pathfinding";

export interface AgentSeed {
  readonly id: AgentId;
  readonly profileId: ProfileId;
  readonly name: string;
  readonly role: string;
  readonly position: GridPoint;
  readonly bindings: AgentRoutineBindingsV1;
}

export interface AgentObservationV1 {
  readonly profileId: ProfileId;
  readonly presence: AgentStateV1["presence"];
  readonly activity: AgentActivity;
  readonly activeSessionCount: number;
  readonly dominantSessionId?: string;
  readonly taskSummary?: string;
  readonly toolFamily?: string;
  readonly observedAt: string;
}

export const PROFILE_TO_AGENT: Readonly<Record<ProfileId, AgentId>> = {
  default: "syka",
  elen: "elen",
  astrelis: "astrelis",
  zerny: "zerny",
};

export const AGENT_IDENTITIES: Readonly<Record<ProfileId, Pick<AgentSeed, "id" | "name" | "role">>> = {
  default: { id: "syka", name: "Syka", role: "Dirección, coordinación y creatividad" },
  elen: { id: "elen", name: "Elen", role: "Marketing y comunicación" },
  astrelis: { id: "astrelis", name: "Astrelis", role: "Comercio y relaciones" },
  zerny: { id: "zerny", name: "Zerny", role: "Construcción y CRM" },
};

const AGENT_ROUTINE_MINUTES_PER_TILE = 2;
const AGENT_LOCAL_ORDER_MINUTES_PER_TILE = 1;
const AGENT_MOVEMENT_PHASE: Readonly<Record<AgentId, number>> = {
  syka: 0,
  elen: 1,
  astrelis: 2,
  zerny: 0,
};

export const createAgent = (seed: AgentSeed): AgentStateV1 => ({
  schema: AGENT_SCHEMA,
  id: seed.id,
  profileId: seed.profileId,
  name: seed.name,
  role: seed.role,
  position: seed.position,
  location: { kind: "exterior", tile: seed.position },
  destination: seed.position,
  destinationBuildingId: seed.bindings.homeBuildingId,
  path: [seed.position],
  activity: "idle",
  presence: "unknown",
  bindings: seed.bindings,
  activeSessions: [],
});

export const ALPHA_PROFILE_IDS = ["default", "elen", "astrelis", "zerny"] as const satisfies readonly string[];

export const createAlphaAgents = (
  bindings: Readonly<Record<string, AgentRoutineBindingsV1>>,
  positions: Readonly<Record<string, GridPoint>>,
): readonly AgentStateV1[] =>
  ALPHA_PROFILE_IDS.map((profileId) => {
    const identity = AGENT_IDENTITIES[profileId];
    if (!identity) throw new Error(`Missing agent identity for legacy profile ${profileId}.`);
    const position = positions[profileId];
    const binding = bindings[profileId];
    if (!position || !binding) {
      throw new Error(`Missing binding or position for legacy profile ${profileId}.`);
    }
    return createAgent({ profileId, ...identity, position, bindings: binding });
  });

const normalizeMinute = (minuteOfDay: number): number => ((Math.floor(minuteOfDay) % 1_440) + 1_440) % 1_440;

/**
 * `buildings` is an append-only persisted list. Its insertion order therefore
 * means "first completed instance that entered this town" and survives saves.
 * A later generated id must never displace an authored `cafe-main`.
 */
export const resolveCompletedBuildingId = (state: GameStateV1, kind: BuildingKind): string | undefined =>
  state.buildings.find((building) => building.kind === kind && building.status === "complete")?.id;

/** home -> cafe -> work -> cafe -> work -> community -> home */
export const selectRoutineBuilding = (agent: AgentStateV1, minuteOfDay: number): string => {
  const minute = normalizeMinute(minuteOfDay);
  if (minute < 420 || minute >= 1_320) return agent.bindings.homeBuildingId;
  if (minute < 540) return agent.bindings.cafeBuildingId;
  if (minute < 720) return agent.bindings.workplaceBuildingId;
  if (minute < 840) return agent.bindings.cafeBuildingId;
  if (minute < 1_020) return agent.bindings.workplaceBuildingId;
  if (minute < 1_200) return agent.bindings.communityBuildingId;
  return agent.bindings.homeBuildingId;
};

const desiredBuildingId = (agent: AgentStateV1, minuteOfDay: number): string => {
  if (agent.presence === "offline" || agent.activity === "offline") return agent.bindings.homeBuildingId;
  if (agent.activeSessions.length > 0 || ["done", "interrupted", "error"].includes(agent.activity)) {
    return agent.bindings.workplaceBuildingId;
  }
  return selectRoutineBuilding(agent, minuteOfDay);
};

const roadNeighbours = (point: GridPoint): readonly GridPoint[] => [
  { x: point.x, y: point.y - 1 },
  { x: point.x + 1, y: point.y },
  { x: point.x, y: point.y + 1 },
  { x: point.x - 1, y: point.y },
];

const reachableRoadTiles = (state: GameStateV1, start: GridPoint): readonly GridPoint[] => {
  const startTile = getTile(state.map, start);
  if (!startTile || startTile.terrain !== "road" || startTile.buildingId) return [];
  const queue: GridPoint[] = [start];
  const visited = new Set([pointKey(start)]);
  const result: GridPoint[] = [];
  while (queue.length > 0 && visited.size <= 2_000) {
    const current = queue.shift();
    if (!current) break;
    result.push(current);
    for (const candidate of roadNeighbours(current)) {
      const tile = getTile(state.map, candidate);
      if (!tile || tile.terrain !== "road" || tile.buildingId || visited.has(pointKey(candidate))) continue;
      visited.add(pointKey(candidate));
      queue.push(candidate);
    }
  }
  return result.sort((left, right) => left.y - right.y || left.x - right.x);
};

const ambientAgentSeed: Readonly<Record<AgentId, number>> = {
  syka: 3,
  elen: 11,
  astrelis: 19,
  zerny: 29,
};

const ambientDestination = (state: GameStateV1, agent: AgentStateV1): GridPoint | undefined => {
  const candidates = reachableRoadTiles(state, agent.position).filter((candidate) => !samePoint(candidate, agent.position));
  if (candidates.length === 0) return undefined;
  const phase = Math.floor(state.clock.totalMinutes / 30);
  const index = (ambientAgentSeed[agent.id] + phase + agent.position.x * 3 + agent.position.y * 5) % candidates.length;
  return candidates[index];
};

const exteriorizeAgent = (state: GameStateV1, agent: AgentStateV1): AgentStateV1 => {
  if (agent.location.kind !== "interior") return agent;
  const interiorBuildingId = agent.location.buildingId;
  const building = state.buildings.find((candidate) => candidate.id === interiorBuildingId);
  const position = building?.accessTile ?? agent.position;
  return { ...agent, position, location: { kind: "exterior", tile: position }, destination: position, path: [position] };
};

const planRoute = (state: GameStateV1, agent: AgentStateV1, destinationBuildingId: string): AgentStateV1 => {
  const exterior = exteriorizeAgent(state, agent);
  const building = state.buildings.find((candidate) => candidate.id === destinationBuildingId && candidate.status === "complete");
  const destination = building?.accessTile ?? ambientDestination(state, exterior);
  if (!destination) {
    return {
      ...exterior,
      destinationBuildingId,
      destination: exterior.position,
      path: [exterior.position],
      location: { kind: "exterior", tile: exterior.position },
    };
  }
  const route = findPath(state.map, exterior.position, destination);
  return route.ok
    ? {
        ...exterior,
        destinationBuildingId,
        destination,
        path: route.value,
        location: route.value.length > 1
          ? { kind: "transit", tile: exterior.position, destinationBuildingId }
          : { kind: "exterior", tile: exterior.position },
      }
    : {
        ...exterior,
        destinationBuildingId,
        destination: exterior.position,
        path: [exterior.position],
        location: { kind: "exterior", tile: exterior.position },
      };
};

export const reconcileAgentBindings = (state: GameStateV1): GameStateV1 => {
  const cafeBuildingId = resolveCompletedBuildingId(state, "cafe") ?? "";
  const communityBuildingId = resolveCompletedBuildingId(state, "community-hall") ?? "";
  const firstHome = resolveCompletedBuildingId(state, "home") ?? "";
  const workplaceByAgent: Readonly<Record<AgentId, string>> = {
    syka: communityBuildingId || firstHome,
    elen: resolveCompletedBuildingId(state, "marketing-office") ?? "",
    astrelis: resolveCompletedBuildingId(state, "commercial-office") ?? "",
    zerny: resolveCompletedBuildingId(state, "crm-workshop") ?? "",
  };
  const agents = state.agents.map((agent): AgentStateV1 => {
    const previousTarget = desiredBuildingId(agent, state.clock.minuteOfDay);
    const explicitHome = state.buildings.some(
      (building) => building.id === agent.bindings.homeBuildingId && building.kind === "home" && building.status === "complete",
    )
      ? agent.bindings.homeBuildingId
      : firstHome;
    const bindings: AgentRoutineBindingsV1 = {
      homeBuildingId: explicitHome,
      cafeBuildingId,
      workplaceBuildingId: workplaceByAgent[agent.id],
      communityBuildingId,
    };
    const target = desiredBuildingId({ ...agent, bindings }, state.clock.minuteOfDay);
    const rebound = { ...agent, bindings };
    if (agent.localOrder || target === previousTarget || agent.destinationBuildingId !== previousTarget) return rebound;
    return planRoute(state, rebound, target);
  });
  return { ...state, agents };
};

const moveAlongPath = (agent: AgentStateV1, steps: number): AgentStateV1 => {
  if (steps <= 0 || agent.path.length <= 1) return agent;
  const index = Math.min(steps, agent.path.length - 1);
  const position = agent.path[index];
  if (!position) return agent;
  const remaining = agent.path.slice(index);
  const path = remaining.length > 0 ? remaining : [position];
  return {
    ...agent,
    position,
    path,
    location: path.length > 1
      ? { kind: "transit", tile: position, destinationBuildingId: agent.destinationBuildingId }
      : { kind: "exterior", tile: position },
  };
};

const movementStepsBetween = (agent: AgentStateV1, fromTotalMinute: number, toTotalMinute: number): number => {
  const phase = AGENT_MOVEMENT_PHASE[agent.id];
  const minutesPerTile = agent.localOrder?.phase === "traveling"
    ? AGENT_LOCAL_ORDER_MINUTES_PER_TILE
    : AGENT_ROUTINE_MINUTES_PER_TILE;
  return Math.max(
    0,
    Math.floor((toTotalMinute + phase) / minutesPerTile) -
      Math.floor((fromTotalMinute + phase) / minutesPerTile),
  );
};

export const isAgentTraveling = (agent: AgentStateV1): boolean =>
  agent.location.kind === "transit" || agent.path.length > 1 || !samePoint(agent.position, agent.destination);

export const currentAgentBuildingId = (state: GameStateV1, agent: AgentStateV1): string | undefined => {
  if (agent.location.kind === "interior") return agent.location.buildingId;
  if (isAgentTraveling(agent)) return undefined;
  const preferred = state.buildings.find(
    (building) => building.id === agent.destinationBuildingId && building.status === "complete",
  );
  if (preferred && samePoint(preferred.accessTile, agent.position)) return preferred.id;
  return state.buildings.find(
    (building) => building.status === "complete" && samePoint(building.accessTile, agent.position),
  )?.id;
};

export const advanceWorldClock = (state: GameStateV1, minutes: number): GameStateV1 => {
  if (!Number.isSafeInteger(minutes) || minutes < 0) throw new Error("Clock delta must be a non-negative integer.");
  const totalMinutes = state.clock.totalMinutes + minutes;
  const dayDelta = Math.floor((state.clock.minuteOfDay + minutes) / 1_440);
  return {
    ...state,
    clock: {
      ...state.clock,
      day: state.clock.day + dayDelta,
      minuteOfDay: normalizeMinute(state.clock.minuteOfDay + minutes),
      totalMinutes,
    },
  };
};

export interface AgentLocalOrderError {
  readonly code: "UNKNOWN_AGENT" | "CAFE_UNAVAILABLE" | "CAFE_UNREACHABLE" | "AGENT_NOT_INTERIOR" | "ANCHOR_OCCUPIED";
  readonly message: string;
}

const actionAnchors: Readonly<Record<AgentLocalAction, readonly string[]>> = {
  sit: ["table-seat-1", "table-seat-2", "table-seat-3"],
  read: ["library-chair", "table-seat-1"],
  "serve-coffee": ["counter", "coffee-machine"],
  "warm-fireplace": ["fireplace"],
};

const availableAnchor = (
  state: GameStateV1,
  agent: AgentStateV1,
  buildingId: string,
  action: AgentLocalAction,
  preferredAnchorId?: string,
): string | undefined => {
  const occupied = new Set(
    [
      ...state.agents.flatMap((candidate) =>
        candidate.id !== agent.id && candidate.location.kind === "interior" && candidate.location.buildingId === buildingId
          ? [candidate.location.anchorId]
          : [],
      ),
      ...state.npcs.flatMap((npc) =>
        npc.location.kind === "interior" && npc.location.buildingId === buildingId ? [npc.location.anchorId] : [],
      ),
    ],
  );
  if (preferredAnchorId !== undefined) {
    return actionAnchors[action].includes(preferredAnchorId) && !occupied.has(preferredAnchorId)
      ? preferredAnchorId
      : undefined;
  }
  return actionAnchors[action].find((anchor) => !occupied.has(anchor));
};

const startInteriorAction = (
  state: GameStateV1,
  agent: AgentStateV1,
  action: AgentLocalAction,
  preferredAnchorId?: string,
): AgentStateV1 | undefined => {
  if (agent.location.kind !== "interior") return undefined;
  const anchorId = availableAnchor(state, agent, agent.location.buildingId, action, preferredAnchorId);
  if (!anchorId) return undefined;
  return {
    ...agent,
    location: { ...agent.location, anchorId, action },
    localOrder: agent.localOrder
      ? {
          ...agent.localOrder,
          action,
          phase: "acting",
          phaseUntilTotalMinute: state.clock.totalMinutes + 15,
        }
      : {
          kind: "go-to-cafe",
          targetBuildingId: agent.location.buildingId,
          action,
          phase: "acting",
          issuedAtTotalMinute: state.clock.totalMinutes,
          phaseUntilTotalMinute: state.clock.totalMinutes + 15,
        },
  };
};

/**
 * Hands a locally controlled profile back to the deterministic routine planner.
 * The route always starts from the actor's persisted real position. Interior
 * actors remain in place when their routine still targets the current building;
 * otherwise they leave through that building's access tile before replanning.
 */
export const resumeAgentAutonomyFromCurrentPosition = (
  state: GameStateV1,
  profileId: ProfileId,
): Result<GameStateV1, AgentLocalOrderError> => {
  const agent = state.agents.find((candidate) => candidate.profileId === profileId);
  if (!agent) return { ok: false, error: { code: "UNKNOWN_AGENT", message: `Unknown agent ${profileId}.` } };
  const autonomous = clearLocalOrder(agent);
  const target = desiredBuildingId(autonomous, state.clock.minuteOfDay);
  const resumed =
    autonomous.location.kind === "interior" && autonomous.location.buildingId === target
      ? {
          ...autonomous,
          destinationBuildingId: target,
          destination: autonomous.position,
          path: [autonomous.position],
        }
      : planRoute(state, autonomous, target);
  return {
    ok: true,
    value: {
      ...state,
      agents: state.agents.map((candidate) => candidate.profileId === profileId ? resumed : candidate),
    },
  };
};

export const issueGoToCafeOrder = (
  state: GameStateV1,
  profileId: ProfileId,
  action: AgentLocalAction = "serve-coffee",
): Result<GameStateV1, AgentLocalOrderError> => {
  const agent = state.agents.find((candidate) => candidate.profileId === profileId);
  if (!agent) return { ok: false, error: { code: "UNKNOWN_AGENT", message: `Unknown agent ${profileId}.` } };
  const targetBuildingId = resolveCompletedBuildingId(state, "cafe");
  if (!targetBuildingId) {
    return { ok: false, error: { code: "CAFE_UNAVAILABLE", message: "A completed cafe is required for this local order." } };
  }
  const cafe = state.buildings.find((building) => building.id === targetBuildingId);
  if (!cafe) {
    return { ok: false, error: { code: "CAFE_UNAVAILABLE", message: "A completed cafe is required for this local order." } };
  }
  const withoutOrder = (() => {
    const { localOrder: _oldOrder, ...rest } = agent;
    return rest as AgentStateV1;
  })();
  const routed = planRoute(state, withoutOrder, targetBuildingId);
  if (!samePoint(routed.destination, cafe.accessTile)) {
    return {
      ok: false,
      error: { code: "CAFE_UNREACHABLE", message: "No walkable road connects this agent to the cafe." },
    };
  }
  const ordered: AgentStateV1 = {
    ...routed,
    localOrder: {
      kind: "go-to-cafe",
      targetBuildingId,
      action,
      phase: "traveling",
      issuedAtTotalMinute: state.clock.totalMinutes,
    },
  };
  return {
    ok: true,
    value: { ...state, agents: state.agents.map((candidate) => candidate.id === agent.id ? ordered : candidate) },
  };
};

export const setAgentInteriorAction = (
  state: GameStateV1,
  profileId: ProfileId,
  action: AgentLocalAction,
  preferredAnchorId?: string,
): Result<GameStateV1, AgentLocalOrderError> => {
  const agent = state.agents.find((candidate) => candidate.profileId === profileId);
  if (!agent) return { ok: false, error: { code: "UNKNOWN_AGENT", message: `Unknown agent ${profileId}.` } };
  if (agent.location.kind !== "interior") {
    return { ok: false, error: { code: "AGENT_NOT_INTERIOR", message: "The agent must be inside before choosing an action." } };
  }
  const acting = startInteriorAction(state, agent, action, preferredAnchorId);
  if (!acting) {
    return { ok: false, error: { code: "ANCHOR_OCCUPIED", message: "No compatible interior anchor is available." } };
  }
  return {
    ok: true,
    value: { ...state, agents: state.agents.map((candidate) => candidate.id === agent.id ? acting : candidate) },
  };
};

export const returnAgentToCity = (
  state: GameStateV1,
  profileId: ProfileId,
): Result<GameStateV1, AgentLocalOrderError> => {
  const agent = state.agents.find((candidate) => candidate.profileId === profileId);
  if (!agent) return { ok: false, error: { code: "UNKNOWN_AGENT", message: `Unknown agent ${profileId}.` } };
  if (agent.location.kind !== "interior") {
    return { ok: false, error: { code: "AGENT_NOT_INTERIOR", message: "The agent is already outside." } };
  }
  const interiorBuildingId = agent.location.buildingId;
  const building = state.buildings.find((candidate) => candidate.id === interiorBuildingId);
  const position = building?.accessTile ?? agent.position;
  const { localOrder: _order, ...rest } = agent;
  const outside: AgentStateV1 = {
    ...rest,
    position,
    location: { kind: "exterior", tile: position },
    destination: position,
    destinationBuildingId: "",
    path: [position],
  };
  return {
    ok: true,
    value: { ...state, agents: state.agents.map((candidate) => candidate.id === agent.id ? outside : candidate) },
  };
};

const advanceLocalOrder = (
  state: GameStateV1,
  agent: AgentStateV1,
  fromTotalMinute: number,
): AgentStateV1 => {
  const order = agent.localOrder;
  if (!order) return agent;
  if (order.phase === "traveling") {
    const moved = moveAlongPath(agent, movementStepsBetween(agent, fromTotalMinute, state.clock.totalMinutes));
    if (!samePoint(moved.position, moved.destination) || moved.path.length > 1) return moved;
    return {
      ...moved,
      location: { kind: "interior", buildingId: order.targetBuildingId, anchorId: "entry" },
      localOrder: {
        ...order,
        phase: "entering",
        phaseUntilTotalMinute: state.clock.totalMinutes + 1,
      },
    };
  }
  if (order.phase === "entering" && state.clock.totalMinutes >= (order.phaseUntilTotalMinute ?? 0)) {
    return startInteriorAction(state, agent, order.action) ?? {
      ...agent,
      localOrder: { ...order, phaseUntilTotalMinute: state.clock.totalMinutes + 1 },
    };
  }
  if (order.phase === "acting" && state.clock.totalMinutes >= (order.phaseUntilTotalMinute ?? Number.MAX_SAFE_INTEGER)) {
    const { action: _finishedAction, ...location } = agent.location.kind === "interior" ? agent.location : {
      kind: "interior" as const,
      buildingId: order.targetBuildingId,
      anchorId: "entry",
    };
    const { phaseUntilTotalMinute: _until, ...rest } = order;
    return { ...agent, location, localOrder: { ...rest, phase: "staying" } };
  }
  return agent;
};

const routineCafeAnchors: readonly string[] = [
  "table-seat-1",
  "table-seat-2",
  "table-seat-3",
  "library-chair",
  "fireplace",
];

const enterRoutineDestination = (
  state: GameStateV1,
  agent: AgentStateV1,
  destinationBuildingId: string,
): AgentStateV1 => {
  if (agent.location.kind === "interior" || isAgentTraveling(agent) || !destinationBuildingId) return agent;
  const building = state.buildings.find(
    (candidate) => candidate.id === destinationBuildingId && candidate.status === "complete",
  );
  if (!building || !samePoint(agent.position, building.accessTile)) return agent;
  if (building.kind !== "cafe") {
    return { ...agent, location: { kind: "interior", buildingId: building.id, anchorId: "inside" } };
  }
  const occupied = new Set([
    ...state.agents.flatMap((candidate) =>
      candidate.id !== agent.id && candidate.location.kind === "interior" && candidate.location.buildingId === building.id
        ? [candidate.location.anchorId]
        : [],
    ),
    ...state.npcs.flatMap((npc) =>
      npc.location.kind === "interior" && npc.location.buildingId === building.id ? [npc.location.anchorId] : [],
    ),
  ]);
  const startIndex = AGENT_MOVEMENT_PHASE[agent.id] % routineCafeAnchors.length;
  const anchorId = [...routineCafeAnchors.slice(startIndex), ...routineCafeAnchors.slice(0, startIndex)]
    .find((candidate) => !occupied.has(candidate));
  return anchorId
    ? { ...agent, location: { kind: "interior", buildingId: building.id, anchorId } }
    : agent;
};

export const advanceAgentRoutines = (state: GameStateV1, minutes: number): GameStateV1 => {
  const clocked = advanceWorldClock(state, minutes);
  const agents: AgentStateV1[] = [];
  for (let index = 0; index < clocked.agents.length; index += 1) {
    const original = clocked.agents[index];
    if (!original) continue;
    // Earlier agents in stable identity order reserve anchors before later
    // agents transition during the same minute.
    const contextualState: GameStateV1 = {
      ...clocked,
      agents: [...agents, ...clocked.agents.slice(index)],
    };
    if (original.localOrder) {
      agents.push(advanceLocalOrder(contextualState, original, state.clock.totalMinutes));
      continue;
    }
    let agent = original;
    const arrivedAtWorkplace =
      currentAgentBuildingId(contextualState, agent) === agent.bindings.workplaceBuildingId;
    if (
      agent.stateUntilTotalMinute !== undefined &&
      clocked.clock.totalMinutes >= agent.stateUntilTotalMinute &&
      agent.activeSessions.length === 0 &&
      arrivedAtWorkplace
    ) {
      const { stateUntilTotalMinute: _settled, taskSummary: _hidden, ...rest } = agent;
      agent = { ...rest, activity: agent.presence === "offline" ? "offline" : "idle" };
    }
    // A persisted free-walk tile came from explicit local control. Idle
    // routines keep that authored interior position until a local doorway
    // transition (or a real Hermes activity) supplies a new intention.
    if (agent.location.kind === "interior" && agent.location.tile && agent.activeSessions.length === 0) {
      agents.push(agent);
      continue;
    }
    const targetId = desiredBuildingId(agent, clocked.clock.minuteOfDay);
    if (agent.location.kind === "interior" && agent.location.buildingId === targetId) {
      agents.push(agent);
      continue;
    }
    if (targetId !== agent.destinationBuildingId || samePoint(agent.position, agent.destination) || agent.path.length === 0) {
      agent = planRoute(contextualState, agent, targetId);
    }
    const moved = moveAlongPath(agent, movementStepsBetween(agent, state.clock.totalMinutes, clocked.clock.totalMinutes));
    const arrivalState: GameStateV1 = {
      ...clocked,
      agents: [...agents, moved, ...clocked.agents.slice(index + 1)],
    };
    agents.push(enterRoutineDestination(arrivalState, moved, targetId));
  }
  return { ...clocked, agents };
};

export const sanitizeTaskSummary = (summary: string | undefined): string | undefined => {
  if (!summary) return undefined;
  const sanitized = summary.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return sanitized.length > 0 ? sanitized : undefined;
};

const sessionActivity = (signal: BridgeSignalV1): ActiveAgentSessionV1["activity"] => {
  if (signal.kind === "activity.waiting") return "waiting";
  if (signal.kind === "activity.resumed" || signal.kind === "tool.started") return "using-tool";
  return "thinking";
};

const upsertSession = (agent: AgentStateV1, signal: BridgeSignalV1): readonly ActiveAgentSessionV1[] => {
  const existing = agent.activeSessions.find((session) => session.sessionId === signal.sessionId);
  const activity = sessionActivity(signal);
  const summary = sanitizeTaskSummary(signal.taskSummary) ?? existing?.taskSummary;
  const toolFamily = signal.toolFamily ?? existing?.toolFamily;
  const session: ActiveAgentSessionV1 = {
    sessionId: signal.sessionId,
    activity,
    updatedAt: signal.occurredAt,
    ...(summary ? { taskSummary: summary } : {}),
    ...(toolFamily ? { toolFamily } : {}),
  };
  return [...agent.activeSessions.filter((candidate) => candidate.sessionId !== signal.sessionId), session];
};

const dominantSession = (sessions: readonly ActiveAgentSessionV1[]): ActiveAgentSessionV1 | undefined =>
  [...sessions].sort((left, right) => {
    const priority = { waiting: 3, "using-tool": 2, thinking: 1 } as const;
    return priority[right.activity] - priority[left.activity] || right.updatedAt.localeCompare(left.updatedAt) || left.sessionId.localeCompare(right.sessionId);
  })[0];

const activeActivity = (sessions: readonly ActiveAgentSessionV1[]): AgentActivity => dominantSession(sessions)?.activity ?? "idle";

const applyActivitySignal = (agent: AgentStateV1, signal: BridgeSignalV1, totalMinute: number): AgentStateV1 => {
  if (["activity.started", "activity.waiting", "activity.resumed", "tool.started", "tool.finished"].includes(signal.kind)) {
    const sessions = upsertSession(agent, signal);
    const dominant = dominantSession(sessions);
    return {
      ...agent,
      activeSessions: sessions,
      activity: activeActivity(sessions),
      destinationBuildingId: agent.bindings.workplaceBuildingId,
      ...(dominant?.taskSummary ? { taskSummary: dominant.taskSummary } : {}),
    };
  }
  if (["activity.completed", "activity.failed", "activity.interrupted"].includes(signal.kind)) {
    const sessions = agent.activeSessions.filter((session) => session.sessionId !== signal.sessionId);
    if (sessions.length > 0) {
      const dominant = dominantSession(sessions);
      return {
        ...agent,
        activeSessions: sessions,
        activity: activeActivity(sessions),
        ...(dominant?.taskSummary ? { taskSummary: dominant.taskSummary } : {}),
      };
    }
    const terminal: AgentActivity =
      signal.kind === "activity.completed" ? "done" : signal.kind === "activity.failed" ? "error" : "interrupted";
    const summary = sanitizeTaskSummary(signal.taskSummary) ?? agent.taskSummary;
    return {
      ...agent,
      activeSessions: [],
      activity: terminal,
      stateUntilTotalMinute: totalMinute + 15,
      ...(summary ? { taskSummary: summary } : {}),
    };
  }
  if (signal.kind === "activity.settled") {
    const remainingSessions = agent.activeSessions.filter((session) => session.sessionId !== signal.sessionId);
    // Hermes can settle a short task before its city avatar has physically
    // reached the workplace. Keep the terminal state until the spatial story
    // has completed, instead of teleporting the agent back into its routine.
    if (["done", "interrupted", "error"].includes(agent.activity) && isAgentTraveling(agent)) {
      return { ...agent, activeSessions: remainingSessions };
    }
    const { stateUntilTotalMinute: _until, taskSummary: _summary, ...rest } = agent;
    return {
      ...rest,
      activity: agent.presence === "offline" ? "offline" : "idle",
      activeSessions: remainingSessions,
    };
  }
  if (signal.kind === "presence.online" || signal.kind === "presence.degraded") {
    const presence = signal.kind === "presence.online" ? "online" : "degraded";
    return { ...agent, presence, activity: agent.activity === "offline" ? "idle" : agent.activity };
  }
  return { ...agent, presence: "offline", activity: "offline", activeSessions: [] };
};

const clearLocalOrder = (agent: AgentStateV1): AgentStateV1 => {
  const { localOrder: _order, ...rest } = agent;
  return rest;
};

const bridgeSignalOverridesLocalOrder = (signal: BridgeSignalV1): boolean =>
  !["presence.online", "presence.degraded"].includes(signal.kind);

export const applyBridgeSignal = (state: GameStateV1, signal: BridgeSignalV1): GameStateV1 => {
  if (signal.schema !== BRIDGE_SIGNAL_SCHEMA) throw new Error("Unsupported bridge signal schema.");
  const matched = state.agents.some((agent) => agent.profileId === signal.profileId);
  if (!matched) return { ...state, lastBridgeEventId: signal.eventId };
  const agents = state.agents.map((agent) =>
    agent.profileId === signal.profileId ? applyActivitySignal(agent, signal, state.clock.totalMinutes) : agent,
  );
  let economy = state.economy;
  if (signal.kind === "activity.completed") {
    economy = grantHermesCompletionReward(economy, signal.profileId, state.clock.day).economy;
  }
  const updated = { ...state, agents, economy, lastBridgeEventId: signal.eventId };
  return {
    ...updated,
    agents: updated.agents.map((agent) =>
      agent.profileId === signal.profileId
        ? agent.localOrder && !bridgeSignalOverridesLocalOrder(signal)
          ? agent
          : planRoute(
              updated,
              bridgeSignalOverridesLocalOrder(signal) ? clearLocalOrder(agent) : agent,
              desiredBuildingId(agent, updated.clock.minuteOfDay),
            )
        : agent,
    ),
  };
};

export const reconcileAgentObservation = (
  state: GameStateV1,
  observation: AgentObservationV1,
): GameStateV1 => {
  const agents = state.agents.map((agent): AgentStateV1 => {
    if (agent.profileId !== observation.profileId) return agent;
    const activeCount = Math.max(0, Math.min(100, Math.trunc(observation.activeSessionCount)));
    if (
      agent.localOrder &&
      activeCount === 0 &&
      observation.presence !== "offline" &&
      observation.activity !== "offline"
    ) {
      return { ...agent, presence: observation.presence };
    }
    if (observation.presence === "offline" || observation.activity === "offline") {
      const { taskSummary: _summary, stateUntilTotalMinute: _until, ...rest } = agent;
      return planRoute(state, {
        ...clearLocalOrder(rest as AgentStateV1),
        presence: "offline",
        activity: "offline",
        activeSessions: [],
      }, agent.bindings.homeBuildingId);
    }
    if (activeCount > 0) {
      const activity: ActiveAgentSessionV1["activity"] =
        observation.activity === "waiting"
          ? "waiting"
          : observation.activity === "using-tool"
            ? "using-tool"
            : "thinking";
      const summary = sanitizeTaskSummary(observation.taskSummary);
      const sessions = Array.from({ length: activeCount }, (_, index): ActiveAgentSessionV1 => ({
        sessionId:
          index === 0 && observation.dominantSessionId
            ? observation.dominantSessionId
            : `snapshot:${observation.profileId}:${index + 1}`,
        activity,
        updatedAt: observation.observedAt,
        ...(index === 0 && summary ? { taskSummary: summary } : {}),
        ...(index === 0 && observation.toolFamily ? { toolFamily: observation.toolFamily } : {}),
      }));
      const { stateUntilTotalMinute: _until, ...rest } = agent;
      return planRoute(state, {
        ...clearLocalOrder(rest as AgentStateV1),
        presence: observation.presence,
        activity,
        activeSessions: sessions,
        destinationBuildingId: agent.bindings.workplaceBuildingId,
        ...(summary ? { taskSummary: summary } : {}),
      }, agent.bindings.workplaceBuildingId);
    }
    if (["done", "interrupted", "error"].includes(observation.activity)) {
      const summary = sanitizeTaskSummary(observation.taskSummary) ?? agent.taskSummary;
      return planRoute(state, {
        ...clearLocalOrder(agent),
        presence: observation.presence,
        activity: observation.activity,
        activeSessions: [],
        stateUntilTotalMinute: agent.stateUntilTotalMinute ?? state.clock.totalMinutes + 15,
        ...(summary ? { taskSummary: summary } : {}),
      }, agent.bindings.workplaceBuildingId);
    }
    if (["done", "interrupted", "error"].includes(agent.activity) && isAgentTraveling(agent)) {
      return planRoute(state, {
        ...clearLocalOrder(agent),
        presence: observation.presence,
        activeSessions: [],
      }, agent.bindings.workplaceBuildingId);
    }
    const { taskSummary: _summary, stateUntilTotalMinute: _until, ...rest } = agent;
    const idle = { ...rest, presence: observation.presence, activity: "idle" as const, activeSessions: [] };
    // A passive idle/presence snapshot is not a navigation command. In
    // particular it must not exteriorize a loaded actor that is still inside
    // an authored room; the local routine/controller owns that doorway story.
    if (idle.location.kind === "interior") {
      return {
        ...idle,
        destinationBuildingId: idle.location.buildingId,
        destination: idle.position,
        path: [idle.position],
      };
    }
    return planRoute(state, idle, selectRoutineBuilding(idle, state.clock.minuteOfDay));
  });
  return { ...state, agents };
};

export const setAgentsVisible = (state: GameStateV1, visible: boolean): GameStateV1 => ({ ...state, agentsVisible: visible });
