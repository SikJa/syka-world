import { describe, expect, it } from "vitest";
import {
  SPATIAL_SCENE_SCHEMA,
  compileSpatialScene,
  findSpatialPath,
  isSpatialCellWalkable,
  releaseSpatialActor,
  reserveSpatialActor,
  resolveSpatialInteraction,
  resolveSpatialPortal,
  spatialEntityBlockedCells,
  spatialEntityFootprintCells,
  spatialPointKey,
  validateSpatialScene,
  type SpatialEntityV1,
  type SpatialOccupancyV1,
  type SpatialSceneDefinitionV1,
  type SpatialSceneIndexV1,
} from "./index";

const floor = (width: number, height: number) =>
  Array.from({ length: width * height }, (_, index) => ({ x: index % width, y: Math.floor(index / width) }));

export const cafeSpatialFixture = (): SpatialSceneDefinitionV1 => ({
  schema: SPATIAL_SCENE_SCHEMA,
  id: "cafe-library-spatial-test",
  version: 1,
  grid: { width: 8, height: 7 },
  projection: { kind: "isometric-fixed", tileWidth: 32, tileHeight: 16, origin: { x: 320, y: 72 } },
  walkableCells: floor(8, 7),
  entities: [
    {
      id: "entity-north-wall",
      kind: "wall",
      origin: { x: 0, y: 0 },
      orientation: "north",
      footprint: { width: 8, height: 1 },
      blocksMovement: true,
    },
    {
      id: "entity-west-wall-top",
      kind: "wall",
      origin: { x: 0, y: 1 },
      orientation: "north",
      footprint: { width: 1, height: 2 },
      blocksMovement: true,
    },
    {
      id: "entity-door-frame",
      kind: "portal-frame",
      origin: { x: 0, y: 3 },
      orientation: "north",
      footprint: { width: 1, height: 1 },
      blocksMovement: true,
    },
    {
      id: "entity-west-wall-bottom",
      kind: "wall",
      origin: { x: 0, y: 4 },
      orientation: "north",
      footprint: { width: 1, height: 2 },
      blocksMovement: true,
    },
    {
      id: "entity-south-wall",
      kind: "wall",
      origin: { x: 0, y: 6 },
      orientation: "north",
      footprint: { width: 8, height: 1 },
      blocksMovement: true,
    },
    {
      id: "entity-room-divider",
      kind: "counter",
      origin: { x: 3, y: 1 },
      orientation: "north",
      footprint: {
        width: 1,
        height: 5,
        blockedOffsets: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 3 }, { x: 0, y: 4 }],
      },
      blocksMovement: true,
    },
    {
      id: "entity-coffee-machine",
      kind: "workstation",
      origin: { x: 1, y: 1 },
      orientation: "north",
      footprint: { width: 1, height: 1 },
      blocksMovement: true,
    },
    {
      id: "entity-community-table",
      kind: "table",
      origin: { x: 5, y: 2 },
      orientation: "north",
      footprint: { width: 2, height: 2 },
      blocksMovement: true,
      render: { visualKey: "cafe-table", depthRule: "ground-cell", parts: ["body", "front"] },
    },
  ],
  anchors: [
    { id: "anchor-entry", cell: { x: 1, y: 3 }, facing: "west", entityId: "entity-door-frame", reservable: true },
    { id: "anchor-coffee-use", cell: { x: 1, y: 2 }, facing: "north", entityId: "entity-coffee-machine", reservable: true },
    { id: "anchor-seat-1", cell: { x: 5, y: 4 }, facing: "north", entityId: "entity-community-table", reservable: true },
    { id: "anchor-seat-2", cell: { x: 6, y: 4 }, facing: "north", entityId: "entity-community-table", reservable: true },
  ],
  interactions: [
    {
      id: "interaction-brew-coffee",
      entityId: "entity-coffee-machine",
      action: "serve-coffee",
      anchorIds: ["anchor-coffee-use"],
      maxApproachSteps: 1,
      priority: 20,
    },
    {
      id: "interaction-sit-table",
      entityId: "entity-community-table",
      action: "sit",
      anchorIds: ["anchor-seat-1", "anchor-seat-2"],
      maxApproachSteps: 1,
      priority: 10,
    },
  ],
  portals: [
    {
      id: "portal-cafe-exit",
      cell: { x: 0, y: 3 },
      approachAnchorIds: ["anchor-entry"],
      requiredFacing: "west",
      target: { sceneId: "city", portalId: "portal-cafe-main" },
      enabled: true,
    },
  ],
  entryAnchorIds: ["anchor-entry"],
  exitAnchorIds: ["anchor-entry"],
  lighting: "inherit-world-clock",
  assets: [
    { key: "alpha-cafe-interior", role: "structure", provenance: "generated/alpha-v1 manifest" },
  ],
});

const compiledCafe = (): SpatialSceneIndexV1 => {
  const compiled = compileSpatialScene(cafeSpatialFixture());
  if (!compiled.ok) throw new Error(compiled.error.issues.map((issue) => issue.message).join("; "));
  return compiled.value;
};

describe("pure spatial scene contracts", () => {
  it("rotates rectangular footprints and explicit blocked offsets deterministically", () => {
    const entity: SpatialEntityV1 = {
      id: "rotated-shelf",
      kind: "storage",
      origin: { x: 4, y: 5 },
      orientation: "east",
      footprint: { width: 2, height: 3, blockedOffsets: [{ x: 0, y: 0 }, { x: 1, y: 2 }] },
      blocksMovement: true,
    };
    expect(spatialEntityFootprintCells(entity)).toEqual([
      { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 },
      { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 },
    ]);
    expect(spatialEntityBlockedCells(entity)).toEqual([{ x: 6, y: 5 }, { x: 4, y: 6 }]);
  });

  it("compiles walls, furniture, anchors and portals into one walkability index", () => {
    const scene = cafeSpatialFixture();
    expect(validateSpatialScene(scene)).toEqual([]);
    const compiled = compiledCafe();
    expect(compiled.blockedKeys.has("5,2")).toBe(true);
    expect(compiled.blockedKeys.has("3,3")).toBe(false);
    expect(isSpatialCellWalkable(compiled, { x: 5, y: 2 })).toBe(false);
    expect(isSpatialCellWalkable(compiled, { x: 3, y: 3 })).toBe(true);
    expect(compiled.anchorsById.get("anchor-entry")?.cell).toEqual({ x: 1, y: 3 });
    expect(compiled.portalsById.get("portal-cafe-exit")?.target.sceneId).toBe("city");
  });

  it("rejects blocked anchors, overlapping blockers and dangling references", () => {
    const scene = cafeSpatialFixture();
    const invalid: SpatialSceneDefinitionV1 = {
      ...scene,
      entities: [
        ...scene.entities,
        {
          id: "entity-overlap",
          kind: "plant",
          origin: { x: 5, y: 2 },
          orientation: "north",
          footprint: { width: 1, height: 1 },
          blocksMovement: true,
        },
      ],
      anchors: [...scene.anchors, { id: "anchor-blocked", cell: { x: 5, y: 2 }, reservable: true }],
      interactions: [...scene.interactions, {
        id: "interaction-dangling",
        entityId: "missing",
        action: "read",
        anchorIds: ["missing"],
        maxApproachSteps: 1,
      }],
    };
    const codes = validateSpatialScene(invalid).map((issue) => issue.code);
    expect(codes).toContain("BLOCKED_OVERLAP");
    expect(codes).toContain("UNWALKABLE_ANCHOR");
    expect(codes).toContain("UNKNOWN_REFERENCE");
    expect(compileSpatialScene(invalid)).toMatchObject({ ok: false, error: { code: "INVALID_SCENE" } });
  });
});

describe("shared occupancy and cardinal interior pathfinding", () => {
  it("reserves cells and anchors without self-blocking, then releases them", () => {
    const scene = compiledCafe();
    let occupancy: SpatialOccupancyV1 = { reservations: [] };
    const first = reserveSpatialActor(scene, occupancy, {
      actorId: "syka",
      kind: "current",
      cell: { x: 5, y: 4 },
      anchorId: "anchor-seat-1",
    });
    if (!first.ok) throw new Error(first.error.message);
    occupancy = first.value;
    const selfDestination = reserveSpatialActor(scene, occupancy, {
      actorId: "syka",
      kind: "destination",
      cell: { x: 5, y: 4 },
      anchorId: "anchor-seat-1",
    });
    expect(selfDestination.ok).toBe(true);
    const blocked = reserveSpatialActor(scene, occupancy, {
      actorId: "elen",
      kind: "destination",
      cell: { x: 5, y: 4 },
      anchorId: "anchor-seat-1",
    });
    expect(blocked).toMatchObject({ ok: false, error: { code: "ANCHOR_OCCUPIED" } });
    occupancy = releaseSpatialActor(occupancy, "syka");
    expect(reserveSpatialActor(scene, occupancy, {
      actorId: "elen",
      kind: "current",
      cell: { x: 5, y: 4 },
      anchorId: "anchor-seat-1",
    }).ok).toBe(true);
  });

  it("returns the same shortest cardinal route through the divider opening", () => {
    const scene = compiledCafe();
    const first = findSpatialPath(scene, { x: 1, y: 5 }, { x: 6, y: 5 }, { actorId: "syka" });
    const second = findSpatialPath(scene, { x: 1, y: 5 }, { x: 6, y: 5 }, { actorId: "syka" });
    expect(first).toEqual(second);
    if (!first.ok) throw new Error(first.error.message);
    expect(first.value).toContainEqual({ x: 3, y: 3 });
    for (const point of first.value) expect(scene.blockedKeys.has(spatialPointKey(point))).toBe(false);
  });

  it("distinguishes blocked, occupied and unreachable destinations", () => {
    const scene = compiledCafe();
    expect(findSpatialPath(scene, { x: 1, y: 5 }, { x: 5, y: 2 })).toMatchObject({
      ok: false,
      error: { code: "INVALID_DESTINATION" },
    });
    const occupied: SpatialOccupancyV1 = {
      reservations: [{ actorId: "elen", kind: "current", cell: { x: 2, y: 5 } }],
    };
    expect(findSpatialPath(scene, { x: 1, y: 5 }, { x: 2, y: 5 }, { occupancy: occupied, actorId: "syka" })).toMatchObject({
      ok: false,
      error: { code: "DESTINATION_OCCUPIED" },
    });

    const definition = cafeSpatialFixture();
    const sealed = compileSpatialScene({
      ...definition,
      entities: definition.entities.map((entity) =>
        entity.id === "entity-room-divider"
          ? { ...entity, footprint: { width: 1, height: 5 } }
          : entity,
      ),
    });
    if (!sealed.ok) throw new Error(sealed.error.message);
    expect(findSpatialPath(sealed.value, { x: 1, y: 5 }, { x: 6, y: 5 })).toMatchObject({
      ok: false,
      error: { code: "NO_PATH" },
    });
  });

  it("lets E resolve only a free interaction on the same or adjacent anchor", () => {
    const scene = compiledCafe();
    const near = resolveSpatialInteraction(scene, { reservations: [] }, "syka", { x: 1, y: 3 });
    expect(near).toMatchObject({
      ok: true,
      value: { interactionId: "interaction-brew-coffee", anchorId: "anchor-coffee-use", action: "serve-coffee" },
    });
    if (!near.ok) throw new Error(near.error.message);
    expect(near.value.path).toEqual([{ x: 1, y: 3 }, { x: 1, y: 2 }]);
    expect(resolveSpatialInteraction(scene, { reservations: [] }, "syka", { x: 1, y: 6 })).toMatchObject({
      ok: false,
      error: { code: "NO_REACHABLE_INTERACTION" },
    });
    const reserved: SpatialOccupancyV1 = {
      reservations: [{
        actorId: "elen",
        kind: "current",
        cell: { x: 1, y: 2 },
        anchorId: "anchor-coffee-use",
      }],
    };
    expect(resolveSpatialInteraction(scene, reserved, "syka", { x: 1, y: 3 })).toMatchObject({ ok: false });
  });

  it("lets F resolve only while standing at and facing an enabled portal approach", () => {
    const scene = compiledCafe();
    expect(resolveSpatialPortal(scene, { x: 1, y: 3 }, "west")).toMatchObject({
      ok: true,
      value: { portalId: "portal-cafe-exit", target: { sceneId: "city", portalId: "portal-cafe-main" } },
    });
    expect(resolveSpatialPortal(scene, { x: 1, y: 3 }, "east")).toMatchObject({
      ok: false,
      error: { code: "NO_PORTAL_IN_FRONT" },
    });
    expect(resolveSpatialPortal(scene, { x: 1, y: 4 }, "west")).toMatchObject({ ok: false });
  });
});
