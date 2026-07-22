import { describe, expect, it } from "vitest";

import { findTilePath, interpolate, tileKey, type RoomGrid, type Tile } from "./engine";

const room: RoomGrid = { width: 8, height: 7 };
const sofaTiles: readonly Tile[] = [{ x: 4, y: 2 }, { x: 5, y: 2 }];
const occupied = new Set(sofaTiles.map(tileKey));

describe("Habbo contract engine", () => {
  it("never accepts an occupied furniture tile as a destination", () => {
    expect(findTilePath({ x: 4, y: 5 }, { x: 4, y: 2 }, room, occupied)).toBeNull();
    expect(findTilePath({ x: 4, y: 5 }, { x: 5, y: 2 }, room, occupied)).toBeNull();
  });

  it("routes around every tile occupied by the sofa", () => {
    const path = findTilePath({ x: 4, y: 5 }, { x: 4, y: 1 }, room, occupied);
    expect(path).not.toBeNull();
    expect(path?.length).toBeGreaterThan(0);
    expect(path?.some((tile) => occupied.has(tileKey(tile)))).toBe(false);
    expect(path?.at(-1)).toEqual({ x: 4, y: 1 });
  });

  it("interpolates through intermediate visual positions instead of jumping", () => {
    const from = { x: 1.5, y: 1.5 };
    const to = { x: 2.5, y: 1.5 };
    expect(interpolate(from, to, 0)).toEqual(from);
    expect(interpolate(from, to, 1)).toEqual(to);
    const middle = interpolate(from, to, 0.5);
    expect(middle.x).toBeGreaterThan(from.x);
    expect(middle.x).toBeLessThan(to.x);
    expect(middle.y).toBe(from.y);
  });

  it("does not cut diagonally through blocked corners", () => {
    const cornerRoom: RoomGrid = { width: 3, height: 3 };
    const cornerBlocks = new Set([tileKey({ x: 1, y: 0 }), tileKey({ x: 0, y: 1 })]);
    expect(findTilePath({ x: 0, y: 0 }, { x: 1, y: 1 }, cornerRoom, cornerBlocks)).toBeNull();
  });
});
