import type { CatalogV1, GameStateV1 } from "./contracts";
import { ALPHA_CATALOG } from "./catalog";
import { advanceConstruction } from "./construction";
import { advanceAgentRoutines } from "./agents";
import { grantLocalReward } from "./economy";
import { advanceNpcRoutines } from "./npcs";

/**
 * One renderer-independent simulation step. Local life awards 2 L every six
 * simulated hours, so a world without Hermes still progresses gently.
 */
export const advanceSimulation = (
  state: GameStateV1,
  minutes: number,
  catalog: CatalogV1 = ALPHA_CATALOG,
): GameStateV1 => {
  if (!Number.isSafeInteger(minutes) || minutes < 0) throw new Error("Simulation delta must be a non-negative integer.");
  if (minutes === 0) return state;
  // Keep large QA/load steps narratively equivalent to normal one-minute
  // runtime ticks. This preserves intermediate routines and lets agents react
  // to a building that finishes partway through a long step.
  let advanced = state;
  for (let minute = 0; minute < minutes; minute += 1) {
    advanced = advanceConstruction(advanced, 1, catalog);
    advanced = advanceNpcRoutines(advanceAgentRoutines(advanced, 1));
  }
  const previousBucket = Math.floor(state.economy.lastLocalRewardTotalMinute / 360);
  const currentBucket = Math.floor(advanced.clock.totalMinutes / 360);
  const bucketsCrossed = Math.max(0, currentBucket - previousBucket);
  if (bucketsCrossed > 0) {
    const rewarded = grantLocalReward(advanced.economy, bucketsCrossed * 2);
    advanced = {
      ...advanced,
      economy: {
        ...rewarded.economy,
        lastLocalRewardTotalMinute: currentBucket * 360,
      },
    };
  }
  return advanced;
};
