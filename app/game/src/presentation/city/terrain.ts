import { getTile, type TileV1, type WorldMapV1 } from "../../core";

export interface TerrainVisual {
  readonly frame: number;
  readonly tint: number;
}

const CARDINALS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

const isUnlocked = (map: WorldMapV1, tile: TileV1): boolean =>
  map.sectors.find((sector) => sector.id === tile.sectorId)?.unlocked === true;

const roadNeighborCount = (map: WorldMapV1, tile: TileV1): number =>
  CARDINALS.reduce((total, offset) => {
    const neighbor = getTile(map, { x: tile.position.x + offset.x, y: tile.position.y + offset.y });
    return total + (neighbor?.terrain === "road" ? 1 : 0);
  }, 0);

export const selectTerrainVisual = (map: WorldMapV1, tile: TileV1): TerrainVisual => {
  const hash = Math.abs(tile.position.x * 47 + tile.position.y * 79);
  const unlockedTint = isUnlocked(map, tile) ? 0xffffff : 0x85917c;
  if (tile.terrain === "road") {
    const roads = roadNeighborCount(map, tile);
    if (roads >= 3) return { frame: 7, tint: unlockedTint };
    if (roads === 2 && hash % 3 === 0) return { frame: 5, tint: unlockedTint };
    return { frame: 3, tint: unlockedTint };
  }
  if (tile.terrain === "water") return { frame: 3, tint: 0x79a7ae };
  if (tile.terrain === "rock") return { frame: 2, tint: 0xa9a28f };
  const frame = hash % 13 === 0 ? 4 : hash % 5 === 0 ? 1 : 0;
  return { frame, tint: unlockedTint };
};
