import { describe, expect, it } from "vitest";
import {
  BRIDGE_SIGNAL_SCHEMA,
  advanceAgentRoutines,
  applyBridgeSignal,
  currentAgentBuildingId,
  createProgressiveGameState,
  createShowcaseGameState,
  createWorldMap,
  findPath,
  paintTerrain,
  sanitizeTaskSummary,
  reconcileAgentObservation,
  resolveCompletedBuildingId,
  selectRoutineBuilding,
  type BridgeSignalKind,
  type BridgeSignalV1,
  type GameStateV1,
} from "./index";

describe("limited deterministic pathfinding", () => {
  it("returns the same shortest cardinal path for the same input", () => {
    let map = createWorldMap(8, 6, [{ id: "meadow-core", name: "Core", unlocked: true, unlockCost: 0 }]);
    const road = [
      ...Array.from({ length: 7 }, (_, x) => ({ x, y: 1 })),
      ...Array.from({ length: 4 }, (_, index) => ({ x: 6, y: index + 1 })),
    ];
    map = paintTerrain(map, road, "road");
    const first = findPath(map, { x: 0, y: 1 }, { x: 6, y: 4 });
    const second = findPath(map, { x: 0, y: 1 }, { x: 6, y: 4 });
    expect(first).toEqual(second);
    if (!first.ok) throw new Error(first.error.message);
    expect(first.value).toHaveLength(10);
    expect(first.value.at(-1)).toEqual({ x: 6, y: 4 });
  });

  it("fails explicitly when the walkable graph is disconnected", () => {
    const map = createWorldMap(5, 5, [{ id: "meadow-core", name: "Core", unlocked: true, unlockCost: 0 }]);
    const result = findPath(map, { x: 0, y: 0 }, { x: 4, y: 4 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NO_PATH");
  });
});

describe("four deterministic agents", () => {
  const signal = (
    kind: BridgeSignalKind,
    sessionId: string,
    eventId: string,
    taskSummary?: string,
  ): BridgeSignalV1 => ({
    schema: BRIDGE_SIGNAL_SCHEMA,
    kind,
    profileId: "default",
    sessionId,
    eventId,
    occurredAt: `2026-07-16T00:00:0${eventId}.000Z`,
    ...(taskSummary ? { taskSummary } : {}),
  });

  it("creates exactly the confirmed profile mapping and schedule", () => {
    const state = createShowcaseGameState();
    expect(state.agents.map((agent) => [agent.id, agent.profileId])).toEqual([
      ["syka", "default"],
      ["elen", "elen"],
      ["astrelis", "astrelis"],
      ["zerny", "zerny"],
    ]);
    const syka = state.agents[0];
    if (!syka) throw new Error("Syka fixture is required.");
    expect(selectRoutineBuilding(syka, 480)).toBe("cafe-main");
    expect(selectRoutineBuilding(syka, 600)).toBe("community-main");
    expect(selectRoutineBuilding(syka, 1_100)).toBe("community-main");
    expect(selectRoutineBuilding(syka, 1_300)).toBe("home-syka");
    expect(selectRoutineBuilding(syka, 1_350)).toBe("home-syka");
  });

  it("keeps the first persisted building instance as the functional destination", () => {
    const showcase = createShowcaseGameState();
    const cafe = showcase.buildings.find((building) => building.id === "cafe-main");
    if (!cafe) throw new Error("Showcase cafe fixture is required.");
    const withLaterCafe: GameStateV1 = {
      ...showcase,
      buildings: [...showcase.buildings, { ...cafe, id: "building-99" }],
    };
    expect(resolveCompletedBuildingId(withLaterCafe, "cafe")).toBe("cafe-main");
  });

  it("keeps showcase homes exact while spreading a new town across its reachable road", () => {
    const showcase = createShowcaseGameState();
    for (const agent of showcase.agents) {
      expect(currentAgentBuildingId(showcase, agent)).toBe(agent.bindings.homeBuildingId);
    }
    const progressive = createProgressiveGameState();
    expect(new Set(progressive.agents.map((agent) => `${agent.position.x},${agent.position.y}`)).size).toBe(4);
    for (const agent of progressive.agents) {
      const tile = progressive.map.tiles.find((candidate) =>
        candidate.position.x === agent.position.x && candidate.position.y === agent.position.y,
      );
      expect(tile?.terrain).toBe("road");
    }
  });

  it("keeps every showcase building footprint off the road network", () => {
    const state = createShowcaseGameState();
    for (const building of state.buildings) {
      for (const point of building.occupiedTiles) {
        const tile = state.map.tiles.find((candidate) =>
          candidate.position.x === point.x && candidate.position.y === point.y,
        );
        expect(tile, `${building.id} has an out-of-map footprint tile`).toBeDefined();
        expect(tile?.terrain, `${building.id} overlaps road at ${point.x},${point.y}`).not.toBe("road");
      }
    }
  });

  it("walks toward routine destinations without randomness", () => {
    const state = { ...createShowcaseGameState(), clock: { day: 1, minuteOfDay: 480, totalMinutes: 0, speed: 1 as const } };
    const first = advanceAgentRoutines(state, 15);
    const second = advanceAgentRoutines(state, 15);
    expect(first.agents).toEqual(second.agents);
    expect(first.agents[0]?.position).not.toEqual(state.agents[0]?.position);
    expect(first.agents[0]?.destinationBuildingId).toBe("cafe-main");
  });

  it("accumulates normal one-minute ticks into visible travel and reports arrival", () => {
    let state: GameStateV1 = {
      ...createShowcaseGameState(),
      clock: { day: 1, minuteOfDay: 480, totalMinutes: 0, speed: 1 as const },
    };
    const start = state.agents[0]?.position;
    state = advanceAgentRoutines(state, 1);
    expect(state.agents[0]?.position).toEqual(start);
    state = advanceAgentRoutines(state, 1);
    expect(state.agents[0]?.position).not.toEqual(start);

    state = advanceAgentRoutines(state, 90);
    const syka = state.agents[0];
    if (!syka) throw new Error("Syka fixture is required.");
    expect(currentAgentBuildingId(state, syka)).toBe(syka.destinationBuildingId);
  });

  it("enters completed routine buildings instead of standing forever on their access road", () => {
    let state: GameStateV1 = {
      ...createShowcaseGameState(),
      clock: { day: 1, minuteOfDay: 1_350, totalMinutes: 0, speed: 1 as const },
    };
    for (let minute = 0; minute < 120; minute += 1) state = advanceAgentRoutines(state, 1);
    for (const agent of state.agents) {
      expect(agent.location).toMatchObject({ kind: "interior", buildingId: agent.bindings.homeBuildingId });
      expect(currentAgentBuildingId(state, agent)).toBe(agent.bindings.homeBuildingId);
    }
  });

  it("keeps concurrent sessions active and rewards completion without failure penalties", () => {
    let state = createShowcaseGameState();
    const startingBalance = state.economy.balance;
    state = applyBridgeSignal(state, signal("activity.started", "s1", "1", "  Una tarea\nprivada resumida  "));
    state = applyBridgeSignal(state, signal("activity.waiting", "s2", "2"));
    expect(state.agents[0]).toEqual(expect.objectContaining({ activity: "waiting", taskSummary: "Una tarea privada resumida" }));
    expect(state.agents[0]?.activeSessions).toHaveLength(2);

    state = applyBridgeSignal(state, signal("activity.completed", "s2", "3"));
    expect(state.agents[0]?.activity).toBe("thinking");
    expect(state.agents[0]?.activeSessions).toHaveLength(1);
    expect(state.economy.balance).toBe(startingBalance + 5);

    state = applyBridgeSignal(state, signal("activity.failed", "s1", "4"));
    expect(state.agents[0]?.activity).toBe("error");
    expect(state.economy.balance).toBe(startingBalance + 5);
  });

  it("preserves tool fidelity and does not settle before spatial arrival", () => {
    let state = createShowcaseGameState();
    state = applyBridgeSignal(state, signal("activity.started", "s1", "1"));
    state = applyBridgeSignal(state, { ...signal("tool.started", "s1", "2"), toolFamily: "code" });
    expect(state.agents[0]?.activity).toBe("using-tool");
    expect(state.agents[0]?.activeSessions[0]?.toolFamily).toBe("code");
    state = applyBridgeSignal(state, signal("tool.finished", "s1", "3"));
    expect(state.agents[0]?.activity).toBe("thinking");
    state = applyBridgeSignal(state, signal("activity.completed", "s1", "4"));
    state = applyBridgeSignal(state, signal("activity.settled", "s1", "5"));
    expect(state.agents[0]?.activity).toBe("done");
  });

  it("keeps an early completion terminal until workplace arrival, then returns to the current routine", () => {
    let state = createShowcaseGameState();
    const startingBalance = state.economy.balance;
    const event = (
      kind: BridgeSignalKind,
      eventId: string,
    ): BridgeSignalV1 => ({
      ...signal(kind, "short-session", eventId, "Campaña breve"),
      profileId: "elen",
    });

    state = applyBridgeSignal(state, event("activity.started", "6"));
    let elen = state.agents.find((agent) => agent.profileId === "elen");
    expect(elen).toMatchObject({
      activity: "thinking",
      destinationBuildingId: "office-marketing",
    });
    expect(elen?.path.length).toBeGreaterThan(1);

    state = applyBridgeSignal(state, event("activity.completed", "7"));
    state = applyBridgeSignal(state, event("activity.settled", "8"));
    elen = state.agents.find((agent) => agent.profileId === "elen");
    expect(elen?.activity).toBe("done");
    expect(state.economy.balance).toBe(startingBalance + 5);

    let arrived = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      state = advanceAgentRoutines(state, 3);
      elen = state.agents.find((agent) => agent.profileId === "elen");
      expect(elen?.activity).toBe("done");
      if (elen && currentAgentBuildingId(state, elen) === elen.bindings.workplaceBuildingId) {
        arrived = true;
        break;
      }
    }
    expect(arrived).toBe(true);
    expect(elen?.activity).toBe("done");

    const terminalUntil = elen?.stateUntilTotalMinute ?? state.clock.totalMinutes;
    state = advanceAgentRoutines(state, Math.max(1, terminalUntil - state.clock.totalMinutes));
    elen = state.agents.find((agent) => agent.profileId === "elen");
    if (!elen) throw new Error("Elen fixture is required.");
    const routineDestination = selectRoutineBuilding(elen, state.clock.minuteOfDay);
    expect(elen.activity).toBe("idle");
    expect(elen.destinationBuildingId).toBe(routineDestination);
    expect(elen.destinationBuildingId).not.toBe(elen.bindings.workplaceBuildingId);
    expect(elen.path.length).toBeGreaterThan(1);
    expect(state.economy.balance).toBe(startingBalance + 5);
  });

  it("reconciles an already-active Hermes snapshot into the spatial loop without granting rewards", () => {
    const initial = createShowcaseGameState();
    const balance = initial.economy.balance;
    const state = reconcileAgentObservation(initial, {
      profileId: "elen",
      presence: "online",
      activity: "using-tool",
      activeSessionCount: 1,
      dominantSessionId: "existing-session",
      taskSummary: "Preparando campaña",
      toolFamily: "browser",
      observedAt: "2026-07-16T12:00:00.000Z",
    });
    const elen = state.agents.find((agent) => agent.profileId === "elen");
    expect(elen).toMatchObject({
      activity: "using-tool",
      destinationBuildingId: "office-marketing",
      taskSummary: "Preparando campaña",
      activeSessions: [expect.objectContaining({ sessionId: "existing-session", toolFamily: "browser" })],
    });
    expect(state.economy.balance).toBe(balance);
  });

  it("keeps a loaded interior location when Hermes only reports idle presence", () => {
    const initial = createShowcaseGameState();
    const cafe = initial.buildings.find((building) => building.kind === "cafe")!;
    const inside = {
      ...initial,
      agents: initial.agents.map((agent) => agent.profileId === "default"
        ? {
            ...agent,
            location: {
              kind: "interior" as const,
              buildingId: cafe.id,
              anchorId: "table-seat-3",
              tile: { x: 22, y: 11 },
            },
          }
        : agent),
    };
    const observed = reconcileAgentObservation(inside, {
      profileId: "default",
      presence: "online",
      activity: "idle",
      activeSessionCount: 0,
      observedAt: "2026-07-16T12:00:00.000Z",
    });
    expect(observed.agents.find((agent) => agent.profileId === "default")?.location).toEqual({
      kind: "interior",
      buildingId: cafe.id,
      anchorId: "table-seat-3",
      tile: { x: 22, y: 11 },
    });
    expect(advanceAgentRoutines(observed, 15).agents.find((agent) => agent.profileId === "default")?.location)
      .toMatchObject({ kind: "interior", buildingId: cafe.id, tile: { x: 22, y: 11 } });
  });

  it("sanitizes and bounds summaries defensively", () => {
    expect(sanitizeTaskSummary(`a\n\t b ${"c".repeat(200)}`)).toHaveLength(120);
    expect(sanitizeTaskSummary(" \n ")).toBeUndefined();
  });
});
