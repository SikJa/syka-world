import { describe, expect, it } from "vitest";
import {
  BRIDGE_SIGNAL_SCHEMA,
  NPC_SCHEMA,
  activeCafeNpcs,
  advanceAgentRoutines,
  advanceNpcRoutines,
  advanceSimulation,
  applyBridgeSignal,
  createCafeNpcs,
  createProgressiveGameState,
  createShowcaseGameState,
  deserializeGame,
  reconcileAgentObservation,
  serializeGame,
  type GameStateV1,
} from ".";

const stateAt = (state: GameStateV1, minuteOfDay: number): GameStateV1 =>
  advanceNpcRoutines({
    ...state,
    clock: { ...state.clock, minuteOfDay, totalMinutes: minuteOfDay },
    npcs: createCafeNpcs(minuteOfDay),
  });

const scheduledNpcIds = (state: GameStateV1): readonly string[] =>
  state.npcs.flatMap((npc) =>
    npc.location.kind === "interior" || (npc.location.kind === "transit" && npc.location.direction === "arriving")
      ? [npc.id]
      : [],
  );

describe("local cafe NPC routines", () => {
  it("seeds the five fixed local identities without Hermes or agent fields", () => {
    const npcs = createCafeNpcs();
    expect(npcs.map((npc) => npc.id)).toEqual([
      "alma-rios",
      "beni-menta",
      "iara-luz",
      "milo-niebla",
      "noa-junco",
    ]);
    for (const npc of npcs) {
      expect(npc.schema).toBe(NPC_SCHEMA);
      expect(npc.location).toEqual({ kind: "offstage" });
      expect(npc).not.toHaveProperty("profileId");
      expect(npc).not.toHaveProperty("activeSessions");
      expect(npc).not.toHaveProperty("taskSummary");
    }
  });

  it("keeps everyone offstage until a completed cafe and interior exist", () => {
    let state = createProgressiveGameState();
    state = advanceSimulation(state, 900);
    expect(state.npcs).toHaveLength(5);
    expect(activeCafeNpcs(state)).toEqual([]);
    expect(state.npcs.every((npc) => npc.routine === "offstage" && npc.location.kind === "offstage")).toBe(true);
  });

  it("derives deterministic clock shifts with no more than three cafe-bound NPCs", () => {
    const showcase = createShowcaseGameState();
    for (let minute = 0; minute < 1_440; minute += 15) {
      const first = stateAt(showcase, minute);
      const second = stateAt(showcase, minute);
      expect(first.npcs).toEqual(second.npcs);
      expect(scheduledNpcIds(first).length).toBeLessThanOrEqual(3);
    }

    expect(scheduledNpcIds(stateAt(showcase, 480))).toEqual(["alma-rios", "beni-menta"]);
    expect(scheduledNpcIds(stateAt(showcase, 660))).toEqual([
      "alma-rios",
      "beni-menta",
      "noa-junco",
    ]);
    expect(scheduledNpcIds(stateAt(showcase, 900))).toEqual(["alma-rios", "iara-luz"]);
    expect(scheduledNpcIds(stateAt(showcase, 1_050))).toEqual(["alma-rios", "milo-niebla"]);
  });

  it("walks in from a connected map border before entering and walks back out after the shift", () => {
    const beforeOpening = stateAt(createShowcaseGameState(), 419);
    expect(activeCafeNpcs(beforeOpening)).toEqual([]);
    let opened = advanceSimulation(beforeOpening, 1);
    expect(opened.clock.minuteOfDay).toBe(420);
    const arriving = opened.npcs.filter((npc) => npc.location.kind === "transit");
    expect(arriving.map((npc) => npc.id)).toEqual(["alma-rios", "beni-menta"]);
    for (const npc of arriving) {
      if (npc.location.kind !== "transit") throw new Error("Transit fixture is required.");
      const { width, height } = opened.map.size;
      expect(
        npc.location.tile.x === 0 ||
        npc.location.tile.y === 0 ||
        npc.location.tile.x === width - 1 ||
        npc.location.tile.y === height - 1,
      ).toBe(true);
      expect(npc.location.direction).toBe("arriving");
      expect(npc.location.path[0]).toEqual(npc.location.tile);
    }
    expect(advanceNpcRoutines(opened).npcs).toEqual(opened.npcs);

    for (let minute = 0; minute < 20 && activeCafeNpcs(opened).length < 2; minute += 1) {
      opened = advanceSimulation(opened, 1);
    }
    expect(activeCafeNpcs(opened).map((npc) => npc.id)).toEqual(["alma-rios", "beni-menta"]);

    const beforeBeniLeaves: GameStateV1 = {
      ...opened,
      clock: { ...opened.clock, minuteOfDay: 719, totalMinutes: 719 },
    };
    let leaving = advanceSimulation(beforeBeniLeaves, 1);
    const beni = leaving.npcs.find((npc) => npc.id === "beni-menta");
    expect(beni?.location).toMatchObject({ kind: "transit", direction: "departing" });
    for (let minute = 0; minute < 20 && leaving.npcs.find((npc) => npc.id === "beni-menta")?.location.kind !== "offstage"; minute += 1) {
      leaving = advanceSimulation(leaving, 1);
    }
    expect(leaving.npcs.find((npc) => npc.id === "beni-menta")?.location).toEqual({ kind: "offstage" });
  });

  it("round-trips NPC state and migrates an existing save without the new field", () => {
    const state = stateAt(createShowcaseGameState(), 660);
    const loaded = deserializeGame(serializeGame(state, "2026-07-16T12:00:00.000Z"));
    if (!loaded.ok) throw new Error(loaded.error.message);
    expect(loaded.value.save.game.npcs).toEqual(state.npcs);
    expect(loaded.value.migratedFrom).toBeUndefined();

    const legacyGame = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete legacyGame.npcs;
    const migrated = deserializeGame(JSON.stringify({
      schema: "syka.world.save.v1",
      savedAt: "2026-07-16T12:00:00.000Z",
      game: legacyGame,
    }));
    if (!migrated.ok) throw new Error(migrated.error.message);
    expect(migrated.value.migratedFrom).toBe("syka.world.game-state.v1.pre-mechanics");
    expect(migrated.value.save.game.npcs).toEqual(createCafeNpcs(660));

    const preTravelGame = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    preTravelGame.npcs = (preTravelGame.npcs as Array<Record<string, unknown>>).map((npc) => {
      const copy = { ...npc };
      delete copy.lastRoutineTotalMinute;
      return copy;
    });
    const travelMigrated = deserializeGame(JSON.stringify({
      schema: "syka.world.save.v1",
      savedAt: "2026-07-16T12:00:00.000Z",
      game: preTravelGame,
    }));
    if (!travelMigrated.ok) throw new Error(travelMigrated.error.message);
    expect(travelMigrated.value.save.game.npcs.every((npc) => npc.lastRoutineTotalMinute === 660)).toBe(true);
    expect(travelMigrated.value.save.game.npcs.map((npc) => npc.location)).toEqual(state.npcs.map((npc) => npc.location));
  });

  it("lets simultaneous real agents reserve distinct cafe anchors around an NPC", () => {
    const showcase = stateAt(createShowcaseGameState(), 480);
    const cafe = showcase.buildings.find((building) => building.id === "cafe-main");
    if (!cafe) throw new Error("Cafe fixture is required.");
    const iara = showcase.npcs.find((npc) => npc.id === "iara-luz");
    if (!iara) throw new Error("Iara fixture is required.");
    const state: GameStateV1 = {
      ...showcase,
      npcs: showcase.npcs.map((npc) =>
        npc.id === iara.id
          ? {
              ...npc,
              activity: "working",
              routine: "illustrating",
              location: { kind: "interior", buildingId: cafe.id, anchorId: "table-seat-1" },
            }
          : { ...npc, activity: "idle", routine: "offstage", location: { kind: "offstage" } },
      ),
      agents: showcase.agents.map((agent, index) =>
        index < 2
          ? {
              ...agent,
              position: cafe.accessTile,
              destination: cafe.accessTile,
              destinationBuildingId: cafe.id,
              path: [cafe.accessTile],
              location: { kind: "interior" as const, buildingId: cafe.id, anchorId: "entry" },
              localOrder: {
                kind: "go-to-cafe" as const,
                targetBuildingId: cafe.id,
                action: "sit" as const,
                phase: "entering" as const,
                issuedAtTotalMinute: showcase.clock.totalMinutes,
                phaseUntilTotalMinute: showcase.clock.totalMinutes + 1,
              },
            }
          : agent,
      ),
    };
    const advanced = advanceAgentRoutines(state, 1);
    const anchors = advanced.agents.slice(0, 2).map((agent) =>
      agent.location.kind === "interior" ? agent.location.anchorId : "outside",
    );
    expect(anchors).toEqual(["table-seat-2", "table-seat-3"]);
    expect(new Set(anchors).size).toBe(2);
  });

  it("cannot be modified by bridge signals or observation reconciliation", () => {
    const state = createShowcaseGameState();
    const before = state.npcs;
    const signaled = applyBridgeSignal(state, {
      schema: BRIDGE_SIGNAL_SCHEMA,
      eventId: "evt-npc-isolation",
      kind: "activity.started",
      profileId: "default",
      sessionId: "session-1",
      occurredAt: "2026-07-16T12:00:00.000Z",
      taskSummary: "Una tarea real de Hermes",
    });
    expect(signaled.npcs).toBe(before);

    const observed = reconcileAgentObservation(state, {
      profileId: "default",
      presence: "online",
      activity: "thinking",
      activeSessionCount: 1,
      dominantSessionId: "session-1",
      taskSummary: "Otra observación",
      observedAt: "2026-07-16T12:00:01.000Z",
    });
    expect(observed.npcs).toBe(before);
  });
});
