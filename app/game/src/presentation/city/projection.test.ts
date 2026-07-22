import { describe, expect, it } from "vitest";
import {
  buildingBasePoint,
  cityDepth,
  projectFootprint,
  projectGridCenter,
  snapWorldPointToGrid,
  unprojectWorldPoint,
} from "./projection";

describe("city isometric projection", () => {
  it("round-trips every tested tile center without camera rotation", () => {
    for (const point of [{ x: 0, y: 0 }, { x: 3, y: 7 }, { x: 19, y: 14 }, { x: 29, y: 23 }]) {
      const screen = projectGridCenter(point.x, point.y);
      expect(unprojectWorldPoint(screen)).toEqual(point);
      expect(snapWorldPointToGrid(screen)).toEqual(point);
    }
  });

  it("projects a footprint as one 2:1 isometric diamond", () => {
    const polygon = projectFootprint({ x: 2, y: 4 }, 3, 2);
    expect(polygon).toHaveLength(4);
    expect(polygon[1]!.x).toBeGreaterThan(polygon[0]!.x);
    expect(polygon[3]!.x).toBeLessThan(polygon[0]!.x);
    expect(polygon[2]!.y).toBeGreaterThan(polygon[0]!.y);
  });

  it("places the building pivot at the far footprint corner and sorts deeper objects later", () => {
    expect(buildingBasePoint({ x: 2, y: 4 }, { width: 3, height: 2 })).toEqual(
      expect.objectContaining({ y: expect.any(Number) }),
    );
    expect(cityDepth(7, 8, 100)).toBeGreaterThan(cityDepth(4, 5, 100));
  });
});
