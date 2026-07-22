import { ALPHA_CATALOG, getBuildingDefinition, getFurnitureDefinition, getInteriorDefinition, getUpgradeDefinition } from "./catalog";
import { reconcileAgentBindings } from "./agents";
import type {
  BuildingInstanceV1,
  BuildingStatus,
  CardinalDirection,
  CatalogV1,
  FurniturePlacementV1,
  GameStateV1,
  GridPoint,
  InteriorStateV1,
  Result,
} from "./contracts";
import { INTERIOR_SCHEMA } from "./contracts";
import { spendLumenes } from "./economy";
import { occupyBuildingTiles, paintTerrain, unlockMapSector, validatePlacement } from "./map";
import { applyCompletionXp } from "./progression";
import { planRoadConnector } from "./roadConnector";
import { worldObjectCleanupCost, worldObjectsAt } from "./worldObjects";

export type GameMutationErrorCode =
  | "UNKNOWN_DEFINITION"
  | "CATALOG_LOCKED"
  | "INVALID_PLACEMENT"
  | "INSUFFICIENT_FUNDS"
  | "UNKNOWN_BUILDING"
  | "BUILDING_INCOMPLETE"
  | "INVALID_UPGRADE"
  | "UPGRADE_IN_PROGRESS"
  | "UNKNOWN_SECTOR"
  | "SECTOR_ALREADY_UNLOCKED"
  | "INVALID_DECORATION"
  | "NOTHING_TO_ACCELERATE";

export interface GameMutationError {
  readonly code: GameMutationErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

export interface PlaceBuildingRequest {
  readonly definitionId: string;
  readonly origin: GridPoint;
  readonly orientation: CardinalDirection;
  readonly instanceId?: string;
}

export interface BuildingPlacementCostBreakdown {
  readonly building: number;
  readonly road: number;
  readonly cleanup: number;
  readonly total: number;
}

/** Public preview contract. Commit reuses this exact deterministic plan. */
export interface BuildingPlacementPlan {
  readonly definitionId: string;
  readonly origin: GridPoint;
  readonly orientation: CardinalDirection;
  readonly occupiedTiles: readonly GridPoint[];
  readonly entranceTile: GridPoint;
  readonly accessTile: GridPoint;
  readonly footprintWidth: number;
  readonly footprintHeight: number;
  readonly connectorPath: readonly GridPoint[];
  readonly roadTiles: readonly GridPoint[];
  readonly removedObjectIds: readonly string[];
  readonly costs: BuildingPlacementCostBreakdown;
  readonly affordable: boolean;
}

const nextBuildingId = (state: GameStateV1): string => {
  const used = new Set(state.buildings.map((building) => building.id));
  let suffix = state.buildings.length + 1;
  while (used.has(`building-${suffix}`)) suffix += 1;
  return `building-${suffix}`;
};

const totalConstructionMinutes = (durations: readonly { readonly durationMinutes: number }[]): number =>
  durations.reduce((total, stage) => total + stage.durationMinutes, 0);

export const planBuildingPlacement = (
  state: GameStateV1,
  request: PlaceBuildingRequest,
  catalog: CatalogV1 = ALPHA_CATALOG,
): Result<BuildingPlacementPlan, GameMutationError> => {
  const definition = getBuildingDefinition(request.definitionId, catalog);
  if (!definition) {
    return { ok: false, error: { code: "UNKNOWN_DEFINITION", message: `Unknown building ${request.definitionId}.` } };
  }
  if (!state.progression.unlockedBuildingIds.includes(definition.id)) {
    return { ok: false, error: { code: "CATALOG_LOCKED", message: `${definition.name} is not unlocked.` } };
  }
  const placement = validatePlacement(
    state.map,
    state.buildings,
    definition,
    request.origin,
    request.orientation,
    state.progression.townLevel,
    false,
  );
  if (!placement.ok) {
    return {
      ok: false,
      error: { code: "INVALID_PLACEMENT", message: "The selected footprint is not buildable.", details: placement.error },
    };
  }
  if (request.instanceId && state.buildings.some((building) => building.id === request.instanceId)) {
    return { ok: false, error: { code: "INVALID_PLACEMENT", message: `Building id ${request.instanceId} already exists.` } };
  }
  const connector = planRoadConnector(state, placement.value.accessTile, placement.value.occupiedTiles);
  if (!connector.ok) {
    return {
      ok: false,
      error: { code: "INVALID_PLACEMENT", message: connector.error.message, details: connector.error },
    };
  }
  const affectedObjects = [
    ...worldObjectsAt(state, placement.value.occupiedTiles),
    ...worldObjectsAt(state, connector.value.roadTiles),
  ].filter((object, index, all) => all.findIndex((candidate) => candidate.instanceId === object.instanceId) === index);
  const blocker = affectedObjects.find((object) => !object.removable);
  if (blocker) {
    return {
      ok: false,
      error: {
        code: "INVALID_PLACEMENT",
        message: `Exterior object ${blocker.definitionId} cannot be removed.`,
        details: { code: "WORLD_OBJECT_BLOCKED", instanceId: blocker.instanceId, tile: blocker.hostTile },
      },
    };
  }
  const cleanup = affectedObjects.reduce((total, object) => total + worldObjectCleanupCost(object, catalog), 0);
  const costs: BuildingPlacementCostBreakdown = {
    building: definition.cost,
    road: connector.value.cost,
    cleanup,
    total: definition.cost + connector.value.cost + cleanup,
  };
  return {
    ok: true,
    value: {
      definitionId: definition.id,
      origin: request.origin,
      orientation: request.orientation,
      occupiedTiles: placement.value.occupiedTiles,
      entranceTile: placement.value.entranceTile,
      accessTile: placement.value.accessTile,
      footprintWidth: placement.value.footprintWidth,
      footprintHeight: placement.value.footprintHeight,
      connectorPath: connector.value.path,
      roadTiles: connector.value.roadTiles,
      removedObjectIds: affectedObjects.map((object) => object.instanceId),
      costs,
      affordable: state.economy.balance >= costs.total,
    },
  };
};

export const placeBuilding = (
  state: GameStateV1,
  request: PlaceBuildingRequest,
  catalog: CatalogV1 = ALPHA_CATALOG,
): Result<GameStateV1, GameMutationError> => {
  const definition = getBuildingDefinition(request.definitionId, catalog);
  const planned = planBuildingPlacement(state, request, catalog);
  if (!planned.ok) return planned;
  if (!definition) {
    return { ok: false, error: { code: "UNKNOWN_DEFINITION", message: `Unknown building ${request.definitionId}.` } };
  }
  const payment = spendLumenes(state.economy, planned.value.costs.total);
  if (!payment.ok) {
    return { ok: false, error: { code: "INSUFFICIENT_FUNDS", message: payment.error.message, details: payment.error } };
  }
  const id = request.instanceId ?? nextBuildingId(state);
  const totalMinutes = totalConstructionMinutes(definition.constructionStages);
  const building: BuildingInstanceV1 = {
    id,
    definitionId: definition.id,
    kind: definition.kind,
    origin: request.origin,
    orientation: request.orientation,
    occupiedTiles: planned.value.occupiedTiles,
    entranceTile: planned.value.entranceTile,
    accessTile: planned.value.accessTile,
    status: "foundation",
    construction: { elapsedMinutes: 0, totalMinutes, stageIndex: 0 },
    level: 1,
    visualVariant: definition.id,
    installedUpgrades: [],
    interiorId: definition.interiorId,
  };
  return {
    ok: true,
    value: {
      ...state,
      map: occupyBuildingTiles(paintTerrain(state.map, planned.value.roadTiles, "road"), building),
      buildings: [...state.buildings, building],
      worldObjects: state.worldObjects.filter(
        (object) => !planned.value.removedObjectIds.includes(object.instanceId),
      ),
      economy: payment.value,
    },
  };
};

const statusForElapsed = (
  elapsed: number,
  stages: readonly { readonly id: Exclude<BuildingStatus, "planned" | "complete">; readonly durationMinutes: number }[],
): { readonly status: BuildingStatus; readonly stageIndex: number } => {
  let threshold = 0;
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    if (!stage) continue;
    threshold += stage.durationMinutes;
    if (elapsed < threshold) return { status: stage.id, stageIndex: index };
  }
  return { status: "complete", stageIndex: stages.length };
};

const createDefaultInterior = (building: BuildingInstanceV1, catalog: CatalogV1): InteriorStateV1 | undefined => {
  const definition = getInteriorDefinition(building.interiorId, catalog);
  if (!definition) return undefined;
  return {
    schema: INTERIOR_SCHEMA,
    buildingId: building.id,
    definitionId: definition.id,
    furniture: definition.defaultFurniture.map((placement) => ({ ...placement, instanceId: `${building.id}-${placement.instanceId}` })),
  };
};

export const advanceConstruction = (
  state: GameStateV1,
  minutes: number,
  catalog: CatalogV1 = ALPHA_CATALOG,
): GameStateV1 => {
  if (!Number.isFinite(minutes) || minutes < 0) throw new Error("Construction delta must be non-negative.");
  if (minutes === 0) return state;
  let completionOccurred = false;
  const buildings = state.buildings.map((building): BuildingInstanceV1 => {
    const advanced = advanceBuildingRecord(building, minutes, catalog);
    completionOccurred ||= advanced.completionOccurred;
    return advanced.building;
  });
  const advanced = { ...state, buildings };
  return completionOccurred ? applyConstructionCompletionEffects(advanced, catalog) : advanced;
};

interface AdvancedBuildingRecord {
  readonly building: BuildingInstanceV1;
  readonly completionOccurred: boolean;
}

const advanceBuildingRecord = (
  building: BuildingInstanceV1,
  minutes: number,
  catalog: CatalogV1,
): AdvancedBuildingRecord => {
  let next = building;
  let completionOccurred = false;
  if (building.status !== "complete") {
    const definition = getBuildingDefinition(building.definitionId, catalog);
    if (definition) {
      const elapsedMinutes = Math.min(building.construction.totalMinutes, building.construction.elapsedMinutes + minutes);
      const stage = statusForElapsed(elapsedMinutes, definition.constructionStages);
      next = {
        ...building,
        status: stage.status,
        construction: { ...building.construction, elapsedMinutes, stageIndex: stage.stageIndex },
      };
      completionOccurred = stage.status === "complete";
    }
  }
  if (next.activeUpgrade) {
    const elapsedMinutes = Math.min(next.activeUpgrade.totalMinutes, next.activeUpgrade.elapsedMinutes + minutes);
    if (elapsedMinutes >= next.activeUpgrade.totalMinutes) {
      const upgrade = getUpgradeDefinition(next.activeUpgrade.definitionId, catalog);
      const { activeUpgrade: _completed, ...withoutUpgrade } = next;
      next = upgrade
        ? {
            ...withoutUpgrade,
            level: upgrade.targetLevel,
            visualVariant: upgrade.visualVariant,
            installedUpgrades: withoutUpgrade.installedUpgrades.includes(upgrade.id)
              ? withoutUpgrade.installedUpgrades
              : [...withoutUpgrade.installedUpgrades, upgrade.id],
          }
        : withoutUpgrade;
      completionOccurred = true;
    } else {
      next = { ...next, activeUpgrade: { ...next.activeUpgrade, elapsedMinutes } };
    }
  }
  return { building: next, completionOccurred };
};

const applyConstructionCompletionEffects = (state: GameStateV1, catalog: CatalogV1): GameStateV1 => {
  const existingInteriors = new Set(state.interiors.map((interior) => interior.buildingId));
  const addedInteriors = state.buildings
    .filter((building) => building.status === "complete" && !existingInteriors.has(building.id))
    .map((building) => createDefaultInterior(building, catalog))
    .filter((interior): interior is InteriorStateV1 => interior !== undefined);
  const furnished = addedInteriors.length > 0
    ? { ...state, interiors: [...state.interiors, ...addedInteriors] }
    : state;
  return reconcileAgentBindings(applyCompletionXp(furnished, catalog));
};

export type ConstructionAccelerationMode = "one-hour" | "finish-now";

export interface ConstructionAccelerationQuote {
  readonly buildingId: string;
  readonly target: "building" | "upgrade";
  readonly mode: ConstructionAccelerationMode;
  readonly remainingMinutes: number;
  readonly advancedMinutes: number;
  readonly cost: number;
  readonly affordable: boolean;
}

export const getConstructionAccelerationQuote = (
  state: GameStateV1,
  buildingId: string,
  mode: ConstructionAccelerationMode,
): Result<ConstructionAccelerationQuote, GameMutationError> => {
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  if (!building) return { ok: false, error: { code: "UNKNOWN_BUILDING", message: `Unknown building ${buildingId}.` } };
  const target = building.status !== "complete" ? "building" : building.activeUpgrade ? "upgrade" : undefined;
  const remainingMinutes = target === "building"
    ? Math.max(0, building.construction.totalMinutes - building.construction.elapsedMinutes)
    : target === "upgrade" && building.activeUpgrade
      ? Math.max(0, building.activeUpgrade.totalMinutes - building.activeUpgrade.elapsedMinutes)
      : 0;
  if (!target || remainingMinutes <= 0) {
    return { ok: false, error: { code: "NOTHING_TO_ACCELERATE", message: "This building has no active construction." } };
  }
  const advancedMinutes = mode === "one-hour" ? Math.min(60, remainingMinutes) : remainingMinutes;
  // Finish-now rounds remaining hours up. The final partial +1h action is
  // proportional, rounded to one whole Lumen, as specified by the alpha goal.
  const cost = mode === "finish-now"
    ? Math.ceil(remainingMinutes / 60) * 4
    : advancedMinutes === 60
      ? 4
      : Math.max(1, Math.ceil((advancedMinutes * 4) / 60));
  return {
    ok: true,
    value: {
      buildingId,
      target,
      mode,
      remainingMinutes,
      advancedMinutes,
      cost,
      affordable: state.economy.balance >= cost,
    },
  };
};

export const accelerateConstruction = (
  state: GameStateV1,
  buildingId: string,
  mode: ConstructionAccelerationMode,
  catalog: CatalogV1 = ALPHA_CATALOG,
): Result<GameStateV1, GameMutationError> => {
  const quote = getConstructionAccelerationQuote(state, buildingId, mode);
  if (!quote.ok) return quote;
  const payment = spendLumenes(state.economy, quote.value.cost);
  if (!payment.ok) {
    return { ok: false, error: { code: "INSUFFICIENT_FUNDS", message: payment.error.message, details: payment.error } };
  }
  let completionOccurred = false;
  const buildings = state.buildings.map((building) => {
    if (building.id !== buildingId) return building;
    const advanced = advanceBuildingRecord(building, quote.value.advancedMinutes, catalog);
    completionOccurred = advanced.completionOccurred;
    return advanced.building;
  });
  const accelerated = { ...state, economy: payment.value, buildings };
  return {
    ok: true,
    value: completionOccurred ? applyConstructionCompletionEffects(accelerated, catalog) : accelerated,
  };
};

export const startBuildingUpgrade = (
  state: GameStateV1,
  buildingId: string,
  upgradeId: string,
  catalog: CatalogV1 = ALPHA_CATALOG,
): Result<GameStateV1, GameMutationError> => {
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  if (!building) return { ok: false, error: { code: "UNKNOWN_BUILDING", message: `Unknown building ${buildingId}.` } };
  if (building.status !== "complete") {
    return { ok: false, error: { code: "BUILDING_INCOMPLETE", message: "Finish construction before upgrading." } };
  }
  if (building.activeUpgrade) {
    return { ok: false, error: { code: "UPGRADE_IN_PROGRESS", message: "This building is already being upgraded." } };
  }
  const upgrade = getUpgradeDefinition(upgradeId, catalog);
  if (
    !upgrade ||
    upgrade.buildingKind !== building.kind ||
    upgrade.requiredLevel !== building.level ||
    building.installedUpgrades.includes(upgrade.id)
  ) {
    return { ok: false, error: { code: "INVALID_UPGRADE", message: `Upgrade ${upgradeId} does not apply.` } };
  }
  const payment = spendLumenes(state.economy, upgrade.cost);
  if (!payment.ok) {
    return { ok: false, error: { code: "INSUFFICIENT_FUNDS", message: payment.error.message, details: payment.error } };
  }
  return {
    ok: true,
    value: {
      ...state,
      economy: payment.value,
      buildings: state.buildings.map((candidate) =>
        candidate.id === buildingId
          ? {
              ...candidate,
              activeUpgrade: {
                definitionId: upgrade.id,
                elapsedMinutes: 0,
                totalMinutes: upgrade.constructionMinutes,
              },
            }
          : candidate,
      ),
    },
  };
};

export const unlockSector = (state: GameStateV1, sectorId: string): Result<GameStateV1, GameMutationError> => {
  const sector = state.map.sectors.find((candidate) => candidate.id === sectorId);
  if (!sector) return { ok: false, error: { code: "UNKNOWN_SECTOR", message: `Unknown sector ${sectorId}.` } };
  if (sector.unlocked) {
    return { ok: false, error: { code: "SECTOR_ALREADY_UNLOCKED", message: `${sector.name} is already unlocked.` } };
  }
  const payment = spendLumenes(state.economy, sector.unlockCost);
  if (!payment.ok) {
    return { ok: false, error: { code: "INSUFFICIENT_FUNDS", message: payment.error.message, details: payment.error } };
  }
  const map = unlockMapSector(state.map, sectorId);
  if (!map) return { ok: false, error: { code: "UNKNOWN_SECTOR", message: `Unknown sector ${sectorId}.` } };
  return { ok: true, value: { ...state, map, economy: payment.value } };
};

export const installOptionalFurniture = (
  state: GameStateV1,
  buildingId: string,
  slotId: string,
  furnitureId: string,
  catalog: CatalogV1 = ALPHA_CATALOG,
): Result<GameStateV1, GameMutationError> => {
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  if (!building) return { ok: false, error: { code: "UNKNOWN_BUILDING", message: `Unknown building ${buildingId}.` } };
  if (building.status !== "complete") {
    return { ok: false, error: { code: "BUILDING_INCOMPLETE", message: "Furniture requires a completed building." } };
  }
  const interior = state.interiors.find((candidate) => candidate.buildingId === buildingId);
  const definition = getInteriorDefinition(building.interiorId, catalog);
  const furniture = getFurnitureDefinition(furnitureId, catalog);
  const slot = definition?.slots.find((candidate) => candidate.id === slotId);
  if (!interior || !definition || !furniture || !slot?.optional || !slot.accepts.includes(furnitureId)) {
    return { ok: false, error: { code: "INVALID_DECORATION", message: "Furniture is not valid for this optional slot." } };
  }
  const payment = spendLumenes(state.economy, furniture.price);
  if (!payment.ok) {
    return { ok: false, error: { code: "INSUFFICIENT_FUNDS", message: payment.error.message, details: payment.error } };
  }
  const placement: FurniturePlacementV1 = {
    instanceId: `${buildingId}-${slotId}-${furnitureId}`,
    furnitureId,
    slotId,
  };
  return {
    ok: true,
    value: {
      ...state,
      economy: payment.value,
      interiors: state.interiors.map((candidate) =>
        candidate.buildingId === buildingId
          ? {
              ...candidate,
              furniture: [...candidate.furniture.filter((item) => item.slotId !== slotId), placement],
            }
          : candidate,
      ),
    },
  };
};
