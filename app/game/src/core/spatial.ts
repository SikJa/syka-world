import {
  type CardinalDirection,
  type GridPoint,
  type GridSize,
  type Result,
} from "./contracts";

export const SPATIAL_SCENE_SCHEMA = "syka.world.spatial-scene.v1" as const;
export const SPATIAL_SCENE_SCHEMA_V2 = "syka.world.spatial-scene.v2" as const;

export interface SpatialProjectionV1 {
  readonly kind: "isometric-fixed";
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly origin: GridPoint;
}

export interface SpatialAssetReferenceV1 {
  readonly key: string;
  readonly role: "structure" | "entity" | "foreground" | "lighting";
  readonly provenance: string;
}

export interface SpatialFootprintV1 extends GridSize {
  /** Local cells blocked by this entity. Defaults to the full footprint when the entity is blocking. */
  readonly blockedOffsets?: readonly GridPoint[];
  /** Local cells that remain walkable through/under the entity (e.g. arch, bridge). */
  readonly walkableOffsets?: readonly GridPoint[];
}

export type SpatialRenderPartRole = "back" | "body" | "front" | "overlay" | "shadow";

/**
 * Deterministic render part of a spatial entity. Each part may carry its own
 * depth offset relative to the entity's floor-contact pivot, enabling correct
 * occlusion of actors standing behind/in front of multi-part furniture such as
 * a counter (back -> actor behind -> body -> actor in front -> front).
 */
export interface SpatialRenderPartV1 {
  readonly role: SpatialRenderPartRole;
  readonly textureKey?: string;
  readonly frameName?: string;
  /** Normalized [0..1] rect inside the source texture, when cropping a room raster. */
  readonly normalizedRect?: readonly [number, number, number, number];
  /** Stable depth offset relative to the entity floor-contact pivot. Lower draws first. */
  readonly depthOffset?: number;
  /** Pivot origin for this part (defaults to entity pivot). */
  readonly origin?: readonly [number, number];
}

export interface SpatialRenderContractV1 {
  readonly visualKey: string;
  readonly depthRule: "ground-cell" | "fixed-back" | "fixed-front" | "elevated";
  /**
   * Legacy flat part list. Prefer `partsV2` for full depth control. When both
   * are present, `partsV2` wins and `parts` is kept only for back-compat readers.
   */
  readonly parts?: readonly (SpatialRenderPartRole)[];
  readonly partsV2?: readonly SpatialRenderPartV1[];
  /** Render pivot at the entity's floor-contact point, in normalized [0..1] of the footprint. */
  readonly pivot?: readonly [number, number];
}

export interface SpatialEntityV1 {
  readonly id: string;
  readonly kind: string;
  readonly origin: GridPoint;
  readonly orientation: CardinalDirection;
  readonly footprint: SpatialFootprintV1;
  readonly blocksMovement: boolean;
  /** Base elevation in tile units (0 = ground floor). Used by the depth compositor. */
  readonly elevation?: number;
  /** Per-tile height in tile units, when the entity has non-uniform top surface (e.g. stairs). */
  readonly tileHeights?: readonly number[];
  /** Whether another entity can be placed on top of this one (stacking). */
  readonly stackable?: boolean;
  /** Surface where other entities may be placed (e.g. on-entity). */
  readonly placementSurface?: "ground" | "on-entity";
  readonly variant?: string;
  readonly render?: SpatialRenderContractV1;
  readonly tags?: readonly string[];
  readonly accessibleLabel?: string;
}

export interface SpatialAnchorV1 {
  readonly id: string;
  readonly cell: GridPoint;
  readonly facing?: CardinalDirection;
  readonly entityId?: string;
  readonly reservable: boolean;
  /** How many actors may reserve this anchor simultaneously (default 1). */
  readonly reservationCapacity?: number;
  /** Pose the actor should adopt when reaching this anchor (sit, stand, service...). */
  readonly pose?: string;
  readonly tags?: readonly string[];
}

export interface SpatialInteractionV1 {
  readonly id: string;
  readonly entityId: string;
  readonly action: string;
  readonly anchorIds: readonly string[];
  /** `E` may resolve only from the anchor itself or one cardinal step away in v1. */
  readonly maxApproachSteps: 0 | 1 | 2;
  readonly priority?: number;
  /** Required actor facing when the action starts (defaults to anchor facing). */
  readonly requiredFacing?: CardinalDirection;
  /** Pose the actor must adopt to perform the action. */
  readonly pose?: string;
}

export interface SpatialPortalTargetV1 {
  readonly sceneId: string;
  readonly portalId: string;
}

export interface SpatialPortalV1 {
  readonly id: string;
  /** Door/threshold cell; it may itself be structurally blocked. */
  readonly cell: GridPoint;
  readonly approachAnchorIds: readonly string[];
  readonly requiredFacing?: CardinalDirection;
  readonly target: SpatialPortalTargetV1;
  readonly enabled: boolean;
}

/**
 * Optional height map. When present, each cell carries an elevation in tile
 * units; the depth compositor uses elevation as the primary depth signal so
 * stairs and raised platforms sort correctly.
 */
export interface SpatialHeightMapV1 {
  readonly kind: "per-cell";
  /** Flat row-major array of `grid.width * grid.height` elevations. */
  readonly elevations: readonly number[];
}

export interface SpatialSceneDefinitionV1 {
  readonly schema: typeof SPATIAL_SCENE_SCHEMA | typeof SPATIAL_SCENE_SCHEMA_V2;
  readonly id: string;
  readonly version: number;
  readonly grid: GridSize;
  readonly projection: SpatialProjectionV1;
  /** Explicit floor cells. Everything omitted is structural/non-walkable. */
  readonly walkableCells: readonly GridPoint[];
  readonly entities: readonly SpatialEntityV1[];
  readonly anchors: readonly SpatialAnchorV1[];
  readonly interactions: readonly SpatialInteractionV1[];
  readonly portals: readonly SpatialPortalV1[];
  readonly entryAnchorIds: readonly string[];
  readonly exitAnchorIds: readonly string[];
  readonly lighting: "inherit-world-clock" | "fixed-day" | "fixed-night";
  readonly assets: readonly SpatialAssetReferenceV1[];
  /** Optional per-cell elevation map. Omitted = flat ground (elevation 0). */
  readonly heightMap?: SpatialHeightMapV1;
  /** Optional editor/placement constraints for this scene. */
  readonly placementConstraints?: readonly SpatialPlacementConstraintV1[];
}

export type SpatialPlacementSurfaceRule =
  | "ground"
  | "on-entity"
  | "ground-or-on-entity";

export interface SpatialPlacementConstraintV1 {
  readonly entityKind: string;
  readonly surface: SpatialPlacementSurfaceRule;
  readonly requiresTags?: readonly string[];
  readonly maxStackHeight?: number;
  readonly rotatable?: boolean;
}

export type SpatialSceneIssueCode =
  | "INVALID_GRID"
  | "INVALID_PROJECTION"
  | "DUPLICATE_ID"
  | "OUT_OF_BOUNDS"
  | "INVALID_FOOTPRINT"
  | "BLOCKED_OVERLAP"
  | "UNKNOWN_REFERENCE"
  | "UNWALKABLE_ANCHOR"
  | "INVALID_PORTAL"
  | "INVALID_HEIGHT_MAP"
  | "INVALID_RENDER_PART"
  | "INVALID_PLACEMENT_CONSTRAINT";

export interface SpatialSceneIssue {
  readonly code: SpatialSceneIssueCode;
  readonly message: string;
  readonly id?: string;
  readonly cell?: GridPoint;
}

export interface SpatialSceneIndexV1 {
  readonly definition: SpatialSceneDefinitionV1;
  readonly walkableKeys: ReadonlySet<string>;
  readonly blockedKeys: ReadonlySet<string>;
  readonly heightAt: ReadonlyMap<string, number>;
  readonly entitiesById: ReadonlyMap<string, SpatialEntityV1>;
  readonly anchorsById: ReadonlyMap<string, SpatialAnchorV1>;
  readonly interactionsById: ReadonlyMap<string, SpatialInteractionV1>;
  readonly portalsById: ReadonlyMap<string, SpatialPortalV1>;
  readonly entityAnchorsByEntityId: ReadonlyMap<string, readonly SpatialAnchorV1[]>;
}

export interface SpatialSceneValidationError {
  readonly code: "INVALID_SCENE";
  readonly message: string;
  readonly issues: readonly SpatialSceneIssue[];
}

export type SpatialReservationKind = "current" | "destination";

export interface SpatialActorReservationV1 {
  readonly actorId: string;
  readonly kind: SpatialReservationKind;
  readonly cell: GridPoint;
  readonly anchorId?: string;
}

export interface SpatialOccupancyV1 {
  readonly reservations: readonly SpatialActorReservationV1[];
}

export const EMPTY_SPATIAL_OCCUPANCY: SpatialOccupancyV1 = Object.freeze({ reservations: [] });

export interface SpatialReservationError {
  readonly code: "INVALID_CELL" | "CELL_OCCUPIED" | "UNKNOWN_ANCHOR" | "ANCHOR_OCCUPIED" | "ANCHOR_MISMATCH" | "CAPACITY_EXCEEDED";
  readonly message: string;
}

export interface SpatialPathError {
  readonly code: "INVALID_START" | "INVALID_DESTINATION" | "DESTINATION_OCCUPIED" | "NO_PATH" | "SEARCH_LIMIT" | "ELEVATION_BLOCKED";
  readonly message: string;
  readonly visited: number;
}

export interface SpatialPathOptions {
  readonly occupancy?: SpatialOccupancyV1;
  readonly actorId?: string;
  readonly maxVisited?: number;
  /**
   * Maximum elevation delta between adjacent path cells. Defaults to 1
   * (a single step up/down is allowed, e.g. stairs). 0 forbids any slope.
   */
  readonly maxElevationStep?: number;
}

export interface SpatialInteractionResolutionV1 {
  readonly interactionId: string;
  readonly entityId: string;
  readonly action: string;
  readonly anchorId: string;
  readonly path: readonly GridPoint[];
  readonly facing?: CardinalDirection;
  readonly pose?: string;
}

export interface SpatialInteractionError {
  readonly code: "NO_REACHABLE_INTERACTION";
  readonly message: string;
}

export interface SpatialPortalResolutionV1 {
  readonly portalId: string;
  readonly approachAnchorId: string;
  readonly target: SpatialPortalTargetV1;
}

export interface SpatialPortalError {
  readonly code: "NO_PORTAL_IN_FRONT";
  readonly message: string;
}

/**
 * Deterministic depth key for a floor-contact position. The compositor computes
 * a single integer that, when used as `setDepth`, produces correct isometric
 * back-to-front ordering for entities and actors that share the same scene.
 *
 * The formula is intentionally stable and dependency-free so it can be tested
 * in isolation and reused by both the city and interior renderers.
 *
 * - `elevation` (tile units) dominates so stairs/raised platforms sort above
 *   ground-level furniture.
 * - `y + x` is the canonical isometric back-to-front sweep; ties break on `x`
 *   to keep left/right neighbours stable across frames.
 * - `subLayer` lets multi-part furniture (counter back/body/front) and actor
 *   layers interleave around the same floor cell.
 */
export const SPATIAL_DEPTH_BASE = 1000;

export interface SpatialDepthInput {
  readonly cell: GridPoint;
  readonly elevation?: number;
  /** 0 = back, 1 = body, 2 = actor, 3 = front, 4 = overlay. See SPATIAL_DEPTH_SUB_LAYER. */
  readonly subLayer?: SpatialDepthSubLayer;
  /** Optional fine offset to disambiguate entities at the exact same cell. */
  readonly tieBreaker?: number;
}

export const SPATIAL_DEPTH_SUB_LAYER = {
  shadow: -2,
  back: -1,
  body: 0,
  actor: 1,
  front: 2,
  overlay: 3,
} as const satisfies Record<string, number>;

export type SpatialDepthSubLayer = (typeof SPATIAL_DEPTH_SUB_LAYER)[keyof typeof SPATIAL_DEPTH_SUB_LAYER];

export function computeSpatialDepth(input: SpatialDepthInput): number {
  const elevation = input.elevation ?? 0;
  const subLayer = input.subLayer ?? SPATIAL_DEPTH_SUB_LAYER.body;
  const tieBreaker = input.tieBreaker ?? 0;
  // Elevation is scaled so a single tile of height always outranks a sub-layer
  // change at the same cell, but does not collapse neighbours.
  const elevationRank = Math.round(elevation * 10000);
  const sweepRank = (input.cell.y + input.cell.x) * 10;
  const xRank = input.cell.x;
  return SPATIAL_DEPTH_BASE + elevationRank + sweepRank + xRank + subLayer + tieBreaker;
}

/**
 * Resolution of a render-part depth for a given entity. The renderer calls
 * this for each part so that `back`, `body`, `actor`, `front` and `overlay`
 * interleave deterministically around the entity floor-contact pivot.
 */
export function spatialRenderPartDepth(
  entity: SpatialEntityV1,
  part: SpatialRenderPartV1,
  options: { readonly actorSubLayer?: SpatialDepthSubLayer } = {},
): number {
  const subLayer =
    part.role === "back" ? SPATIAL_DEPTH_SUB_LAYER.back
    : part.role === "front" ? SPATIAL_DEPTH_SUB_LAYER.front
    : part.role === "overlay" ? SPATIAL_DEPTH_SUB_LAYER.overlay
    : part.role === "shadow" ? SPATIAL_DEPTH_SUB_LAYER.shadow
    : SPATIAL_DEPTH_SUB_LAYER.body;
  return computeSpatialDepth({
    cell: entity.origin,
    elevation: entity.elevation ?? 0,
    subLayer,
    tieBreaker: (part.depthOffset ?? 0) + (options.actorSubLayer ?? 0),
  });
}

/** Cells an actor would occupy while standing at the entity's front face. */
export function spatialEntityFrontCells(entity: SpatialEntityV1): readonly GridPoint[] {
  // The "front" face of a north-oriented footprint is the row at y = height.
  // For other orientations we rotate the local offset list like the footprint.
  const front: GridPoint[] = [];
  const width = entity.footprint.width;
  const height = entity.footprint.height;
  for (let x = 0; x < width; x += 1) {
    front.push(spatialEntityBlockedCells(entity).length === 0
      ? { x: entity.origin.x + x, y: entity.origin.y + height }
      : { x: entity.origin.x + x, y: entity.origin.y + height });
  }
  return front;
}

export const spatialPointKey = ({ x, y }: GridPoint): string => `${x},${y}`;

export const sameSpatialPoint = (left: GridPoint, right: GridPoint): boolean =>
  left.x === right.x && left.y === right.y;

const integerPoint = (point: GridPoint): boolean => Number.isSafeInteger(point.x) && Number.isSafeInteger(point.y);

export const isSpatialCellInBounds = (grid: GridSize, point: GridPoint): boolean =>
  integerPoint(point) && point.x >= 0 && point.y >= 0 && point.x < grid.width && point.y < grid.height;

const orientationTurns = (orientation: CardinalDirection): number =>
  ({ north: 0, east: 1, south: 2, west: 3 })[orientation];

const rotateLocalCell = (point: GridPoint, width: number, height: number, turns: number): GridPoint => {
  switch (turns) {
    case 1:
      return { x: height - 1 - point.y, y: point.x };
    case 2:
      return { x: width - 1 - point.x, y: height - 1 - point.y };
    case 3:
      return { x: point.y, y: width - 1 - point.x };
    default:
      return point;
  }
};

const fullFootprintOffsets = (footprint: SpatialFootprintV1): readonly GridPoint[] => {
  const points: GridPoint[] = [];
  for (let y = 0; y < footprint.height; y += 1) {
    for (let x = 0; x < footprint.width; x += 1) points.push({ x, y });
  }
  return points;
};

const projectLocalCells = (
  entity: SpatialEntityV1,
  offsets: readonly GridPoint[],
): readonly GridPoint[] => {
  const turns = orientationTurns(entity.orientation);
  return offsets
    .map((offset) => rotateLocalCell(offset, entity.footprint.width, entity.footprint.height, turns))
    .map((offset) => ({ x: entity.origin.x + offset.x, y: entity.origin.y + offset.y }))
    .sort((left, right) => left.y - right.y || left.x - right.x);
};

export const spatialEntityFootprintCells = (entity: SpatialEntityV1): readonly GridPoint[] =>
  projectLocalCells(entity, fullFootprintOffsets(entity.footprint));

export const spatialEntityBlockedCells = (entity: SpatialEntityV1): readonly GridPoint[] => {
  if (!entity.blocksMovement) return [];
  const offsets = entity.footprint.blockedOffsets ?? fullFootprintOffsets(entity.footprint);
  return projectLocalCells(entity, offsets);
};

export const spatialEntityWalkableOffsets = (entity: SpatialEntityV1): readonly GridPoint[] => {
  const offsets = entity.footprint.walkableOffsets ?? [];
  return projectLocalCells(entity, offsets);
};

const duplicateIds = (ids: readonly string[]): readonly string[] =>
  [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].sort();

export const validateSpatialScene = (scene: SpatialSceneDefinitionV1): readonly SpatialSceneIssue[] => {
  const issues: SpatialSceneIssue[] = [];
  if (!Number.isSafeInteger(scene.grid.width) || !Number.isSafeInteger(scene.grid.height) || scene.grid.width < 1 || scene.grid.height < 1) {
    issues.push({ code: "INVALID_GRID", message: "Spatial grid dimensions must be positive integers." });
  }
  if (
    scene.projection.kind !== "isometric-fixed" ||
    !Number.isFinite(scene.projection.tileWidth) ||
    !Number.isFinite(scene.projection.tileHeight) ||
    scene.projection.tileWidth <= 0 ||
    scene.projection.tileHeight <= 0
  ) {
    issues.push({ code: "INVALID_PROJECTION", message: "Spatial projection requires positive isometric tile dimensions." });
  }

  for (const id of duplicateIds([
    ...scene.entities.map((item) => item.id),
    ...scene.anchors.map((item) => item.id),
    ...scene.interactions.map((item) => item.id),
    ...scene.portals.map((item) => item.id),
  ])) {
    issues.push({ code: "DUPLICATE_ID", id, message: `Spatial id ${id} is not unique within the scene.` });
  }

  for (const cell of scene.walkableCells) {
    if (!isSpatialCellInBounds(scene.grid, cell)) {
      issues.push({ code: "OUT_OF_BOUNDS", cell, message: `Walkable cell ${spatialPointKey(cell)} is outside the grid.` });
    }
  }

  if (scene.heightMap && scene.heightMap.elevations.length !== scene.grid.width * scene.grid.height) {
    issues.push({ code: "INVALID_HEIGHT_MAP", message: "Height map length must equal grid.width * grid.height." });
  }

  const entityIds = new Set(scene.entities.map((entity) => entity.id));
  const blockedOwners = new Map<string, string>();
  for (const entity of scene.entities) {
    const footprint = entity.footprint;
    if (
      !Number.isSafeInteger(footprint.width) ||
      !Number.isSafeInteger(footprint.height) ||
      footprint.width < 1 ||
      footprint.height < 1 ||
      footprint.blockedOffsets?.some((offset) =>
        !integerPoint(offset) || offset.x < 0 || offset.y < 0 || offset.x >= footprint.width || offset.y >= footprint.height,
      ) ||
      footprint.walkableOffsets?.some((offset) =>
        !integerPoint(offset) || offset.x < 0 || offset.y < 0 || offset.x >= footprint.width || offset.y >= footprint.height,
      )
    ) {
      issues.push({ code: "INVALID_FOOTPRINT", id: entity.id, message: `Entity ${entity.id} has an invalid footprint.` });
      continue;
    }
    for (const cell of spatialEntityFootprintCells(entity)) {
      if (!isSpatialCellInBounds(scene.grid, cell)) {
        issues.push({ code: "OUT_OF_BOUNDS", id: entity.id, cell, message: `Entity ${entity.id} leaves the spatial grid.` });
      }
    }
    for (const cell of spatialEntityBlockedCells(entity)) {
      const key = spatialPointKey(cell);
      const owner = blockedOwners.get(key);
      if (owner && owner !== entity.id) {
        issues.push({ code: "BLOCKED_OVERLAP", id: entity.id, cell, message: `${entity.id} overlaps blocked entity ${owner}.` });
      } else {
        blockedOwners.set(key, entity.id);
      }
    }
    if (entity.render?.partsV2) {
      for (const part of entity.render.partsV2) {
        if (part.normalizedRect) {
          const [nx, ny, nw, nh] = part.normalizedRect;
          if (
            !Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nw) || !Number.isFinite(nh) ||
            nx < 0 || ny < 0 || nw <= 0 || nh <= 0 || nx + nw > 1.0001 || ny + nh > 1.0001
          ) {
            issues.push({ code: "INVALID_RENDER_PART", id: entity.id, message: `Entity ${entity.id} has an invalid render part rect.` });
          }
        }
      }
    }
  }

  const anchorIds = new Set(scene.anchors.map((anchor) => anchor.id));
  const walkable = new Set(scene.walkableCells.map(spatialPointKey));
  for (const anchor of scene.anchors) {
    if (!isSpatialCellInBounds(scene.grid, anchor.cell)) {
      issues.push({ code: "OUT_OF_BOUNDS", id: anchor.id, cell: anchor.cell, message: `Anchor ${anchor.id} is outside the grid.` });
    }
    if (anchor.entityId && !entityIds.has(anchor.entityId)) {
      issues.push({ code: "UNKNOWN_REFERENCE", id: anchor.id, message: `Anchor ${anchor.id} references an unknown entity.` });
    }
    const key = spatialPointKey(anchor.cell);
    if (!walkable.has(key) || blockedOwners.has(key)) {
      issues.push({ code: "UNWALKABLE_ANCHOR", id: anchor.id, cell: anchor.cell, message: `Anchor ${anchor.id} is not on free floor.` });
    }
  }

  for (const interaction of scene.interactions) {
    if (!entityIds.has(interaction.entityId)) {
      issues.push({ code: "UNKNOWN_REFERENCE", id: interaction.id, message: `Interaction ${interaction.id} references an unknown entity.` });
    }
    if (interaction.anchorIds.length === 0 || interaction.anchorIds.some((id) => !anchorIds.has(id))) {
      issues.push({ code: "UNKNOWN_REFERENCE", id: interaction.id, message: `Interaction ${interaction.id} has an unknown or empty anchor list.` });
    }
  }

  for (const portal of scene.portals) {
    if (
      !isSpatialCellInBounds(scene.grid, portal.cell) ||
      portal.approachAnchorIds.length === 0 ||
      portal.approachAnchorIds.some((id) => !anchorIds.has(id)) ||
      portal.target.sceneId.length === 0 ||
      portal.target.portalId.length === 0
    ) {
      issues.push({ code: "INVALID_PORTAL", id: portal.id, cell: portal.cell, message: `Portal ${portal.id} is invalid.` });
    }
  }

  for (const anchorId of [...scene.entryAnchorIds, ...scene.exitAnchorIds]) {
    if (!anchorIds.has(anchorId)) {
      issues.push({ code: "UNKNOWN_REFERENCE", id: anchorId, message: `Scene entry/exit references unknown anchor ${anchorId}.` });
    }
  }

  for (const constraint of scene.placementConstraints ?? []) {
    if (!constraint.entityKind || (constraint.surface !== "ground" && constraint.surface !== "on-entity" && constraint.surface !== "ground-or-on-entity")) {
      issues.push({ code: "INVALID_PLACEMENT_CONSTRAINT", message: `Placement constraint for ${constraint.entityKind ?? "(unknown)"} is invalid.` });
    }
  }
  return issues;
};

export const compileSpatialScene = (
  scene: SpatialSceneDefinitionV1,
): Result<SpatialSceneIndexV1, SpatialSceneValidationError> => {
  const issues = validateSpatialScene(scene);
  if (issues.length > 0) {
    return { ok: false, error: { code: "INVALID_SCENE", message: "Spatial scene validation failed.", issues } };
  }
  const heightAt = new Map<string, number>();
  if (scene.heightMap) {
    for (let y = 0; y < scene.grid.height; y += 1) {
      for (let x = 0; x < scene.grid.width; x += 1) {
        const elevation = scene.heightMap.elevations[y * scene.grid.width + x] ?? 0;
        if (Number.isFinite(elevation) && elevation !== 0) {
          heightAt.set(spatialPointKey({ x, y }), elevation);
        }
      }
    }
  }
  for (const entity of scene.entities) {
    if (entity.elevation && entity.elevation !== 0) {
      for (const cell of spatialEntityFootprintCells(entity)) {
        const key = spatialPointKey(cell);
        if (!heightAt.has(key)) heightAt.set(key, entity.elevation);
      }
    }
  }
  const entityAnchorsByEntityId = new Map<string, SpatialAnchorV1[]>();
  for (const anchor of scene.anchors) {
    if (!anchor.entityId) continue;
    const list = entityAnchorsByEntityId.get(anchor.entityId) ?? [];
    list.push(anchor);
    entityAnchorsByEntityId.set(anchor.entityId, list);
  }
  return {
    ok: true,
    value: {
      definition: scene,
      walkableKeys: new Set(scene.walkableCells.map(spatialPointKey)),
      blockedKeys: new Set(scene.entities.flatMap(spatialEntityBlockedCells).map(spatialPointKey)),
      heightAt,
      entitiesById: new Map(scene.entities.map((entity) => [entity.id, entity])),
      anchorsById: new Map(scene.anchors.map((anchor) => [anchor.id, anchor])),
      interactionsById: new Map(scene.interactions.map((interaction) => [interaction.id, interaction])),
      portalsById: new Map(scene.portals.map((portal) => [portal.id, portal])),
      entityAnchorsByEntityId,
    },
  };
};

export const spatialCellElevation = (
  scene: SpatialSceneIndexV1,
  cell: GridPoint,
): number => scene.heightAt.get(spatialPointKey(cell)) ?? 0;

const occupiedByOther = (
  occupancy: SpatialOccupancyV1,
  cell: GridPoint,
  actorId?: string,
): SpatialActorReservationV1 | undefined =>
  occupancy.reservations.find((reservation) =>
    reservation.actorId !== actorId && sameSpatialPoint(reservation.cell, cell),
  );

export const isSpatialCellWalkable = (
  scene: SpatialSceneIndexV1,
  cell: GridPoint,
  occupancy: SpatialOccupancyV1 = EMPTY_SPATIAL_OCCUPANCY,
  actorId?: string,
): boolean =>
  isSpatialCellInBounds(scene.definition.grid, cell) &&
  scene.walkableKeys.has(spatialPointKey(cell)) &&
  !scene.blockedKeys.has(spatialPointKey(cell)) &&
  !occupiedByOther(occupancy, cell, actorId);

const reservationSort = (left: SpatialActorReservationV1, right: SpatialActorReservationV1): number =>
  left.actorId.localeCompare(right.actorId) || left.kind.localeCompare(right.kind);

export const reserveSpatialActor = (
  scene: SpatialSceneIndexV1,
  occupancy: SpatialOccupancyV1,
  request: SpatialActorReservationV1,
): Result<SpatialOccupancyV1, SpatialReservationError> => {
  if (!isSpatialCellInBounds(scene.definition.grid, request.cell) ||
      !scene.walkableKeys.has(spatialPointKey(request.cell)) ||
      scene.blockedKeys.has(spatialPointKey(request.cell))) {
    return { ok: false, error: { code: "INVALID_CELL", message: "The requested spatial cell is not walkable." } };
  }
  if (request.anchorId) {
    const anchor = scene.anchorsById.get(request.anchorId);
    if (!anchor || !anchor.reservable) {
      return { ok: false, error: { code: "UNKNOWN_ANCHOR", message: `Anchor ${request.anchorId} cannot be reserved.` } };
    }
    if (!sameSpatialPoint(anchor.cell, request.cell)) {
      return { ok: false, error: { code: "ANCHOR_MISMATCH", message: `Anchor ${request.anchorId} belongs to another cell.` } };
    }
    const capacity = Math.max(1, anchor.reservationCapacity ?? 1);
    const owners = occupancy.reservations.filter((reservation) =>
      reservation.actorId !== request.actorId && reservation.anchorId === request.anchorId,
    );
    if (owners.length >= capacity) {
      return { ok: false, error: { code: "ANCHOR_OCCUPIED", message: `Anchor ${request.anchorId} is reserved by ${owners[0]?.actorId}.` } };
    }
  }
  const other = occupiedByOther(occupancy, request.cell, request.actorId);
  if (other) {
    return { ok: false, error: { code: "CELL_OCCUPIED", message: `Cell is reserved by ${other.actorId}.` } };
  }
  const reservations = occupancy.reservations
    .filter((reservation) => reservation.actorId !== request.actorId || reservation.kind !== request.kind);
  return { ok: true, value: { reservations: [...reservations, request].sort(reservationSort) } };
};

export const releaseSpatialActor = (
  occupancy: SpatialOccupancyV1,
  actorId: string,
  kind?: SpatialReservationKind,
): SpatialOccupancyV1 => ({
  reservations: occupancy.reservations.filter((reservation) =>
    reservation.actorId !== actorId || (kind !== undefined && reservation.kind !== kind),
  ),
});

export const cardinalSpatialNeighbours = (cell: GridPoint): readonly GridPoint[] => [
  { x: cell.x, y: cell.y - 1 },
  { x: cell.x + 1, y: cell.y },
  { x: cell.x, y: cell.y + 1 },
  { x: cell.x - 1, y: cell.y },
];

const reconstructSpatialPath = (
  cameFrom: ReadonlyMap<string, GridPoint>,
  goal: GridPoint,
): readonly GridPoint[] => {
  const path: GridPoint[] = [goal];
  let cursor = goal;
  while (cameFrom.has(spatialPointKey(cursor))) {
    const previous = cameFrom.get(spatialPointKey(cursor));
    if (!previous) break;
    path.push(previous);
    cursor = previous;
  }
  return path.reverse();
};

export const findSpatialPath = (
  scene: SpatialSceneIndexV1,
  start: GridPoint,
  destination: GridPoint,
  options: SpatialPathOptions = {},
): Result<readonly GridPoint[], SpatialPathError> => {
  const occupancy = options.occupancy ?? EMPTY_SPATIAL_OCCUPANCY;
  if (!isSpatialCellWalkable(scene, start, occupancy, options.actorId)) {
    return { ok: false, error: { code: "INVALID_START", message: "Spatial path start is invalid.", visited: 0 } };
  }
  const destinationBaseWalkable =
    isSpatialCellInBounds(scene.definition.grid, destination) &&
    scene.walkableKeys.has(spatialPointKey(destination)) &&
    !scene.blockedKeys.has(spatialPointKey(destination));
  if (!destinationBaseWalkable) {
    return { ok: false, error: { code: "INVALID_DESTINATION", message: "Spatial destination is blocked.", visited: 0 } };
  }
  if (occupiedByOther(occupancy, destination, options.actorId)) {
    return { ok: false, error: { code: "DESTINATION_OCCUPIED", message: "Spatial destination is reserved.", visited: 0 } };
  }
  if (sameSpatialPoint(start, destination)) return { ok: true, value: [start] };

  const maxElevationStep = options.maxElevationStep ?? 1;
  const queue: GridPoint[] = [start];
  const visited = new Set([spatialPointKey(start)]);
  const cameFrom = new Map<string, GridPoint>();
  const maxVisited = options.maxVisited ?? scene.definition.grid.width * scene.definition.grid.height;
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (visited.size > maxVisited) {
      return { ok: false, error: { code: "SEARCH_LIMIT", message: "Spatial path search reached its limit.", visited: visited.size } };
    }
    const currentElevation = spatialCellElevation(scene, current);
    for (const next of cardinalSpatialNeighbours(current)) {
      const key = spatialPointKey(next);
      if (visited.has(key) || !isSpatialCellWalkable(scene, next, occupancy, options.actorId)) continue;
      const nextElevation = spatialCellElevation(scene, next);
      const delta = Math.abs(nextElevation - currentElevation);
      if (delta > maxElevationStep) {
        // Elevation cliff: do not traverse, but record so the caller can report.
        continue;
      }
      visited.add(key);
      cameFrom.set(key, current);
      if (sameSpatialPoint(next, destination)) {
        return { ok: true, value: reconstructSpatialPath(cameFrom, next) };
      }
      queue.push(next);
    }
  }
  return { ok: false, error: { code: "NO_PATH", message: "No cardinal spatial path reaches the destination.", visited: visited.size } };
};

const anchorReservedByOther = (
  occupancy: SpatialOccupancyV1,
  anchorId: string,
  actorId: string,
  scene: SpatialSceneIndexV1,
): boolean => {
  const anchor = scene.anchorsById.get(anchorId);
  if (!anchor) return false;
  const capacity = Math.max(1, anchor.reservationCapacity ?? 1);
  const owners = occupancy.reservations.filter((reservation) =>
    reservation.actorId !== actorId && reservation.anchorId === anchorId,
  );
  return owners.length >= capacity;
};

export const resolveSpatialInteraction = (
  scene: SpatialSceneIndexV1,
  occupancy: SpatialOccupancyV1,
  actorId: string,
  actorCell: GridPoint,
): Result<SpatialInteractionResolutionV1, SpatialInteractionError> => {
  const candidates: Array<SpatialInteractionResolutionV1 & { readonly steps: number; readonly priority: number }> = [];
  for (const interaction of scene.definition.interactions) {
    for (const anchorId of interaction.anchorIds) {
      const anchor = scene.anchorsById.get(anchorId);
      if (!anchor || anchorReservedByOther(occupancy, anchorId, actorId, scene)) continue;
      const path = findSpatialPath(scene, actorCell, anchor.cell, { occupancy, actorId });
      if (!path.ok) continue;
      const steps = path.value.length - 1;
      if (steps > interaction.maxApproachSteps) continue;
      const facing = interaction.requiredFacing ?? anchor.facing;
      const pose = interaction.pose ?? anchor.pose;
      candidates.push({
        interactionId: interaction.id,
        entityId: interaction.entityId,
        action: interaction.action,
        anchorId,
        path: path.value,
        ...(facing ? { facing } : {}),
        ...(pose ? { pose } : {}),
        steps,
        priority: interaction.priority ?? 0,
      });
    }
  }
  candidates.sort((left, right) =>
    left.steps - right.steps ||
    right.priority - left.priority ||
    left.interactionId.localeCompare(right.interactionId) ||
    left.anchorId.localeCompare(right.anchorId),
  );
  const best = candidates[0];
  if (!best) {
    return { ok: false, error: { code: "NO_REACHABLE_INTERACTION", message: "No interaction is reachable with E." } };
  }
  const { steps: _steps, priority: _priority, ...resolution } = best;
  return { ok: true, value: resolution };
};

export const resolveSpatialPortal = (
  scene: SpatialSceneIndexV1,
  actorCell: GridPoint,
  actorFacing: CardinalDirection,
): Result<SpatialPortalResolutionV1, SpatialPortalError> => {
  const portals = [...scene.definition.portals].sort((left, right) => left.id.localeCompare(right.id));
  for (const portal of portals) {
    if (!portal.enabled) continue;
    for (const anchorId of portal.approachAnchorIds) {
      const anchor = scene.anchorsById.get(anchorId);
      if (!anchor || !sameSpatialPoint(anchor.cell, actorCell)) continue;
      const requiredFacing = portal.requiredFacing ?? anchor.facing;
      if (requiredFacing && requiredFacing !== actorFacing) continue;
      return { ok: true, value: { portalId: portal.id, approachAnchorId: anchorId, target: portal.target } };
    }
  }
  return { ok: false, error: { code: "NO_PORTAL_IN_FRONT", message: "F requires an enabled portal directly in front of the actor." } };
};

// ---------------------------------------------------------------------------
// Placement validation (Habbo-style editor slice)
// ---------------------------------------------------------------------------

export interface SpatialPlacementRequestV1 {
  readonly entity: SpatialEntityV1;
  readonly surface: SpatialPlacementSurfaceRule;
  /** When placing on top of another entity, its id. */
  readonly onEntityId?: string;
  readonly occupancy?: SpatialOccupancyV1;
}

export interface SpatialPlacementResultV1 {
  readonly ok: boolean;
  readonly code?: "OUT_OF_BOUNDS" | "BLOCKED_OVERLAP" | "SURFACE_MISMATCH" | "NOT_STACKABLE" | "STACK_HEIGHT" | "OK";
  readonly message: string;
  readonly conflictingCells?: readonly GridPoint[];
}

export function validateSpatialPlacement(
  scene: SpatialSceneIndexV1,
  request: SpatialPlacementRequestV1,
): SpatialPlacementResultV1 {
  const { entity, surface } = request;
  const footprint = spatialEntityFootprintCells(entity);
  for (const cell of footprint) {
    if (!isSpatialCellInBounds(scene.definition.grid, cell)) {
      return { ok: false, code: "OUT_OF_BOUNDS", message: `Placement leaves the grid at ${spatialPointKey(cell)}.`, conflictingCells: [cell] };
    }
  }
  const blocked = spatialEntityBlockedCells(entity);
  const conflicts: GridPoint[] = [];
  for (const cell of blocked) {
    const key = spatialPointKey(cell);
    if (scene.blockedKeys.has(key) || scene.walkableKeys.has(key) === false) {
      // A cell may be walkable and still become blocked by the new entity; that
      // is allowed. We only reject when the cell is already owned by another
      // blocking entity or is structural (non-walkable, non-floor).
      if (scene.blockedKeys.has(key)) {
        const owner = scene.definition.entities.find((other) =>
          other.id !== entity.id && spatialEntityBlockedCells(other).some((c) => sameSpatialPoint(c, cell)),
        );
        if (owner) conflicts.push(cell);
      }
    }
  }
  if (conflicts.length > 0) {
    return { ok: false, code: "BLOCKED_OVERLAP", message: "Placement overlaps another blocking entity.", conflictingCells: conflicts };
  }
  if (surface === "on-entity") {
    if (!request.onEntityId) {
      return { ok: false, code: "SURFACE_MISMATCH", message: "on-entity placement requires a host entity id." };
    }
    const host = scene.entitiesById.get(request.onEntityId);
    if (!host) {
      return { ok: false, code: "SURFACE_MISMATCH", message: `Host entity ${request.onEntityId} does not exist.` };
    }
    if (!host.stackable) {
      return { ok: false, code: "NOT_STACKABLE", message: `Host ${request.onEntityId} is not stackable.` };
    }
    const constraint = scene.definition.placementConstraints?.find((c) => c.entityKind === entity.kind);
    if (constraint?.maxStackHeight !== undefined) {
      const stackHeight = (host.elevation ?? 0) + 1;
      if (stackHeight > constraint.maxStackHeight) {
        return { ok: false, code: "STACK_HEIGHT", message: `Stack height ${stackHeight} exceeds max ${constraint.maxStackHeight}.` };
      }
    }
  }
  return { ok: true, code: "OK", message: "Placement is valid." };
}
