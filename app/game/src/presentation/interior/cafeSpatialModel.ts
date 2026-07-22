import {
  SPATIAL_SCENE_SCHEMA,
  compileSpatialScene,
  isSpatialCellWalkable,
  type GridPoint,
  type GameStateV1,
  type InteriorStateV1,
  type ManualSpatialActorSeedV1,
  type SpatialEntityV1,
  type SpatialSceneDefinitionV1,
  type SpatialSceneIndexV1,
} from "../../core";
import {
  CAFE_DECOR_POSITIONS,
  CAFE_INTERIOR_FLOOR_BOUNDS,
  CAFE_INTERIOR_SPATIAL_GRID,
  optionalFurniture,
  type CafeDecorPlacementVisual,
} from "./interiorModel";

export const CAFE_SPATIAL_GRID = CAFE_INTERIOR_SPATIAL_GRID;

const NORMALIZED_FLOOR = CAFE_INTERIOR_FLOOR_BOUNDS;

export interface CafeSpatialEntityPresentation {
  readonly entity: SpatialEntityV1;
  /** Tight crop of the approved room raster used as the entity's front layer. */
  readonly normalizedOcclusionRect?: readonly [number, number, number, number];
}

const entity = (
  id: string,
  kind: string,
  origin: GridPoint,
  width: number,
  height: number,
  visualKey: string,
  normalizedOcclusionRect?: readonly [number, number, number, number],
): CafeSpatialEntityPresentation => ({
  entity: {
    id,
    kind,
    origin,
    orientation: "north",
    footprint: { width, height },
    // The room is one approved raster. These records remain semantic landmarks
    // for interactions and depth, while movement is owned by the authored safe
    // floor below. This avoids a second, inevitably misaligned collider per
    // chair, table and sofa.
    blocksMovement: false,
    render: {
      visualKey,
      depthRule: "ground-cell",
      // When the entity has an occlusion rect, declare explicit render parts
      // so the deterministic depth compositor can interleave actors between
      // the back/body and the front crop. This is the Habbo-style contract:
      // background -> actor behind counter -> counter body -> actor in front
      // -> counter front.
      ...(normalizedOcclusionRect
        ? {
            parts: ["body", "front"] as const,
            partsV2: [
              { role: "body" as const },
              { role: "front" as const, normalizedRect: normalizedOcclusionRect },
            ],
          }
        : {
            parts: ["body"] as const,
          }),
    },
    tags: ["cafe-furniture", "raster-landmark", "raster-backed"],
    accessibleLabel: visualKey,
  },
  ...(normalizedOcclusionRect ? { normalizedOcclusionRect } : {}),
});

/**
 * Logical landmarks laid over the approved Café Biblioteca raster. The art is
 * deliberately not rebuilt: these records add semantics and the one required
 * service-counter depth slice. Collision belongs to the safe-floor mask.
 */
export const CAFE_SPATIAL_ENTITIES: readonly CafeSpatialEntityPresentation[] = [
  entity("cafe-bar", "service-counter", { x: 2, y: 7 }, 8, 6, "Barra del café", [0.075, 0.535, 0.26, 0.185]),
  entity("cafe-kitchen", "kitchen", { x: 8, y: 2 }, 4, 4, "Cocina equipada"),
  entity("cafe-window-table", "table", { x: 17, y: 2 }, 4, 3, "Mesa junto a la ventana"),
  entity("cafe-round-table", "table", { x: 13, y: 6 }, 4, 3, "Mesa verde"),
  entity("cafe-library-fireplace", "library-fireplace", { x: 22, y: 1 }, 8, 4, "Biblioteca y chimenea"),
  entity("cafe-sofa", "sofa-group", { x: 23, y: 6 }, 7, 5, "Sala junto al fuego"),
  entity("cafe-table-left", "table", { x: 10, y: 12 }, 6, 5, "Mesa sobre alfombra verde"),
  entity("cafe-table-right", "table", { x: 18, y: 12 }, 7, 5, "Mesa sobre alfombra roja"),
  entity("cafe-sideboard", "storage", { x: 30, y: 5 }, 1, 3, "Aparador lateral"),
] as const;

const decorAccessibleLabel = (furnitureId: string): string => ({
  fern: "Helecho opcional",
  "warm-lamp": "Lámpara cálida opcional",
  "notice-board": "Tablero comunitario opcional",
})[furnitureId] ?? "Decoración opcional";

const decorPlacementVisual = (
  slotId: string,
  furnitureId: string,
): CafeDecorPlacementVisual | undefined => {
  const slot = CAFE_DECOR_POSITIONS[slotId as keyof typeof CAFE_DECOR_POSITIONS] as
    | Readonly<Record<string, CafeDecorPlacementVisual>>
    | undefined;
  return slot?.[furnitureId];
};

/**
 * Optional purchases are first-class spatial entities, not free-floating
 * sprites. Floor pieces own one collision cell; wall pieces remain addressable
 * without consuming floor space.
 */
export function createCafeOptionalDecorEntities(
  interior: InteriorStateV1 | undefined,
): readonly CafeSpatialEntityPresentation[] {
  return optionalFurniture(interior).flatMap((placement): readonly CafeSpatialEntityPresentation[] => {
    const visual = decorPlacementVisual(placement.slotId, placement.furnitureId);
    if (!visual) return [];
    const floorPiece = visual.surface === "floor";
    return [{
      entity: {
        id: `cafe-decor:${placement.instanceId}`,
        kind: floorPiece ? "optional-floor-decor" : "optional-wall-decor",
        origin: visual.spatialCell,
        orientation: "north",
        footprint: { width: 1, height: 1 },
        blocksMovement: visual.blocksMovement,
        variant: placement.furnitureId,
        render: {
          visualKey: placement.furnitureId,
          depthRule: floorPiece ? "ground-cell" : "fixed-back",
          parts: ["body"],
        },
        tags: [
          "cafe-decoration",
          "optional",
          floorPiece ? "floor-standing" : "wall-mounted",
          placement.slotId,
        ],
        accessibleLabel: decorAccessibleLabel(placement.furnitureId),
      },
    }];
  });
}

export const cafeOptionalDecorSignature = (interior: InteriorStateV1 | undefined): string =>
  optionalFurniture(interior)
    .map((placement) => `${placement.slotId}:${placement.furnitureId}:${placement.instanceId}`)
    .sort()
    .join("|");

const addSafeRectangle = (
  cells: Map<string, GridPoint>,
  left: number,
  top: number,
  right: number,
  bottom: number,
): void => {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) cells.set(`${x},${y}`, { x, y });
  }
};

/**
 * Feet-first navigation authored directly over the approved room raster.
 *
 * Only the visually empty centre aisle is admitted for visitors in v2. A small
 * disconnected service pocket keeps café staff behind the bar. Everything else
 * is structurally absent, so a route can never cross painted furniture even
 * when the furniture art has a complex silhouette.
 */
const floorCells = (): readonly GridPoint[] => {
  const cells = new Map<string, GridPoint>();

  // Twelve guest cells form a short, wide aisle between the two foreground
  // table silhouettes. This is intentionally conservative for the first real
  // integration; additional lanes can be added only after visual calibration.
  addSafeRectangle(cells, 15, 12, 16, 17);

  // Staff-only island behind the counter. It is deliberately disconnected.
  addSafeRectangle(cells, 4, 3, 9, 5);

  return [...cells.values()].sort((left, right) => left.y - right.y || left.x - right.x);
};

const CAFE_SAFE_FLOOR_KEYS = new Set(floorCells().map((cell) => `${cell.x},${cell.y}`));

export const isCafeAuthoredSafeCell = (cell: GridPoint): boolean =>
  CAFE_SAFE_FLOOR_KEYS.has(`${cell.x},${cell.y}`);

const anchorDefinitions = [
  { id: "entry", cell: { x: 16, y: 17 }, facing: "south", reservable: true, tags: ["entry", "portal"] },
  { id: "counter", cell: { x: 15, y: 16 }, facing: "north", entityId: "cafe-bar", reservable: true, tags: ["guest", "coffee"] },
  { id: "table-seat-1", cell: { x: 15, y: 15 }, facing: "north", entityId: "cafe-table-left", reservable: true, tags: ["guest", "seat"] },
  { id: "table-seat-2", cell: { x: 16, y: 15 }, facing: "north", entityId: "cafe-table-right", reservable: true, tags: ["guest", "seat"] },
  { id: "table-seat-3", cell: { x: 15, y: 14 }, facing: "north", entityId: "cafe-table-right", reservable: true, tags: ["guest", "seat"] },
  { id: "library-chair", cell: { x: 16, y: 14 }, facing: "north", entityId: "cafe-library-fireplace", reservable: true, tags: ["guest", "reading"] },
  { id: "fireplace", cell: { x: 15, y: 13 }, facing: "north", entityId: "cafe-sofa", reservable: true, tags: ["guest", "fireplace"] },
  { id: "coffee-machine", cell: { x: 5, y: 5 }, facing: "north", entityId: "cafe-bar", reservable: true, tags: ["staff", "coffee"] },
  { id: "bartender-station", cell: { x: 7, y: 5 }, facing: "north", entityId: "cafe-bar", reservable: true, tags: ["npc-service", "staff", "coffee"] },
] as const;

export type CafeSpatialAnchorId = typeof anchorDefinitions[number]["id"];

export function createCafeSpatialScene(
  buildingId: string,
  interior?: InteriorStateV1,
): SpatialSceneDefinitionV1 {
  const optionalDecor = createCafeOptionalDecorEntities(interior);
  return {
    schema: SPATIAL_SCENE_SCHEMA,
    id: `cafe:${buildingId}`,
    version: 2,
    grid: CAFE_SPATIAL_GRID,
    projection: { kind: "isometric-fixed", tileWidth: 18, tileHeight: 10, origin: { x: 0, y: 0 } },
    walkableCells: floorCells(),
    entities: [
      ...CAFE_SPATIAL_ENTITIES.map(({ entity: definition }) => definition),
      ...optionalDecor.map(({ entity: definition }) => definition),
    ],
    anchors: anchorDefinitions,
    interactions: [
      { id: "interaction-coffee", entityId: "cafe-bar", action: "serve-coffee", anchorIds: ["counter", "coffee-machine"], maxApproachSteps: 1, priority: 30 },
      { id: "interaction-read", entityId: "cafe-library-fireplace", action: "read", anchorIds: ["library-chair"], maxApproachSteps: 1, priority: 20 },
      { id: "interaction-fireplace", entityId: "cafe-library-fireplace", action: "warm-fireplace", anchorIds: ["fireplace"], maxApproachSteps: 1, priority: 20 },
      { id: "interaction-sit-left", entityId: "cafe-table-left", action: "sit", anchorIds: ["table-seat-1"], maxApproachSteps: 1, priority: 10 },
      { id: "interaction-sit-right", entityId: "cafe-table-right", action: "sit", anchorIds: ["table-seat-2", "table-seat-3"], maxApproachSteps: 1, priority: 10 },
    ],
    portals: [{
      id: "cafe-exit",
      cell: { x: 16, y: 17 },
      approachAnchorIds: ["entry"],
      requiredFacing: "south",
      target: { sceneId: "city", portalId: `building:${buildingId}` },
      enabled: true,
    }],
    entryAnchorIds: ["entry"],
    exitAnchorIds: ["entry"],
    lighting: "inherit-world-clock",
    assets: [{
      key: "alpha-cafe-interior",
      role: "structure",
      provenance: "approved alpha-v1 Cafe Biblioteca raster",
    }],
  };
}

export function compileCafeSpatialScene(
  buildingId: string,
  interior?: InteriorStateV1,
): SpatialSceneIndexV1 {
  const compiled = compileSpatialScene(createCafeSpatialScene(buildingId, interior));
  if (!compiled.ok) {
    const detail = compiled.error.issues.map((issue) => `${issue.code}:${issue.id ?? "scene"}`).join(", ");
    throw new Error(`Invalid Café Biblioteca spatial model (${detail}).`);
  }
  return compiled.value;
}

export function cafeAnchorCell(anchorId: string): GridPoint {
  return anchorDefinitions.find((anchor) => anchor.id === anchorId)?.cell ?? anchorDefinitions[0].cell;
}

export function createCafeSpatialActorSeeds(
  state: GameStateV1,
  buildingId: string,
): readonly ManualSpatialActorSeedV1[] {
  const agents = state.agents.flatMap((agent): readonly ManualSpatialActorSeedV1[] => {
    if (agent.location.kind !== "interior" || agent.location.buildingId !== buildingId) return [];
    const location = agent.location as typeof agent.location & { readonly tile?: GridPoint };
    const guestCell = agent.location.anchorId === "coffee-machine" || agent.location.anchorId === "bartender-station"
      ? cafeAnchorCell("counter")
      : cafeAnchorCell(agent.location.anchorId);
    return [{
      actorId: agent.profileId,
      sceneId: `cafe:${buildingId}`,
      possessible: true,
      // Old saves may contain a tile from the former broad rectangular grid.
      // Restore it only when it belongs to the new authored safe surface.
      cell: location.tile && isCafeAuthoredSafeCell(location.tile) ? location.tile : guestCell,
      facing: "south",
    }];
  });
  const npcs = state.npcs.flatMap((npc): readonly ManualSpatialActorSeedV1[] => {
    if (npc.location.kind !== "interior" || npc.location.buildingId !== buildingId) return [];
    const serviceCell = npc.routine === "serving" || npc.routine === "brewing" || npc.routine === "baking"
      ? cafeAnchorCell(npc.location.anchorId === "coffee-machine" ? "coffee-machine" : "bartender-station")
      : cafeAnchorCell(npc.location.anchorId);
    return [{
      actorId: `npc:${npc.id}`,
      sceneId: `cafe:${buildingId}`,
      possessible: false,
      cell: serviceCell,
      facing: "south",
    }];
  });
  return [...agents, ...npcs];
}

export function cafeCellToNormalized(cell: GridPoint): readonly [number, number] {
  const x = NORMALIZED_FLOOR.left + (cell.x / (CAFE_SPATIAL_GRID.width - 1)) * (NORMALIZED_FLOOR.right - NORMALIZED_FLOOR.left);
  const y = NORMALIZED_FLOOR.top + (cell.y / (CAFE_SPATIAL_GRID.height - 1)) * (NORMALIZED_FLOOR.bottom - NORMALIZED_FLOOR.top);
  return [x, y];
}

export function cafeNormalizedToCell(
  normalizedX: number,
  normalizedY: number,
  scene: SpatialSceneIndexV1,
): GridPoint | null {
  const estimate = {
    x: Math.round(((normalizedX - NORMALIZED_FLOOR.left) / (NORMALIZED_FLOOR.right - NORMALIZED_FLOOR.left)) * (CAFE_SPATIAL_GRID.width - 1)),
    y: Math.round(((normalizedY - NORMALIZED_FLOOR.top) / (NORMALIZED_FLOOR.bottom - NORMALIZED_FLOOR.top)) * (CAFE_SPATIAL_GRID.height - 1)),
  };
  if (isSpatialCellWalkable(scene, estimate)) return estimate;
  for (let radius = 1; radius <= 2; radius += 1) {
    const candidates: GridPoint[] = [];
    for (let y = estimate.y - radius; y <= estimate.y + radius; y += 1) {
      for (let x = estimate.x - radius; x <= estimate.x + radius; x += 1) {
        if (Math.abs(x - estimate.x) + Math.abs(y - estimate.y) !== radius) continue;
        candidates.push({ x, y });
      }
    }
    candidates.sort((left, right) => left.y - right.y || left.x - right.x);
    const nearest = candidates.find((candidate) => isSpatialCellWalkable(scene, candidate));
    if (nearest) return nearest;
  }
  return null;
}
