import { describe, expect, it } from "vitest";
import { INTERIOR_SCHEMA, type InteriorStateV1 } from "../../core";
import {
  CAFE_DECOR_POSITIONS,
  CAFE_DECOR_VISUALS,
  CAFE_HOTSPOTS,
  CAFE_INTERIOR_ANCHORS,
  cafeAnchor,
  cafeFloorCellToNormalized,
  getInteriorLighting,
  optionalFurniture,
  type CafeDecorPlacementVisual,
} from "./interiorModel";

describe("cafe interior presentation model", () => {
  it("keeps day, twilight and night visually distinct", () => {
    expect(getInteriorLighting(12 * 60).period).toBe("day");
    expect(getInteriorLighting(19 * 60).period).toBe("twilight");
    expect(getInteriorLighting(22 * 60).period).toBe("night");
    expect(getInteriorLighting(22 * 60).warmLightAlpha).toBeGreaterThan(
      getInteriorLighting(12 * 60).warmLightAlpha,
    );
  });

  it("defines non-overflowing inspectable regions", () => {
    expect(CAFE_HOTSPOTS).toHaveLength(4);
    for (const hotspot of CAFE_HOTSPOTS) {
      const [x, y, width, height] = hotspot.normalizedRect;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(1);
      expect(y + height).toBeLessThanOrEqual(1);
      expect(hotspot.actions.length).toBeGreaterThan(0);
      expect(hotspot.actions.every((action) => action.agentAction)).toBe(true);
    }
  });

  it("separates optional decor from default furniture", () => {
    const interior: InteriorStateV1 = {
      schema: INTERIOR_SCHEMA,
      buildingId: "cafe-main",
      definitionId: "interior-cafe-library",
      furniture: [
        { instanceId: "counter", furnitureId: "cafe-counter", slotId: "counter" },
        { instanceId: "plant", furnitureId: "fern", slotId: "decor-window" },
      ],
    };
    expect(optionalFurniture(interior).map((item) => item.furnitureId)).toEqual(["fern"]);
  });

  it("maps every optional cafe choice to a tight frame and a semantic room position", () => {
    const choices = [
      ["decor-window", "fern"],
      ["decor-window", "warm-lamp"],
      ["decor-books", "fern"],
      ["decor-books", "notice-board"],
    ] as const;
    for (const [slotId, furnitureId] of choices) {
      expect(CAFE_DECOR_VISUALS[furnitureId].crop[2]).toBeLessThan(512);
      expect(CAFE_DECOR_VISUALS[furnitureId].draw[0]).toBeLessThanOrEqual(24);
      expect(Object.prototype.hasOwnProperty.call(CAFE_DECOR_POSITIONS[slotId], furnitureId)).toBe(true);
      const slotPositions = CAFE_DECOR_POSITIONS[slotId] as Readonly<Record<string, CafeDecorPlacementVisual>>;
      const placement = slotPositions[furnitureId]!;
      expect(placement.normalizedPosition[0]).toBeGreaterThanOrEqual(0);
      expect(placement.normalizedPosition[0]).toBeLessThanOrEqual(1);
      expect(placement.normalizedPosition[1]).toBeGreaterThanOrEqual(0);
      expect(placement.normalizedPosition[1]).toBeLessThanOrEqual(1);
    }
  });

  it("keeps floor plants on reserved floor pockets instead of tables or painted plants", () => {
    const windowFern = CAFE_DECOR_POSITIONS["decor-window"].fern;
    const booksFern = CAFE_DECOR_POSITIONS["decor-books"].fern;
    expect(windowFern.surface).toBe("floor");
    expect(booksFern.surface).toBe("floor");
    expect(windowFern.normalizedPosition[1]).toBeGreaterThanOrEqual(0.76);
    expect(booksFern.normalizedPosition[1]).toBeGreaterThanOrEqual(0.76);
    expect(Math.abs(windowFern.normalizedPosition[0] - booksFern.normalizedPosition[0])).toBeGreaterThan(0.2);
    expect(windowFern.normalizedPosition).toEqual(cafeFloorCellToNormalized(windowFern.spatialCell));
    expect(booksFern.normalizedPosition).toEqual(cafeFloorCellToNormalized(booksFern.spatialCell));
    expect(windowFern.spatialCell).not.toEqual(booksFern.spatialCell);
    expect(windowFern.blocksMovement).toBe(true);
    expect(booksFern.blocksMovement).toBe(true);
    expect(CAFE_DECOR_POSITIONS["decor-window"]["warm-lamp"].spatialCell).toEqual(windowFern.spatialCell);
  });

  it("defines persistent guest anchors and a live bartender station", () => {
    expect(new Set(CAFE_INTERIOR_ANCHORS.map((anchor) => anchor.id)).size).toBe(CAFE_INTERIOR_ANCHORS.length);
    expect(cafeAnchor("bartender-station").role).toBe("npc-service");
    expect(cafeAnchor("missing").id).toBe("entry");
    for (const anchor of CAFE_INTERIOR_ANCHORS) {
      expect(anchor.normalizedPosition[0]).toBeGreaterThanOrEqual(0);
      expect(anchor.normalizedPosition[0]).toBeLessThanOrEqual(1);
      expect(anchor.normalizedPosition[1]).toBeGreaterThanOrEqual(0);
      expect(anchor.normalizedPosition[1]).toBeLessThanOrEqual(1);
    }
  });
});
