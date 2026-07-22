import { getTile, pointKey, type GridPoint, type TileV1, type WorldMapV1 } from "../../core";
import { projectGridTop, type CityScreenPoint } from "./projection";

const CARDINALS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

const stableHash = (x: number, y: number, salt = 0): number => {
  let value = Math.imul(x + 137, 73_856_093) ^ Math.imul(y + 251, 19_349_663) ^ Math.imul(salt + 29, 83_492_791);
  value ^= value >>> 13;
  return Math.abs(value | 0);
};

const shiftDown = (point: CityScreenPoint, amount: number): CityScreenPoint => ({
  x: point.x,
  y: point.y + amount,
});

export interface CityMapSlabGeometry {
  readonly outline: readonly CityScreenPoint[];
  readonly shadow: readonly CityScreenPoint[];
  readonly southeastFace: readonly CityScreenPoint[];
  readonly southwestFace: readonly CityScreenPoint[];
}

/** Geometry for a thin raised-earth base under the fixed isometric map. */
export const createCityMapSlabGeometry = (
  width: number,
  height: number,
  thickness = 8,
): CityMapSlabGeometry => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const safeThickness = Math.max(3, Math.round(thickness));
  const outline = [
    projectGridTop(0, 0),
    projectGridTop(safeWidth, 0),
    projectGridTop(safeWidth, safeHeight),
    projectGridTop(0, safeHeight),
  ] as const;
  const [north, east, south, west] = outline;
  return {
    outline,
    shadow: outline.map((point) => shiftDown(point, safeThickness + 3)),
    southeastFace: [east, south, shiftDown(south, safeThickness), shiftDown(east, safeThickness)],
    southwestFace: [south, west, shiftDown(west, safeThickness), shiftDown(south, safeThickness)],
  };
};

export type CityGrassTextureTone = "light" | "deep" | "warm";

export interface CityGrassTextureMark {
  readonly hostTile: GridPoint;
  readonly position: { readonly x: number; readonly y: number };
  readonly tone: CityGrassTextureTone;
  readonly doublePixel: boolean;
}

const sectorUnlocked = (map: WorldMapV1, tile: TileV1): boolean =>
  map.sectors.find((sector) => sector.id === tile.sectorId)?.unlocked === true;

/** Restrained one/two-pixel grass variation; deterministic and non-blocking. */
export const createCityGrassTexturePlan = (map: WorldMapV1): readonly CityGrassTextureMark[] => {
  const marks: CityGrassTextureMark[] = [];
  for (const tile of map.tiles) {
    if (tile.terrain !== "grass" || tile.buildingId !== undefined || !sectorUnlocked(map, tile)) continue;
    const hash = stableHash(tile.position.x, tile.position.y, 211);
    if (hash % 4 !== 0) continue;
    const tone: CityGrassTextureTone = hash % 11 === 0 ? "warm" : hash % 3 === 0 ? "light" : "deep";
    marks.push({
      hostTile: tile.position,
      position: {
        x: tile.position.x + (((hash >>> 2) % 7) - 3) * 0.035,
        y: tile.position.y + (((hash >>> 6) % 7) - 3) * 0.035,
      },
      tone,
      doublePixel: hash % 5 === 0,
    });
  }
  return marks;
};

export type CityBoundarySide = "north" | "east" | "south" | "west";

export interface CityBoundaryFenceSegment {
  readonly hostTile: GridPoint;
  readonly side: CityBoundarySide;
  readonly start: CityScreenPoint;
  readonly end: CityScreenPoint;
}

const hasRoadOrBuildingNeighbor = (map: WorldMapV1, tile: TileV1): boolean =>
  CARDINALS.some((offset) => {
    const neighbor = getTile(map, {
      x: tile.position.x + offset.x,
      y: tile.position.y + offset.y,
    });
    return neighbor !== undefined && (neighbor.terrain === "road" || neighbor.buildingId !== undefined);
  });

const fenceRunAllows = (side: CityBoundarySide, coordinate: number): boolean => {
  const salt = side === "north" ? 0 : side === "east" ? 3 : side === "south" ? 6 : 9;
  // Long, readable runs with regular breathing gaps instead of a hard cage.
  return Math.floor((coordinate + salt) / 4) % 3 !== 2;
};

/**
 * Decorative fence runs sit on the outer map edge only. Roads, current
 * buildings, adjacent entrances and explicit world objects create safe gaps.
 */
export const createCityBoundaryFencePlan = (
  map: WorldMapV1,
  blockedTiles: readonly GridPoint[] = [],
): readonly CityBoundaryFenceSegment[] => {
  const blocked = new Set(blockedTiles.map(pointKey));
  const segments: CityBoundaryFenceSegment[] = [];
  const { width, height } = map.size;

  const add = (tile: TileV1, side: CityBoundarySide, coordinate: number): void => {
    if (
      tile.terrain !== "grass" ||
      tile.buildingId !== undefined ||
      !sectorUnlocked(map, tile) ||
      blocked.has(pointKey(tile.position)) ||
      hasRoadOrBuildingNeighbor(map, tile) ||
      !fenceRunAllows(side, coordinate)
    ) return;

    const { x, y } = tile.position;
    const edge = side === "north"
      ? [projectGridTop(x, 0), projectGridTop(x + 1, 0)]
      : side === "east"
        ? [projectGridTop(width, y), projectGridTop(width, y + 1)]
        : side === "south"
          ? [projectGridTop(x + 1, height), projectGridTop(x, height)]
          : [projectGridTop(0, y + 1), projectGridTop(0, y)];
    segments.push({ hostTile: tile.position, side, start: edge[0]!, end: edge[1]! });
  };

  for (let x = 0; x < width; x += 1) {
    const north = getTile(map, { x, y: 0 });
    const south = getTile(map, { x, y: height - 1 });
    if (north) add(north, "north", x);
    if (south) add(south, "south", x);
  }
  for (let y = 0; y < height; y += 1) {
    const west = getTile(map, { x: 0, y });
    const east = getTile(map, { x: width - 1, y });
    if (east) add(east, "east", y);
    if (west) add(west, "west", y);
  }
  return segments;
};
