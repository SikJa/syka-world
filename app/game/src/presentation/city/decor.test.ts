import { describe, expect, it } from "vitest";
import { createWorldMap, getTile, paintTerrain } from "../../core";
import { adjacentRoadTiles, createCityDecorPlan } from "./decor";

const makeCrossMap = () => {
  let map = createWorldMap(12, 12, [
    { id: "meadow-core", name: "Pradera", unlocked: true, unlockCost: 0 },
    { id: "east-gardens", name: "Este", unlocked: true, unlockCost: 0 },
  ]);
  const road = [];
  for (let index = 0; index < 12; index += 1) {
    road.push({ x: index, y: 5 }, { x: 5, y: index });
  }
  map = paintTerrain(map, road, "road");
  return map;
};

describe("city decor placement", () => {
  it("is deterministic", () => {
    const map = makeCrossMap();
    expect(createCityDecorPlan(map)).toEqual(createCityDecorPlan(map));
  });

  it("anchors every lamp and bench on free grass beside a road, never in the carriageway", () => {
    const map = makeCrossMap();
    const furniture = createCityDecorPlan(map).streetFurniture;
    expect(furniture.some((placement) => placement.frame === "streetlamp")).toBe(true);
    expect(furniture.some((placement) => placement.frame === "bench")).toBe(true);
    for (const placement of furniture) {
      const host = getTile(map, placement.hostTile);
      expect(host?.terrain).toBe("grass");
      expect(host?.buildingId).toBeUndefined();
      expect(adjacentRoadTiles(map, placement.hostTile).length).toBeGreaterThan(0);
    }
    const lamps = furniture.filter((placement) => placement.frame === "streetlamp");
    expect(lamps.some((lamp) => adjacentRoadTiles(map, lamp.hostTile).length >= 2)).toBe(true);
    expect(lamps).toHaveLength(1);
    for (const lamp of lamps) {
      const distance = Math.hypot(lamp.position.x - lamp.hostTile.x, lamp.position.y - lamp.hostTile.y);
      expect(distance).toBeGreaterThan(0.15);
      expect(distance).toBeLessThan(0.3);
    }
  });

  it("adds restrained varied detail only over free grass", () => {
    const map = makeCrossMap();
    const details = createCityDecorPlan(map).groundDetails;
    expect(details.length).toBeGreaterThan(2);
    expect(new Set(details.map((detail) => detail.frame)).size).toBeGreaterThan(1);
    for (const detail of details) expect(getTile(map, detail.hostTile)?.terrain).toBe("grass");
  });

  it("adds deterministic non-blocking animal details only over free grass", () => {
    const map = makeCrossMap();
    const ambient = createCityDecorPlan(map).ambientDetails;
    expect(ambient.length).toBeGreaterThanOrEqual(4);
    expect(new Set(ambient.map((detail) => detail.kind)).size).toBeGreaterThan(1);
    expect(new Set(ambient.map((detail) => `${detail.hostTile.x},${detail.hostTile.y}`)).size).toBe(ambient.length);
    for (const detail of ambient) {
      const tile = getTile(map, detail.hostTile);
      expect(tile?.terrain).toBe("grass");
      expect(tile?.buildingId).toBeUndefined();
      expect(detail.phase).toBeGreaterThanOrEqual(0);
      expect(detail.phase).toBeLessThan(1);
    }
  });

  it("keeps animal details off building footprints and placed world objects", () => {
    const map = makeCrossMap();
    const baseline = createCityDecorPlan(map).ambientDetails;
    const buildingTile = baseline[0]?.hostTile;
    const worldObjectTile = baseline[1]?.hostTile;
    expect(buildingTile).toBeDefined();
    expect(worldObjectTile).toBeDefined();

    const occupancy = {
      occupiedTiles: buildingTile ? [buildingTile] : [],
      worldObjects: worldObjectTile ? [{ hostTile: worldObjectTile }] : [],
    };
    const ambient = createCityDecorPlan(map, occupancy).ambientDetails;

    expect(createCityDecorPlan(map, occupancy).ambientDetails).toEqual(ambient);
    expect(ambient.some((detail) => detail.hostTile.x === buildingTile?.x && detail.hostTile.y === buildingTile?.y)).toBe(false);
    expect(ambient.some((detail) => detail.hostTile.x === worldObjectTile?.x && detail.hostTile.y === worldObjectTile?.y)).toBe(false);
    for (const detail of ambient) {
      const tile = getTile(map, detail.hostTile);
      expect(tile?.terrain).toBe("grass");
      expect(tile?.buildingId).toBeUndefined();
    }
  });
});
