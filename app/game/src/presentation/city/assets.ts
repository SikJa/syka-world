import type { AgentActivity, AgentId, BuildingKind, BuildingStatus, CardinalDirection } from "../../core";
import { CITY_HALF_TILE_WIDTH } from "./projection";

export const CITY_ASSET_PATHS = Object.freeze({
  terrain: "/assets/generated/gate-v2/terrain-tiles-atlas-v2.png",
  props: "/assets/generated/gate-v2/environment-props-sheet-v1.png",
  groundDecals: "/assets/generated/gate-v2/ground-decals-sheet-v1.png",
  environmentCorrections: "/assets/generated/alpha-v1/environment-corrections-sheet-v1.png",
  lightFx: "/assets/generated/gate-v3/light-fx-sheet-v1.png",
  fallbackHouse: "/assets/generated/gate-v2/house-exterior-v1.png",
  fallbackCafe: "/assets/generated/gate-v2/cafe-exterior-v1.png",
  alphaBuildings: "/assets/generated/alpha-v1/buildings-sheet-v1.png",
  alphaConstruction: "/assets/generated/alpha-v1/construction-sheet-v1.png",
  alphaAgents: "/assets/generated/alpha-v1/agents-sheet-v1.png",
});

export const CITY_TEXTURE_KEYS = Object.freeze({
  terrain: "city-terrain-v2",
  props: "city-props-v1",
  groundDecals: "city-ground-decals-v1",
  environmentCorrections: "city-environment-corrections-v1",
  lightFx: "city-light-fx-v1",
  fallbackHouse: "city-fallback-house-v1",
  fallbackCafe: "city-fallback-cafe-v1",
  alphaBuildings: "city-alpha-buildings-v1",
  alphaConstruction: "city-alpha-construction-v1",
  alphaAgents: "city-alpha-agents-v1",
  fallbackAgent: "city-fallback-agent-v1",
});

export const BUILDING_KIND_ORDER: readonly BuildingKind[] = [
  "home",
  "cafe",
  "marketing-office",
  "commercial-office",
  "crm-workshop",
  "community-hall",
];

export const AGENT_ID_ORDER: readonly AgentId[] = ["syka", "elen", "astrelis", "zerny"];

export const AGENT_ACTIVITY_ORDER: readonly AgentActivity[] = [
  "idle",
  "thinking",
  "using-tool",
  "waiting",
  "done",
  "interrupted",
  "error",
  "offline",
];

export interface SourceFrameSpec {
  readonly crop: readonly [number, number, number, number];
  readonly draw: readonly [number, number];
}

export const FALLBACK_BUILDING_SOURCE_FRAMES = Object.freeze({
  house: {
    crop: [339, 78, 853, 905] as const,
    draw: [92, 98] as const,
    pivot: [427 / 853, 903 / 905] as const,
  },
  cafe: {
    crop: [330, 87, 894, 878] as const,
    draw: [118, 116] as const,
    pivot: [447 / 894, 876 / 878] as const,
  },
});

export interface BuildingVisualCalibration {
  /** Logical tiles reserved for every ground-level part of the sprite. */
  readonly contactFootprint: readonly [number, number];
  /** Pixel correction from the footprint's lower vertex to the sprite pivot. */
  readonly spriteOffset: readonly [number, number];
  readonly nativeOrientation: CardinalDirection;
  readonly supportedOrientations: readonly CardinalDirection[];
}

const NORTH_ONLY_ORIENTATION: readonly CardinalDirection[] = ["north"];

export const BUILDING_VISUAL_CALIBRATIONS = Object.freeze({
  home: {
    contactFootprint: [4, 3],
    spriteOffset: [-8, -10],
    nativeOrientation: "north",
    supportedOrientations: NORTH_ONLY_ORIENTATION,
  },
  cafe: {
    contactFootprint: [5, 4],
    spriteOffset: [-11, -13],
    nativeOrientation: "north",
    supportedOrientations: NORTH_ONLY_ORIENTATION,
  },
  "marketing-office": {
    contactFootprint: [4, 4],
    spriteOffset: [-5, -15],
    nativeOrientation: "north",
    supportedOrientations: NORTH_ONLY_ORIENTATION,
  },
  "commercial-office": {
    contactFootprint: [4, 4],
    spriteOffset: [-2, -14],
    nativeOrientation: "north",
    supportedOrientations: NORTH_ONLY_ORIENTATION,
  },
  "crm-workshop": {
    contactFootprint: [5, 4],
    spriteOffset: [-8, -18],
    nativeOrientation: "north",
    supportedOrientations: NORTH_ONLY_ORIENTATION,
  },
  "community-hall": {
    contactFootprint: [5, 4],
    spriteOffset: [-7, -16],
    nativeOrientation: "north",
    supportedOrientations: NORTH_ONLY_ORIENTATION,
  },
} satisfies Readonly<Record<BuildingKind, BuildingVisualCalibration>>);

export interface BuildingVisualSpec extends BuildingVisualCalibration {
  readonly texture: string;
  readonly frame: string;
  readonly draw: readonly [number, number];
  readonly pivot: readonly [number, number];
  readonly tint: number;
  readonly provisional: boolean;
}

export const BUILDING_DRAW_SIZE: Readonly<Record<BuildingKind, readonly [number, number]>> = {
  // Keep the authored proportions while leaving an actual raster-visible
  // grass apron inside the logical parcel. The former sizes filled or
  // exceeded the entire projected diamond and could therefore sit on roads.
  home: [92, 98],
  cafe: [118, 116],
  "marketing-office": [112, 110],
  "commercial-office": [108, 106],
  "crm-workshop": [118, 106],
  "community-hall": [117, 108],
};

const FALLBACK_BY_KIND: Readonly<Record<BuildingKind, BuildingVisualSpec>> = {
  home: {
    ...BUILDING_VISUAL_CALIBRATIONS.home,
    texture: CITY_TEXTURE_KEYS.fallbackHouse,
    frame: "body",
    draw: BUILDING_DRAW_SIZE.home,
    pivot: FALLBACK_BUILDING_SOURCE_FRAMES.house.pivot,
    tint: 0xffffff,
    provisional: true,
  },
  cafe: {
    ...BUILDING_VISUAL_CALIBRATIONS.cafe,
    texture: CITY_TEXTURE_KEYS.fallbackCafe,
    frame: "body",
    draw: BUILDING_DRAW_SIZE.cafe,
    pivot: FALLBACK_BUILDING_SOURCE_FRAMES.cafe.pivot,
    tint: 0xffffff,
    provisional: true,
  },
  "marketing-office": {
    ...BUILDING_VISUAL_CALIBRATIONS["marketing-office"],
    texture: CITY_TEXTURE_KEYS.fallbackCafe,
    frame: "body",
    draw: BUILDING_DRAW_SIZE["marketing-office"],
    pivot: FALLBACK_BUILDING_SOURCE_FRAMES.cafe.pivot,
    tint: 0xcfe8ef,
    provisional: true,
  },
  "commercial-office": {
    ...BUILDING_VISUAL_CALIBRATIONS["commercial-office"],
    texture: CITY_TEXTURE_KEYS.fallbackCafe,
    frame: "body",
    draw: BUILDING_DRAW_SIZE["commercial-office"],
    pivot: FALLBACK_BUILDING_SOURCE_FRAMES.cafe.pivot,
    tint: 0xffe4bb,
    provisional: true,
  },
  "crm-workshop": {
    ...BUILDING_VISUAL_CALIBRATIONS["crm-workshop"],
    texture: CITY_TEXTURE_KEYS.fallbackCafe,
    frame: "body",
    draw: BUILDING_DRAW_SIZE["crm-workshop"],
    pivot: FALLBACK_BUILDING_SOURCE_FRAMES.cafe.pivot,
    tint: 0xc8d6bb,
    provisional: true,
  },
  "community-hall": {
    ...BUILDING_VISUAL_CALIBRATIONS["community-hall"],
    texture: CITY_TEXTURE_KEYS.fallbackCafe,
    frame: "body",
    draw: BUILDING_DRAW_SIZE["community-hall"],
    pivot: FALLBACK_BUILDING_SOURCE_FRAMES.cafe.pivot,
    tint: 0xead8bc,
    provisional: true,
  },
};

export const resolveBuildingVisual = (kind: BuildingKind, alphaAvailable: boolean): BuildingVisualSpec =>
  alphaAvailable
    ? {
        ...BUILDING_VISUAL_CALIBRATIONS[kind],
        texture: CITY_TEXTURE_KEYS.alphaBuildings,
        frame: `building-${kind}`,
        draw: BUILDING_DRAW_SIZE[kind],
        pivot: [0.5, 1],
        tint: 0xffffff,
        provisional: false,
      }
    : FALLBACK_BY_KIND[kind];

export const normalizeBuildingOrientation = (
  kind: BuildingKind,
  orientation: CardinalDirection,
): CardinalDirection => {
  const calibration = BUILDING_VISUAL_CALIBRATIONS[kind];
  return calibration.supportedOrientations.includes(orientation) ? orientation : calibration.nativeOrientation;
};

export const resolveBuildingSpriteOffset = (
  visual: BuildingVisualSpec,
  renderedFootprint: { readonly width: number; readonly height: number },
): readonly [number, number] => {
  const [contactWidth, contactHeight] = visual.contactFootprint;
  const canonicalCenterX = ((contactHeight - contactWidth) * CITY_HALF_TILE_WIDTH) / 2;
  const renderedCenterX = ((renderedFootprint.height - renderedFootprint.width) * CITY_HALF_TILE_WIDTH) / 2;
  return [visual.spriteOffset[0] + renderedCenterX - canonicalCenterX, visual.spriteOffset[1]];
};

export interface ConstructionVisualSpec {
  readonly useConstructionSheet: boolean;
  readonly frame?: string;
  readonly alpha: number;
  readonly tint: number;
}

export const resolveConstructionVisual = (
  status: BuildingStatus,
  constructionSheetAvailable: boolean,
): ConstructionVisualSpec => {
  if (status === "complete") return { useConstructionSheet: false, alpha: 1, tint: 0xffffff };
  if (status === "planned") return { useConstructionSheet: false, alpha: 0.22, tint: 0xb8aa8b };
  if (constructionSheetAvailable) {
    return { useConstructionSheet: true, frame: `construction-${status}`, alpha: 1, tint: 0xffffff };
  }
  const fallback = {
    foundation: { alpha: 0.34, tint: 0xb9aa8e },
    framing: { alpha: 0.56, tint: 0xd2b887 },
    finishing: { alpha: 0.78, tint: 0xe7d3ad },
  } as const;
  return { useConstructionSheet: false, ...fallback[status] };
};

export const PROP_SOURCE_FRAMES = Object.freeze({
  "tree-round": { crop: [108, 31, 247, 275], draw: [42, 47] },
  "tree-narrow": { crop: [539, 31, 138, 275], draw: [23, 46] },
  "shrub-round": { crop: [880, 134, 187, 169], draw: [21, 18] },
  "shrub-flowering": { crop: [1264, 160, 203, 143], draw: [27, 18] },
  "hedge-two-segment": { crop: [115, 449, 248, 118], draw: [39, 18] },
  "planter-wood": { crop: [519, 391, 197, 190], draw: [24, 22] },
  "flower-patch": { crop: [880, 455, 188, 116], draw: [24, 14] },
  streetlamp: { crop: [1323, 322, 82, 255], draw: [8, 28] },
  bench: { crop: [111, 691, 258, 200], draw: [22, 17] },
  "potted-plant": { crop: [537, 715, 134, 154], draw: [17, 18] },
  mailbox: { crop: [915, 695, 111, 187], draw: [11, 18] },
  trellis: { crop: [1269, 680, 195, 211], draw: [27, 28] },
} satisfies Readonly<Record<string, SourceFrameSpec>>);

export type CityPropFrame = keyof typeof PROP_SOURCE_FRAMES;

export const GROUND_DECAL_SOURCE_FRAMES = Object.freeze({
  "grass-two-blade": { crop: [195, 204, 74, 50], draw: [9, 6] },
  "grass-three-blade": { crop: [533, 182, 87, 76], draw: [10, 9] },
  "grass-fan": { crop: [873, 182, 137, 76], draw: [15, 8] },
  "clover-two-leaf": { crop: [1235, 169, 111, 89], draw: [11, 9] },
  "ground-plant-round": { crop: [179, 456, 107, 93], draw: [12, 10] },
  "flowers-coral": { crop: [508, 443, 148, 107], draw: [15, 11] },
  "flowers-cream": { crop: [868, 434, 129, 121], draw: [14, 13] },
  "stones-two": { crop: [1241, 476, 96, 60], draw: [10, 6] },
  "stones-three": { crop: [150, 754, 140, 88], draw: [13, 8] },
  "fallen-leaves": { crop: [498, 727, 153, 134], draw: [15, 13] },
  "bare-earth": { crop: [849, 748, 174, 104], draw: [17, 10] },
  mushrooms: { crop: [1235, 744, 141, 103], draw: [15, 11] },
} satisfies Readonly<Record<string, SourceFrameSpec>>);

export type CityGroundDecalFrame = keyof typeof GROUND_DECAL_SOURCE_FRAMES;

export interface EnvironmentCorrectionFrameSpec extends SourceFrameSpec {
  readonly origin: readonly [number, number];
}

export const ENVIRONMENT_CORRECTION_SOURCE_FRAMES = Object.freeze({
  "streetlamp-left": { crop: [184, 126, 90, 296], draw: [7, 24], origin: [0.5, 1] },
  "streetlamp-right": { crop: [567, 126, 90, 296], draw: [7, 24], origin: [0.5, 1] },
  "bench-axis-a": { crop: [881, 238, 180, 150], draw: [16, 10], origin: [0.5, 1] },
  "bench-axis-b": { crop: [1286, 242, 171, 148], draw: [16, 10], origin: [0.5, 1] },
  "grass-motes": { crop: [109, 632, 226, 173], draw: [12, 9], origin: [0.5, 1] },
  "grass-leaves": { crop: [504, 635, 212, 162], draw: [12, 9], origin: [0.5, 1] },
  "grass-flowers": { crop: [876, 660, 186, 134], draw: [11, 8], origin: [0.5, 1] },
  "grass-tonal": { crop: [1260, 645, 223, 144], draw: [14, 9], origin: [0.5, 1] },
} satisfies Readonly<Record<string, EnvironmentCorrectionFrameSpec>>);

export type EnvironmentCorrectionFrame = keyof typeof ENVIRONMENT_CORRECTION_SOURCE_FRAMES;

export const correctionGroundFrame = (
  frame: CityGroundDecalFrame,
  gridX: number,
  gridY: number,
): EnvironmentCorrectionFrame | undefined => {
  if (frame === "stones-two" || frame === "stones-three" || frame === "mushrooms") return undefined;
  if (frame === "flowers-coral" || frame === "flowers-cream") return "grass-flowers";
  if (frame === "fallen-leaves") return "grass-leaves";
  if (frame === "bare-earth") return "grass-tonal";
  const variants = ["grass-motes", "grass-leaves", "grass-tonal"] as const;
  return variants[Math.abs(Math.round(gridX * 17 + gridY * 31)) % variants.length];
};

export const LIGHT_FX_SOURCE_FRAMES = Object.freeze({
  "streetlamp-pool-large": { crop: [8, 6, 48, 20], draw: [48, 20] },
  "streetlamp-pool-small": { crop: [80, 9, 32, 14], draw: [32, 14] },
  "doorway-spill": { crop: [140, 4, 40, 24], draw: [40, 24] },
  "cafe-spill-wide": { crop: [0, 34, 64, 28], draw: [64, 28] },
  "window-halo": { crop: [80, 36, 32, 24], draw: [32, 24] },
  "bulb-halo-small": { crop: [152, 40, 16, 16], draw: [16, 16] },
} satisfies Readonly<Record<string, SourceFrameSpec>>);

export type CityLightFxFrame = keyof typeof LIGHT_FX_SOURCE_FRAMES;

export interface BuildingUpgradeAddonVisual {
  readonly frame: CityPropFrame;
  readonly offset: readonly [number, number];
  readonly draw: readonly [number, number];
  readonly origin: readonly [number, number];
}

export interface BuildingUpgradeComposition {
  readonly id: "cafe-reading-loft";
  readonly addons: readonly BuildingUpgradeAddonVisual[];
  readonly signOffset: readonly [number, number];
  readonly lightOffset: readonly [number, number];
}

const CAFE_READING_LOFT_COMPOSITION: BuildingUpgradeComposition = {
  id: "cafe-reading-loft",
  addons: [
    { frame: "trellis", offset: [-47, -7], draw: [18, 20], origin: [0.5, 1] },
    { frame: "potted-plant", offset: [43, -3], draw: [14, 15], origin: [0.5, 1] },
  ],
  signOffset: [25, -57],
  lightOffset: [25, -56],
};

export const resolveBuildingUpgradeComposition = (
  kind: BuildingKind,
  visualVariant: string,
): BuildingUpgradeComposition | undefined =>
  kind === "cafe" && visualVariant === CAFE_READING_LOFT_COMPOSITION.id
    ? CAFE_READING_LOFT_COMPOSITION
    : undefined;

export const agentFrameName = (agentId: AgentId, activity: AgentActivity): string =>
  `agent-${agentId}-${activity}`;
