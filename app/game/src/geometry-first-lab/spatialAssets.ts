export interface SpatialAssetFootprint {
  readonly widthX: number;
  readonly depthZ: number;
}

export interface SpatialAssetSkin {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly baseY: number;
  /** Horizontal registration point measured from the left edge of the trimmed alpha image. */
  readonly groundAnchorX: number;
}

export interface SpatialAssetDefinition {
  readonly id: string;
  readonly position: {
    readonly x: number;
    readonly z: number;
  };
  readonly footprint: SpatialAssetFootprint;
  readonly skin: SpatialAssetSkin;
}

export const BOOKSHELF_ASSET: SpatialAssetDefinition = Object.freeze({
  id: "bookshelf",
  // Deliberately centered in the micro-lab so the authored skin, its base and
  // the actor clearance can be judged without UI or wall-edge occlusion.
  position: Object.freeze({ x: -1.55, z: -1.55 }),
  footprint: Object.freeze({ widthX: 0.84, depthZ: 1.42 }),
  skin: Object.freeze({
    src: "/assets/generated/geometry-first-v2/bookshelf-skin-trimmed-v1.png",
    width: 1.55,
    height: 3.10,
    baseY: 0.01,
    // Tall wall props keep a centered floor registration; their lower alpha
    // band is visually biased by the cabinet perspective and is not a safe pivot.
    groundAnchorX: 0.5000,
  }),
});

export const SOFA_ASSET: SpatialAssetDefinition = Object.freeze({
  id: "sofa",
  position: Object.freeze({ x: 1.72, z: -1.29 }),
  // The generated sofa is wider and deeper than the old procedural proxy.
  // Its collision envelope follows the full visible base, not the legacy mesh.
  footprint: Object.freeze({ widthX: 2.86, depthZ: 1.42 }),
  skin: Object.freeze({
    src: "/assets/generated/geometry-first-v3/sofa-skin-trimmed-v1.png",
    width: 2.86,
    height: 2.64,
    baseY: 0.01,
    // Symmetric furniture is registered by its authored center. The lowest
    // alpha band is biased toward the front-right foot and is not the center.
    groundAnchorX: 0.5000,
  }),
});

export const TABLE_ASSET: SpatialAssetDefinition = Object.freeze({
  id: "table",
  position: Object.freeze({ x: -0.52, z: 0.82 }),
  footprint: Object.freeze({ widthX: 1.56, depthZ: 1.56 }),
  skin: Object.freeze({
    src: "/assets/generated/geometry-first-v3/table-skin-trimmed-v1.png",
    width: 1.66,
    height: 1.76,
    baseY: 0.01,
    groundAnchorX: 0.5000,
  }),
});

export const AUTHORED_SPATIAL_ASSETS: readonly SpatialAssetDefinition[] = Object.freeze([
  BOOKSHELF_ASSET,
  SOFA_ASSET,
  TABLE_ASSET,
]);

export function colliderFromSpatialAsset(asset: SpatialAssetDefinition): {
  readonly id: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
} {
  const halfWidth = asset.footprint.widthX * 0.5;
  const halfDepth = asset.footprint.depthZ * 0.5;
  return Object.freeze({
    id: asset.id,
    minX: asset.position.x - halfWidth,
    maxX: asset.position.x + halfWidth,
    minZ: asset.position.z - halfDepth,
    maxZ: asset.position.z + halfDepth,
  });
}
