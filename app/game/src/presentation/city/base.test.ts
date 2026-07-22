import { describe, expect, it } from "vitest";
import { createWorldMap, getTile, paintTerrain } from "../../core";
import {
  createCityBoundaryFencePlan,
  createCityGrassTexturePlan,
  createCityMapSlabGeometry,
} from "./base";

const makeUnlockedMap = (width = 12, height = 12) => createWorldMap(width, height, [
  { id: "meadow-core", name: "Pradera", unlocked: true, unlockCost: 0 },
]);

describe("isometric city base presentation", () => {
  it("builds two visible earth faces and a shadow below the playable diamond", () => {
    const slab = createCityMapSlabGeometry(12, 8, 8);
    expect(slab.outline).toHaveLength(4);
    expect(slab.southeastFace).toHaveLength(4);
    expect(slab.southwestFace).toHaveLength(4);
    expect(slab.shadow).toHaveLength(4);

    expect(slab.southeastFace[2]!.y - slab.southeastFace[1]!.y).toBe(8);
    expect(slab.southwestFace[2]!.y - slab.southwestFace[1]!.y).toBe(8);
    for (let index = 0; index < slab.outline.length; index += 1) {
      expect(slab.shadow[index]!.x).toBe(slab.outline[index]!.x);
      expect(slab.shadow[index]!.y - slab.outline[index]!.y).toBe(11);
    }
  });

  it("adds restrained deterministic grass texture only to free unlocked grass", () => {
    let map = makeUnlockedMap(20, 20);
    map = paintTerrain(map, [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }], "road");
    const once = createCityGrassTexturePlan(map);
    const twice = createCityGrassTexturePlan(map);

    expect(once).toEqual(twice);
    expect(once.length).toBeGreaterThan(60);
    expect(once.length).toBeLessThan(140);
    for (const mark of once) {
      const tile = getTile(map, mark.hostTile);
      expect(tile?.terrain).toBe("grass");
      expect(tile?.buildingId).toBeUndefined();
      expect(Math.abs(mark.position.x - mark.hostTile.x)).toBeLessThanOrEqual(0.106);
      expect(Math.abs(mark.position.y - mark.hostTile.y)).toBeLessThanOrEqual(0.106);
    }
  });

  it("keeps decorative boundary fences away from roads, buildings and explicit objects", () => {
    let map = makeUnlockedMap();
    map = paintTerrain(map, [{ x: 0, y: 0 }, { x: 3, y: 1 }], "road");
    map = {
      ...map,
      tiles: map.tiles.map((tile) => tile.position.x === 2 && tile.position.y === 0
        ? { ...tile, buildingId: "edge-building" }
        : tile),
    };
    const blocked = { x: 1, y: 0 };
    const plan = createCityBoundaryFencePlan(map, [blocked]);
    const hosts = new Set(plan.map((segment) => `${segment.hostTile.x},${segment.hostTile.y}`));

    expect(plan.length).toBeGreaterThan(4);
    expect(hosts.has("0,0")).toBe(false);
    expect(hosts.has("1,0")).toBe(false);
    expect(hosts.has("2,0")).toBe(false);
    expect(hosts.has("3,0")).toBe(false);
    for (const segment of plan) {
      const tile = getTile(map, segment.hostTile);
      expect(tile?.terrain).toBe("grass");
      expect(tile?.buildingId).toBeUndefined();
      expect(
        [0, map.size.width - 1].includes(segment.hostTile.x) ||
        [0, map.size.height - 1].includes(segment.hostTile.y),
      ).toBe(true);
    }
  });
});
