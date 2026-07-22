import type { FurniturePlacementV1, GridPoint, InteriorStateV1 } from "../../core";

export interface InteriorHotspot {
  readonly id: "counter" | "library" | "fireplace" | "tables";
  readonly label: string;
  readonly description: string;
  readonly normalizedRect: readonly [number, number, number, number];
  readonly actions: readonly InteriorContextAction[];
}

export interface InteriorContextAction {
  readonly id: "self-serve-coffee" | "read" | "warm-up" | "sit" | "exit";
  readonly label: string;
  readonly agentAction: boolean;
}

export interface CafeInteriorAnchor {
  readonly id: string;
  readonly normalizedPosition: readonly [number, number];
  readonly role: "entry" | "guest" | "service" | "npc-service";
}

export const CAFE_INTERIOR_ANCHORS: readonly CafeInteriorAnchor[] = [
  { id: "entry", normalizedPosition: [0.52, 0.84], role: "entry" },
  { id: "counter", normalizedPosition: [0.49, 0.82], role: "service" },
  { id: "table-seat-1", normalizedPosition: [0.49, 0.79], role: "guest" },
  { id: "table-seat-2", normalizedPosition: [0.52, 0.79], role: "guest" },
  { id: "table-seat-3", normalizedPosition: [0.49, 0.77], role: "guest" },
  { id: "library-chair", normalizedPosition: [0.52, 0.77], role: "guest" },
  { id: "fireplace", normalizedPosition: [0.49, 0.74], role: "guest" },
  { id: "coffee-machine", normalizedPosition: [0.21, 0.55], role: "service" },
  { id: "bartender-station", normalizedPosition: [0.27, 0.55], role: "npc-service" },
] as const;

export const cafeAnchor = (anchorId: string): CafeInteriorAnchor =>
  CAFE_INTERIOR_ANCHORS.find((anchor) => anchor.id === anchorId) ?? CAFE_INTERIOR_ANCHORS[0]!;

export interface CafeDecorVisual {
  readonly frame: string;
  readonly crop: readonly [number, number, number, number];
  readonly draw: readonly [number, number];
  readonly origin: readonly [number, number];
}

export interface CafeDecorPlacementVisual {
  readonly normalizedPosition: readonly [number, number];
  readonly surface: "floor" | "wall";
  readonly depthOffset: number;
  /** Logical cell occupied by the original decor entity. */
  readonly spatialCell: GridPoint;
  /** Wall art is an entity too, but only floor pieces obstruct movement. */
  readonly blocksMovement: boolean;
}

export const CAFE_INTERIOR_SPATIAL_GRID = Object.freeze({ width: 32, height: 18 });

export const CAFE_INTERIOR_FLOOR_BOUNDS = Object.freeze({
  left: 0.07,
  right: 0.94,
  top: 0.43,
  // The cutaway floor rises into a central notch. 0.84 keeps the actor's feet
  // on painted wood at that notch instead of on the transparent backdrop.
  bottom: 0.84,
});

export const cafeFloorCellToNormalized = (cell: GridPoint): readonly [number, number] => [
  CAFE_INTERIOR_FLOOR_BOUNDS.left +
    (cell.x / (CAFE_INTERIOR_SPATIAL_GRID.width - 1)) *
      (CAFE_INTERIOR_FLOOR_BOUNDS.right - CAFE_INTERIOR_FLOOR_BOUNDS.left),
  CAFE_INTERIOR_FLOOR_BOUNDS.top +
    (cell.y / (CAFE_INTERIOR_SPATIAL_GRID.height - 1)) *
      (CAFE_INTERIOR_FLOOR_BOUNDS.bottom - CAFE_INTERIOR_FLOOR_BOUNDS.top),
];

const floorDecor = (spatialCell: GridPoint, depthOffset: number): CafeDecorPlacementVisual => ({
  spatialCell,
  normalizedPosition: cafeFloorCellToNormalized(spatialCell),
  surface: "floor",
  depthOffset,
  blocksMovement: true,
});

export const CAFE_DECOR_VISUALS = Object.freeze({
  "warm-lamp": {
    frame: "decor-warm-lamp",
    crop: [192, 119, 228, 369],
    draw: [18, 30],
    origin: [0.5, 1],
  },
  fern: {
    frame: "decor-fern",
    crop: [609, 59, 247, 430],
    draw: [18, 32],
    origin: [0.5, 1],
  },
  "notice-board": {
    frame: "decor-notice-board",
    crop: [669, 575, 355, 370],
    draw: [24, 25],
    origin: [0.5, 1],
  },
} satisfies Readonly<Record<string, CafeDecorVisual>>);

export const CAFE_DECOR_POSITIONS = Object.freeze({
  "decor-window": {
    // Clear pocket below the counter and left of the green-rug table.
    "warm-lamp": floorDecor({ x: 7, y: 16 }, 6),
    fern: floorDecor({ x: 7, y: 16 }, 6),
  },
  "decor-books": {
    // A second independent floor pocket in front of the sofa area.
    fern: floorDecor({ x: 25, y: 16 }, 6),
    "notice-board": {
      normalizedPosition: [0.91, 0.31],
      surface: "wall",
      depthOffset: 8,
      spatialCell: { x: 30, y: 2 },
      blocksMovement: false,
    },
  },
} satisfies Readonly<Record<string, Readonly<Record<string, CafeDecorPlacementVisual>>>>);

export const CAFE_HOTSPOTS: readonly InteriorHotspot[] = [
  {
    id: "library",
    label: "Biblioteca alta",
    description: "Libros, notas y un rincón tranquilo para leer o investigar.",
    normalizedRect: [0.66, 0.07, 0.27, 0.2],
    actions: [{ id: "read", label: "Leer", agentAction: true }],
  },
  {
    id: "fireplace",
    label: "Junto a la chimenea",
    description: "El corazón cálido de la cafetería durante la tarde y la noche.",
    normalizedRect: [0.68, 0.34, 0.2, 0.2],
    actions: [{ id: "warm-up", label: "Acercarse al fuego", agentAction: true }],
  },
  {
    id: "counter",
    label: "Barra del café",
    description: "Café, vajilla y una cocina lista desde el primer día.",
    normalizedRect: [0.07, 0.31, 0.26, 0.41],
    actions: [{ id: "self-serve-coffee", label: "Servirse un café", agentAction: true }],
  },
  {
    id: "tables",
    label: "Mesa junto al fuego",
    description: "Un espacio para reunirse, descansar y observar la ciudad.",
    normalizedRect: [0.34, 0.6, 0.36, 0.15],
    actions: [{ id: "sit", label: "Sentarse", agentAction: true }],
  },
] as const;

export interface InteriorLighting {
  readonly sky: number;
  readonly cityTint: number;
  readonly roomTint: number;
  readonly warmLightAlpha: number;
  readonly period: "day" | "twilight" | "night";
}

export function getInteriorLighting(minuteOfDay: number): InteriorLighting {
  const minute = ((Math.round(minuteOfDay) % 1_440) + 1_440) % 1_440;
  const hour = minute / 60;
  if (hour >= 20 || hour < 6) {
    return {
      sky: 0x36566a,
      cityTint: 0x71889c,
      roomTint: 0xa8a8a2,
      warmLightAlpha: 0.9,
      period: "night",
    };
  }
  if (hour >= 17) {
    return {
      sky: 0x7896aa,
      cityTint: 0xaab9c5,
      roomTint: 0xe1d9ce,
      warmLightAlpha: 0.66,
      period: "twilight",
    };
  }
  return {
    sky: 0x9fc5cf,
    cityTint: 0xdde7e5,
    roomTint: 0xffffff,
    warmLightAlpha: 0.28,
    period: "day",
  };
}

export function optionalFurniture(interior: InteriorStateV1 | undefined): readonly FurniturePlacementV1[] {
  if (!interior) return [];
  return interior.furniture.filter((placement) => placement.slotId.startsWith("decor-"));
}
