import { describe, expect, it } from "vitest";
import { ACTOR_RADIUS, findSmoothPath, isWalkable, moveWithSliding, type WorldRect } from "./engine";

const obstacle: WorldRect = {
  id: "table",
  label: "Mesa",
  minX: 3,
  maxX: 5,
  minY: 3,
  maxY: 5,
};

describe("spatial lab engine", () => {
  it("keeps a continuous actor outside solid furniture", () => {
    const result = moveWithSliding({ x: 2.7, y: 4 }, { x: 0.5, y: 0.18 }, [obstacle]);
    expect(result.collided).toBe(true);
    expect(isWalkable(result.position, [obstacle], ACTOR_RADIUS)).toBe(true);
  });

  it("builds a smooth route around a solid footprint", () => {
    const route = findSmoothPath({ x: 2, y: 4 }, { x: 6, y: 4 }, [obstacle]);
    expect(route).not.toBeNull();
    expect(route?.length).toBeGreaterThan(1);
    expect(route?.every((point) => isWalkable(point, [obstacle]))).toBe(true);
  });

  it("rejects destinations inside furniture", () => {
    expect(findSmoothPath({ x: 2, y: 2 }, { x: 4, y: 4 }, [obstacle])).toBeNull();
  });
});
