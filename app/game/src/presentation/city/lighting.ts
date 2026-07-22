export type CityLightFamily = "streetlamp" | "doorway" | "window" | "accent";

export interface CityLightingState {
  readonly period: "day" | "twilight" | "night";
  readonly ambientTint: number;
  readonly overlayAlpha: number;
  readonly backgroundColor: number;
  readonly familyAlpha: Readonly<Record<CityLightFamily, number>>;
}

const NIGHT_ALPHA: Readonly<Record<CityLightFamily, number>> = {
  streetlamp: 0.78,
  doorway: 0.34,
  window: 0.48,
  accent: 0.56,
};

const scaledFamilyAlpha = (amount: number): Readonly<Record<CityLightFamily, number>> => ({
  streetlamp: NIGHT_ALPHA.streetlamp * amount,
  doorway: NIGHT_ALPHA.doorway * amount,
  window: NIGHT_ALPHA.window * amount,
  accent: NIGHT_ALPHA.accent * amount,
});

/**
 * Presentation-only light curve. Daylight deliberately returns zero for every
 * additive sprite: windows remain readable in the authored raster, but there
 * is no detached halo, pool or cone over the city.
 */
export const getCityLighting = (minuteOfDay: number): CityLightingState => {
  const minute = ((Math.round(minuteOfDay) % 1_440) + 1_440) % 1_440;
  const hour = minute / 60;

  if (hour >= 20 || hour < 6) {
    return {
      period: "night",
      ambientTint: 0x879daf,
      overlayAlpha: 0.18,
      backgroundColor: 0x385b70,
      familyAlpha: NIGHT_ALPHA,
    };
  }

  if (hour >= 17 && hour < 20) {
    const progress = (hour - 17) / 3;
    const intensity = 0.16 + progress * 0.74;
    return {
      period: "twilight",
      ambientTint: 0xd9cbbc,
      overlayAlpha: 0.035 + progress * 0.045,
      backgroundColor: 0x7897ac,
      familyAlpha: scaledFamilyAlpha(intensity),
    };
  }

  if (hour >= 6 && hour < 7.5) {
    const progress = (7.5 - hour) / 1.5;
    return {
      period: "twilight",
      ambientTint: 0xd9cbbc,
      overlayAlpha: 0.025 + progress * 0.055,
      backgroundColor: 0x7897ac,
      familyAlpha: scaledFamilyAlpha(progress * 0.7),
    };
  }

  return {
    period: "day",
    ambientTint: 0xffffff,
    overlayAlpha: 0,
    backgroundColor: 0xa8c9d2,
    familyAlpha: scaledFamilyAlpha(0),
  };
};

export const resolvedLightAlpha = (
  family: CityLightFamily,
  strength: number,
  lighting: CityLightingState,
): number => Math.max(0, Math.min(1, strength * lighting.familyAlpha[family]));
