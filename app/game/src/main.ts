import "./styles.css";
import "./alpha-styles.css";
import { AlphaRuntime } from "./application/AlphaRuntime";
import type { AgentLocalAction, GridPoint, ProfileId } from "./core";
import { createSykaGame } from "./presentation/createSykaGame";
import { CITY_SCENE_EVENTS, type CityInteriorRequestPayload } from "./presentation/city/types";
import { CityScene } from "./presentation/scenes/CityScene";
import { cafeAnchorCell } from "./presentation/interior/cafeSpatialModel";
import { installAlphaQaApi } from "./qa/alphaQaApi";
import { createAlphaUi, type AlphaUiHandle } from "./ui";

const query = new URLSearchParams(window.location.search);
const gateMode = query.get("gate") === "1" || query.get("view") === "visual-gate";

if (gateMode) {
  const game = createSykaGame("game-canvas", { mode: "visual-gate" });
  hideLoadingWhenReady(game);
  registerHotCleanup(() => game.destroy(true));
} else {
  bootstrapAlpha();
}

function bootstrapAlpha(): void {
  const mode = query.get("mode") === "progressive" ? "progressive" : "showcase";
  const developmentMode = query.get("qa") === "1";
  const runtime = new AlphaRuntime({ mode, developmentMode });
  const controller = runtime.getController();
  const game = createSykaGame("game-canvas", { mode: "alpha", controller });
  let disposeAlpha: (() => void) | undefined;

  hideLoadingWhenReady(game);
  game.events.once("ready", () => {
    disposeAlpha = wireAlpha(runtime, game, developmentMode);
  });

  const stop = (): void => {
    disposeAlpha?.();
    void runtime.stop();
    game.destroy(true);
  };
  window.addEventListener("pagehide", () => void runtime.stop(), { once: true });
  registerHotCleanup(stop);
}

function wireAlpha(runtime: AlphaRuntime, game: Phaser.Game, developmentMode: boolean): () => void {
  const controller = runtime.getController();
  const city = game.scene.getScene("city") as CityScene;
  if (!city) throw new Error("City scene did not boot.");
  const uiRoot = requiredElement("#game-ui");
  let ui: AlphaUiHandle;
  let transitioning = false;
  const interactionTimers = new Set<number>();

  const openInterior = (buildingId: string): void => {
    if (transitioning || game.scene.isActive("cafe-interior")) return;
    transitioning = true;
    city.selectBuilding(buildingId);
    city.cameras.main.fadeOut(150, 38, 60, 73);
    window.setTimeout(() => {
      if (game.scene.isActive("city")) game.scene.sleep("city");
      if (!game.scene.isActive("cafe-interior")) game.scene.start("cafe-interior", { buildingId });
      transitioning = false;
    }, 160);
  };

  const closeInterior = (): void => {
    if (transitioning) return;
    transitioning = true;
    if (game.scene.isActive("cafe-interior")) game.scene.stop("cafe-interior");
    if (game.scene.isSleeping("city")) game.scene.wake("city");
    city.activateSpatialControl();
    city.cameras.main.fadeIn(170, 38, 60, 73);
    window.setTimeout(() => {
      transitioning = false;
    }, 180);
  };

  const syncSceneFromState = (): void => {
    if (transitioning) return;
    const camera = runtime.getSnapshot().game.camera;
    if (camera.scene === "interior" && camera.interiorBuildingId) {
      if (!game.scene.isActive("cafe-interior")) openInterior(camera.interiorBuildingId);
      return;
    }
    if (game.scene.isActive("cafe-interior")) closeInterior();
  };

  // Manual release inside an interior may complete an authored exit route on
  // a later tick. Keep the renderer aligned with that atomic camera change.
  const unsubscribeSceneSync = controller.subscribe(() => syncSceneFromState(), false);

  ui = createAlphaUi({
    root: uiRoot,
    runtime,
    scene: {
      setBuildTool: (definitionId, orientation) => {
        city.setBuildTool(definitionId, orientation);
      },
      rotateBuildTool: (orientation) => {
        city.setBuildOrientation(orientation);
      },
      cancelBuildTool: () => city.cancelBuild(),
      enterCafe: openInterior,
      exitCafe: closeInterior,
      focusAgent: (profileId) => {
        city.focusAgent(profileId);
      },
      focusBuilding: (buildingId) => {
        city.focusBuilding(buildingId);
      },
      resetWorld: () => {
        if (game.scene.isActive("cafe-interior")) closeInterior();
        city.cancelBuild();
        city.selectBuilding(null);
      },
      setExteriorTool: (definitionId) => city.setExteriorTool(definitionId),
      selectWorldObject: (instanceId) => city.selectWorldObject(instanceId),
      runInteriorAction: (profileId, _hotspotId, actionId) => {
        const actions: Readonly<Record<string, AgentLocalAction>> = {
          sit: "sit",
          read: "read",
          "self-serve-coffee": "serve-coffee",
          "warm-up": "warm-fireplace",
        };
        const action = actions[actionId];
        if (!action) {
          ui.showToast("Esa acción todavía no está disponible.", "warning");
          return false;
        }
        const result = runtime.actions.setAgentInteriorAction(profileId, action);
        return result.ok;
      },
      interactContext: () => runContextInteraction(runtime, city, ui, interactionTimers),
      usePortal: () => useContextPortal(runtime, city, ui, openInterior, closeInterior),
      syncSceneFromState,
    },
  });

  city.onCityEvent(CITY_SCENE_EVENTS.selection, (selection) => {
    ui.setSelectedBuilding(selection?.buildingId ?? null);
  });
  city.onCityEvent(CITY_SCENE_EVENTS.agentSelection, (agentId) => {
    const profileId = agentId === "syka" ? "default" : agentId;
    runtime.actions.selectProfile(profileId);
    ui.setSelectedAgent(profileId);
  });
  city.onCityEvent(CITY_SCENE_EVENTS.error, (error) => {
    ui.showToast(error.message, "warning");
  });
  city.onCityEvent(CITY_SCENE_EVENTS.interior, (request) => {
    enterFromCity(request, runtime, ui, openInterior);
  });
  city.onCityEvent(CITY_SCENE_EVENTS.placementPreview, (preview) => {
    ui.setPlacementPreview(preview);
  });
  city.onCityEvent(CITY_SCENE_EVENTS.worldObjectSelection, (selection) => {
    ui.setSelectedWorldObject(selection?.instanceId ?? null);
  });

  game.events.on("syka:interior-exit", closeInterior);
  game.events.on("syka:interior-selection", (detail: {
    readonly hotspot?: {
      readonly id: string;
      readonly label: string;
      readonly description: string;
      readonly actions: readonly { readonly id: string; readonly label: string; readonly agentAction: boolean }[];
    };
  }) => {
    ui.setInteriorHotspot(detail.hotspot ?? null);
  });
  game.events.on("syka:interior-agent-selection", (detail: { readonly profileId?: "default" | "elen" | "astrelis" | "zerny" }) => {
    if (detail.profileId) {
      runtime.actions.selectProfile(detail.profileId);
      ui.setSelectedAgent(detail.profileId);
    }
  });
  game.events.on("syka:spatial-click", (detail: { readonly sceneId: string; readonly cell: GridPoint }) => {
    const result = runtime.actions.clickMove(detail.sceneId, detail.cell);
    if (!result.ok) ui.showToast(spatialErrorLabel(result.error.code, result.error.message), "warning");
  });
  game.events.on("syka:ui-error", () => ui.showToast("No se pudo completar esa acción.", "warning"));

  const removeQaApi = developmentMode
    ? installAlphaQaApi({ runtime, game, city, openInterior, closeInterior })
    : () => undefined;

  void runtime.start()
    .then(syncSceneFromState)
    .catch(() => {
      ui.showToast("The town remains in local mode because the bridge did not respond.", "warning");
      syncSceneFromState();
    });

  return (): void => {
    for (const timer of interactionTimers) window.clearTimeout(timer);
    interactionTimers.clear();
    unsubscribeSceneSync();
    removeQaApi();
    ui.destroy();
  };
}

function runContextInteraction(
  runtime: AlphaRuntime,
  city: CityScene,
  ui: AlphaUiHandle,
  timers: Set<number>,
): boolean {
  const result = runtime.actions.interact();
  if (!result.ok) {
    ui.showToast(spatialErrorLabel(result.error.code, result.error.message), "warning");
    return false;
  }
  const request = result.value;
  const delay = Math.max(40, (request.interaction.path.length - 1) * 190 + 50);
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    const actor = runtime.getSnapshot().control.actors.find((candidate) => candidate.actorId === request.actorId);
    const target = request.interaction.path.at(-1);
    if (!actor || !target || actor.cell.x !== target.x || actor.cell.y !== target.y) {
      ui.showToast("La interacción se canceló porque el paso quedó bloqueado.", "warning");
      runtime.actions.finishInteraction(request.actorId);
      return;
    }
    const action = asAgentLocalAction(request.interaction.action);
    if (action && request.profileId) {
      const applied = runtime.actions.setAgentInteriorAction(
        request.profileId,
        action,
        request.interaction.anchorId,
      );
      if (!applied.ok) {
        ui.showToast(applied.error.message, "warning");
        runtime.actions.finishInteraction(request.actorId);
        return;
      }
      ui.showToast(interactionSuccessLabel(action), "success");
    } else if (request.interaction.action === "inspect-building") {
      const buildingId = request.interaction.entityId.replace("city:entity:building:", "");
      city.focusBuilding(buildingId);
      ui.showToast("Lugar seleccionado.", "warm");
    } else if (request.interaction.action === "inspect-world-object") {
      const instanceId = request.interaction.entityId.replace("city:entity:world-object:", "");
      city.selectWorldObject(instanceId);
      ui.showToast("Objeto seleccionado.", "warm");
    } else {
      ui.showToast("Interacción completada.", "success");
    }
    runtime.actions.finishInteraction(request.actorId);
  }, delay);
  timers.add(timer);
  return true;
}

function useContextPortal(
  runtime: AlphaRuntime,
  city: CityScene,
  ui: AlphaUiHandle,
  openInterior: (buildingId: string) => void,
  closeInterior: () => void,
): boolean {
  const request = runtime.actions.usePortal();
  if (!request.ok) {
    ui.showToast(spatialErrorLabel(request.error.code, request.error.message), "warning");
    return false;
  }
  const targetSceneId = request.value.portal.target.sceneId;
  if (targetSceneId === "city") {
    const binding = runtime.getSnapshot().control.binding;
    const buildingId = binding?.kind === "interior" ? binding.buildingId : undefined;
    const building = buildingId
      ? runtime.getSnapshot().game.buildings.find((candidate) => candidate.id === buildingId)
      : undefined;
    if (!building) {
      ui.showToast("No encontramos la salida de este interior.", "warning");
      return false;
    }
    const traversed = runtime.actions.traversePortal(request.value, {
      binding: { kind: "city" },
      cell: building.accessTile,
    });
    if (!traversed.ok) {
      ui.showToast(spatialErrorLabel(traversed.error.code, traversed.error.message), "warning");
      return false;
    }
    closeInterior();
    city.activateSpatialControl();
    ui.showToast("You exited to town without losing control.", "success");
    return true;
  }
  if (!targetSceneId.startsWith("cafe:")) {
    ui.showToast("Ese interior todavía no está disponible en esta versión.", "warning");
    return false;
  }
  const buildingId = targetSceneId.slice("cafe:".length);
  const building = runtime.getSnapshot().game.buildings.find(
    (candidate) => candidate.id === buildingId && candidate.kind === "cafe" && candidate.status === "complete",
  );
  if (!building) {
    ui.showToast("El Café Biblioteca todavía no está listo.", "warning");
    return false;
  }
  const traversed = runtime.actions.traversePortal(request.value, {
    binding: { kind: "interior", buildingId },
    cell: cafeAnchorCell("entry"),
    anchorId: "entry",
  });
  if (!traversed.ok) {
    ui.showToast(spatialErrorLabel(traversed.error.code, traversed.error.message), "warning");
    return false;
  }
  openInterior(buildingId);
  ui.showToast("Entraste al Café Biblioteca sin perder el control.", "success");
  return true;
}

function asAgentLocalAction(action: string): AgentLocalAction | undefined {
  return (["sit", "read", "serve-coffee", "warm-fireplace"] as const).find((candidate) => candidate === action);
}

function interactionSuccessLabel(action: AgentLocalAction): string {
  return {
    sit: "Se sentó en el lugar elegido.",
    read: "Empezó a leer.",
    "serve-coffee": "Preparó un café.",
    "warm-fireplace": "Se acercó a la chimenea.",
  }[action];
}

function spatialErrorLabel(code: string, fallback: string): string {
  const labels: Readonly<Record<string, string>> = {
    NO_SELECTED_ACTOR: "Select Syka, Elen, Astrelis or Zerny first.",
    NO_POSSESSED_ACTOR: "Activate Possess before using WASD.",
    PROFILE_NOT_IN_SCENE: "That inhabitant is not in the scene you are viewing.",
    POSSESSION_ACTIVE: "While possessing an agent, move it with WASD.",
    INVALID_DESTINATION: "That tile is not walkable.",
    DESTINATION_OCCUPIED: "Esa casilla ya está ocupada.",
    STEP_BLOCKED: "Hay un objeto o personaje bloqueando ese paso.",
    NO_PATH: "No hay un camino libre hasta allí.",
    NO_REACHABLE_INTERACTION: "No valid interaction nearby.",
    NO_PORTAL_IN_FRONT: "Acercate a la puerta y mirá hacia ella para usar F.",
  };
  return labels[code] ?? fallback;
}

function enterFromCity(
  request: CityInteriorRequestPayload,
  runtime: AlphaRuntime,
  ui: AlphaUiHandle,
  openInterior: (buildingId: string) => void,
): void {
  const result = runtime.actions.enterInterior(request.buildingId);
  if (!result.ok) {
    ui.showToast(result.error.message, "warning");
    return;
  }
  openInterior(request.buildingId);
}

function hideLoadingWhenReady(game: Phaser.Game): void {
  game.events.once("ready", () => {
    document.querySelector("#loading-card")?.classList.add("is-hidden");
  });
}

function requiredElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function registerHotCleanup(cleanup: () => void): void {
  if (import.meta.hot) import.meta.hot.dispose(cleanup);
}
