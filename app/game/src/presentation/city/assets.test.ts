import { describe, expect, it } from "vitest";
import { ALPHA_CATALOG, type BuildingKind } from "../../core";
import {
  BUILDING_VISUAL_CALIBRATIONS,
  BUILDING_KIND_ORDER,
  CITY_ASSET_PATHS,
  ENVIRONMENT_CORRECTION_SOURCE_FRAMES,
  PROP_SOURCE_FRAMES,
  correctionGroundFrame,
  normalizeBuildingOrientation,
  resolveBuildingVisual,
  resolveBuildingSpriteOffset,
  resolveBuildingUpgradeComposition,
  resolveConstructionVisual,
} from "./assets";

describe("city visual asset mappings", () => {
  it("maps every building kind to an alpha frame and a raster fallback", () => {
    const kinds: readonly BuildingKind[] = [
      "home",
      "cafe",
      "marketing-office",
      "commercial-office",
      "crm-workshop",
      "community-hall",
    ];
    expect(BUILDING_KIND_ORDER).toEqual(kinds);
    for (const kind of kinds) {
      const alpha = resolveBuildingVisual(kind, true);
      expect(alpha.frame).toBe(`building-${kind}`);
      expect(alpha.spriteOffset[1]).toBeLessThan(0);
      const fallback = resolveBuildingVisual(kind, false);
      expect(fallback.provisional).toBe(true);
      expect(fallback.draw[0]).toBeGreaterThan(0);
      expect(fallback.draw).toEqual(alpha.draw);
    }
  });

  it("reserves the audited ground contact footprint and calibrated pivot for every alpha building", () => {
    for (const kind of BUILDING_KIND_ORDER) {
      const definition = ALPHA_CATALOG.buildings.find((building) => building.kind === kind);
      const visual = resolveBuildingVisual(kind, true);
      const calibration = BUILDING_VISUAL_CALIBRATIONS[kind];
      expect(definition).toBeDefined();
      expect([definition?.footprint.width, definition?.footprint.height]).toEqual(calibration.contactFootprint);
      expect(
        resolveBuildingSpriteOffset(visual, {
          width: definition?.footprint.width ?? 0,
          height: definition?.footprint.height ?? 0,
        }),
      ).toEqual(calibration.spriteOffset);

      const [width, height] = calibration.contactFootprint;
      const projectedLeft = -width * 16;
      const projectedRight = height * 16;
      const spriteLeft = calibration.spriteOffset[0] - visual.draw[0] / 2;
      const spriteRight = calibration.spriteOffset[0] + visual.draw[0] / 2;
      expect(spriteLeft - projectedLeft).toBeGreaterThanOrEqual(3);
      expect(projectedRight - spriteRight).toBeGreaterThanOrEqual(3);
      expect(calibration.spriteOffset[1]).toBeLessThanOrEqual(-8);
    }
  });

  it("normalizes unsupported rotations to the only authored building view", () => {
    for (const kind of BUILDING_KIND_ORDER) {
      expect(normalizeBuildingOrientation(kind, "north")).toBe("north");
      expect(normalizeBuildingOrientation(kind, "east")).toBe("north");
      expect(normalizeBuildingOrientation(kind, "south")).toBe("north");
      expect(normalizeBuildingOrientation(kind, "west")).toBe("north");
    }
  });

  it("declares the future alpha sheets at their fixed project paths", () => {
    expect(CITY_ASSET_PATHS.alphaBuildings.endsWith("/alpha-v1/buildings-sheet-v1.png")).toBe(true);
    expect(CITY_ASSET_PATHS.alphaConstruction.endsWith("/alpha-v1/construction-sheet-v1.png")).toBe(true);
    expect(CITY_ASSET_PATHS.alphaAgents.endsWith("/alpha-v1/agents-sheet-v1.png")).toBe(true);
  });

  it("keeps benches and streetlamps subordinate to buildings and roads", () => {
    expect(PROP_SOURCE_FRAMES.bench.draw[0]).toBeLessThanOrEqual(22);
    expect(PROP_SOURCE_FRAMES.bench.draw[1]).toBeLessThanOrEqual(17);
    expect(PROP_SOURCE_FRAMES.streetlamp.draw[0]).toBeLessThanOrEqual(8);
    expect(PROP_SOURCE_FRAMES.streetlamp.draw[1]).toBeLessThanOrEqual(28);
  });

  it("uses the dedicated small street furniture and subtle grass correction sheet", () => {
    expect(CITY_ASSET_PATHS.environmentCorrections.endsWith("/alpha-v1/environment-corrections-sheet-v1.png")).toBe(true);
    expect(ENVIRONMENT_CORRECTION_SOURCE_FRAMES["streetlamp-left"].draw).toEqual([7, 24]);
    expect(ENVIRONMENT_CORRECTION_SOURCE_FRAMES["bench-axis-a"].draw).toEqual([16, 10]);
    expect(correctionGroundFrame("flowers-coral", 2, 3)).toBe("grass-flowers");
    expect(correctionGroundFrame("stones-two", 2, 3)).toBeUndefined();
  });

  it("uses dedicated construction frames when available and honest raster staging otherwise", () => {
    expect(resolveConstructionVisual("foundation", true)).toEqual(
      expect.objectContaining({ useConstructionSheet: true, frame: "construction-foundation" }),
    );
    expect(resolveConstructionVisual("framing", false)).toEqual(
      expect.objectContaining({ useConstructionSheet: false, alpha: 0.56 }),
    );
    expect(resolveConstructionVisual("complete", true).alpha).toBe(1);
  });

  it("turns the cafe reading upgrade into a visible exterior composition", () => {
    expect(resolveBuildingUpgradeComposition("cafe", "cafe-library")).toBeUndefined();
    const upgrade = resolveBuildingUpgradeComposition("cafe", "cafe-reading-loft");
    expect(upgrade?.addons).toHaveLength(2);
    expect(new Set(upgrade?.addons.map((addon) => addon.frame))).toEqual(new Set(["trellis", "potted-plant"]));
    expect(upgrade?.signOffset).not.toEqual([0, 0]);
    expect(resolveBuildingUpgradeComposition("home", "cafe-reading-loft")).toBeUndefined();
  });
});
