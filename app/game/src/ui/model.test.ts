import { describe, expect, it } from "vitest";
import type { ControllerSnapshot } from "../application/AlphaRuntime";
import { advanceAgentRoutines, createProgressiveGameState, createShowcaseGameState } from "../core";
import { createSimulatedSnapshot } from "../integrations";
import {
  buildAlphaUiModel,
  formatClock,
  formatLumenes,
  friendlyActionError,
  sanitizeUiSummary,
} from "./model";

describe("alpha UI formatting", () => {
  it("formats time and Lumens for a non-technical interface", () => {
    expect(formatClock(1_050)).toBe("17:30");
    expect(formatClock(-1)).toBe("23:59");
    expect(formatLumenes(1_240.8)).toMatch(/1[.,]240 Lumens/);
    expect(formatLumenes(Number.NaN)).toBe("0 Lumens");
  });

  it("uses short friendly errors instead of forwarding technical messages", () => {
    expect(friendlyActionError("INSUFFICIENT_FUNDS")).toBe("Not enough Lumens yet.");
    expect(friendlyActionError("C:\\private\\provider-error")).toBe("Could not complete that action.");
  });

  it("sanitizes agent summaries before the DOM model sees them", () => {
    const summary = sanitizeUiSummary(
      "<img src=x onerror=alert(1)> check https://private.example token=verysecretvalue",
    );
    expect(summary).not.toContain("<");
    expect(summary).not.toContain("private.example");
    expect(summary).not.toContain("verysecretvalue");
    expect(summary).toContain("[link]");
    expect(summary).toContain("[redacted]");
  });
});

describe("alpha UI view model", () => {
  it("shows all six buildings and clear lock/price states in a new game", () => {
    const model = buildAlphaUiModel(snapshot(createProgressiveGameState()), null);
    expect(model.palette).toHaveLength(6);
    expect(model.palette.find((item) => item.id === "cafe-library")).toMatchObject({
      unlocked: true,
      affordable: true,
      cost: 240,
    });
    expect(model.palette.find((item) => item.id === "office-marketing")).toMatchObject({
      unlocked: false,
      requiredTownLevel: 2,
      disabledReason: "Unlocks at level 2",
    });
    expect(model.exteriorPalette).toHaveLength(9);
    expect(model.exteriorPalette.find((item) => item.id === "streetlamp")).toMatchObject({
      name: "Farola",
      cost: 24,
      placementHint: "Grass near road",
    });
    expect(model.lockedSector).toMatchObject({
      id: "east-gardens",
      name: "East Gardens",
      cost: 280,
      affordable: true,
      stateLabel: "Ready to explore",
    });
  });

  it("derives optional interior furniture only from the real catalog and save state", () => {
    const base = createShowcaseGameState();
    const cafe = base.buildings.find((building) => building.kind === "cafe");
    expect(cafe).toBeDefined();
    const game = {
      ...base,
      camera: {
        center: cafe!.entranceTile,
        zoom: 2 as const,
        scene: "interior" as const,
        interiorBuildingId: cafe!.id,
        cityViewBeforeInterior: { center: base.camera.center, zoom: base.camera.zoom },
      },
    };
    const model = buildAlphaUiModel(snapshot(game), null);
    expect(model.interiorShop?.buildingId).toBe(cafe!.id);
    expect(model.interiorShop?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slotId: "decor-window", furnitureId: "fern", name: "Helecho", installed: false }),
        expect.objectContaining({ slotId: "decor-books", furnitureId: "notice-board", name: "Tablero comunitario" }),
      ]),
    );
  });

  it("builds a café inspector with entry and upgrade actions", () => {
    const game = createShowcaseGameState();
    const cafe = game.buildings.find((building) => building.kind === "cafe");
    expect(cafe).toBeDefined();
    const model = buildAlphaUiModel(snapshot(game), cafe!.id);
    expect(model.selectedBuilding).toMatchObject({
      name: "Café Biblioteca",
      status: "complete",
      progress: 1,
      canEnterCafe: true,
      upgradeId: "cafe-reading-loft",
      upgradeAvailable: true,
    });
  });

  it("keeps the agent strip compact and privacy-safe", () => {
    const base = createShowcaseGameState();
    const game = {
      ...base,
      agents: base.agents.map((agent) =>
        agent.profileId === "elen"
          ? { ...agent, activity: "thinking" as const, taskSummary: "<b>Campaign</b> token=abcdefghijk" }
          : agent,
      ),
    };
    const model = buildAlphaUiModel(snapshot(game), null);
    expect(model.agents).toHaveLength(4);
    expect(model.agents.find((agent) => agent.profileId === "elen")).toMatchObject({
      name: "Elen",
      activityLabel: "Thinking",
      summary: "Campaign [redacted]",
    });
  });

  it("makes destination, travel and building occupancy explicit", () => {
    const initial = createShowcaseGameState();
    const home = initial.buildings.find((building) => building.id === "home-syka");
    expect(home).toBeDefined();
    const homeModel = buildAlphaUiModel(snapshot(initial), home!.id, "default");
    expect(homeModel.selectedBuilding).toMatchObject({
      occupancyLabel: "1 inhabitant here",
      occupants: [expect.objectContaining({ name: "Syka" })],
    });
    expect(homeModel.selectedAgent).toMatchObject({
      name: "Syka",
      traveling: false,
      locationLabel: "At Casa acogedora",
    });

    const traveling = advanceAgentRoutines(
      { ...initial, clock: { day: 1, minuteOfDay: 480, totalMinutes: 0, speed: 1 } },
      3,
    );
    const travelModel = buildAlphaUiModel(snapshot(traveling), null, "default");
    expect(travelModel.selectedAgent).toMatchObject({
      traveling: true,
      phaseLabel: "Heading to Café Biblioteca",
    });
  });

  it("explains when a Hermes task is waiting for an unbuilt workplace", () => {
    const base = createProgressiveGameState();
    const game = {
      ...base,
      agents: base.agents.map((agent) => agent.profileId === "elen"
        ? {
            ...agent,
            activity: "thinking" as const,
            destinationBuildingId: agent.bindings.workplaceBuildingId,
            destination: agent.position,
            path: [agent.position],
            activeSessions: [{
              sessionId: "existing-task",
              activity: "thinking" as const,
              updatedAt: "2026-07-16T12:00:00.000Z",
            }],
          }
        : agent),
    };
    const model = buildAlphaUiModel(snapshot(game), null, "elen");
    expect(model.selectedAgent?.phaseLabel).toBe("Waiting for access to Estudio de Elen");
  });
});

function snapshot(game: ReturnType<typeof createShowcaseGameState>): ControllerSnapshot {
  const bridge = createSimulatedSnapshot(new Date("2026-07-16T12:00:00Z"));
  return {
    game,
    bridge,
    bridgeMode: bridge.mode,
    control: { configured: false, actors: [], revision: 0 },
  };
}
