import { describe, expect, it } from "vitest";

import {
  NAV_GRID,
  cellKey,
  fillCellRange,
  findSmoothPath,
  isWorldWalkable,
  moveContinuous,
  worldToCell,
} from "./engine";

const occupied = new Set([
  ...fillCellRange(9, 12, 1, 4),
  ...fillCellRange(6, 9, 6, 9),
]);

describe("visual contract hybrid navigation", () => {
  it("derives collision from hidden occupied cells", () => {
    expect(occupied.has(cellKey(worldToCell({ x: 5.75, y: 1.75 })))).toBe(true);
    expect(isWorldWalkable({ x: 5.75, y: 1.75 }, occupied)).toBe(false);
    expect(isWorldWalkable({ x: 6.75, y: 4.5 }, occupied)).toBe(true);
  });

  it("rejects paths whose destination belongs to furniture", () => {
    expect(findSmoothPath({ x: 6.75, y: 4.5 }, { x: 5.75, y: 1.75 }, occupied)).toBeNull();
  });

  it("routes around furniture while returning continuous waypoints", () => {
    const path = findSmoothPath({ x: 6.75, y: 4.5 }, { x: 4.25, y: 1.0 }, occupied);
    expect(path).not.toBeNull();
    expect(path?.length).toBeGreaterThan(0);
    expect(path?.every((point) => isWorldWalkable(point, occupied))).toBe(true);
    expect(path?.at(-1)).toEqual({ x: 4.25, y: 1.0 });
  });

  it("moves by floating point deltas rather than snapping to cell centers", () => {
    const start = { x: 6.75, y: 4.5 };
    const result = moveContinuous(start, { x: 0.031, y: -0.017 }, occupied);
    expect(result.collided).toBe(false);
    expect(result.position.x).toBeCloseTo(6.781);
    expect(result.position.y).toBeCloseTo(4.483);
    const cell = worldToCell(result.position, NAV_GRID);
    expect(result.position).not.toEqual({
      x: NAV_GRID.originX + (cell.x + 0.5) * NAV_GRID.cellSize,
      y: NAV_GRID.originY + (cell.y + 0.5) * NAV_GRID.cellSize,
    });
  });

  it("slides along a blocked cell instead of entering it", () => {
    const start = { x: 6.72, y: 3.2 };
    const result = moveContinuous(start, { x: -0.08, y: -0.02 }, occupied);
    expect(isWorldWalkable(result.position, occupied)).toBe(true);
  });
});
