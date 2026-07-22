import {
  MAP_SCHEMA,
  type BuildingDefinitionV1,
  type BuildingInstanceV1,
  type CardinalDirection,
  type GridPoint,
  type Result,
  type SectorStateV1,
  type TerrainKind,
  type TileV1,
  type WorldMapV1,
} from "./contracts";

export type PlacementErrorCode =
  | "OUT_OF_BOUNDS"
  | "SECTOR_LOCKED"
  | "TERRAIN_BLOCKED"
  | "COLLISION"
  | "NO_ROAD_ACCESS"
  | "TOWN_LEVEL_LOCKED";

export interface PlacementError {
  readonly code: PlacementErrorCode;
  readonly tile: GridPoint;
  readonly message: string;
}

export interface PlacementGeometry {
  readonly occupiedTiles: readonly GridPoint[];
  readonly entranceTile: GridPoint;
  readonly accessTile: GridPoint;
  readonly footprintWidth: number;
  readonly footprintHeight: number;
}

export const DEFAULT_SECTORS: readonly SectorStateV1[] = [
  { id: "meadow-core", name: "Initial meadow", unlocked: true, unlockCost: 0 },
  { id: "east-gardens", name: "East Gardens", unlocked: false, unlockCost: 280 },
] as const;

export const pointKey = ({ x, y }: GridPoint): string => `${x},${y}`;

export const samePoint = (left: GridPoint, right: GridPoint): boolean => left.x === right.x && left.y === right.y;

export const createWorldMap = (
  width = 24,
  height = 20,
  sectors: readonly SectorStateV1[] = DEFAULT_SECTORS,
): WorldMapV1 => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Map dimensions must be positive integers.");
  }
  const eastStart = Math.max(1, Math.floor(width * 0.72));
  const tiles: TileV1[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push({
        position: { x, y },
        terrain: "grass",
        elevation: 0,
        sectorId: x >= eastStart ? "east-gardens" : "meadow-core",
      });
    }
  }
  return { schema: MAP_SCHEMA, size: { width, height }, tiles, sectors: sectors.map((sector) => ({ ...sector })) };
};

export const isInBounds = (map: WorldMapV1, point: GridPoint): boolean =>
  Number.isInteger(point.x) &&
  Number.isInteger(point.y) &&
  point.x >= 0 &&
  point.y >= 0 &&
  point.x < map.size.width &&
  point.y < map.size.height;

export const getTile = (map: WorldMapV1, point: GridPoint): TileV1 | undefined => {
  if (!isInBounds(map, point)) return undefined;
  return map.tiles[point.y * map.size.width + point.x];
};

export const updateTiles = (
  map: WorldMapV1,
  points: readonly GridPoint[],
  update: (tile: TileV1) => TileV1,
): WorldMapV1 => {
  const wanted = new Set(points.map(pointKey));
  return {
    ...map,
    tiles: map.tiles.map((tile) => (wanted.has(pointKey(tile.position)) ? update(tile) : tile)),
  };
};

export const paintTerrain = (map: WorldMapV1, points: readonly GridPoint[], terrain: TerrainKind): WorldMapV1 => {
  for (const point of points) {
    if (!isInBounds(map, point)) throw new Error(`Cannot paint out-of-bounds tile ${pointKey(point)}.`);
  }
  return updateTiles(map, points, (tile) => ({ ...tile, terrain }));
};

const rotateFacing = (facing: CardinalDirection, turns: number): CardinalDirection => {
  const order: readonly CardinalDirection[] = ["north", "east", "south", "west"];
  const index = order.indexOf(facing);
  return order[(index + turns) % order.length] ?? "north";
};

const rotateLocalPoint = (
  point: GridPoint,
  width: number,
  height: number,
  turns: number,
): GridPoint => {
  switch (turns) {
    case 1:
      return { x: height - 1 - point.y, y: point.x };
    case 2:
      return { x: width - 1 - point.x, y: height - 1 - point.y };
    case 3:
      return { x: point.y, y: width - 1 - point.x };
    default:
      return point;
  }
};

const directionTurns = (orientation: CardinalDirection): number =>
  ({ north: 0, east: 1, south: 2, west: 3 })[orientation];

const directionOffset = (direction: CardinalDirection): GridPoint =>
  ({
    north: { x: 0, y: -1 },
    east: { x: 1, y: 0 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 },
  })[direction];

export const computePlacementGeometry = (
  definition: BuildingDefinitionV1,
  origin: GridPoint,
  orientation: CardinalDirection,
): PlacementGeometry => {
  const turns = directionTurns(orientation);
  const { width, height } = definition.footprint;
  const footprintWidth = turns % 2 === 0 ? width : height;
  const footprintHeight = turns % 2 === 0 ? height : width;
  const occupiedTiles: GridPoint[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const rotated = rotateLocalPoint({ x, y }, width, height, turns);
      occupiedTiles.push({ x: origin.x + rotated.x, y: origin.y + rotated.y });
    }
  }

  occupiedTiles.sort((left, right) => left.y - right.y || left.x - right.x);
  const rotatedEntrance = rotateLocalPoint(definition.entrance.offset, width, height, turns);
  const entranceTile = { x: origin.x + rotatedEntrance.x, y: origin.y + rotatedEntrance.y };
  const facing = rotateFacing(definition.entrance.facing, turns);
  const accessOffset = directionOffset(facing);
  const accessTile = { x: entranceTile.x + accessOffset.x, y: entranceTile.y + accessOffset.y };

  return { occupiedTiles, entranceTile, accessTile, footprintWidth, footprintHeight };
};

const isSectorUnlocked = (map: WorldMapV1, tile: TileV1): boolean =>
  map.sectors.find((sector) => sector.id === tile.sectorId)?.unlocked === true;

export const validatePlacement = (
  map: WorldMapV1,
  buildings: readonly BuildingInstanceV1[],
  definition: BuildingDefinitionV1,
  origin: GridPoint,
  orientation: CardinalDirection,
  townLevel: number,
  requireExistingRoad = true,
): Result<PlacementGeometry, readonly PlacementError[]> => {
  const geometry = computePlacementGeometry(definition, origin, orientation);
  const errors: PlacementError[] = [];
  const occupiedByBuildings = new Set(buildings.flatMap((building) => building.occupiedTiles.map(pointKey)));

  if (townLevel < definition.requiredTownLevel) {
    errors.push({
      code: "TOWN_LEVEL_LOCKED",
      tile: origin,
      message: `Requires town level ${definition.requiredTownLevel}.`,
    });
  }

  for (const point of geometry.occupiedTiles) {
    const tile = getTile(map, point);
    if (!tile) {
      errors.push({ code: "OUT_OF_BOUNDS", tile: point, message: "Building footprint leaves the map." });
      continue;
    }
    if (!isSectorUnlocked(map, tile)) {
      errors.push({ code: "SECTOR_LOCKED", tile: point, message: `Sector ${tile.sectorId} is locked.` });
    }
    if (tile.terrain !== "grass") {
      errors.push({ code: "TERRAIN_BLOCKED", tile: point, message: `Cannot build on ${tile.terrain}.` });
    }
    if (tile.buildingId || occupiedByBuildings.has(pointKey(point))) {
      errors.push({ code: "COLLISION", tile: point, message: "Another building occupies this tile." });
    }
  }

  const access = getTile(map, geometry.accessTile);
  if (requireExistingRoad && (!access || !isSectorUnlocked(map, access) || access.terrain !== "road")) {
    errors.push({
      code: "NO_ROAD_ACCESS",
      tile: geometry.accessTile,
      message: "The entrance must face an unlocked road tile.",
    });
  }

  return errors.length === 0 ? { ok: true, value: geometry } : { ok: false, error: errors };
};

export const occupyBuildingTiles = (map: WorldMapV1, building: BuildingInstanceV1): WorldMapV1 =>
  updateTiles(map, building.occupiedTiles, (tile) => ({ ...tile, buildingId: building.id }));

export const clearBuildingTiles = (map: WorldMapV1, building: BuildingInstanceV1): WorldMapV1 =>
  updateTiles(map, building.occupiedTiles, (tile) => {
    if (tile.buildingId !== building.id) return tile;
    const { buildingId: _removed, ...rest } = tile;
    return rest;
  });

export const unlockMapSector = (map: WorldMapV1, sectorId: string): WorldMapV1 | undefined => {
  const sector = map.sectors.find((candidate) => candidate.id === sectorId);
  if (!sector) return undefined;
  if (sector.unlocked) return map;
  return {
    ...map,
    sectors: map.sectors.map((candidate) =>
      candidate.id === sectorId ? { ...candidate, unlocked: true } : candidate,
    ),
  };
};
