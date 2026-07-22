import Phaser from "phaser";

export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 16;
export const HALF_TILE_WIDTH = TILE_WIDTH / 2;
export const HALF_TILE_HEIGHT = TILE_HEIGHT / 2;
export const WORLD_ORIGIN = { x: 900, y: 126 } as const;

export interface ScreenPoint {
  x: number;
  y: number;
}

export function isoPoint(gridX: number, gridY: number, elevation = 0): ScreenPoint {
  return {
    x: WORLD_ORIGIN.x + (gridX - gridY) * HALF_TILE_WIDTH,
    y: WORLD_ORIGIN.y + (gridX + gridY) * HALF_TILE_HEIGHT - elevation,
  };
}

export function diamondPoints(gridX: number, gridY: number, elevation = 0): Phaser.Math.Vector2[] {
  const top = isoPoint(gridX, gridY, elevation);
  return [
    new Phaser.Math.Vector2(top.x, top.y),
    new Phaser.Math.Vector2(top.x + HALF_TILE_WIDTH, top.y + HALF_TILE_HEIGHT),
    new Phaser.Math.Vector2(top.x, top.y + TILE_HEIGHT),
    new Phaser.Math.Vector2(top.x - HALF_TILE_WIDTH, top.y + HALF_TILE_HEIGHT),
  ];
}

export function footprintPoints(
  gridX: number,
  gridY: number,
  width: number,
  depth: number,
  elevation = 0,
): Phaser.Math.Vector2[] {
  const top = isoPoint(gridX, gridY, elevation);
  const right = isoPoint(gridX + width, gridY, elevation);
  const bottom = isoPoint(gridX + width, gridY + depth, elevation);
  const left = isoPoint(gridX, gridY + depth, elevation);
  return [top, right, bottom, left].map((point) => new Phaser.Math.Vector2(point.x, point.y));
}

export function depthFor(gridX: number, gridY: number, offset = 0): number {
  return (gridX + gridY) * 100 + offset;
}
