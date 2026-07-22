import { describe, expect, it } from "vitest";
import {
  advanceSimulation,
  createShowcaseGameState,
  enterBuildingInterior,
  exitBuildingInterior,
  panCityCamera,
  setAgentsVisible,
  setCameraZoom,
} from "./index";

describe("camera and isolated interiors", () => {
  it("enters a furnished interior and restores the exact city view", () => {
    let state = createShowcaseGameState();
    state = panCityCamera(state, { x: 3, y: -2 });
    state = setCameraZoom(state, 1.5);
    const cityCamera = state.camera;
    const entered = enterBuildingInterior(state, "cafe-main");
    if (!entered.ok) throw new Error(entered.error.message);
    expect(entered.value.camera).toEqual(expect.objectContaining({ scene: "interior", zoom: 2, interiorBuildingId: "cafe-main" }));
    const exited = exitBuildingInterior(entered.value);
    if (!exited.ok) throw new Error(exited.error.message);
    expect(exited.value.camera).toEqual({ center: cityCamera.center, zoom: cityCamera.zoom, scene: "city" });
    expect(exited.value.clock).toEqual(state.clock);
  });
});

describe("headless simulation", () => {
  it("advances construction, routines and local progression without Hermes", () => {
    const state = createShowcaseGameState();
    const balance = state.economy.balance;
    const advanced = advanceSimulation(state, 720);
    expect(advanced.clock.totalMinutes).toBe(720);
    expect(advanced.economy.balance).toBe(balance + 4);
    expect(advanced.agents).toHaveLength(4);
  });

  it("hiding agents never pauses their simulation", () => {
    const hidden = setAgentsVisible(createShowcaseGameState(), false);
    const advanced = advanceSimulation(hidden, 15);
    expect(advanced.agentsVisible).toBe(false);
    expect(advanced.clock.totalMinutes).toBe(15);
    expect(advanced.agents[0]?.position).not.toEqual(hidden.agents[0]?.position);
  });

  it("keeps a large time jump equivalent to normal minute-by-minute life", () => {
    const initial = createShowcaseGameState();
    const jumped = advanceSimulation(initial, 720);
    let stepped = initial;
    for (let minute = 0; minute < 720; minute += 1) stepped = advanceSimulation(stepped, 1);
    expect(jumped).toEqual(stepped);
  });
});
