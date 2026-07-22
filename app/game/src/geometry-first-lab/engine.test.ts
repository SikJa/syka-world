import { describe, expect, it } from "vitest";

import {
  ACTOR_BODY_RADIUS,
  ACTOR_RADIUS,
  ACTOR_VISUAL_CLEARANCE,
  LAB_COLLIDERS,
  advanceAlongPath,
  findVisibilityPath,
  isWorldWalkable,
  moveWithCollision,
} from "./engine";

describe("geometry-first continuous spatial contract", () => {
  it("blocks the true sofa base without relying on a visual grid", () => {
    expect(isWorldWalkable({ x: 1.7, z: -1.2 })).toBe(false);
    expect(isWorldWalkable({ x: 1.7, z: -0.10 })).toBe(true);
  });

  it("adds authored visual clearance around the physical body", () => {
    expect(ACTOR_RADIUS).toBeCloseTo(ACTOR_BODY_RADIUS + ACTOR_VISUAL_CLEARANCE, 6);
    expect(ACTOR_VISUAL_CLEARANCE).toBeGreaterThan(0);
    expect(isWorldWalkable({ x: 1.7, z: -0.76 + ACTOR_RADIUS - 0.01 })).toBe(false);
  });

  it("rejects a destination inside a physical object", () => {
    const path = findVisibilityPath({ x: 2.9, z: 2.6 }, { x: -0.5, z: 0.7 });
    expect(path).toBeNull();
  });

  it("slides continuously along an expanded collider", () => {
    const start = { x: 1.10, z: 0.06 };
    const result = moveWithCollision(start, { x: 0.42, z: -0.55 });
    expect(result.collided).toBe(true);
    const sofa = LAB_COLLIDERS.find((collider) => collider.id === "sofa");
    expect(sofa).toBeDefined();
    expect(result.position.z).toBeGreaterThanOrEqual((sofa?.maxZ ?? 0) + ACTOR_RADIUS - 0.01);
    expect(result.position.x).toBeGreaterThan(start.x);
    expect(isWorldWalkable(result.position)).toBe(true);
  });

  it("does not fabricate a path through the sofa sealed against the wall", () => {
    const start = { x: 2.9, z: 2.55 };
    const target = { x: 1.72, z: -2.55 };
    const path = findVisibilityPath(start, target);
    expect(path).toBeNull();
  });

  it("interpolates through geometric waypoints without snapping", () => {
    const path = [{ x: 1, z: 0 }, { x: 1, z: 1 }];
    const first = advanceAlongPath({ x: 0, z: 0 }, path, 0.13);
    expect(first.position.x).toBeCloseTo(0.13, 5);
    expect(first.position.z).toBeCloseTo(0, 5);
    expect(first.remaining).toHaveLength(2);

    const second = advanceAlongPath(first.position, first.remaining, 1.1);
    expect(second.position.x).toBeCloseTo(1, 5);
    expect(second.position.z).toBeCloseTo(0.23, 5);
    expect(second.arrived).toBe(false);
  });
});
