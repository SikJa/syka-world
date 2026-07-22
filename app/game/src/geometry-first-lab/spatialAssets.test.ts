import { describe, expect, it } from "vitest";

import { ACTOR_RADIUS } from "./engine";
import {
  AUTHORED_SPATIAL_ASSETS,
  BOOKSHELF_ASSET,
  SOFA_ASSET,
  TABLE_ASSET,
  colliderFromSpatialAsset,
} from "./spatialAssets";

describe("geometry-first authored asset contract", () => {
  it("derives every collider from the same definition as its visual skin", () => {
    for (const asset of AUTHORED_SPATIAL_ASSETS) {
      const collider = colliderFromSpatialAsset(asset);

      expect(collider.maxX - collider.minX).toBeCloseTo(asset.footprint.widthX, 6);
      expect(collider.maxZ - collider.minZ).toBeCloseTo(asset.footprint.depthZ, 6);
      expect((collider.minX + collider.maxX) * 0.5).toBeCloseTo(asset.position.x, 6);
      expect((collider.minZ + collider.maxZ) * 0.5).toBeCloseTo(asset.position.z, 6);
    }
  });

  it("leaves a positive visual gap between the actor body and the authored base", () => {
    const collider = colliderFromSpatialAsset(BOOKSHELF_ASSET);
    const approachX = collider.maxX + ACTOR_RADIUS + 0.025;

    expect(approachX - ACTOR_RADIUS).toBeGreaterThan(collider.maxX);
  });

  it("registers every authored skin to a valid opaque ground anchor", () => {
    expect(AUTHORED_SPATIAL_ASSETS.map((asset) => asset.id)).toEqual(["bookshelf", "sofa", "table"]);
    for (const asset of AUTHORED_SPATIAL_ASSETS) {
      expect(asset.skin.groundAnchorX).toBeGreaterThan(0);
      expect(asset.skin.groundAnchorX).toBeLessThan(1);
      expect(asset.skin.src).toMatch(/-skin-trimmed-v1\.png$/);
    }
  });

  it("covers the complete visible bases of the generated sofa and table", () => {
    expect(SOFA_ASSET.footprint.widthX).toBeGreaterThanOrEqual(SOFA_ASSET.skin.width);
    expect(SOFA_ASSET.footprint.depthZ).toBeGreaterThan(1.35);
    expect(TABLE_ASSET.footprint.widthX).toBeGreaterThan(1.5);
    expect(TABLE_ASSET.footprint.depthZ).toBeGreaterThan(1.5);
  });
});
