import type { GridPoint } from "../../core";
import { computeSpatialDepth, SPATIAL_DEPTH_SUB_LAYER, type SpatialDepthSubLayer } from "../../core";

export const CITY_TILE_WIDTH = 32;
export const CITY_TILE_HEIGHT = 16;
export const CITY_HALF_TILE_WIDTH = CITY_TILE_WIDTH / 2;
export const CITY_HALF_TILE_HEIGHT = CITY_TILE_HEIGHT / 2;
export const CITY_WORLD_ORIGIN = Object.freeze({ x: 900, y: 126 });

export interface CityScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface FractionalGridPoint {
  readonly x: number;
  readonly y: number;
}

export const projectGridTop = (
  gridX: number,
  gridY: number,
  elevation = 0,
  origin: CityScreenPoint = CITY_WORLD_ORIGIN,
): CityScreenPoint => ({
  x: origin.x + (gridX - gridY) * CITY_HALF_TILE_WIDTH,
  y: origin.y + (gridX + gridY) * CITY_HALF_TILE_HEIGHT - elevation,
});

export const projectGridCenter = (
  gridX: number,
  gridY: number,
  elevation = 0,
  origin: CityScreenPoint = CITY_WORLD_ORIGIN,
): CityScreenPoint => {
  const top = projectGridTop(gridX, gridY, elevation, origin);
  return { x: top.x, y: top.y + CITY_HALF_TILE_HEIGHT };
};

export const unprojectWorldPoint = (
  point: CityScreenPoint,
  elevation = 0,
  origin: CityScreenPoint = CITY_WORLD_ORIGIN,
): FractionalGridPoint => {
  const horizontal = (point.x - origin.x) / CITY_HALF_TILE_WIDTH;
  const vertical = (point.y - origin.y - CITY_HALF_TILE_HEIGHT + elevation) / CITY_HALF_TILE_HEIGHT;
  return {
    x: (vertical + horizontal) / 2,
    y: (vertical - horizontal) / 2,
  };
};

export const snapWorldPointToGrid = (
  point: CityScreenPoint,
  elevation = 0,
  origin: CityScreenPoint = CITY_WORLD_ORIGIN,
): GridPoint => {
  const fractional = unprojectWorldPoint(point, elevation, origin);
  return { x: Math.round(fractional.x), y: Math.round(fractional.y) };
};

export const projectFootprint = (
  originPoint: GridPoint,
  width: number,
  height: number,
  elevation = 0,
): readonly CityScreenPoint[] => [
  projectGridTop(originPoint.x, originPoint.y, elevation),
  projectGridTop(originPoint.x + width, originPoint.y, elevation),
  projectGridTop(originPoint.x + width, originPoint.y + height, elevation),
  projectGridTop(originPoint.x, originPoint.y + height, elevation),
];

export const cityDepth = (gridX: number, gridY: number, offset = 0): number =>
  (gridX + gridY) * 100 + offset;

/**
 * Deterministic depth for exterior entities that may occlude actors. Uses the
 * shared `computeSpatialDepth` compositor so trees, lamps, benches and
 * foreground structures interleave correctly with actors passing behind/in
 * front of them. The `subLayer` controls whether the part draws above or
 * below actors at the same cell.
 */
export const cityEntityDepth = (
  gridX: number,
  gridY: number,
  subLayer: SpatialDepthSubLayer = SPATIAL_DEPTH_SUB_LAYER.body,
  offset = 0,
): number =>
  computeSpatialDepth({ cell: { x: gridX, y: gridY }, subLayer, tieBreaker: offset });

export const buildingBasePoint = (
  origin: GridPoint,
  footprint: { readonly width: number; readonly height: number },
): CityScreenPoint => projectGridTop(origin.x + footprint.width, origin.y + footprint.height);
