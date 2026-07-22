import type { EconomyStateV1, ProfileId, Result } from "./contracts";

export interface EconomyError {
  readonly code: "INVALID_AMOUNT" | "INSUFFICIENT_FUNDS";
  readonly message: string;
  readonly required?: number;
  readonly available?: number;
}

export interface RewardResult {
  readonly economy: EconomyStateV1;
  readonly reward: number;
}

export const createEconomyState = (startingBalance = 420, day = 1): EconomyStateV1 => {
  if (!Number.isSafeInteger(startingBalance) || startingBalance < 0) {
    throw new Error("Starting balance must be a non-negative safe integer.");
  }
  return {
    balance: startingBalance,
    earned: startingBalance,
    spent: 0,
    rewardDay: day,
    hermesCompletionsToday: {},
    lastLocalRewardTotalMinute: 0,
  };
};

const validAmount = (amount: number): boolean => Number.isSafeInteger(amount) && amount > 0;

export const spendLumenes = (
  economy: EconomyStateV1,
  amount: number,
): Result<EconomyStateV1, EconomyError> => {
  if (!validAmount(amount)) {
    return { ok: false, error: { code: "INVALID_AMOUNT", message: "Amount must be a positive integer." } };
  }
  if (economy.balance < amount) {
    return {
      ok: false,
      error: {
        code: "INSUFFICIENT_FUNDS",
        message: `Need ${amount} L but only ${economy.balance} L are available.`,
        required: amount,
        available: economy.balance,
      },
    };
  }
  return {
    ok: true,
    value: {
      ...economy,
      balance: economy.balance - amount,
      spent: economy.spent + amount,
    },
  };
};

export const grantLocalReward = (economy: EconomyStateV1, amount: number): RewardResult => {
  if (!validAmount(amount)) throw new Error("Reward must be a positive integer.");
  return {
    economy: {
      ...economy,
      balance: economy.balance + amount,
      earned: economy.earned + amount,
    },
    reward: amount,
  };
};

/**
 * A completion is celebratory, not productivist: the first four per profile and
 * in-game day award 5 L; later completions award 1 L. Failed or interrupted
 * work calls no reward function and can therefore never subtract currency.
 */
export const grantHermesCompletionReward = (
  economy: EconomyStateV1,
  profileId: ProfileId,
  day: number,
): RewardResult => {
  const completions = economy.rewardDay === day ? economy.hermesCompletionsToday : {};
  const previous = completions[profileId] ?? 0;
  const reward = previous < 4 ? 5 : 1;
  const rewarded = grantLocalReward(
    {
      ...economy,
      rewardDay: day,
      hermesCompletionsToday: completions,
    },
    reward,
  );
  return {
    reward,
    economy: {
      ...rewarded.economy,
      hermesCompletionsToday: { ...completions, [profileId]: previous + 1 },
    },
  };
};
