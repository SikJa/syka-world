// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
  LOGICAL_VIEWPORT_HEIGHT,
  MAX_LOGICAL_VIEWPORT_WIDTH,
  MIN_LOGICAL_VIEWPORT_WIDTH,
  logicalViewportForSize,
} from "./logicalViewport";

describe("responsive logical viewport", () => {
  it.each([
    [1440, 900, 720],
    [1008, 548, 828],
    [1920, 1080, 800],
    [2560, 1080, 1066],
  ])("maps %sx%s to a %s×450 logical viewport", (width, height, expectedWidth) => {
    expect(logicalViewportForSize(width, height)).toEqual({ width: expectedWidth, height: LOGICAL_VIEWPORT_HEIGHT });
  });

  it("bounds extreme or invalid aspect ratios without changing logical height", () => {
    expect(logicalViewportForSize(500, 1200)).toEqual({
      width: MIN_LOGICAL_VIEWPORT_WIDTH,
      height: LOGICAL_VIEWPORT_HEIGHT,
    });
    expect(logicalViewportForSize(6000, 900)).toEqual({
      width: MAX_LOGICAL_VIEWPORT_WIDTH,
      height: LOGICAL_VIEWPORT_HEIGHT,
    });
    expect(logicalViewportForSize(0, Number.NaN)).toEqual({
      width: MIN_LOGICAL_VIEWPORT_WIDTH,
      height: LOGICAL_VIEWPORT_HEIGHT,
    });
  });
});
