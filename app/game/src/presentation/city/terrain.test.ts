import { describe, expect, it } from "vitest";
import { createWorldMap, getTile, paintTerrain } from "../../core";
import { selectTerrainVisual } from "./terrain";

describe("city terrain visual selection", () => {
  it("never turns road-adjacent grass into an oversized sidewalk tile", () => {
    let map = createWorldMap(8, 8);
    map = paintTerrain(map, [{ x: 3, y: 3 }, { x: 4, y: 3 }], "road");
    const grass = getTile(map, { x: 3, y: 2 });
    const road = getTile(map, { x: 3, y: 3 });
    expect(grass && [0, 1, 4]).toContain(selectTerrainVisual(map, grass!).frame);
    expect(road && [3, 5, 7]).toContain(selectTerrainVisual(map, road!).frame);
    expect(selectTerrainVisual(map, grass!).frame).not.toBe(2);
  });
});
