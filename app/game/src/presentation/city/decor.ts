import { getTile, pointKey, type GridPoint, type TileV1, type WorldMapV1 } from "../../core";
import type { CityGroundDecalFrame, CityPropFrame } from "./assets";

const CARDINALS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

const DIAGONALS = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
] as const;

const DECAL_FRAMES: readonly CityGroundDecalFrame[] = [
  "grass-two-blade",
  "grass-three-blade",
  "grass-fan",
  "clover-two-leaf",
  "ground-plant-round",
  "flowers-coral",
  "flowers-cream",
  "stones-two",
  "stones-three",
  "fallen-leaves",
  "bare-earth",
  "mushrooms",
];

export interface CityDecorPlacement<TFrame extends string> {
  readonly frame: TFrame;
  readonly hostTile: GridPoint;
  readonly position: { readonly x: number; readonly y: number };
}

export type CityAmbientDetailKind = "sparrow-pair" | "butterfly-coral" | "butterfly-cream" | "snail";

export interface CityAmbientDetailPlacement {
  readonly kind: CityAmbientDetailKind;
  readonly hostTile: GridPoint;
  readonly position: { readonly x: number; readonly y: number };
  /** Stable animation offset so a flock never bobs in mechanical unison. */
  readonly phase: number;
}

export interface CityDecorPlan {
  readonly streetFurniture: readonly CityDecorPlacement<"streetlamp" | "bench">[];
  readonly vegetation: readonly CityDecorPlacement<CityPropFrame>[];
  readonly groundDetails: readonly CityDecorPlacement<CityGroundDecalFrame>[];
  readonly ambientDetails: readonly CityAmbientDetailPlacement[];
}

export interface CityDecorOccupancy {
  readonly occupiedTiles?: readonly GridPoint[];
  readonly worldObjects?: readonly { readonly hostTile: GridPoint }[];
}

const stableHash = (x: number, y: number, salt = 0): number => {
  let value = Math.imul(x + 101, 73_856_093) ^ Math.imul(y + 211, 19_349_663) ^ Math.imul(salt + 17, 83_492_791);
  value ^= value >>> 13;
  return Math.abs(value | 0);
};

const isUnlockedGrass = (map: WorldMapV1, tile: TileV1 | undefined): tile is TileV1 =>
  tile?.terrain === "grass" &&
  tile.buildingId === undefined &&
  map.sectors.find((sector) => sector.id === tile.sectorId)?.unlocked === true;

export const adjacentRoadTiles = (map: WorldMapV1, point: GridPoint): readonly TileV1[] =>
  CARDINALS.map((offset) => getTile(map, { x: point.x + offset.x, y: point.y + offset.y })).filter(
    (tile): tile is TileV1 => tile?.terrain === "road",
  );

const roadDegree = (map: WorldMapV1, point: GridPoint): number => adjacentRoadTiles(map, point).length;

interface FurnitureCandidate {
  readonly frame: "streetlamp" | "bench";
  readonly hostTile: TileV1;
  readonly roadTile: TileV1;
  readonly priority: number;
}

const placedNearRoad = (candidate: FurnitureCandidate, amount: number): CityDecorPlacement<"streetlamp" | "bench"> => ({
  frame: candidate.frame,
  hostTile: candidate.hostTile.position,
  position: {
    x: candidate.hostTile.position.x + (candidate.roadTile.position.x - candidate.hostTile.position.x) * amount,
    y: candidate.hostTile.position.y + (candidate.roadTile.position.y - candidate.hostTile.position.y) * amount,
  },
});

const lampCandidates = (map: WorldMapV1): readonly FurnitureCandidate[] => {
  const candidates: FurnitureCandidate[] = [];
  for (const road of map.tiles) {
    if (road.terrain !== "road" || roadDegree(map, road.position) < 3) continue;
    const intersectionCorners: FurnitureCandidate[] = [];
    for (const diagonal of DIAGONALS) {
      const host = getTile(map, { x: road.position.x + diagonal.x, y: road.position.y + diagonal.y });
      if (!isUnlockedGrass(map, host)) continue;
      intersectionCorners.push({
        frame: "streetlamp",
        hostTile: host,
        roadTile: road,
        priority: stableHash(host.position.x, host.position.y, 31),
      });
    }
    const chosenCorner = intersectionCorners.sort((left, right) => left.priority - right.priority)[0];
    if (chosenCorner) candidates.push(chosenCorner);
  }
  return candidates;
};

const fallbackLampCandidates = (map: WorldMapV1): readonly FurnitureCandidate[] => {
  const candidates: FurnitureCandidate[] = [];
  for (const road of map.tiles) {
    if (road.terrain !== "road") continue;
    for (const offset of CARDINALS) {
      const host = getTile(map, { x: road.position.x + offset.x, y: road.position.y + offset.y });
      if (!isUnlockedGrass(map, host)) continue;
      candidates.push({
        frame: "streetlamp",
        hostTile: host,
        roadTile: road,
        priority: stableHash(host.position.x, host.position.y, 43),
      });
    }
  }
  return candidates;
};

const benchCandidates = (map: WorldMapV1): readonly FurnitureCandidate[] => {
  const candidates: FurnitureCandidate[] = [];
  for (const host of map.tiles) {
    if (!isUnlockedGrass(map, host)) continue;
    const roads = adjacentRoadTiles(map, host.position);
    const road = roads[stableHash(host.position.x, host.position.y, 59) % Math.max(roads.length, 1)];
    if (!road) continue;
    candidates.push({
      frame: "bench",
      hostTile: host,
      roadTile: road,
      priority: stableHash(host.position.x, host.position.y, 61),
    });
  }
  return candidates;
};

const takeUniqueHosts = (
  candidates: readonly FurnitureCandidate[],
  count: number,
  occupiedHosts: Set<string>,
  nearAmount: number,
): CityDecorPlacement<"streetlamp" | "bench">[] => {
  const chosen: CityDecorPlacement<"streetlamp" | "bench">[] = [];
  for (const candidate of [...candidates].sort((left, right) => left.priority - right.priority)) {
    if (chosen.length >= count) break;
    const key = pointKey(candidate.hostTile.position);
    if (occupiedHosts.has(key)) continue;
    occupiedHosts.add(key);
    chosen.push(placedNearRoad(candidate, nearAmount));
  }
  return chosen;
};

export const createCityDecorPlan = (map: WorldMapV1, occupancy: CityDecorOccupancy = {}): CityDecorPlan => {
  const area = map.size.width * map.size.height;
  const occupiedHosts = new Set<string>();
  const maxLamps = Math.max(2, Math.min(10, Math.ceil(area / 90)));
  const corners = lampCandidates(map);
  const lampPool = corners.length > 0 ? corners : fallbackLampCandidates(map);
  const lamps = takeUniqueHosts(lampPool, maxLamps, occupiedHosts, 0.16);

  const maxBenches = Math.max(1, Math.min(5, Math.ceil(area / 190)));
  const benches = takeUniqueHosts(benchCandidates(map), maxBenches, occupiedHosts, 0.16);

  const vegetation: CityDecorPlacement<CityPropFrame>[] = [];
  const vegetationLimit = Math.max(6, Math.min(22, Math.ceil(area / 38)));
  for (const tile of map.tiles) {
    if (vegetation.length >= vegetationLimit || !isUnlockedGrass(map, tile)) continue;
    if (occupiedHosts.has(pointKey(tile.position)) || adjacentRoadTiles(map, tile.position).length > 0) continue;
    const hash = stableHash(tile.position.x, tile.position.y, 79);
    if (hash % 19 !== 0 && hash % 23 !== 0) continue;
    const frame: CityPropFrame =
      hash % 5 === 0
        ? "tree-narrow"
        : hash % 3 === 0
          ? "tree-round"
          : hash % 2 === 0
            ? "shrub-flowering"
            : "shrub-round";
    occupiedHosts.add(pointKey(tile.position));
    vegetation.push({
      frame,
      hostTile: tile.position,
      position: {
        x: tile.position.x + ((hash % 5) - 2) * 0.055,
        y: tile.position.y + (((hash >>> 3) % 5) - 2) * 0.055,
      },
    });
  }

  const groundDetails: CityDecorPlacement<CityGroundDecalFrame>[] = [];
  for (const tile of map.tiles) {
    if (!isUnlockedGrass(map, tile) || occupiedHosts.has(pointKey(tile.position))) continue;
    const hash = stableHash(tile.position.x, tile.position.y, 97);
    if (hash % 9 !== 0) continue;
    const frame = DECAL_FRAMES[hash % DECAL_FRAMES.length];
    if (!frame) continue;
    groundDetails.push({
      frame,
      hostTile: tile.position,
      position: {
        x: tile.position.x + ((hash % 7) - 3) * 0.035,
        y: tile.position.y + (((hash >>> 4) % 7) - 3) * 0.035,
      },
    });
  }

  const ambientDetails: CityAmbientDetailPlacement[] = [];
  const ambientLimit = Math.max(4, Math.min(12, Math.ceil(area / 70)));
  const ambientHosts = new Set<string>();
  const blockedAmbientHosts = new Set<string>([
    ...(occupancy.occupiedTiles ?? []).map(pointKey),
    ...(occupancy.worldObjects ?? []).map((object) => pointKey(object.hostTile)),
  ]);
  for (const tile of map.tiles) {
    if (ambientDetails.length >= ambientLimit || !isUnlockedGrass(map, tile)) continue;
    const key = pointKey(tile.position);
    if (ambientHosts.has(key) || blockedAmbientHosts.has(key)) continue;
    const hash = stableHash(tile.position.x, tile.position.y, 137);
    if (hash % 17 > 1) continue;
    const kind: CityAmbientDetailKind =
      hash % 11 === 0
        ? "snail"
        : hash % 5 === 0
          ? "butterfly-cream"
          : hash % 3 === 0
            ? "butterfly-coral"
            : "sparrow-pair";
    ambientHosts.add(key);
    ambientDetails.push({
      kind,
      hostTile: tile.position,
      position: {
        x: tile.position.x + ((hash % 9) - 4) * 0.045,
        y: tile.position.y + (((hash >>> 4) % 9) - 4) * 0.035,
      },
      phase: (hash % 997) / 997,
    });
  }

  return {
    streetFurniture: [...lamps, ...benches],
    vegetation,
    groundDetails,
    ambientDetails,
  };
};
