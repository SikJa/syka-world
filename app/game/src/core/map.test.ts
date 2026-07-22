import { describe, expect, it } from "vitest";
import { computePlacementGeometry, createWorldMap, getBuildingDefinition, paintTerrain, validatePlacement } from "./index";

describe("map placement", () => {
  const cafe = getBuildingDefinition("cafe-library");
  if (!cafe) throw new Error("Cafe definition is required by tests.");

  it("rotates footprints and entrances deterministically", () => {
    const north = computePlacementGeometry(cafe, { x: 2, y: 3 }, "north");
    const east = computePlacementGeometry(cafe, { x: 2, y: 3 }, "east");
    expect([north.footprintWidth, north.footprintHeight]).toEqual([5, 4]);
    expect([east.footprintWidth, east.footprintHeight]).toEqual([4, 5]);
    expect(north.accessTile).toEqual({ x: 4, y: 7 });
    expect(east.occupiedTiles).toHaveLength(20);
  });

  it("requires buildable unlocked land and road access", () => {
    let map = createWorldMap(16, 12, [{ id: "meadow-core", name: "Core", unlocked: true, unlockCost: 0 }]);
    map = paintTerrain(map, Array.from({ length: 16 }, (_, x) => ({ x, y: 7 })), "road");
    const result = validatePlacement(map, [], cafe, { x: 2, y: 3 }, "north", 1);
    expect(result.ok).toBe(true);

    const blocked = paintTerrain(map, [{ x: 2, y: 3 }], "water");
    const blockedResult = validatePlacement(blocked, [], cafe, { x: 2, y: 3 }, "north", 1);
    expect(blockedResult.ok).toBe(false);
    if (!blockedResult.ok) expect(blockedResult.error.map((error) => error.code)).toContain("TERRAIN_BLOCKED");
  });

  it("rejects locked sectors and overlapping buildings", () => {
    let map = createWorldMap(24, 12);
    map = paintTerrain(map, Array.from({ length: 24 }, (_, x) => ({ x, y: 7 })), "road");
    const locked = validatePlacement(map, [], cafe, { x: 18, y: 3 }, "north", 3);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error.some((error) => error.code === "SECTOR_LOCKED")).toBe(true);

    const geometry = computePlacementGeometry(cafe, { x: 2, y: 3 }, "north");
    const occupied = {
      id: "existing",
      definitionId: cafe.id,
      kind: cafe.kind,
      origin: { x: 2, y: 3 },
      orientation: "north" as const,
      occupiedTiles: geometry.occupiedTiles,
      entranceTile: geometry.entranceTile,
      accessTile: geometry.accessTile,
      status: "complete" as const,
      construction: { elapsedMinutes: 360, totalMinutes: 360, stageIndex: 3 },
      level: 1,
      visualVariant: cafe.id,
      installedUpgrades: [],
      interiorId: cafe.interiorId,
    };
    const collision = validatePlacement(map, [occupied], cafe, { x: 3, y: 3 }, "north", 3);
    expect(collision.ok).toBe(false);
    if (!collision.ok) expect(collision.error.some((error) => error.code === "COLLISION")).toBe(true);
  });
});
