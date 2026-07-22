import { describe, expect, it } from "vitest";
import { getCityLighting, resolvedLightAlpha } from "./lighting";

describe("city lighting families", () => {
  it("removes every additive pool and halo during daylight", () => {
    const noon = getCityLighting(12 * 60);
    expect(noon.period).toBe("day");
    expect(noon.overlayAlpha).toBe(0);
    expect(Object.values(noon.familyAlpha)).toEqual([0, 0, 0, 0]);
    expect(resolvedLightAlpha("streetlamp", 1, noon)).toBe(0);
  });

  it("keeps twilight restrained and night localized by family", () => {
    const twilight = getCityLighting(18.5 * 60);
    const night = getCityLighting(22 * 60);
    expect(twilight.period).toBe("twilight");
    expect(twilight.familyAlpha.streetlamp).toBeLessThan(night.familyAlpha.streetlamp);
    expect(night.familyAlpha.doorway).toBeLessThan(night.familyAlpha.streetlamp);
    expect(night.familyAlpha.window).toBeLessThan(night.familyAlpha.accent);
  });

  it("normalizes clocks outside one day", () => {
    expect(getCityLighting(-120)).toEqual(getCityLighting(22 * 60));
    expect(getCityLighting(36 * 60)).toEqual(getCityLighting(12 * 60));
  });
});
