import { describe, expect, it } from "vitest";

import { alphaChannelFromRgba, buildAlphaRelief } from "./relief";

describe("sprite depth relief", () => {
  it("keeps transparent pixels outside the depth surface", () => {
    const alpha = new Uint8ClampedArray([
      0, 0, 0, 0, 255, 0, 0, 0, 0,
    ]);
    const relief = buildAlphaRelief(alpha, 3, 3, { maximumInset: 2 });
    expect(relief[4]).toBeGreaterThan(0);
    expect(relief.filter((value) => value === 0)).toHaveLength(8);
  });

  it("places the interior of a silhouette in front of its edge", () => {
    const alpha = new Uint8ClampedArray(7 * 7);
    for (let y = 1; y <= 5; y += 1) {
      for (let x = 1; x <= 5; x += 1) alpha[y * 7 + x] = 255;
    }
    const relief = buildAlphaRelief(alpha, 7, 7, { maximumInset: 3 });
    expect(relief[3 * 7 + 3]).toBeGreaterThan(relief[1 * 7 + 1] ?? 1);
  });

  it("extracts alpha without changing source pixel count", () => {
    const rgba = new Uint8ClampedArray([12, 24, 36, 48, 60, 72, 84, 96]);
    expect([...alphaChannelFromRgba(rgba)]).toEqual([48, 96]);
  });
});
