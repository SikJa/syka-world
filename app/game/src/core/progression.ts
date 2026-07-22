import { ALPHA_CATALOG, getBuildingDefinition, getUpgradeDefinition } from "./catalog";
import type {
  BuildingDefinitionV1,
  BuildingUpgradeDefinitionV1,
  CatalogV1,
  GameStateV1,
  ProgressionStateV1,
} from "./contracts";

const unlockedForLevel = (level: number, catalog: CatalogV1): readonly string[] =>
  catalog.buildings.filter((building) => building.requiredTownLevel <= level).map((building) => building.id);

export const buildingCompletionMilestone = (buildingId: string): string => `building:${buildingId}`;
export const upgradeCompletionMilestone = (buildingId: string, upgradeId: string): string =>
  `upgrade:${buildingId}:${upgradeId}`;

/**
 * Cost and footprint both express impact on the town. The first alpha cafe is
 * intentionally worth exactly 100 XP, opening level two without a grind loop.
 */
export const buildingCompletionXp = (definition: BuildingDefinitionV1): number =>
  Math.ceil(definition.cost / 4) + definition.footprint.width * definition.footprint.height * 2;

export const upgradeCompletionXp = (definition: BuildingUpgradeDefinitionV1): number =>
  Math.max(20, Math.ceil(definition.cost / 8));

export const addTownXp = (
  progression: ProgressionStateV1,
  amount: number,
  catalog: CatalogV1 = ALPHA_CATALOG,
): ProgressionStateV1 => {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Town XP must be a non-negative integer.");
  const townXp = progression.townXp + amount;
  const townLevel = Math.max(progression.townLevel, townXp >= 300 ? 3 : townXp >= 100 ? 2 : 1);
  return {
    ...progression,
    townXp,
    townLevel,
    unlockedBuildingIds: Array.from(new Set([...progression.unlockedBuildingIds, ...unlockedForLevel(townLevel, catalog)])),
  };
};

/** Scan completed state and reward only milestones that have never been seen. */
export const applyCompletionXp = (
  state: GameStateV1,
  catalog: CatalogV1 = ALPHA_CATALOG,
): GameStateV1 => {
  const rewarded = new Set(state.progression.rewardedMilestones);
  let progression = state.progression;
  for (const building of state.buildings) {
    if (building.status === "complete") {
      const key = buildingCompletionMilestone(building.id);
      if (!rewarded.has(key)) {
        const definition = getBuildingDefinition(building.definitionId, catalog);
        progression = addTownXp(progression, definition ? buildingCompletionXp(definition) : 0, catalog);
        rewarded.add(key);
      }
    }
    for (const upgradeId of building.installedUpgrades) {
      const key = upgradeCompletionMilestone(building.id, upgradeId);
      if (rewarded.has(key)) continue;
      const definition = getUpgradeDefinition(upgradeId, catalog);
      progression = addTownXp(progression, definition ? upgradeCompletionXp(definition) : 0, catalog);
      rewarded.add(key);
    }
  }
  const rewardedMilestones = [...rewarded];
  return progression === state.progression && rewardedMilestones.length === state.progression.rewardedMilestones.length
    ? state
    : { ...state, progression: { ...progression, rewardedMilestones } };
};

/** Existing authored/save buildings are baselines, not retroactive XP farms. */
export const markExistingCompletionMilestones = (state: GameStateV1): GameStateV1 => {
  const rewarded = new Set(state.progression.rewardedMilestones);
  for (const building of state.buildings) {
    if (building.status === "complete") rewarded.add(buildingCompletionMilestone(building.id));
    for (const upgradeId of building.installedUpgrades) rewarded.add(upgradeCompletionMilestone(building.id, upgradeId));
  }
  return { ...state, progression: { ...state.progression, rewardedMilestones: [...rewarded] } };
};
