import Phaser from "phaser";
import type { GameController } from "../application";
import { CafeInteriorScene } from "./scenes/CafeInteriorScene";
import { CityScene } from "./scenes/CityScene";
import { VisualGateScene } from "./scenes/VisualGateScene";
import {
  LOGICAL_VIEWPORT_HEIGHT,
  MIN_LOGICAL_VIEWPORT_WIDTH,
  logicalViewportForSize,
  type LogicalViewport,
} from "./logicalViewport";

export interface SykaGameOptions {
  readonly mode?: "alpha" | "visual-gate";
  readonly controller?: GameController;
}

export function createSykaGame(parent: string, options: SykaGameOptions = {}): Phaser.Game {
  const mode = options.mode ?? "alpha";
  const scenes = mode === "visual-gate"
    ? [VisualGateScene]
    : createAlphaScenes(options.controller);
  const viewport = viewportForParent(parent);

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: viewport.width,
    height: viewport.height,
    backgroundColor: "#91b6c2",
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    transparent: false,
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: viewport.width,
      height: viewport.height,
    },
    input: {
      mouse: { preventDefaultWheel: true },
      touch: { capture: true },
    },
    scene: scenes,
  });
}

function viewportForParent(parent: string): LogicalViewport {
  const element = typeof document === "undefined" ? null : document.getElementById(parent);
  const bounds = element?.getBoundingClientRect();
  const view = element?.ownerDocument.defaultView;
  const width = bounds?.width || element?.clientWidth || view?.innerWidth || MIN_LOGICAL_VIEWPORT_WIDTH;
  const height = bounds?.height || element?.clientHeight || view?.innerHeight || LOGICAL_VIEWPORT_HEIGHT;
  return logicalViewportForSize(width, height);
}

function createAlphaScenes(controller: GameController | undefined): Phaser.Types.Scenes.SceneType[] {
  if (!controller) throw new TypeError("Syka World alpha requires a GameController.");
  return [new CityScene({ controller }), new CafeInteriorScene(controller)];
}
