import { describe, expect, it } from "vitest";
import { createBlankGameState, paintTerrain } from "../../core";
import { createPlacementPreview } from "./placement";

describe("city placement preview", () => {
  it("matches the core placement rules for a valid road-facing home", () => {
    let state = createBlankGameState({ mode: "progressive", width: 12, height: 12 });
    state = { ...state, map: paintTerrain(state.map, [{ x: 4, y: 5 }], "road") };
    const preview = createPlacementPreview(state, "home-cozy", { x: 2, y: 2 }, "north");
    expect(preview.valid).toBe(true);
    expect(preview.occupiedTiles).toHaveLength(12);
    expect(preview.accessTile).toEqual({ x: 4, y: 5 });
    expect(preview.costs.total).toBe(110);
  });

  it("returns invalid visual information without mutating state", () => {
    const state = createBlankGameState({ mode: "progressive", width: 12, height: 12 });
    const before = JSON.stringify(state);
    const preview = createPlacementPreview(state, "home-cozy", { x: 2, y: 2 }, "north");
    expect(preview.valid).toBe(false);
    expect(preview.errors).toContain("NO_EXISTING_ROAD");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("shows the exact automatic road and cost before commit", () => {
    let state = createBlankGameState({ mode: "progressive", width: 12, height: 12 });
    state = { ...state, map: paintTerrain(state.map, [{ x: 4, y: 8 }], "road") };
    const preview = createPlacementPreview(state, "home-cozy", { x: 2, y: 2 }, "north");
    expect(preview.valid).toBe(true);
    expect(preview.roadTiles.length).toBeGreaterThan(0);
    expect(preview.costs.road).toBe(preview.roadTiles.length * 3);
    expect(preview.costs.total).toBe(preview.costs.building + preview.costs.road + preview.costs.cleanup);
  });

  it("reports an unknown definition safely", () => {
    const state = createBlankGameState();
    expect(createPlacementPreview(state, "missing", { x: 1, y: 1 }, "north").errors).toEqual([
      "UNKNOWN_DEFINITION",
    ]);
  });
});
