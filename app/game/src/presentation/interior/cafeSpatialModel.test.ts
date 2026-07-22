import { describe, expect, it } from "vitest";
import {
  EMPTY_SPATIAL_OCCUPANCY,
  createManualControlState,
  findSpatialPath,
  INTERIOR_SCHEMA,
  isSpatialCellWalkable,
  resolveSpatialInteraction,
  resolveSpatialPortal,
  spatialEntityBlockedCells,
  type InteriorStateV1,
} from "../../core";
import {
  CAFE_SPATIAL_ENTITIES,
  cafeAnchorCell,
  cafeCellToNormalized,
  cafeOptionalDecorSignature,
  cafeNormalizedToCell,
  compileCafeSpatialScene,
  createCafeOptionalDecorEntities,
  createCafeSpatialScene,
  createCafeSpatialActorSeeds,
  isCafeAuthoredSafeCell,
} from "./cafeSpatialModel";
import { createShowcaseGameState } from "../../core";
import { CAFE_DECOR_POSITIONS } from "./interiorModel";

const decoratedInterior = (
  furniture: InteriorStateV1["furniture"],
): InteriorStateV1 => ({
  schema: INTERIOR_SCHEMA,
  buildingId: "cafe-main",
  definitionId: "interior-cafe-library",
  furniture,
});

describe("Café Biblioteca spatial model", () => {
  it("compiles one safe-floor/depth contract over the approved raster", () => {
    const scene = compileCafeSpatialScene("cafe-main");
    expect(scene.definition.id).toBe("cafe:cafe-main");
    expect(scene.definition.version).toBe(2);
    expect(scene.definition.assets[0]?.provenance).toContain("approved");
    expect(CAFE_SPATIAL_ENTITIES.filter((item) => item.normalizedOcclusionRect).map((item) => item.entity.id))
      .toEqual(["cafe-bar"]);
    expect(CAFE_SPATIAL_ENTITIES.every((item) => !item.entity.blocksMovement)).toBe(true);
  });

  it("admits only the authored empty-floor corridors", () => {
    const scene = compileCafeSpatialScene("cafe-main");
    expect(isSpatialCellWalkable(scene, { x: 4, y: 9 })).toBe(false);
    expect(isSpatialCellWalkable(scene, { x: 15, y: 6 })).toBe(false);
    expect(isSpatialCellWalkable(scene, { x: 22, y: 10 })).toBe(false);
    expect(isSpatialCellWalkable(scene, { x: 12, y: 14 })).toBe(false);
    const path = findSpatialPath(scene, cafeAnchorCell("entry"), cafeAnchorCell("counter"));
    expect(path.ok).toBe(true);
    if (!path.ok) return;
    expect(path.value.every((cell) => isSpatialCellWalkable(scene, cell))).toBe(true);
  });

  it("keeps every guest interaction anchor reachable from the entrance", () => {
    const scene = compileCafeSpatialScene("cafe-main");
    for (const anchorId of [
      "counter",
      "table-seat-1",
      "table-seat-2",
      "table-seat-3",
      "library-chair",
      "fireplace",
    ]) {
      const path = findSpatialPath(scene, cafeAnchorCell("entry"), cafeAnchorCell(anchorId));
      expect(path.ok, `${anchorId} should be reachable`).toBe(true);
    }
  });

  it("keeps one guest component and one deliberately isolated staff island", () => {
    const scene = compileCafeSpatialScene("cafe-main");
    const entry = cafeAnchorCell("entry");
    expect(entry).toEqual({ x: 16, y: 17 });
    expect(isSpatialCellWalkable(scene, { x: 16, y: 16 })).toBe(true);

    const staffOrigin = cafeAnchorCell("coffee-machine");
    const staffCells = scene.definition.walkableCells
      .filter((cell) => isSpatialCellWalkable(scene, cell))
      .filter((cell) => !findSpatialPath(scene, entry, cell).ok);
    expect(staffCells).toHaveLength(18);
    expect(staffCells.every((cell) => findSpatialPath(scene, staffOrigin, cell).ok)).toBe(true);
    expect(findSpatialPath(scene, entry, cafeAnchorCell("coffee-machine")).ok).toBe(false);
    expect(findSpatialPath(scene, cafeAnchorCell("coffee-machine"), cafeAnchorCell("bartender-station")).ok).toBe(true);

    for (const trapped of [
      { x: 30, y: 2 },
      { x: 30, y: 3 },
      { x: 30, y: 4 },
      { x: 22, y: 13 },
    ]) {
      expect(isSpatialCellWalkable(scene, trapped), `${trapped.x},${trapped.y} must not trap actors`).toBe(false);
    }
  });

  it("keeps optional floor decor in display pockets outside the guest aisle", () => {
    const interior = decoratedInterior([
      { instanceId: "window-fern", furnitureId: "fern", slotId: "decor-window" },
      { instanceId: "books-fern", furnitureId: "fern", slotId: "decor-books" },
    ]);
    const base = compileCafeSpatialScene("cafe-main");
    const decorated = compileCafeSpatialScene("cafe-main", interior);
    const windowCell = CAFE_DECOR_POSITIONS["decor-window"].fern.spatialCell;
    const booksCell = CAFE_DECOR_POSITIONS["decor-books"].fern.spatialCell;
    const staticBlocked = new Set(CAFE_SPATIAL_ENTITIES.flatMap(({ entity }) =>
      spatialEntityBlockedCells(entity).map((cell) => `${cell.x},${cell.y}`)));

    expect(staticBlocked.has(`${windowCell.x},${windowCell.y}`)).toBe(false);
    expect(staticBlocked.has(`${booksCell.x},${booksCell.y}`)).toBe(false);
    expect(isSpatialCellWalkable(base, windowCell)).toBe(false);
    expect(isSpatialCellWalkable(base, booksCell)).toBe(false);
    expect(isSpatialCellWalkable(decorated, windowCell)).toBe(false);
    expect(isSpatialCellWalkable(decorated, booksCell)).toBe(false);

    const entities = createCafeOptionalDecorEntities(interior).map(({ entity }) => entity);
    expect(entities.map((entity) => entity.id)).toEqual([
      "cafe-decor:window-fern",
      "cafe-decor:books-fern",
    ]);
    expect(entities.every((entity) =>
      entity.blocksMovement &&
      entity.footprint.width === 1 &&
      entity.footprint.height === 1 &&
      entity.tags?.includes("floor-standing"))).toBe(true);
  });

  it("keeps routes and every semantic anchor reachable after both decor slots are occupied", () => {
    const interior = decoratedInterior([
      { instanceId: "window-lamp", furnitureId: "warm-lamp", slotId: "decor-window" },
      { instanceId: "books-fern", furnitureId: "fern", slotId: "decor-books" },
    ]);
    const scene = compileCafeSpatialScene("cafe-main", interior);
    expect(isSpatialCellWalkable(scene, CAFE_DECOR_POSITIONS["decor-window"]["warm-lamp"].spatialCell)).toBe(false);
    for (const anchorId of [
      "counter",
      "table-seat-1",
      "table-seat-2",
      "table-seat-3",
      "library-chair",
      "fireplace",
    ]) {
      const path = findSpatialPath(scene, cafeAnchorCell("entry"), cafeAnchorCell(anchorId));
      expect(path.ok, `${anchorId} should remain reachable with decor installed`).toBe(true);
    }
    expect(findSpatialPath(scene, cafeAnchorCell("coffee-machine"), cafeAnchorCell("bartender-station")).ok).toBe(true);
  });

  it("keeps wall decoration addressable without consuming a floor cell", () => {
    const interior = decoratedInterior([
      { instanceId: "books-board", furnitureId: "notice-board", slotId: "decor-books" },
    ]);
    const entity = createCafeOptionalDecorEntities(interior)[0]!.entity;
    const scene = compileCafeSpatialScene("cafe-main", interior);
    expect(entity.kind).toBe("optional-wall-decor");
    expect(entity.blocksMovement).toBe(false);
    expect(scene.blockedKeys.has(`${entity.origin.x},${entity.origin.y}`)).toBe(false);
  });

  it("changes the topology signature when optional furniture is installed or replaced", () => {
    const empty = decoratedInterior([]);
    const fern = decoratedInterior([
      { instanceId: "window-fern", furnitureId: "fern", slotId: "decor-window" },
    ]);
    const lamp = decoratedInterior([
      { instanceId: "window-lamp", furnitureId: "warm-lamp", slotId: "decor-window" },
    ]);
    expect(cafeOptionalDecorSignature(empty)).not.toBe(cafeOptionalDecorSignature(fern));
    expect(cafeOptionalDecorSignature(fern)).not.toBe(cafeOptionalDecorSignature(lamp));
  });

  it("resolves E and F only from valid contextual anchors", () => {
    const scene = compileCafeSpatialScene("cafe-main");
    const interaction = resolveSpatialInteraction(
      scene,
      EMPTY_SPATIAL_OCCUPANCY,
      "default",
      cafeAnchorCell("counter"),
    );
    expect(interaction.ok && interaction.value.action).toBe("serve-coffee");
    const portal = resolveSpatialPortal(scene, cafeAnchorCell("entry"), "south");
    expect(portal.ok && portal.value.target.sceneId).toBe("city");
    expect(resolveSpatialPortal(scene, cafeAnchorCell("entry"), "north").ok).toBe(false);
  });

  it("round-trips authored anchor positions through pointer conversion", () => {
    const scene = compileCafeSpatialScene("cafe-main");
    for (const anchorId of ["entry", "counter", "library-chair", "fireplace"] as const) {
      const cell = cafeAnchorCell(anchorId);
      const normalized = cafeCellToNormalized(cell);
      expect(cafeNormalizedToCell(normalized[0], normalized[1], scene)).toEqual(cell);
    }
  });

  it("keeps the portal target tied to the concrete building instance", () => {
    const definition = createCafeSpatialScene("building-17");
    expect(definition.portals[0]?.target.portalId).toBe("building:building-17");
  });

  it("seeds only actors physically inside this concrete café", () => {
    const state = createShowcaseGameState();
    const cafe = state.buildings.find((building) => building.kind === "cafe")!;
    const seeded = {
      ...state,
      agents: state.agents.map((agent, index) => index === 0
        ? { ...agent, location: { kind: "interior" as const, buildingId: cafe.id, anchorId: "entry" } }
        : agent),
    };
    const seeds = createCafeSpatialActorSeeds(seeded, cafe.id);
    expect(seeds.some((seed) => seed.actorId === "default" && seed.possessible)).toBe(true);
    expect(seeds.every((seed) => seed.sceneId === `cafe:${cafe.id}`)).toBe(true);
    expect(createManualControlState(compileCafeSpatialScene(cafe.id), seeds).ok).toBe(true);
  });

  it("rejects stale persisted tiles from the former broad furniture grid", () => {
    const state = createShowcaseGameState();
    const cafe = state.buildings.find((building) => building.kind === "cafe")!;
    const staleTile = { x: 24, y: 8 };
    expect(isCafeAuthoredSafeCell(staleTile)).toBe(false);
    const seeded = {
      ...state,
      agents: state.agents.map((agent, index) => index === 0
        ? {
            ...agent,
            location: {
              kind: "interior" as const,
              buildingId: cafe.id,
              anchorId: "entry",
              tile: staleTile,
            },
          }
        : agent),
    };
    const seed = createCafeSpatialActorSeeds(seeded, cafe.id).find((candidate) => candidate.actorId === "default");
    expect(seed?.cell).toEqual(cafeAnchorCell("entry"));
  });
});
