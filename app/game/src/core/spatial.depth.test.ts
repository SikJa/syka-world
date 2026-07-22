import { describe, expect, it } from "vitest";
import {
  SPATIAL_DEPTH_BASE,
  SPATIAL_DEPTH_SUB_LAYER,
  SPATIAL_SCENE_SCHEMA,
  compileSpatialScene,
  computeSpatialDepth,
  findSpatialPath,
  isSpatialCellWalkable,
  reserveSpatialActor,
  resolveSpatialInteraction,
  spatialEntityBlockedCells,
  spatialEntityFootprintCells,
  spatialRenderPartDepth,
  validateSpatialScene,
  validateSpatialPlacement,
  type SpatialEntityV1,
  type SpatialRenderPartV1,
  type SpatialSceneDefinitionV1,
} from "./index";

const allFloor = (width: number, height: number) =>
  Array.from({ length: width * height }, (_, index) => ({ x: index % width, y: Math.floor(index / width) }));

const minimalScene = (overrides: Partial<SpatialSceneDefinitionV1> = {}): SpatialSceneDefinitionV1 => ({
  schema: SPATIAL_SCENE_SCHEMA,
  id: "depth-test-scene",
  version: 1,
  grid: { width: 6, height: 6 },
  projection: { kind: "isometric-fixed", tileWidth: 32, tileHeight: 16, origin: { x: 0, y: 0 } },
  walkableCells: allFloor(6, 6),
  entities: [],
  anchors: [],
  interactions: [],
  portals: [],
  entryAnchorIds: [],
  exitAnchorIds: [],
  lighting: "inherit-world-clock",
  assets: [],
  ...overrides,
});

describe("computeSpatialDepth — deterministic depth ordering", () => {
  it("returns a stable integer for the same input", () => {
    const a = computeSpatialDepth({ cell: { x: 3, y: 4 }, elevation: 0, subLayer: SPATIAL_DEPTH_SUB_LAYER.actor });
    const b = computeSpatialDepth({ cell: { x: 3, y: 4 }, elevation: 0, subLayer: SPATIAL_DEPTH_SUB_LAYER.actor });
    expect(a).toBe(b);
  });

  it("orders farther-back cells first (smaller depth = drawn earlier)", () => {
    const back = computeSpatialDepth({ cell: { x: 0, y: 0 }, subLayer: SPATIAL_DEPTH_SUB_LAYER.body });
    const front = computeSpatialDepth({ cell: { x: 5, y: 5 }, subLayer: SPATIAL_DEPTH_SUB_LAYER.body });
    expect(back).toBeLessThan(front);
  });

  it("elevation dominates sub-layer so stairs sort above ground furniture", () => {
    const groundFront = computeSpatialDepth({ cell: { x: 5, y: 5 }, elevation: 0, subLayer: SPATIAL_DEPTH_SUB_LAYER.front });
    const raisedBack = computeSpatialDepth({ cell: { x: 0, y: 0 }, elevation: 1, subLayer: SPATIAL_DEPTH_SUB_LAYER.back });
    expect(raisedBack).toBeGreaterThan(groundFront);
  });

  it("at the same cell, back < body < actor < front < overlay", () => {
    const cell = { x: 2, y: 2 };
    const back = computeSpatialDepth({ cell, subLayer: SPATIAL_DEPTH_SUB_LAYER.back });
    const body = computeSpatialDepth({ cell, subLayer: SPATIAL_DEPTH_SUB_LAYER.body });
    const actor = computeSpatialDepth({ cell, subLayer: SPATIAL_DEPTH_SUB_LAYER.actor });
    const front = computeSpatialDepth({ cell, subLayer: SPATIAL_DEPTH_SUB_LAYER.front });
    const overlay = computeSpatialDepth({ cell, subLayer: SPATIAL_DEPTH_SUB_LAYER.overlay });
    expect(back).toBeLessThan(body);
    expect(body).toBeLessThan(actor);
    expect(actor).toBeLessThan(front);
    expect(front).toBeLessThan(overlay);
  });

  it("tie-breaker disambiguates entities at the same cell", () => {
    const cell = { x: 2, y: 2 };
    const a = computeSpatialDepth({ cell, tieBreaker: 0 });
    const b = computeSpatialDepth({ cell, tieBreaker: 1 });
    expect(a).toBeLessThan(b);
  });
});

describe("spatialRenderPartDepth — multi-part furniture", () => {
  const counter: SpatialEntityV1 = {
    id: "counter",
    kind: "service-counter",
    origin: { x: 2, y: 3 },
    orientation: "north",
    footprint: { width: 4, height: 2 },
    blocksMovement: true,
    render: { visualKey: "counter", depthRule: "ground-cell" },
  };

  it("orders back part below actor, front part above actor at the same cell", () => {
    const backPart: SpatialRenderPartV1 = { role: "back" };
    const frontPart: SpatialRenderPartV1 = { role: "front" };
    const actorDepth = computeSpatialDepth({
      cell: counter.origin,
      subLayer: SPATIAL_DEPTH_SUB_LAYER.actor,
    });
    const backDepth = spatialRenderPartDepth(counter, backPart);
    const frontDepth = spatialRenderPartDepth(counter, frontPart);
    expect(backDepth).toBeLessThan(actorDepth);
    expect(frontDepth).toBeGreaterThan(actorDepth);
  });
});

describe("elevation-aware pathfinding", () => {
  it("climbs a single-step elevation", () => {
    const scene: SpatialSceneDefinitionV1 = minimalScene({
      id: "stairs-test",
      heightMap: {
        kind: "per-cell",
        elevations: [
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
          0, 0, 1, 1, 0, 0,
          0, 0, 1, 1, 0, 0,
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
        ],
      },
    });
    const compiled = compileSpatialScene(scene);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const path = findSpatialPath(compiled.value, { x: 0, y: 0 }, { x: 3, y: 3 });
    expect(path.ok).toBe(true);
  });

  it("rejects a cliff taller than maxElevationStep", () => {
    const scene: SpatialSceneDefinitionV1 = minimalScene({
      id: "cliff-test",
      heightMap: {
        kind: "per-cell",
        elevations: [
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
          0, 0, 3, 3, 0, 0,
          0, 0, 3, 3, 0, 0,
          0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
        ],
      },
    });
    const compiled = compileSpatialScene(scene);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const path = findSpatialPath(compiled.value, { x: 0, y: 0 }, { x: 3, y: 3 }, { maxElevationStep: 1 });
    expect(path.ok).toBe(false);
  });
});

describe("anchor reservation capacity", () => {
  it("rejects a second actor at the same anchor with ANCHOR_OCCUPIED when capacity is 1 (default)", () => {
    const scene: SpatialSceneDefinitionV1 = minimalScene({
      id: "capacity-test",
      anchors: [
        { id: "bench", cell: { x: 2, y: 2 }, reservable: true },
      ],
    });
    const compiled = compileSpatialScene(scene);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const occ1 = reserveSpatialActor(compiled.value, { reservations: [] }, {
      actorId: "a1", kind: "current", cell: { x: 2, y: 2 }, anchorId: "bench",
    });
    expect(occ1.ok).toBe(true);
    if (!occ1.ok) return;
    // Anchor occupancy is checked before cell ownership; capacity 1 means the
    // second actor is rejected with ANCHOR_OCCUPIED, matching the v1 contract.
    const occ2 = reserveSpatialActor(compiled.value, occ1.value, {
      actorId: "a2", kind: "current", cell: { x: 2, y: 2 }, anchorId: "bench",
    });
    expect(occ2.ok).toBe(false);
    if (occ2.ok) return;
    expect(occ2.error.code).toBe("ANCHOR_OCCUPIED");
  });

  it("reserves separate seats of a two-seat sofa without conflict", () => {
    const scene: SpatialSceneDefinitionV1 = minimalScene({
      id: "sofa-test",
      entities: [{
        id: "sofa",
        kind: "sofa",
        origin: { x: 2, y: 2 },
        orientation: "north",
        footprint: { width: 2, height: 1 },
        blocksMovement: true,
      }],
      anchors: [
        { id: "sofa-seat-1", cell: { x: 2, y: 3 }, entityId: "sofa", reservable: true },
        { id: "sofa-seat-2", cell: { x: 3, y: 3 }, entityId: "sofa", reservable: true },
      ],
    });
    const compiled = compileSpatialScene(scene);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const occ1 = reserveSpatialActor(compiled.value, { reservations: [] }, {
      actorId: "a1", kind: "current", cell: { x: 2, y: 3 }, anchorId: "sofa-seat-1",
    });
    expect(occ1.ok).toBe(true);
    if (!occ1.ok) return;
    const occ2 = reserveSpatialActor(compiled.value, occ1.value, {
      actorId: "a2", kind: "current", cell: { x: 3, y: 3 }, anchorId: "sofa-seat-2",
    });
    expect(occ2.ok).toBe(true);
  });
});

describe("validateSpatialPlacement — editor slice", () => {
  it("accepts a free-standing entity on ground", () => {
    const scene = minimalScene({ id: "place-test" });
    const compiled = compileSpatialScene(scene);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const entity: SpatialEntityV1 = {
      id: "fern",
      kind: "plant",
      origin: { x: 3, y: 3 },
      orientation: "north",
      footprint: { width: 1, height: 1 },
      blocksMovement: true,
    };
    const result = validateSpatialPlacement(compiled.value, { entity, surface: "ground" });
    expect(result.ok).toBe(true);
  });

  it("rejects placement overlapping a blocking entity", () => {
    const blocker: SpatialEntityV1 = {
      id: "table",
      kind: "table",
      origin: { x: 3, y: 3 },
      orientation: "north",
      footprint: { width: 2, height: 2 },
      blocksMovement: true,
    };
    const scene = minimalScene({ id: "overlap-test", entities: [blocker] });
    const compiled = compileSpatialScene(scene);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const entity: SpatialEntityV1 = {
      id: "chair",
      kind: "seat",
      origin: { x: 4, y: 4 },
      orientation: "north",
      footprint: { width: 1, height: 1 },
      blocksMovement: true,
    };
    const result = validateSpatialPlacement(compiled.value, { entity, surface: "ground" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("BLOCKED_OVERLAP");
  });

  it("rejects on-entity placement on a non-stackable host", () => {
    const host: SpatialEntityV1 = {
      id: "rug",
      kind: "rug",
      origin: { x: 1, y: 1 },
      orientation: "north",
      footprint: { width: 2, height: 2 },
      blocksMovement: false,
      stackable: false,
    };
    const scene = minimalScene({ id: "stack-test", entities: [host] });
    const compiled = compileSpatialScene(scene);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const entity: SpatialEntityV1 = {
      id: "lamp",
      kind: "lamp",
      origin: { x: 1, y: 1 },
      orientation: "north",
      footprint: { width: 1, height: 1 },
      blocksMovement: false,
    };
    const result = validateSpatialPlacement(compiled.value, {
      entity, surface: "on-entity", onEntityId: "rug",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_STACKABLE");
  });

  it("accepts on-entity placement on a stackable host within height", () => {
    const host: SpatialEntityV1 = {
      id: "shelf",
      kind: "shelf",
      origin: { x: 1, y: 1 },
      orientation: "north",
      footprint: { width: 2, height: 1 },
      blocksMovement: true,
      stackable: true,
      elevation: 0,
      placementSurface: "on-entity",
    };
    const scene = minimalScene({
      id: "stack-ok",
      entities: [host],
      placementConstraints: [{ entityKind: "plant", surface: "on-entity", maxStackHeight: 2 }],
    });
    const compiled = compileSpatialScene(scene);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const entity: SpatialEntityV1 = {
      id: "potted-plant",
      kind: "plant",
      origin: { x: 1, y: 1 },
      orientation: "north",
      footprint: { width: 1, height: 1 },
      blocksMovement: false,
    };
    const result = validateSpatialPlacement(compiled.value, {
      entity, surface: "on-entity", onEntityId: "shelf",
    });
    expect(result.ok).toBe(true);
  });
});

describe("validation of extended contracts", () => {
  it("rejects a height map with wrong length", () => {
    const scene = minimalScene({
      id: "bad-height",
      heightMap: { kind: "per-cell", elevations: [0, 0, 0] },
    });
    const issues = validateSpatialScene(scene);
    expect(issues.some((i) => i.code === "INVALID_HEIGHT_MAP")).toBe(true);
  });

  it("rejects a render part with an out-of-range normalized rect", () => {
    const entity: SpatialEntityV1 = {
      id: "bad-part",
      kind: "counter",
      origin: { x: 0, y: 0 },
      orientation: "north",
      footprint: { width: 1, height: 1 },
      blocksMovement: true,
      render: {
        visualKey: "bad",
        depthRule: "ground-cell",
        partsV2: [{ role: "front", normalizedRect: [-0.1, 0, 0.5, 0.5] }],
      },
    };
    const scene = minimalScene({ id: "bad-part-scene", entities: [entity] });
    const issues = validateSpatialScene(scene);
    expect(issues.some((i) => i.code === "INVALID_RENDER_PART")).toBe(true);
  });
});

describe("footprint and blocked cells — extended offsets", () => {
  it("exposes walkableOffsets as projected cells for arches/bridges", () => {
    const arch: SpatialEntityV1 = {
      id: "arch",
      kind: "arch",
      origin: { x: 2, y: 2 },
      orientation: "north",
      footprint: { width: 1, height: 1, walkableOffsets: [{ x: 0, y: 0 }] },
      blocksMovement: false,
    };
    const cells = spatialEntityFootprintCells(arch);
    expect(cells).toEqual([{ x: 2, y: 2 }]);
  });
});
