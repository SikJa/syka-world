import {
  ALPHA_CATALOG,
  computePlacementGeometry,
  getBuildingDefinition,
  planBuildingPlacement,
  type CardinalDirection,
  type GameStateV1,
  type GridPoint,
} from "../../core";

export type PlacementPreviewErrorCode =
  | "UNKNOWN_DEFINITION"
  | "CATALOG_LOCKED"
  | "INSUFFICIENT_FUNDS"
  | "OUT_OF_BOUNDS"
  | "SECTOR_LOCKED"
  | "TERRAIN_BLOCKED"
  | "COLLISION"
  | "NO_ROAD_ACCESS"
  | "TOWN_LEVEL_LOCKED"
  | "INVALID_ACCESS_TILE"
  | "NO_EXISTING_ROAD"
  | "NO_ROAD_ROUTE"
  | "WORLD_OBJECT_BLOCKED"
  | "INVALID_PLACEMENT";

export interface CityPlacementCosts {
  readonly building: number;
  readonly road: number;
  readonly cleanup: number;
  readonly total: number;
}

export interface CityPlacementPreview {
  readonly definitionId: string;
  readonly origin: GridPoint;
  readonly orientation: CardinalDirection;
  readonly valid: boolean;
  readonly occupiedTiles: readonly GridPoint[];
  readonly accessTile: GridPoint;
  readonly footprintWidth: number;
  readonly footprintHeight: number;
  readonly roadTiles: readonly GridPoint[];
  readonly connectorPath: readonly GridPoint[];
  readonly removedObjectIds: readonly string[];
  readonly costs: CityPlacementCosts;
  readonly affordable: boolean;
  readonly errors: readonly PlacementPreviewErrorCode[];
}

const EMPTY_COSTS: CityPlacementCosts = { building: 0, road: 0, cleanup: 0, total: 0 };

const EXACT_PLACEMENT_ERRORS = new Set<PlacementPreviewErrorCode>([
  "OUT_OF_BOUNDS",
  "SECTOR_LOCKED",
  "TERRAIN_BLOCKED",
  "COLLISION",
  "NO_ROAD_ACCESS",
  "TOWN_LEVEL_LOCKED",
  "INVALID_ACCESS_TILE",
  "NO_EXISTING_ROAD",
  "NO_ROAD_ROUTE",
  "WORLD_OBJECT_BLOCKED",
]);

const detailedPlacementErrors = (details: unknown): readonly PlacementPreviewErrorCode[] => {
  const values = Array.isArray(details) ? details : details ? [details] : [];
  const codes = values.flatMap((value) => {
    if (!value || typeof value !== "object" || !("code" in value)) return [];
    const code = (value as { readonly code?: unknown }).code;
    return typeof code === "string" && EXACT_PLACEMENT_ERRORS.has(code as PlacementPreviewErrorCode)
      ? [code as PlacementPreviewErrorCode]
      : [];
  });
  return [...new Set(codes)];
};

export const createPlacementPreview = (
  state: GameStateV1,
  definitionId: string,
  origin: GridPoint,
  orientation: CardinalDirection,
): CityPlacementPreview => {
  const definition = getBuildingDefinition(definitionId, ALPHA_CATALOG);
  if (!definition) {
    return {
      definitionId,
      origin,
      orientation,
      valid: false,
      occupiedTiles: [],
      accessTile: origin,
      footprintWidth: 0,
      footprintHeight: 0,
      roadTiles: [],
      connectorPath: [],
      removedObjectIds: [],
      costs: EMPTY_COSTS,
      affordable: false,
      errors: ["UNKNOWN_DEFINITION"],
    };
  }
  const geometry = computePlacementGeometry(definition, origin, orientation);
  const result = planBuildingPlacement(state, { definitionId, origin, orientation }, ALPHA_CATALOG);
  if (!result.ok) {
    const exactErrors = detailedPlacementErrors(result.error.details);
    const errors: readonly PlacementPreviewErrorCode[] = result.error.code === "CATALOG_LOCKED"
      ? ["CATALOG_LOCKED"]
      : exactErrors.length > 0
        ? exactErrors
        : ["INVALID_PLACEMENT"];
    return {
      definitionId,
      origin,
      orientation,
      valid: false,
      occupiedTiles: geometry.occupiedTiles,
      accessTile: geometry.accessTile,
      footprintWidth: geometry.footprintWidth,
      footprintHeight: geometry.footprintHeight,
      roadTiles: [],
      connectorPath: [],
      removedObjectIds: [],
      costs: { ...EMPTY_COSTS, building: definition.cost, total: definition.cost },
      affordable: state.economy.balance >= definition.cost,
      errors,
    };
  }
  return {
    definitionId,
    origin,
    orientation,
    valid: result.value.affordable,
    occupiedTiles: geometry.occupiedTiles,
    accessTile: geometry.accessTile,
    footprintWidth: geometry.footprintWidth,
    footprintHeight: geometry.footprintHeight,
    roadTiles: result.value.roadTiles,
    connectorPath: result.value.connectorPath,
    removedObjectIds: result.value.removedObjectIds,
    costs: result.value.costs,
    affordable: result.value.affordable,
    errors: result.value.affordable ? [] : ["INSUFFICIENT_FUNDS"],
  };
};
