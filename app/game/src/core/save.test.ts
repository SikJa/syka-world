import { describe, expect, it } from "vitest";
import {
  MemoryStorage,
  SAVE_SCHEMA,
  advanceConstruction,
  advanceSimulation,
  createProgressiveGameState,
  createShowcaseGameState,
  deserializeGame,
  getTile,
  issueGoToCafeOrder,
  loadGameFromStorage,
  placeBuilding,
  placeWorldObject,
  removeWorldObject,
  saveGameToStorage,
  serializeGame,
  validateGameState,
} from "./index";

const freeRoadEdge = (state: ReturnType<typeof createProgressiveGameState>) => {
  const offsets = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  const candidate = state.map.tiles.find((tile) =>
    tile.terrain === "grass" &&
    !tile.buildingId &&
    !state.worldObjects.some((object) =>
      object.hostTile.x === tile.position.x && object.hostTile.y === tile.position.y,
    ) &&
    offsets.some(([dx, dy]) => getTile(state.map, {
      x: tile.position.x + dx,
      y: tile.position.y + dy,
    })?.terrain === "road"),
  );
  if (!candidate) throw new Error("A free road edge is required by save tests.");
  return candidate.position;
};

describe("versioned save/load", () => {
  it("round-trips the complete serializable state", () => {
    const state = createShowcaseGameState();
    const serialized = serializeGame(state, "2026-07-16T12:00:00.000Z");
    const loaded = deserializeGame(serialized);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw new Error(loaded.error.message);
    expect(loaded.value.save.schema).toBe(SAVE_SCHEMA);
    expect(loaded.value.save.game).toEqual(state);
    expect(loaded.value.migratedFrom).toBeUndefined();
    expect(validateGameState(loaded.value.save.game)).toEqual([]);
  });

  it("migrates only the explicitly supported v0 wrapper", () => {
    const state = createShowcaseGameState();
    const loaded = deserializeGame(
      JSON.stringify({ schema: "syka.world.save.v0", savedAt: "2026-07-16T12:00:00.000Z", state }),
    );
    if (!loaded.ok) throw new Error(loaded.error.message);
    expect(loaded.value.migratedFrom).toBe("syka.world.save.v0");
    expect(loaded.value.save.game).toEqual(state);
  });

  it("explicitly upgrades a pre-mechanics v1 save with safe persistent defaults", () => {
    const current = createProgressiveGameState();
    const legacyGame = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;
    delete legacyGame.worldObjects;
    const progression = legacyGame.progression as Record<string, unknown>;
    delete progression.rewardedMilestones;
    legacyGame.agents = (legacyGame.agents as Array<Record<string, unknown>>).map((agent) => {
      const copy = { ...agent };
      delete copy.location;
      return copy;
    });
    const loaded = deserializeGame(JSON.stringify({
      schema: SAVE_SCHEMA,
      savedAt: "2026-07-16T12:00:00.000Z",
      game: legacyGame,
    }));
    if (!loaded.ok) throw new Error(loaded.error.message);
    expect(loaded.value.migratedFrom).toBe("syka.world.game-state.v1.pre-mechanics");
    expect(loaded.value.save.game.worldObjects).toEqual([]);
    expect(loaded.value.save.game.progression.rewardedMilestones).toContain("building:home-syka");
    expect(loaded.value.save.game.agents.every((agent) => agent.location.kind === "exterior")).toBe(true);
  });

  it("round-trips generated connector roads, removals and completion milestones", () => {
    const initial = createProgressiveGameState();
    const roadCount = initial.map.tiles.filter((tile) => tile.terrain === "road").length;
    const placed = placeBuilding(initial, {
      definitionId: "cafe-library",
      origin: { x: 8, y: 1 },
      orientation: "north",
    });
    if (!placed.ok) throw new Error(placed.error.message);
    const completed = advanceConstruction(placed.value, 360);
    expect(completed.map.tiles.filter((tile) => tile.terrain === "road").length).toBeGreaterThan(roadCount);
    const loaded = deserializeGame(serializeGame(completed, "2026-07-16T12:00:00.000Z"));
    if (!loaded.ok) throw new Error(loaded.error.message);
    expect(loaded.value.save.game).toEqual(completed);
    expect(loaded.value.save.game.progression.rewardedMilestones).toContain("building:building-2");
  });

  it("persists a purchased world object and its exact balance, then cannot refund removal twice", () => {
    const initial = createProgressiveGameState();
    const placed = placeWorldObject(initial, {
      definitionId: "bench",
      hostTile: freeRoadEdge(initial),
    });
    if (!placed.ok) throw new Error(placed.error.message);
    const object = placed.value.worldObjects.find((candidate) => candidate.provenance === "player");
    if (!object) throw new Error("Purchased object fixture is required.");
    const loadedPlaced = deserializeGame(serializeGame(placed.value, "2026-07-16T12:00:00.000Z"));
    if (!loadedPlaced.ok) throw new Error(loadedPlaced.error.message);
    expect(loadedPlaced.value.save.game.economy.balance).toBe(initial.economy.balance - 16);
    expect(loadedPlaced.value.save.game.worldObjects).toContainEqual(object);

    const removed = removeWorldObject(loadedPlaced.value.save.game, object.instanceId);
    if (!removed.ok) throw new Error(removed.error.message);
    const balanceAfterRemoval = removed.value.economy.balance;
    expect(balanceAfterRemoval).toBe(initial.economy.balance - 8);
    const loadedRemoved = deserializeGame(serializeGame(removed.value, "2026-07-16T12:01:00.000Z"));
    if (!loadedRemoved.ok) throw new Error(loadedRemoved.error.message);
    expect(removeWorldObject(loadedRemoved.value.save.game, object.instanceId)).toMatchObject({
      ok: false,
      error: { code: "WORLD_OBJECT_NOT_FOUND" },
    });
    expect(loadedRemoved.value.save.game.economy.balance).toBe(balanceAfterRemoval);
  });

  it("round-trips a local cafe order in transit and its interior anchor/action", () => {
    const placed = placeBuilding(createProgressiveGameState(), {
      definitionId: "cafe-library",
      origin: { x: 8, y: 4 },
      orientation: "north",
    });
    if (!placed.ok) throw new Error(placed.error.message);
    let state = advanceConstruction(placed.value, 360);
    const ordered = issueGoToCafeOrder(state, "default", "read");
    if (!ordered.ok) throw new Error(ordered.error.message);
    const traveling = ordered.value.agents.find((agent) => agent.profileId === "default");
    expect(traveling?.location.kind).toBe("transit");
    const loadedTransit = deserializeGame(serializeGame(ordered.value, "2026-07-16T12:00:00.000Z"));
    if (!loadedTransit.ok) throw new Error(loadedTransit.error.message);
    expect(loadedTransit.value.save.game.agents.find((agent) => agent.profileId === "default")).toEqual(traveling);

    state = loadedTransit.value.save.game;
    for (let minute = 0; minute < 240; minute += 1) {
      state = advanceSimulation(state, 1);
      if (state.agents.find((agent) => agent.profileId === "default")?.localOrder?.phase === "acting") break;
    }
    const acting = state.agents.find((agent) => agent.profileId === "default");
    expect(acting?.location).toMatchObject({
      kind: "interior",
      buildingId: "building-2",
      anchorId: "library-chair",
      action: "read",
    });
    expect(acting?.localOrder?.phase).toBe("acting");
    const loadedInterior = deserializeGame(serializeGame(state, "2026-07-16T12:02:00.000Z"));
    if (!loadedInterior.ok) throw new Error(loadedInterior.error.message);
    expect(loadedInterior.value.save.game.agents.find((agent) => agent.profileId === "default")).toEqual(acting);
  });

  it("rejects invalid world-object hosts and dangling interior agent locations", () => {
    const state = createShowcaseGameState();
    const object = state.worldObjects[0];
    if (!object) throw new Error("Seeded object fixture is required.");
    const road = state.map.tiles.find((tile) => tile.terrain === "road")?.position;
    if (!road) throw new Error("Road fixture is required.");
    const invalidObject = {
      ...state,
      worldObjects: state.worldObjects.map((candidate) =>
        candidate.instanceId === object.instanceId ? { ...candidate, hostTile: road } : candidate,
      ),
    };
    expect(validateGameState(invalidObject)).toContain(`world object ${object.instanceId} host tile is invalid`);

    const invalidLocation = {
      ...state,
      agents: state.agents.map((agent, index) =>
        index === 0
          ? { ...agent, location: { kind: "interior" as const, buildingId: "missing", anchorId: "" } }
          : agent,
      ),
    };
    expect(validateGameState(invalidLocation)).toContain("agent default interior location is invalid");
    expect(deserializeGame(JSON.stringify({
      schema: SAVE_SCHEMA,
      savedAt: "2026-07-16T12:00:00.000Z",
      game: invalidLocation,
    }))).toMatchObject({ ok: false, error: { code: "INVALID_SAVE" } });
  });

  it("rejects corrupt, unknown and structurally invalid saves", () => {
    expect(deserializeGame("not-json")).toEqual(expect.objectContaining({ ok: false }));
    expect(deserializeGame(JSON.stringify({ schema: "syka.world.save.v9" }))).toEqual(expect.objectContaining({ ok: false }));
    const state = createShowcaseGameState();
    const invalid = { schema: SAVE_SCHEMA, savedAt: "2026-07-16T12:00:00.000Z", game: { ...state, economy: { ...state.economy, balance: -1 } } };
    const loaded = deserializeGame(JSON.stringify(invalid));
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe("INVALID_SAVE");
  });

  it("rejects stale saves whose building footprint overlaps a road", () => {
    const state = createShowcaseGameState();
    const home = state.buildings.find((building) => building.id === "home-elen");
    const occupied = home?.occupiedTiles[0];
    expect(occupied).toBeDefined();
    const stale = {
      ...state,
      map: {
        ...state.map,
        tiles: state.map.tiles.map((tile) =>
          tile.position.x === occupied!.x && tile.position.y === occupied!.y
            ? { ...tile, terrain: "road" as const }
            : tile,
        ),
      },
    };
    expect(validateGameState(stale)).toContain("building home-elen footprint is not on buildable terrain");
    const loaded = deserializeGame(JSON.stringify({
      schema: SAVE_SCHEMA,
      savedAt: "2026-07-16T12:00:00.000Z",
      game: stale,
    }));
    expect(loaded.ok).toBe(false);
  });

  it("uses a temporary key for recoverable writes", () => {
    const storage = new MemoryStorage();
    const state = createShowcaseGameState();
    expect(saveGameToStorage(storage, "syka-save", state, "2026-07-16T12:00:00.000Z").ok).toBe(true);
    expect(storage.getItem("syka-save.tmp")).toBeNull();
    const loaded = loadGameFromStorage(storage, "syka-save");
    expect(loaded.ok).toBe(true);

    storage.removeItem("syka-save");
    storage.setItem("syka-save.tmp", serializeGame(state, "2026-07-16T12:00:00.000Z"));
    const recovered = loadGameFromStorage(storage, "syka-save");
    if (!recovered.ok) throw new Error(recovered.error.message);
    expect(recovered.value.recoveredFromTemporary).toBe(true);
  });
});
