import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Scene: class Scene {},
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
      Linear: (start: number, end: number, amount: number) => start + (end - start) * amount,
    },
  },
}));

import { isSpatialCellWalkable } from "../../core";
import {
  CAFE_SPATIAL_ENTITIES,
  cafeAnchorCell,
  cafeCellToNormalized,
  cafeNormalizedToCell,
  compileCafeSpatialScene,
} from "../interior/cafeSpatialModel";
import {
  CAFE_ACTOR_OCCLUSION_REGIONS,
  cafeActorMovementRoute,
  cafeActorVisualSpec,
  cafeForegroundDepth,
} from "./CafeInteriorScene";

describe("cafe character visual calibration", () => {
  it("gives Hermes humans and local NPCs the same visible world height", () => {
    const syka = cafeActorVisualSpec("agent", "syka", "entry", 346);
    const elen = cafeActorVisualSpec("agent", "elen", "entry", 346);
    const alma = cafeActorVisualSpec("npc", "alma-rios", "entry", 346);

    expect(syka.visibleHeight).toBe(48);
    expect(elen.visibleHeight).toBe(syka.visibleHeight);
    expect(alma.visibleHeight).toBe(syka.visibleHeight);
    expect(alma.displayHeight).toBeLessThanOrEqual(54);
    expect(syka.footOriginY).toBeCloseTo(125 / 128, 6);
    expect(alma.footOriginY).toBeCloseTo(156 / 160, 6);
  });

  it("preserves the intentional pet scale instead of stretching every atlas cell equally", () => {
    const syka = cafeActorVisualSpec("agent", "syka", "entry", 346);
    const astrelis = cafeActorVisualSpec("agent", "astrelis", "entry", 346);
    const zerny = cafeActorVisualSpec("agent", "zerny", "entry", 346);

    expect(astrelis.visibleHeight / syka.visibleHeight).toBeCloseTo(0.56, 1);
    expect(zerny.visibleHeight / syka.visibleHeight).toBeCloseTo(0.75, 1);
    expect(astrelis.displayHeight).toBeGreaterThan(astrelis.visibleHeight);
    expect(zerny.displayHeight).toBeGreaterThan(zerny.visibleHeight);
  });

  it("places work, seating and reading poses at their semantic furniture", () => {
    const bartenderCell = cafeAnchorCell("bartender-station");
    const counterCell = cafeAnchorCell("counter");
    const tableCell = cafeAnchorCell("table-seat-1");
    const libraryCell = cafeAnchorCell("library-chair");
    const bartender = cafeActorVisualSpec("npc", "alma-rios", "bartender-station", 346, "serving", bartenderCell);
    const baker = cafeActorVisualSpec("npc", "beni-menta", "counter", 346, "baking", cafeAnchorCell("coffee-machine"));
    const visitor = cafeActorVisualSpec("npc", "noa-junco", "counter", 346, "delivering", counterCell);
    const illustrator = cafeActorVisualSpec("npc", "iara-luz", "table-seat-1", 346, "illustrating", tableCell);
    const reader = cafeActorVisualSpec("npc", "milo-niebla", "library-chair", 346, "reading", libraryCell);

    expect(bartender.stance).toBe("service");
    expect(bartender.normalizedPosition).toEqual(cafeCellToNormalized(bartenderCell));
    expect(baker.stance).toBe("service");
    expect(baker.normalizedPosition).toEqual(cafeCellToNormalized(cafeAnchorCell("coffee-machine")));
    expect(visitor.stance).toBe("standing");
    expect(visitor.normalizedPosition).toEqual(cafeCellToNormalized(counterCell));
    expect(illustrator.stance).toBe("seated");
    expect(illustrator.normalizedPosition).toEqual(cafeCellToNormalized(tableCell));
    expect(reader.stance).toBe("reading");
    expect(reader.normalizedPosition).toEqual(cafeCellToNormalized(libraryCell));
    expect(bartender.shadowAlpha).toBeLessThan(visitor.shadowAlpha);
  });

  it("uses only the bar slice to cover staff feet behind the counter", () => {
    const regions = new Map(CAFE_ACTOR_OCCLUSION_REGIONS.map((region) => [region.entityId, region.normalizedRect]));
    expect([...regions.keys()]).toEqual(["cafe-bar"]);
    const actor = cafeActorVisualSpec(
      "npc",
      "alma-rios",
      "bartender-station",
      346,
      "serving",
      cafeAnchorCell("bartender-station"),
    );
    const [x, y, width] = regions.get("cafe-bar")!;
    const [actorX, feetY] = actor.normalizedPosition;
    const headY = feetY - actor.visibleHeight / 346;
    expect(actorX).toBeGreaterThanOrEqual(x);
    expect(actorX).toBeLessThanOrEqual(x + width);
    expect(y).toBeGreaterThan(headY);
    expect(y).toBeLessThan(feetY);
  });

  it("derives foreground crops and their depth from spatial furniture entities", () => {
    const entityRects = new Map(CAFE_SPATIAL_ENTITIES.flatMap(({ entity, normalizedOcclusionRect }) =>
      normalizedOcclusionRect ? [[entity.id, normalizedOcclusionRect] as const] : []));
    expect(CAFE_ACTOR_OCCLUSION_REGIONS).toHaveLength(entityRects.size);
    for (const region of CAFE_ACTOR_OCCLUSION_REGIONS) {
      expect(region.normalizedRect).toBe(entityRects.get(region.entityId));
    }
    expect([...entityRects.keys()]).toEqual(["cafe-bar"]);
    expect(cafeForegroundDepth(entityRects.get("cafe-bar")!, 74, 336)).toBeGreaterThan(0);
  });

  it("keeps semantic anchors, walkability and raster transforms in one spatial model", () => {
    const scene = compileCafeSpatialScene("cafe-test");
    const entry = cafeAnchorCell("entry");
    const normalized = cafeCellToNormalized(entry);
    expect(scene.definition.id).toBe("cafe:cafe-test");
    expect(isSpatialCellWalkable(scene, entry)).toBe(true);
    expect(cafeNormalizedToCell(normalized[0], normalized[1], scene)).toEqual(entry);
    expect(isSpatialCellWalkable(scene, { x: 3, y: 8 })).toBe(false);
  });

  it("uses restrained perspective scaling from the back wall to the entrance", () => {
    const back = cafeActorVisualSpec("npc", "milo-niebla", "library-chair", 346, "reading");
    const front = cafeActorVisualSpec("npc", "noa-junco", "entry", 346, "delivering");
    expect(back.visibleHeight).toBeLessThan(front.visibleHeight);
    expect(front.visibleHeight - back.visibleHeight).toBeLessThanOrEqual(4);
  });

  it("uses a persisted interior tile ahead of the semantic anchor when one is available", () => {
    const tile = { x: 20, y: 10 };
    const normalized = cafeCellToNormalized(tile);
    const moved = cafeActorVisualSpec("agent", "elen", "entry", 346, undefined, tile);
    expect(moved.normalizedPosition[0]).toBeCloseTo(normalized[0], 6);
    expect(moved.normalizedPosition[1]).toBeCloseTo(normalized[1], 6);
    expect(moved.stance).toBe("walking");
  });

  it("routes large visual anchor changes cell by cell instead of crossing furniture", () => {
    const scene = compileCafeSpatialScene("cafe-test");
    const route = cafeActorMovementRoute(scene, cafeAnchorCell("counter"), cafeAnchorCell("fireplace"));
    expect(route.length).toBeGreaterThan(2);
    expect(route.every((cell) => isSpatialCellWalkable(scene, cell))).toBe(true);
    for (let index = 1; index < route.length; index += 1) {
      const previous = route[index - 1]!;
      const current = route[index]!;
      expect(Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y)).toBe(1);
    }
  });
});
