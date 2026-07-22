import type { GameStateV1, GridPoint, Result } from "./contracts";

export interface NavigationError {
  readonly code: "UNKNOWN_BUILDING" | "BUILDING_INCOMPLETE" | "INTERIOR_UNAVAILABLE" | "NOT_IN_INTERIOR";
  readonly message: string;
}

export const panCityCamera = (state: GameStateV1, delta: GridPoint): GameStateV1 => {
  if (state.camera.scene !== "city") return state;
  const center = {
    x: Math.max(0, Math.min(state.map.size.width - 1, state.camera.center.x + delta.x)),
    y: Math.max(0, Math.min(state.map.size.height - 1, state.camera.center.y + delta.y)),
  };
  return { ...state, camera: { ...state.camera, center } };
};

export const setCameraZoom = (state: GameStateV1, zoom: 1 | 1.5 | 2): GameStateV1 => ({
  ...state,
  camera: { ...state.camera, zoom },
});

export const enterBuildingInterior = (
  state: GameStateV1,
  buildingId: string,
): Result<GameStateV1, NavigationError> => {
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  if (!building) return { ok: false, error: { code: "UNKNOWN_BUILDING", message: `Unknown building ${buildingId}.` } };
  if (building.status !== "complete") {
    return { ok: false, error: { code: "BUILDING_INCOMPLETE", message: "The interior opens after construction finishes." } };
  }
  if (!state.interiors.some((interior) => interior.buildingId === buildingId)) {
    return { ok: false, error: { code: "INTERIOR_UNAVAILABLE", message: "This building has no furnished interior." } };
  }
  return {
    ok: true,
    value: {
      ...state,
      camera: {
        center: building.entranceTile,
        zoom: 2,
        scene: "interior",
        interiorBuildingId: buildingId,
        cityViewBeforeInterior: { center: state.camera.center, zoom: state.camera.zoom },
      },
    },
  };
};

export const exitBuildingInterior = (state: GameStateV1): Result<GameStateV1, NavigationError> => {
  if (state.camera.scene !== "interior") {
    return { ok: false, error: { code: "NOT_IN_INTERIOR", message: "The camera is already in the city." } };
  }
  const restored = state.camera.cityViewBeforeInterior ?? { center: state.camera.center, zoom: 1 as const };
  return {
    ok: true,
    value: {
      ...state,
      camera: { center: restored.center, zoom: restored.zoom, scene: "city" },
    },
  };
};
