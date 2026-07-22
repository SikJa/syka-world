import { describe, expect, it, vi } from "vitest";

// The tests exercise the exported, presentation-only math helpers. Phaser's
// browser renderer is intentionally not booted in this unit environment.
vi.mock("phaser", () => ({ default: { Scene: class Scene {} } }));

import {
  CITY_AGENT_VISUAL_CALIBRATIONS,
  CITY_CAFE_NPC_VISUAL_SPEC,
  advanceCityAgentVisual,
  cityAgentAnimationState,
  cityAgentEntryState,
  cityButterflyVisualState,
  cityCafeNpcFrameName,
} from "./CityScene";

describe("city presentation motion", () => {
  it("crosses both axes of an isometric tile without per-frame rounding stalls", () => {
    const target = { x: 16, y: 8 };
    let current = { x: 0, y: 0 };
    const samples: { x: number; y: number }[] = [];

    for (let frame = 0; frame < 60; frame += 1) {
      const step = advanceCityAgentVisual(current, target, 1_000 / 60, 1);
      current = { x: step.x, y: step.y };
      samples.push(current);
    }

    expect(samples[0]?.x).toBeGreaterThan(0);
    expect(samples[0]?.y).toBeGreaterThan(0);
    expect(current.x).toBe(target.x);
    expect(current.y).toBe(target.y);
  });

  it("caps a delayed frame instead of teleporting and scales normal travel with clock speed", () => {
    const target = { x: 16, y: 8 };
    const delayed = advanceCityAgentVisual({ x: 0, y: 0 }, target, 2_000, 1);
    expect(Math.hypot(delayed.x, delayed.y)).toBeLessThanOrEqual(1.281);

    const normal = advanceCityAgentVisual({ x: 0, y: 0 }, target, 16, 1);
    const fast = advanceCityAgentVisual({ x: 0, y: 0 }, target, 16, 4);
    expect(Math.hypot(fast.x, fast.y)).toBeCloseTo(Math.hypot(normal.x, normal.y) * 4, 6);
  });

  it("keeps butterfly drift deterministic, bounded and visibly flapping", () => {
    const baseline = cityButterflyVisualState(2_345, 0.37);
    expect(cityButterflyVisualState(2_345, 0.37)).toEqual(baseline);

    const samples = Array.from({ length: 9 }, (_, index) =>
      cityButterflyVisualState(index * 110, 0.37),
    );
    expect(new Set(samples.map((sample) => sample.flapFrame))).toEqual(new Set([0, 1, 2]));
    for (const sample of samples) {
      expect(Math.abs(sample.offsetX)).toBeLessThanOrEqual(6.5);
      expect(sample.offsetY).toBeGreaterThanOrEqual(-6.9);
      expect(sample.offsetY).toBeLessThanOrEqual(-1.1);
    }
    expect(cityButterflyVisualState(4_000, 0.1)).not.toEqual(cityButterflyVisualState(4_000, 0.6));
  });

  it("normalizes the four unequal atlas silhouettes around one grounded scale", () => {
    const calibrations = Object.values(CITY_AGENT_VISUAL_CALIBRATIONS);
    expect(calibrations).toHaveLength(4);
    for (const calibration of calibrations) {
      expect(calibration.displayWidth).toBeGreaterThanOrEqual(18);
      expect(calibration.footOriginY).toBeGreaterThanOrEqual(0.89);
      expect(calibration.footOriginY).toBeLessThan(1);
      expect(calibration.shadowWidth).toBeGreaterThan(calibration.shadowHeight);
      expect(calibration.markerY).toBeLessThanOrEqual(-34);
    }

    // Astrelis and Zerny occupy substantially less of their source cells, so
    // their full cells must be drawn larger to match the humanoid silhouettes.
    expect(CITY_AGENT_VISUAL_CALIBRATIONS.astrelis.displayHeight)
      .toBeGreaterThan(CITY_AGENT_VISUAL_CALIBRATIONS.syka.displayHeight);
    expect(CITY_AGENT_VISUAL_CALIBRATIONS.zerny.displayHeight)
      .toBeGreaterThan(CITY_AGENT_VISUAL_CALIBRATIONS.elen.displayHeight);
  });

  it("uses a stable two-pose walk cycle while keeping idle feet planted", () => {
    expect(cityAgentAnimationState(1_000, false, 0)).toEqual({
      frameActivity: "idle",
      liftY: 0,
      shadowScaleX: 1,
      shadowAlpha: 0.3,
    });

    const cycle = [0, 170, 340, 510].map((time) => cityAgentAnimationState(time, true, 0));
    expect(cycle.map((state) => state.frameActivity)).toEqual([
      "done",
      "done",
      "interrupted",
      "interrupted",
    ]);
    expect(cycle.map((state) => state.liftY)).toEqual([0, 1, 0, 1]);
    expect(cycle[1]?.shadowScaleX).toBeLessThan(cycle[0]?.shadowScaleX ?? 0);
  });

  it("finishes building entry with a short monotonic fade instead of a pop", () => {
    const start = cityAgentEntryState(0);
    const middle = cityAgentEntryState(0.5);
    const end = cityAgentEntryState(1);

    expect(start).toEqual({ alpha: 1, scale: 1, liftY: 0 });
    expect(middle.alpha).toBeLessThan(start.alpha);
    expect(middle.alpha).toBeGreaterThan(end.alpha);
    expect(middle.scale).toBeLessThan(start.scale);
    expect(middle.liftY).toBeGreaterThan(start.liftY);
    expect(end).toEqual({ alpha: 0, scale: 0.84, liftY: 4 });
    expect(cityAgentEntryState(Number.NaN)).toEqual(start);
  });

  it("keeps travelling cafe NPCs slightly smaller than the exterior profiles", () => {
    const visibleNpcHeight = CITY_CAFE_NPC_VISUAL_SPEC.displayHeight * (152 / 160);
    const visibleSykaHeight = CITY_AGENT_VISUAL_CALIBRATIONS.syka.displayHeight * (116 / 128);
    expect(visibleNpcHeight).toBeGreaterThan(25);
    expect(visibleNpcHeight).toBeLessThan(visibleSykaHeight);
    expect(CITY_CAFE_NPC_VISUAL_SPEC.displayWidth).toBeLessThan(CITY_CAFE_NPC_VISUAL_SPEC.displayHeight);
    expect(CITY_CAFE_NPC_VISUAL_SPEC.footOriginY).toBeCloseTo(0.975, 5);
    expect(cityCafeNpcFrameName("alma-rios", "walking")).toBe("cafe-npc-alma-rios-walking");
  });

  it("lets two-tile-per-minute NPC travel catch up without changing agent speed", () => {
    const target = { x: 32, y: 16 };
    const agent = advanceCityAgentVisual({ x: 0, y: 0 }, target, 16, 1);
    const npc = advanceCityAgentVisual({ x: 0, y: 0 }, target, 16, 1, 38);
    expect(Math.hypot(npc.x, npc.y)).toBeCloseTo(Math.hypot(agent.x, agent.y) * 1.9, 6);
    expect(Math.hypot(agent.x, agent.y)).toBeCloseTo(0.32, 6);
  });
});
