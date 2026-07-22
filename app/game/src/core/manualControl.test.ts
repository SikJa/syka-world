import { describe, expect, it } from "vitest";
import {
  SPATIAL_SCENE_SCHEMA,
  advanceManualActorStep,
  compileSpatialScene,
  createManualControlState,
  finishContextInteraction,
  issueSelectedClickMove,
  manualActorAt,
  possessSelectedActor,
  releasePossessedActor,
  reconcileManualControlState,
  requestContextInteraction,
  requestPortalUse,
  requestPossessedStep,
  screenRelativeDirectionForKey,
  screenRelativeNeighbourForKey,
  selectManualActor,
  type GridPoint,
  type ManualControlStateV1,
  type ManualSpatialActorSeedV1,
  type SpatialSceneDefinitionV1,
  type SpatialSceneIndexV1,
} from "./index";

const floor = (width: number, height: number): readonly GridPoint[] =>
  Array.from({ length: width * height }, (_, index) => ({
    x: index % width,
    y: Math.floor(index / width),
  }));

const manualSceneDefinition = (): SpatialSceneDefinitionV1 => ({
  schema: SPATIAL_SCENE_SCHEMA,
  id: "manual-control-test-cafe",
  version: 1,
  grid: { width: 7, height: 6 },
  projection: { kind: "isometric-fixed", tileWidth: 32, tileHeight: 16, origin: { x: 280, y: 64 } },
  walkableCells: floor(7, 6),
  entities: [
    {
      id: "north-wall",
      kind: "wall",
      origin: { x: 0, y: 0 },
      orientation: "north",
      footprint: { width: 7, height: 1 },
      blocksMovement: true,
    },
    {
      id: "south-wall",
      kind: "wall",
      origin: { x: 0, y: 5 },
      orientation: "north",
      footprint: { width: 7, height: 1 },
      blocksMovement: true,
    },
    {
      id: "west-wall-top",
      kind: "wall",
      origin: { x: 0, y: 1 },
      orientation: "north",
      footprint: { width: 1, height: 2 },
      blocksMovement: true,
    },
    {
      id: "door-frame",
      kind: "portal-frame",
      origin: { x: 0, y: 3 },
      orientation: "north",
      footprint: { width: 1, height: 1 },
      blocksMovement: true,
    },
    {
      id: "west-wall-bottom",
      kind: "wall",
      origin: { x: 0, y: 4 },
      orientation: "north",
      footprint: { width: 1, height: 1 },
      blocksMovement: true,
    },
    {
      id: "room-divider",
      kind: "counter",
      origin: { x: 3, y: 1 },
      orientation: "north",
      footprint: {
        width: 1,
        height: 4,
        blockedOffsets: [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
      },
      blocksMovement: true,
    },
    {
      id: "coffee-machine",
      kind: "workstation",
      origin: { x: 1, y: 1 },
      orientation: "north",
      footprint: { width: 1, height: 1 },
      blocksMovement: true,
    },
    {
      id: "reading-table",
      kind: "table",
      origin: { x: 5, y: 1 },
      orientation: "north",
      footprint: { width: 1, height: 1 },
      blocksMovement: true,
    },
  ],
  anchors: [
    { id: "entry-anchor", cell: { x: 1, y: 3 }, facing: "west", entityId: "door-frame", reservable: true },
    { id: "coffee-anchor", cell: { x: 1, y: 2 }, facing: "north", entityId: "coffee-machine", reservable: true },
    { id: "reading-anchor", cell: { x: 5, y: 2 }, facing: "north", entityId: "reading-table", reservable: true },
  ],
  interactions: [
    {
      id: "brew-coffee",
      entityId: "coffee-machine",
      action: "serve-coffee",
      anchorIds: ["coffee-anchor"],
      maxApproachSteps: 1,
      priority: 20,
    },
    {
      id: "read-book",
      entityId: "reading-table",
      action: "read",
      anchorIds: ["reading-anchor"],
      maxApproachSteps: 1,
      priority: 10,
    },
  ],
  portals: [
    {
      id: "cafe-exit",
      cell: { x: 0, y: 3 },
      approachAnchorIds: ["entry-anchor"],
      requiredFacing: "west",
      target: { sceneId: "city", portalId: "cafe-main-door" },
      enabled: true,
    },
  ],
  entryAnchorIds: ["entry-anchor"],
  exitAnchorIds: ["entry-anchor"],
  lighting: "inherit-world-clock",
  assets: [],
});

const manualScene = (): SpatialSceneIndexV1 => {
  const compiled = compileSpatialScene(manualSceneDefinition());
  if (!compiled.ok) throw new Error(compiled.error.issues.map((issue) => issue.message).join("; "));
  return compiled.value;
};

const seed = (
  actorId: string,
  cell: GridPoint,
  overrides: Partial<ManualSpatialActorSeedV1> = {},
): ManualSpatialActorSeedV1 => ({
  actorId,
  sceneId: "manual-control-test-cafe",
  possessible: true,
  cell,
  facing: "west",
  ...overrides,
});

const createState = (
  scene: SpatialSceneIndexV1,
  seeds: readonly ManualSpatialActorSeedV1[],
): ManualControlStateV1 => {
  const created = createManualControlState(scene, seeds);
  if (!created.ok) throw new Error(created.error.message);
  return created.value;
};

const selected = (state: ManualControlStateV1, actorId: string): ManualControlStateV1 => {
  const result = selectManualActor(state, actorId);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("screen-relative manual control", () => {
  it("maps WASD to exactly one deterministic cardinal neighbour", () => {
    const origin = { x: 4, y: 4 };
    expect(screenRelativeDirectionForKey("W")).toBe("north");
    expect(screenRelativeDirectionForKey("a")).toBe("west");
    expect(screenRelativeDirectionForKey("S")).toBe("south");
    expect(screenRelativeDirectionForKey("d")).toBe("east");
    expect(screenRelativeNeighbourForKey(origin, "w")).toEqual({ x: 4, y: 3 });
    expect(screenRelativeNeighbourForKey(origin, "a")).toEqual({ x: 3, y: 4 });
    expect(screenRelativeNeighbourForKey(origin, "s")).toEqual({ x: 4, y: 5 });
    expect(screenRelativeNeighbourForKey(origin, "d")).toEqual({ x: 5, y: 4 });
  });

  it("selects only known actors and possesses only an explicitly possessible actor", () => {
    const scene = manualScene();
    const initial = createState(scene, [
      seed("syka", { x: 1, y: 3 }),
      seed("barista", { x: 5, y: 3 }, { possessible: false }),
    ]);
    expect(selectManualActor(initial, "missing")).toMatchObject({ ok: false, error: { code: "UNKNOWN_ACTOR" } });

    const npcSelected = selected(initial, "barista");
    expect(possessSelectedActor(npcSelected)).toMatchObject({ ok: false, error: { code: "NOT_POSSESSIBLE" } });

    const sykaSelected = selected(initial, "syka");
    const possessed = possessSelectedActor(sykaSelected);
    expect(possessed).toMatchObject({
      ok: true,
      value: { possessedActorId: "syka" },
    });
    if (!possessed.ok) throw new Error(possessed.error.message);
    expect(manualActorAt(possessed.value, "syka")).toMatchObject({
      cell: { x: 1, y: 3 },
      path: [{ x: 1, y: 3 }],
      intent: "possessed",
    });
    expect(issueSelectedClickMove(scene, possessed.value, { x: 2, y: 3 })).toMatchObject({
      ok: false,
      error: { code: "POSSESSION_ACTIVE" },
    });
  });

  it("queues one WASD step, ignores key-repeat through an explicit error, and releases at the real cell", () => {
    const scene = manualScene();
    const initial = selected(createState(scene, [seed("syka", { x: 1, y: 3 })]), "syka");
    const possessed = possessSelectedActor(initial);
    if (!possessed.ok) throw new Error(possessed.error.message);

    const south = requestPossessedStep(scene, possessed.value, "s");
    if (!south.ok) throw new Error(south.error.message);
    expect(manualActorAt(south.value, "syka")).toMatchObject({
      facing: "south",
      path: [{ x: 1, y: 3 }, { x: 1, y: 4 }],
    });
    expect(requestPossessedStep(scene, south.value, "s")).toMatchObject({
      ok: false,
      error: { code: "MOVE_IN_PROGRESS" },
    });

    const steppedSouth = advanceManualActorStep(scene, south.value, "syka");
    if (!steppedSouth.ok) throw new Error(steppedSouth.error.message);
    const east = requestPossessedStep(scene, steppedSouth.value, "d");
    if (!east.ok) throw new Error(east.error.message);
    const steppedEast = advanceManualActorStep(scene, east.value, "syka");
    if (!steppedEast.ok) throw new Error(steppedEast.error.message);
    expect(manualActorAt(steppedEast.value, "syka")?.cell).toEqual({ x: 2, y: 4 });

    const released = releasePossessedActor(steppedEast.value);
    expect(released).toMatchObject({ ok: true, value: { selectedActorId: "syka" } });
    if (!released.ok) throw new Error(released.error.message);
    expect(released.value.possessedActorId).toBeUndefined();
    expect(manualActorAt(released.value, "syka")).toMatchObject({
      cell: { x: 2, y: 4 },
      intent: "hold",
    });
  });
});

describe("click movement and actor reservations", () => {
  it("rejects blocked and occupied targets and replaces a previous destination reservation", () => {
    const scene = manualScene();
    const withNpc = selected(createState(scene, [
      seed("syka", { x: 1, y: 3 }),
      seed("barista", { x: 5, y: 4 }, { possessible: false }),
    ]), "syka");
    expect(issueSelectedClickMove(scene, withNpc, { x: 3, y: 4 })).toMatchObject({
      ok: false,
      error: { code: "INVALID_DESTINATION" },
    });
    expect(issueSelectedClickMove(scene, withNpc, { x: 5, y: 4 })).toMatchObject({
      ok: false,
      error: { code: "DESTINATION_OCCUPIED" },
    });

    const alone = selected(createState(scene, [seed("syka", { x: 1, y: 3 })]), "syka");
    const first = issueSelectedClickMove(scene, alone, { x: 5, y: 4 });
    if (!first.ok) throw new Error(first.error.message);
    expect(first.value.occupancy.reservations).toContainEqual({
      actorId: "syka",
      kind: "destination",
      cell: { x: 5, y: 4 },
    });
    const replacement = issueSelectedClickMove(scene, first.value, { x: 2, y: 4 });
    if (!replacement.ok) throw new Error(replacement.error.message);
    expect(replacement.value.occupancy.reservations).not.toContainEqual(expect.objectContaining({
      actorId: "syka",
      kind: "destination",
      cell: { x: 5, y: 4 },
    }));
    expect(replacement.value.occupancy.reservations).toContainEqual({
      actorId: "syka",
      kind: "destination",
      cell: { x: 2, y: 4 },
    });
  });

  it("advances a click path one cardinal cell at a time and releases its destination on arrival", () => {
    const scene = manualScene();
    let state = selected(createState(scene, [seed("syka", { x: 1, y: 4 })]), "syka");
    const issued = issueSelectedClickMove(scene, state, { x: 5, y: 4 });
    if (!issued.ok) throw new Error(issued.error.message);
    state = issued.value;

    let previous = manualActorAt(state, "syka")!.cell;
    let guard = 0;
    while (manualActorAt(state, "syka")!.path.length > 1 && guard < 20) {
      const advanced = advanceManualActorStep(scene, state, "syka");
      if (!advanced.ok) throw new Error(advanced.error.message);
      state = advanced.value;
      const current = manualActorAt(state, "syka")!.cell;
      expect(Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y)).toBe(1);
      previous = current;
      guard += 1;
    }

    expect(guard).toBeGreaterThan(0);
    expect(manualActorAt(state, "syka")).toMatchObject({
      cell: { x: 5, y: 4 },
      path: [{ x: 5, y: 4 }],
      intent: "hold",
    });
    expect(state.occupancy.reservations).not.toContainEqual(expect.objectContaining({
      actorId: "syka",
      kind: "destination",
    }));
  });

  it("faces an authored portal when click movement reaches its approach anchor", () => {
    const scene = manualScene();
    let state = selected(createState(scene, [seed("syka", { x: 2, y: 4 }, { facing: "south" })]), "syka");
    const issued = issueSelectedClickMove(scene, state, { x: 1, y: 3 });
    if (!issued.ok) throw new Error(issued.error.message);
    state = issued.value;
    while (manualActorAt(state, "syka")!.path.length > 1) {
      const advanced = advanceManualActorStep(scene, state, "syka");
      if (!advanced.ok) throw new Error(advanced.error.message);
      state = advanced.value;
    }
    expect(manualActorAt(state, "syka")).toMatchObject({
      cell: { x: 1, y: 3 },
      facing: "west",
    });
    expect(requestPortalUse(scene, state)).toMatchObject({ ok: true });
  });

  it("prevents two actors from reserving or ending in the same cell", () => {
    const scene = manualScene();
    let state = selected(createState(scene, [
      seed("syka", { x: 1, y: 4 }),
      seed("elen", { x: 2, y: 1 }),
    ]), "syka");
    const sykaMove = issueSelectedClickMove(scene, state, { x: 5, y: 4 });
    if (!sykaMove.ok) throw new Error(sykaMove.error.message);
    state = selected(sykaMove.value, "elen");
    expect(issueSelectedClickMove(scene, state, { x: 5, y: 4 })).toMatchObject({
      ok: false,
      error: { code: "DESTINATION_OCCUPIED" },
    });

    while (manualActorAt(state, "syka")!.path.length > 1) {
      const advanced = advanceManualActorStep(scene, state, "syka");
      if (!advanced.ok) throw new Error(advanced.error.message);
      state = advanced.value;
    }
    expect(manualActorAt(state, "syka")?.cell).toEqual({ x: 5, y: 4 });
    expect(manualActorAt(state, "elen")?.cell).not.toEqual({ x: 5, y: 4 });
    expect(issueSelectedClickMove(scene, state, { x: 5, y: 4 })).toMatchObject({
      ok: false,
      error: { code: "DESTINATION_OCCUPIED" },
    });
  });
});

describe("scene refresh reconciliation", () => {
  it("preserves an in-flight controlled route across a newer scene version", () => {
    const originalScene = manualScene();
    let state = selected(createState(originalScene, [
      seed("syka", { x: 1, y: 4 }),
      seed("barista", { x: 5, y: 3 }, { possessible: false }),
    ]), "syka");
    const issued = issueSelectedClickMove(originalScene, state, { x: 5, y: 4 });
    if (!issued.ok) throw new Error(issued.error.message);
    state = issued.value;
    const routeBefore = manualActorAt(state, "syka")!.path;
    const refreshedDefinition = { ...manualSceneDefinition(), version: 2 };
    const compiled = compileSpatialScene(refreshedDefinition);
    if (!compiled.ok) throw new Error(compiled.error.message);

    const reconciled = reconcileManualControlState(compiled.value, state, [
      seed("syka", { x: 2, y: 2 }),
      seed("barista", { x: 5, y: 3 }, { possessible: false }),
    ], { preserveActorIds: ["syka"] });

    expect(reconciled.ok).toBe(true);
    if (!reconciled.ok) throw new Error(reconciled.error.message);
    expect(manualActorAt(reconciled.value, "syka")).toMatchObject({
      cell: { x: 1, y: 4 },
      path: routeBefore,
      destination: { x: 5, y: 4 },
      intent: "manual-click",
    });
    expect(reconciled.value.selectedActorId).toBe("syka");
  });

  it("deterministically relocates an autonomous seed away from a controlled route and destination", () => {
    const originalScene = manualScene();
    let state = selected(createState(originalScene, [seed("syka", { x: 1, y: 4 })]), "syka");
    const issued = issueSelectedClickMove(originalScene, state, { x: 5, y: 4 });
    if (!issued.ok) throw new Error(issued.error.message);
    state = issued.value;
    const controlledPath = manualActorAt(state, "syka")!.path;
    const refreshed = compileSpatialScene({ ...manualSceneDefinition(), version: 2 });
    if (!refreshed.ok) throw new Error(refreshed.error.message);
    const seeds = [
      seed("syka", { x: 1, y: 4 }),
      seed("barista", { x: 5, y: 4 }, { possessible: false }),
    ];

    const first = reconcileManualControlState(refreshed.value, state, seeds, { preserveActorIds: ["syka"] });
    const second = reconcileManualControlState(refreshed.value, state, seeds, { preserveActorIds: ["syka"] });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const firstCell = manualActorAt(first.value, "barista")?.cell;
    const secondCell = manualActorAt(second.value, "barista")?.cell;
    expect(firstCell).toEqual(secondCell);
    expect(firstCell).toBeDefined();
    expect(controlledPath).not.toContainEqual(firstCell);
    expect(new Set(first.value.occupancy.reservations.map((reservation) =>
      `${reservation.cell.x},${reservation.cell.y}`,
    )).size).toBe(first.value.occupancy.reservations.length);
    expect(manualActorAt(first.value, "syka")?.path).toEqual(controlledPath);
  });
});

describe("context interaction and portal requests", () => {
  it("lets E reserve only a same-cell or adjacent free anchor", () => {
    const scene = manualScene();
    let state = selected(createState(scene, [
      seed("syka", { x: 1, y: 3 }),
      seed("elen", { x: 2, y: 2 }),
    ]), "syka");
    const sykaInteraction = requestContextInteraction(scene, state);
    if (!sykaInteraction.ok) throw new Error(sykaInteraction.error.message);
    expect(sykaInteraction.value.interaction).toMatchObject({
      interactionId: "brew-coffee",
      action: "serve-coffee",
      anchorId: "coffee-anchor",
      path: [{ x: 1, y: 3 }, { x: 1, y: 2 }],
    });
    expect(sykaInteraction.value.state.occupancy.reservations).toContainEqual({
      actorId: "syka",
      kind: "destination",
      cell: { x: 1, y: 2 },
      anchorId: "coffee-anchor",
    });

    state = selected(sykaInteraction.value.state, "elen");
    expect(requestContextInteraction(scene, state)).toMatchObject({
      ok: false,
      error: { code: "NO_REACHABLE_INTERACTION" },
    });

    const arrived = advanceManualActorStep(scene, state, "syka");
    if (!arrived.ok) throw new Error(arrived.error.message);
    expect(manualActorAt(arrived.value, "syka")).toMatchObject({
      cell: { x: 1, y: 2 },
      intent: "interaction",
      pendingInteraction: { interactionId: "brew-coffee", anchorId: "coffee-anchor" },
    });
    const finished = finishContextInteraction(scene, arrived.value, "syka");
    if (!finished.ok) throw new Error(finished.error.message);
    expect(finished.value.occupancy.reservations).toContainEqual({
      actorId: "syka",
      kind: "current",
      cell: { x: 1, y: 2 },
    });
    expect(finished.value.occupancy.reservations.some((reservation) => reservation.anchorId === "coffee-anchor")).toBe(false);
    expect(manualActorAt(finished.value, "syka")?.pendingInteraction).toBeUndefined();
  });

  it("does not let E pull an actor across the room", () => {
    const scene = manualScene();
    const state = selected(createState(scene, [seed("syka", { x: 6, y: 4 })]), "syka");
    expect(requestContextInteraction(scene, state)).toMatchObject({
      ok: false,
      error: { code: "NO_REACHABLE_INTERACTION" },
    });
  });

  it("lets F resolve only from a stationary portal approach with the required facing", () => {
    const scene = manualScene();
    const valid = selected(createState(scene, [seed("syka", { x: 1, y: 3 }, { facing: "west" })]), "syka");
    expect(requestPortalUse(scene, valid)).toMatchObject({
      ok: true,
      value: {
        actorId: "syka",
        portal: { portalId: "cafe-exit", target: { sceneId: "city", portalId: "cafe-main-door" } },
      },
    });

    const wrongFacing = selected(createState(scene, [seed("syka", { x: 1, y: 3 }, { facing: "east" })]), "syka");
    expect(requestPortalUse(scene, wrongFacing)).toMatchObject({
      ok: false,
      error: { code: "NO_PORTAL_IN_FRONT" },
    });
    const wrongCell = selected(createState(scene, [seed("syka", { x: 1, y: 4 }, { facing: "west" })]), "syka");
    expect(requestPortalUse(scene, wrongCell)).toMatchObject({ ok: false, error: { code: "NO_PORTAL_IN_FRONT" } });

    const moving = issueSelectedClickMove(scene, valid, { x: 2, y: 4 });
    if (!moving.ok) throw new Error(moving.error.message);
    expect(requestPortalUse(scene, moving.value)).toMatchObject({ ok: false, error: { code: "MOVE_IN_PROGRESS" } });
  });
});
