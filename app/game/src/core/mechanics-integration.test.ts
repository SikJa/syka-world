import { describe, expect, it } from "vitest";
import {
  WORLD_OBJECT_SCHEMA,
  accelerateConstruction,
  advanceAgentRoutines,
  advanceConstruction,
  advanceSimulation,
  createEconomyState,
  createProgressiveGameState,
  getConstructionAccelerationQuote,
  getTile,
  grantLocalReward,
  issueGoToCafeOrder,
  placeBuilding,
  placeWorldObject,
  planBuildingPlacement,
  removeWorldObject,
  returnAgentToCity,
  setAgentInteriorAction,
  type GameStateV1,
  type GridPoint,
} from "./index";

const cafeRequest = {
  definitionId: "cafe-library",
  origin: { x: 8, y: 4 },
  orientation: "north" as const,
};

const buildCafe = (state = createProgressiveGameState()): GameStateV1 => {
  const placed = placeBuilding(state, cafeRequest);
  if (!placed.ok) throw new Error(placed.error.message);
  return placed.value;
};

const availableRoadEdge = (state: GameStateV1): GridPoint => {
  const offsets = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  const tile = state.map.tiles.find((candidate) => {
    if (candidate.terrain !== "grass" || candidate.buildingId) return false;
    if (state.worldObjects.some((object) =>
      object.hostTile.x === candidate.position.x && object.hostTile.y === candidate.position.y,
    )) return false;
    return offsets.some(([dx, dy]) => getTile(state.map, {
      x: candidate.position.x + dx,
      y: candidate.position.y + dy,
    })?.terrain === "road");
  });
  if (!tile) throw new Error("Expected a free grass road edge in the progressive fixture.");
  return tile.position;
};

describe("persistent exterior objects and atomic intelligent placement", () => {
  it("offers two separated initial-map bands for the cafe with deterministic non-invasive connectors", () => {
    const initial = createProgressiveGameState();
    const origins = [{ x: 8, y: 1 }, { x: 8, y: 11 }] as const;
    expect(Math.abs(origins[0].y - origins[1].y)).toBeGreaterThanOrEqual(8);

    for (const origin of origins) {
      const request = { ...cafeRequest, origin };
      const first = planBuildingPlacement(initial, request);
      const second = planBuildingPlacement(initial, request);
      expect(first).toEqual(second);
      if (!first.ok) throw new Error(first.error.message);
      expect(first.value.affordable).toBe(true);
      expect(first.value.roadTiles.length).toBeGreaterThan(0);
      const occupied = new Set(first.value.occupiedTiles.map((tile) => `${tile.x},${tile.y}`));
      expect(first.value.roadTiles.every((tile) => !occupied.has(`${tile.x},${tile.y}`))).toBe(true);
      const endpoint = first.value.connectorPath.at(-1);
      expect(endpoint).toBeDefined();
      expect(getTile(initial.map, endpoint!)?.terrain).toBe("road");
    }
  });

  it("keeps preview pure and commits its exact deterministic road and cleanup plan", () => {
    const initial = createProgressiveGameState();
    const request = { ...cafeRequest, origin: { x: 8, y: 1 } };
    const first = planBuildingPlacement(initial, request);
    const second = planBuildingPlacement(initial, request);
    expect(first).toEqual(second);
    if (!first.ok) throw new Error(first.error.message);
    expect(first.value.roadTiles.length).toBeGreaterThan(0);
    expect(first.value.costs.road).toBe(first.value.roadTiles.length * 3);
    expect(first.value.costs.total).toBe(
      first.value.costs.building + first.value.costs.road + first.value.costs.cleanup,
    );
    expect(initial.economy.balance).toBe(420);
    const initialRoadCount = initial.map.tiles.filter((tile) => tile.terrain === "road").length;
    expect(planBuildingPlacement(initial, request)).toEqual(first);
    expect(initial.map.tiles.filter((tile) => tile.terrain === "road")).toHaveLength(initialRoadCount);

    const committed = placeBuilding(initial, request);
    if (!committed.ok) throw new Error(committed.error.message);
    expect(initial.economy.balance - committed.value.economy.balance).toBe(first.value.costs.total);
    expect(committed.value.worldObjects.map((object) => object.instanceId)).not.toEqual(
      expect.arrayContaining([...first.value.removedObjectIds]),
    );
    for (const road of first.value.roadTiles) expect(getTile(committed.value.map, road)?.terrain).toBe("road");
    for (const occupied of first.value.occupiedTiles) expect(getTile(committed.value.map, occupied)?.terrain).toBe("grass");
  });

  it("does not mutate anything when funds are insufficient or an object is non-removable", () => {
    const initial = createProgressiveGameState();
    const poor = { ...initial, economy: createEconomyState(1) };
    const failedPayment = placeBuilding(poor, cafeRequest);
    expect(failedPayment).toMatchObject({ ok: false, error: { code: "INSUFFICIENT_FUNDS" } });
    expect(poor.map).toEqual(initial.map);
    expect(poor.worldObjects).toEqual(initial.worldObjects);

    const blocked: GameStateV1 = {
      ...initial,
      worldObjects: [
        ...initial.worldObjects.filter((object) => object.hostTile.x !== 8 || object.hostTile.y !== 4),
        {
          schema: WORLD_OBJECT_SCHEMA,
          instanceId: "protected-tree",
          definitionId: "tree-round",
          hostTile: { x: 8, y: 4 },
          orientation: "north",
          placementState: "placed",
          removable: false,
          provenance: "seeded",
        },
      ],
    };
    expect(planBuildingPlacement(blocked, cafeRequest)).toMatchObject({
      ok: false,
      error: { code: "INVALID_PLACEMENT" },
    });
  });

  it("keeps benches and lamps on grass road edges and refunds a player object once", () => {
    const initial = createProgressiveGameState();
    const hostTile = availableRoadEdge(initial);
    const placed = placeWorldObject(initial, { definitionId: "streetlamp", hostTile });
    if (!placed.ok) throw new Error(placed.error.message);
    const lamp = placed.value.worldObjects.find((object) => object.provenance === "player");
    expect(lamp).toMatchObject({ definitionId: "streetlamp", hostTile, lightSource: { activePeriod: "night" } });
    expect(getTile(placed.value.map, hostTile)?.terrain).toBe("grass");
    expect(placed.value.economy.balance).toBe(initial.economy.balance - 24);
    expect(placed.value.progression.townXp).toBe(initial.progression.townXp);

    const removed = removeWorldObject(placed.value, lamp!.instanceId);
    if (!removed.ok) throw new Error(removed.error.message);
    expect(removed.value.economy.balance).toBe(initial.economy.balance - 12);
    expect(removeWorldObject(removed.value, lamp!.instanceId)).toMatchObject({
      ok: false,
      error: { code: "WORLD_OBJECT_NOT_FOUND" },
    });

    const roadTile = initial.map.tiles.find((tile) => tile.terrain === "road")?.position;
    if (!roadTile) throw new Error("Road fixture is required.");
    expect(placeWorldObject(initial, { definitionId: "bench", hostTile: roadTile })).toMatchObject({
      ok: false,
      error: { code: "INVALID_WORLD_OBJECT_PLACEMENT" },
    });
  });
});

describe("completion progression, acceleration and functional bindings", () => {
  it("recognizes a generated cafe, awards XP once and unlocks level two", () => {
    const placed = buildCafe();
    const cafe = placed.buildings.find((building) => building.kind === "cafe");
    expect(cafe?.id).toBe("building-2");
    let completed = advanceConstruction(placed, 360);
    expect(completed.progression).toMatchObject({ townXp: 100, townLevel: 2 });
    expect(completed.progression.unlockedBuildingIds).toEqual(expect.arrayContaining([
      "office-marketing",
      "office-commercial",
      "workshop-crm",
    ]));
    for (const agent of completed.agents) expect(agent.bindings.cafeBuildingId).toBe(cafe?.id);

    const rewardedMilestones = completed.progression.rewardedMilestones;
    completed = advanceConstruction(completed, 360);
    expect(completed.progression.townXp).toBe(100);
    expect(completed.progression.rewardedMilestones).toEqual(rewardedMilestones);

    completed = { ...completed, economy: grantLocalReward(completed.economy, 500).economy };
    const office = placeBuilding(completed, {
      definitionId: "office-marketing",
      origin: { x: 13, y: 4 },
      orientation: "north",
    });
    if (!office.ok) throw new Error(office.error.message);
    const officeId = office.value.buildings.find((building) => building.kind === "marketing-office")?.id;
    const officeDone = advanceConstruction(office.value, 360);
    expect(officeDone.agents.find((agent) => agent.profileId === "elen")?.bindings.workplaceBuildingId).toBe(officeId);
  });

  it("uses the same completion pipeline for time and paid finish without changing the world clock", () => {
    const normalPlaced = buildCafe();
    const paidPlaced = buildCafe();
    const cafeId = paidPlaced.buildings.find((building) => building.kind === "cafe")?.id;
    if (!cafeId) throw new Error("Cafe fixture is required.");
    const quote = getConstructionAccelerationQuote(paidPlaced, cafeId, "finish-now");
    expect(quote).toMatchObject({
      ok: true,
      value: { remainingMinutes: 360, advancedMinutes: 360, cost: 24, affordable: true },
    });
    const clock = paidPlaced.clock;
    const paid = accelerateConstruction(paidPlaced, cafeId, "finish-now");
    if (!paid.ok) throw new Error(paid.error.message);
    const normal = advanceConstruction(normalPlaced, 360);
    expect(paid.value.clock).toEqual(clock);
    expect(paid.value.buildings).toEqual(normal.buildings);
    expect(paid.value.interiors).toEqual(normal.interiors);
    expect(paid.value.progression).toEqual(normal.progression);
    expect(paid.value.agents.map((agent) => agent.bindings)).toEqual(normal.agents.map((agent) => agent.bindings));
    expect(paidPlaced.economy.balance - paid.value.economy.balance).toBe(24);
  });

  it("prices +1h separately and refuses acceleration without enough Lumenes", () => {
    const placed = buildCafe();
    const cafeId = placed.buildings.find((building) => building.kind === "cafe")!.id;
    expect(getConstructionAccelerationQuote(placed, cafeId, "one-hour")).toMatchObject({
      ok: true,
      value: { advancedMinutes: 60, cost: 4 },
    });
    const accelerated = accelerateConstruction(placed, cafeId, "one-hour");
    if (!accelerated.ok) throw new Error(accelerated.error.message);
    expect(accelerated.value.buildings.find((building) => building.id === cafeId)?.construction.elapsedMinutes).toBe(60);
    expect(accelerated.value.clock).toEqual(placed.clock);
    const poor = { ...placed, economy: createEconomyState(1) };
    expect(accelerateConstruction(poor, cafeId, "one-hour")).toMatchObject({
      ok: false,
      error: { code: "INSUFFICIENT_FUNDS" },
    });
  });
});

describe("ambient life and renderer-agnostic local interior loop", () => {
  it("moves distinct agents deterministically on reachable roads before destinations exist", () => {
    const initial = createProgressiveGameState();
    const first = advanceSimulation(initial, 15);
    const second = advanceSimulation(initial, 15);
    expect(first.agents).toEqual(second.agents);
    expect(first.agents.some((agent, index) => agent.position.x !== initial.agents[index]?.position.x)).toBe(true);
    for (const agent of first.agents) expect(getTile(first.map, agent.position)?.terrain).toBe("road");
  });

  it("walks to a generated cafe, enters an anchor, acts and returns through the same access", () => {
    let state = advanceConstruction(buildCafe(), 360);
    const ordered = issueGoToCafeOrder(state, "default", "read");
    if (!ordered.ok) throw new Error(ordered.error.message);
    state = ordered.value;
    for (let minute = 0; minute < 240; minute += 1) {
      state = advanceSimulation(state, 1);
      if (state.agents.find((agent) => agent.profileId === "default")?.localOrder?.phase === "staying") break;
    }
    const syka = state.agents.find((agent) => agent.profileId === "default");
    expect(syka?.location).toMatchObject({ kind: "interior", buildingId: "building-2", anchorId: "library-chair" });
    expect(syka?.localOrder?.phase).toBe("staying");

    const acting = setAgentInteriorAction(state, "default", "serve-coffee");
    if (!acting.ok) throw new Error(acting.error.message);
    const actingLocation = acting.value.agents.find((agent) => agent.profileId === "default")?.location;
    expect(actingLocation).toMatchObject({
      kind: "interior",
      action: "serve-coffee",
    });
    if (actingLocation?.kind !== "interior") throw new Error("Expected an interior action location.");
    expect(["counter", "coffee-machine"]).toContain(actingLocation.anchorId);

    const anchored = setAgentInteriorAction(state, "default", "serve-coffee", actingLocation.anchorId);
    if (!anchored.ok) throw new Error(anchored.error.message);
    expect(anchored.value.agents.find((agent) => agent.profileId === "default")?.location).toMatchObject({
      kind: "interior",
      anchorId: actingLocation.anchorId,
      action: "serve-coffee",
    });
    expect(setAgentInteriorAction(state, "default", "serve-coffee", "library-chair")).toMatchObject({
      ok: false,
      error: { code: "ANCHOR_OCCUPIED" },
    });
    const cafe = state.buildings.find((building) => building.kind === "cafe")!;
    const returned = returnAgentToCity(acting.value, "default");
    if (!returned.ok) throw new Error(returned.error.message);
    expect(returned.value.agents.find((agent) => agent.profileId === "default")?.location).toEqual({
      kind: "exterior",
      tile: cafe.accessTile,
    });
  });

  it("rejects a cafe order when the road graph is disconnected instead of teleporting", () => {
    const completed = advanceConstruction(buildCafe(), 360);
    const cafe = completed.buildings.find((building) => building.kind === "cafe")!;
    const isolatedPosition = { x: 0, y: 0 };
    const disconnected: GameStateV1 = {
      ...completed,
      map: {
        ...completed.map,
        tiles: completed.map.tiles.map((tile) => ({
          ...tile,
          terrain:
            (tile.position.x === isolatedPosition.x && tile.position.y === isolatedPosition.y) ||
            (tile.position.x === cafe.accessTile.x && tile.position.y === cafe.accessTile.y)
              ? "road" as const
              : tile.buildingId
                ? "grass" as const
                : "grass" as const,
        })),
      },
      agents: completed.agents.map((agent) =>
        agent.profileId === "default"
          ? {
              ...agent,
              position: isolatedPosition,
              location: { kind: "exterior" as const, tile: isolatedPosition },
              destination: isolatedPosition,
              path: [isolatedPosition],
            }
          : agent,
      ),
    };
    expect(issueGoToCafeOrder(disconnected, "default", "read")).toMatchObject({
      ok: false,
      error: { code: "CAFE_UNREACHABLE" },
    });
    expect(disconnected.agents.find((agent) => agent.profileId === "default")?.location).toEqual({
      kind: "exterior",
      tile: isolatedPosition,
    });
  });

  it("reserves distinct interior seats for simultaneous transitions", () => {
    const completed = advanceConstruction(buildCafe(), 360);
    const cafe = completed.buildings.find((building) => building.kind === "cafe")!;
    const simultaneous: GameStateV1 = {
      ...completed,
      agents: completed.agents.map((agent, index) =>
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
                issuedAtTotalMinute: completed.clock.totalMinutes,
                phaseUntilTotalMinute: completed.clock.totalMinutes + 1,
              },
            }
          : agent,
      ),
    };
    const advanced = advanceAgentRoutines(simultaneous, 1);
    const anchors = advanced.agents.slice(0, 2).map((agent) =>
      agent.location.kind === "interior" ? agent.location.anchorId : "outside",
    );
    expect(anchors).toEqual(["table-seat-1", "table-seat-2"]);
    expect(new Set(anchors).size).toBe(2);
  });
});
