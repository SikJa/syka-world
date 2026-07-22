import { describe, expect, it } from "vitest";
import {
  advanceConstruction,
  createEconomyState,
  createProgressiveGameState,
  grantHermesCompletionReward,
  grantLocalReward,
  installOptionalFurniture,
  placeBuilding,
  spendLumenes,
  startBuildingUpgrade,
  unlockSector,
} from "./index";

describe("Lumen economy", () => {
  it("never allows negative funds", () => {
    const economy = createEconomyState(10);
    const result = spendLumenes(economy, 11);
    expect(result.ok).toBe(false);
    expect(economy.balance).toBe(10);
  });

  it("uses diminishing Hermes rewards without penalizing failure paths", () => {
    let economy = createEconomyState(0);
    const rewards: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const result = grantHermesCompletionReward(economy, "elen", 1);
      economy = result.economy;
      rewards.push(result.reward);
    }
    expect(rewards).toEqual([5, 5, 5, 5, 1, 1]);
    expect(economy.balance).toBe(22);
    expect(grantHermesCompletionReward(economy, "elen", 2).reward).toBe(5);
  });
});

describe("construction, furnishing and progression", () => {
  const buildCafe = () => {
    const initial = createProgressiveGameState();
    const placed = placeBuilding(initial, {
      definitionId: "cafe-library",
      instanceId: "cafe-main",
      origin: { x: 8, y: 4 },
      orientation: "north",
    });
    if (!placed.ok) throw new Error(placed.error.message);
    return placed.value;
  };

  it("purchases a building and advances all three visible stages", () => {
    const placed = buildCafe();
    // The deterministic preview removed one seeded hedge for 2 L in this lot.
    expect(placed.economy.balance).toBe(178);
    expect(placed.buildings.find((building) => building.id === "cafe-main")?.status).toBe("foundation");

    const framed = advanceConstruction(placed, 100);
    expect(framed.buildings.find((building) => building.id === "cafe-main")?.status).toBe("framing");
    const finished = advanceConstruction(framed, 260);
    expect(finished.buildings.find((building) => building.id === "cafe-main")?.status).toBe("complete");
    const interior = finished.interiors.find((candidate) => candidate.buildingId === "cafe-main");
    expect(interior?.furniture.map((item) => item.furnitureId)).toEqual(
      expect.arrayContaining(["bookcase", "fireplace", "cafe-counter"]),
    );
  });

  it("builds the cafe upgrade over time and installs optional decor", () => {
    let state = advanceConstruction(buildCafe(), 360);
    state = { ...state, economy: grantLocalReward(state.economy, 500).economy };
    const upgrading = startBuildingUpgrade(state, "cafe-main", "cafe-reading-loft");
    if (!upgrading.ok) throw new Error(upgrading.error.message);
    expect(upgrading.value.buildings.find((building) => building.id === "cafe-main")?.activeUpgrade).toBeDefined();
    state = advanceConstruction(upgrading.value, 240);
    expect(state.buildings.find((building) => building.id === "cafe-main")).toEqual(
      expect.objectContaining({ level: 2, visualVariant: "cafe-reading-loft", installedUpgrades: ["cafe-reading-loft"] }),
    );

    const decorated = installOptionalFurniture(state, "cafe-main", "decor-window", "fern");
    if (!decorated.ok) throw new Error(decorated.error.message);
    expect(decorated.value.interiors.find((interior) => interior.buildingId === "cafe-main")?.furniture).toContainEqual(
      expect.objectContaining({ slotId: "decor-window", furnitureId: "fern" }),
    );
  });

  it("unlocks the expansion sector only after payment", () => {
    const poor = { ...createProgressiveGameState(), economy: createEconomyState(10) };
    expect(unlockSector(poor, "east-gardens").ok).toBe(false);
    const rich = { ...poor, economy: createEconomyState(300) };
    const unlocked = unlockSector(rich, "east-gardens");
    if (!unlocked.ok) throw new Error(unlocked.error.message);
    expect(unlocked.value.economy.balance).toBe(20);
    expect(unlocked.value.map.sectors.find((sector) => sector.id === "east-gardens")?.unlocked).toBe(true);
  });
});
