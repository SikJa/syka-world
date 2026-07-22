import { describe, expect, it } from "vitest";
import {
  ALPHA_CATALOG,
  CATALOG_SCHEMA,
  INTERIOR_SCHEMA,
  getBuildingDefinition,
  getInteriorDefinition,
} from "./index";

describe("alpha catalog contracts", () => {
  it("contains every required building role", () => {
    expect(ALPHA_CATALOG.schema).toBe(CATALOG_SCHEMA);
    expect(new Set(ALPHA_CATALOG.buildings.map((building) => building.kind))).toEqual(
      new Set(["home", "cafe", "marketing-office", "commercial-office", "crm-workshop", "community-hall"]),
    );
  });

  it("links every building to a furnished versioned interior", () => {
    for (const building of ALPHA_CATALOG.buildings) {
      const interior = getInteriorDefinition(building.interiorId);
      expect(interior?.schema).toBe(INTERIOR_SCHEMA);
      expect(interior?.furnishedByDefault).toBe(true);
      expect(interior?.defaultFurniture.length).toBeGreaterThan(0);
    }
  });

  it("reserves the full generated house contact area", () => {
    expect(getBuildingDefinition("home-cozy")?.footprint).toEqual({ width: 4, height: 3 });
  });

  it("gives the cafe its required narrative objects and a real upgrade", () => {
    const cafe = getBuildingDefinition("cafe-library");
    const interior = getInteriorDefinition(cafe?.interiorId ?? "");
    const installed = new Set(interior?.defaultFurniture.map((item) => item.furnitureId));
    expect(installed.has("bookcase")).toBe(true);
    expect(installed.has("fireplace")).toBe(true);
    expect(installed.has("cafe-counter")).toBe(true);
    expect(ALPHA_CATALOG.upgrades).toContainEqual(expect.objectContaining({ id: "cafe-reading-loft", targetLevel: 2 }));
  });

  it("versions the complete exterior catalog and keeps street furniture off roads", () => {
    expect(ALPHA_CATALOG.exteriorObjects.map((object) => [object.id, object.price])).toEqual([
      ["wildflowers", 4],
      ["shrub-round", 8],
      ["shrub-flowering", 10],
      ["hedge-short", 12],
      ["planter", 14],
      ["bench", 16],
      ["streetlamp", 24],
      ["tree-round", 20],
      ["tree-narrow", 22],
    ]);
    expect(ALPHA_CATALOG.exteriorObjects.find((object) => object.id === "bench")?.placementRule).toBe("grass-near-road");
    expect(ALPHA_CATALOG.exteriorObjects.find((object) => object.id === "streetlamp")).toMatchObject({
      placementRule: "grass-near-road",
      lightSource: { kind: "warm-compact", activePeriod: "night" },
    });
  });
});
