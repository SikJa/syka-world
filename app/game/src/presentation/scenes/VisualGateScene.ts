import Phaser from "phaser";
import { drawIslandEdge } from "../art/pixelShapes";
import { depthFor, isoPoint } from "../art/iso";
import { palette } from "../art/palette";

const MAP_SIZE = 18;
const ZOOM_LEVELS = [1, 1.5, 2] as const;

const BUILDING_FRAMES = {
  "gate-house": { crop: [339, 78, 853, 905], draw: [112, 119], pivot: [427 / 853, 903 / 905] },
  "gate-cafe": { crop: [330, 87, 894, 878], draw: [144, 142], pivot: [447 / 894, 876 / 878] },
} as const;

const PROP_FRAMES = {
  "tree-round": { crop: [108, 31, 247, 275], draw: [45, 50] },
  "tree-tall": { crop: [539, 31, 138, 275], draw: [25, 50] },
  shrub: { crop: [880, 134, 187, 169], draw: [22, 20] },
  "flower-shrub": { crop: [1264, 160, 203, 143], draw: [29, 20] },
  hedge: { crop: [115, 449, 248, 118], draw: [43, 20] },
  planter: { crop: [519, 391, 197, 190], draw: [26, 25] },
  wildflowers: { crop: [880, 455, 188, 116], draw: [26, 16] },
  lamp: { crop: [1323, 322, 82, 255], draw: [11, 34] },
  bench: { crop: [111, 691, 258, 200], draw: [25, 19] },
  "potted-plant": { crop: [537, 715, 134, 154], draw: [18, 20] },
  mailbox: { crop: [915, 695, 111, 187], draw: [12, 20] },
  trellis: { crop: [1269, 680, 195, 211], draw: [28, 30] },
} as const;

const GROUND_DECAL_FRAMES = {
  "grass-two-blade": { crop: [195, 204, 74, 50], draw: [9, 6], originY: 1 },
  "grass-three-blade": { crop: [533, 182, 87, 76], draw: [10, 9], originY: 1 },
  "grass-fan": { crop: [873, 182, 137, 76], draw: [15, 8], originY: 1 },
  "clover-two-leaf": { crop: [1235, 169, 111, 89], draw: [11, 9], originY: 1 },
  "ground-plant-round": { crop: [179, 456, 107, 93], draw: [12, 10], originY: 1 },
  "flowers-coral": { crop: [508, 443, 148, 107], draw: [15, 11], originY: 1 },
  "flowers-cream": { crop: [868, 434, 129, 121], draw: [14, 13], originY: 1 },
  "stones-two": { crop: [1241, 476, 96, 60], draw: [10, 6], originY: 0.5 },
  "stones-three": { crop: [150, 754, 140, 88], draw: [13, 8], originY: 0.5 },
  "fallen-leaves": { crop: [498, 727, 153, 134], draw: [15, 13], originY: 0.5 },
  "bare-earth": { crop: [849, 748, 174, 104], draw: [17, 10], originY: 0.5 },
  mushrooms: { crop: [1235, 744, 141, 103], draw: [15, 11], originY: 1 },
} as const;

const LIGHT_FX_FRAMES = {
  "streetlamp-pool-large": { crop: [8, 6, 48, 20], draw: [48, 20], origin: [0.5, 0.5] },
  "streetlamp-pool-small": { crop: [80, 9, 32, 14], draw: [32, 14], origin: [0.5, 0.5] },
  "doorway-spill": { crop: [140, 4, 40, 24], draw: [40, 24], origin: [0.5, 0] },
  "cafe-spill-wide": { crop: [0, 34, 64, 28], draw: [64, 28], origin: [0.5, 0] },
  "window-halo": { crop: [80, 36, 32, 24], draw: [32, 24], origin: [0.5, 0.5] },
  "bulb-halo-small": { crop: [152, 40, 16, 16], draw: [16, 16], origin: [0.5, 0.5] },
} as const;

type PropFrame = keyof typeof PROP_FRAMES;
type BuildingFrame = keyof typeof BUILDING_FRAMES;
type GroundDecalFrame = keyof typeof GROUND_DECAL_FRAMES;
type LightFxFrame = keyof typeof LIGHT_FX_FRAMES;

interface QaController {
  setZoom: (zoom: number) => void;
  setTime: (hour: number) => void;
  resetCamera: () => void;
  getState: () => {
    zoom: number;
    hour: number;
    ready: boolean;
    camera: { scrollX: number; scrollY: number };
  };
}

declare global {
  interface Window {
    __SYKA_QA__?: QaController;
  }
}

export class VisualGateScene extends Phaser.Scene {
  private dragging = false;
  private dragStart = new Phaser.Math.Vector2();
  private cameraStart = new Phaser.Math.Vector2();
  private hour = 19.25;
  private hourLabel?: Phaser.GameObjects.Text;
  private readonly worldSprites: Phaser.GameObjects.Image[] = [];
  private readonly lampSprites: Phaser.GameObjects.Image[] = [];
  private readonly lightEffects: Array<{ sprite: Phaser.GameObjects.Image; strength: number }> = [];

  constructor() {
    super("visual-gate");
  }

  preload(): void {
    this.load.image("gate-house", "/assets/generated/gate-v2/house-exterior-v1.png");
    this.load.image("gate-cafe", "/assets/generated/gate-v2/cafe-exterior-v1.png");
    this.load.image("gate-props", "/assets/generated/gate-v2/environment-props-sheet-v1.png");
    this.load.image("gate-ground-decals", "/assets/generated/gate-v2/ground-decals-sheet-v1.png");
    this.load.image("gate-light-fx", "/assets/generated/gate-v3/light-fx-sheet-v1.png");
    this.load.spritesheet("gate-terrain", "/assets/generated/gate-v2/terrain-tiles-atlas-v2.png", {
      frameWidth: 320,
      frameHeight: 160,
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(palette.skyTwilight);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBounds(300, 20, 1200, 760);

    this.registerGeneratedFrames();
    this.drawTerrain();
    this.drawGroundDetails();
    this.drawGateDistrict();
    this.createCameraControls();
    this.createMinimalHud();
    this.resetCamera();
    this.setHour(this.hour);
    this.exposeQaControls();

    this.game.events.emit("ready");
    document.documentElement.dataset.sykaReady = "true";
  }

  shutdown(): void {
    delete window.__SYKA_QA__;
  }

  private drawTerrain(): void {
    drawIslandEdge(this, MAP_SIZE);
    for (let y = 0; y < MAP_SIZE; y += 1) {
      for (let x = 0; x < MAP_SIZE; x += 1) {
        const horizontalRoad = y >= 7 && y <= 8 && x >= 1 && x <= 16;
        const verticalRoad = x >= 8 && x <= 9 && y >= 1 && y <= 16;
        const publicNook = (x === 5 || x === 6) && (y === 10 || y === 11);
        const sidewalk = publicNook ||
          ((y === 6 || y === 9) && x >= 1 && x <= 16) ||
          ((x === 7 || x === 10) && y >= 1 && y <= 16);
        const road = horizontalRoad || verticalRoad;
        const hasLaneMark = road && ((horizontalRoad && x % 3 === 0) || (verticalRoad && y % 3 === 0));
        const grassVariant = (x * 5 + y * 3) % 11 === 0 ? 4 : (x * 5 + y * 3) % 5 === 0 ? 1 : 0;
        const frame = road ? (hasLaneMark ? 5 : 3) : sidewalk ? 2 : grassVariant;
        const point = isoPoint(x, y);
        const tile = this.add
          .image(point.x, point.y + 8, "gate-terrain", frame)
          .setOrigin(0.5)
          .setScale(0.1)
          .setDepth(-2000 + x + y);
        if (hasLaneMark && verticalRoad && !horizontalRoad) tile.setFlipX(true);
        this.worldSprites.push(tile);
      }
    }
  }

  private drawGateDistrict(): void {
    this.placeBuildingSprite("gate-house", 3.2, 5.2);
    this.placeBuildingSprite("gate-cafe", 14.4, 4.8);

    const trees: Array<[number, number, "tree-round" | "tree-tall"]> = [
      [1, 2, "tree-round"], [2, 6, "tree-tall"], [6, 2, "tree-round"], [7, 5, "tree-tall"],
      [10, 2, "tree-round"], [16, 2, "tree-tall"], [16, 6, "tree-round"], [1, 11, "tree-tall"],
      [4.5, 12.5, "tree-tall"],
      [3, 15, "tree-round"], [7, 16, "tree-tall"], [12, 16, "tree-round"], [16, 13, "tree-tall"],
    ];
    for (const [x, y, frame] of trees) this.placeProp(frame, x, y);

    const lamps: Array<[number, number]> = [
      [3, 5.55], [12, 5.55], [6, 9.45], [15, 9.45], [6.55, 12], [10.45, 5],
    ];
    for (const [x, y] of lamps) this.placeProp("lamp", x, y);

    const shrubs: Array<[number, number, "shrub" | "flower-shrub" | "hedge" | "planter" | "wildflowers"]> = [
      [2, 1, "flower-shrub"], [5, 1, "shrub"], [6, 5, "planter"], [11, 1, "hedge"],
      [15, 1, "flower-shrub"], [10, 5, "wildflowers"], [15, 5, "planter"], [2, 11, "hedge"],
      [4, 13, "flower-shrub"], [13, 12, "wildflowers"], [15, 15, "planter"], [11, 16, "shrub"],
    ];
    for (const [x, y, frame] of shrubs) this.placeProp(frame, x, y);

    this.placeProp("bench", 5.6, 10.6);
    this.placeProp("planter", 5.1, 11.45);
    this.placeProp("trellis", 6, 3);
    this.placeProp("mailbox", 3, 6);
    this.placeProp("potted-plant", 11, 6);
    this.placeProp("planter", 14, 6);
    this.placeProp("wildflowers", 13, 10);
    this.createLightSources(lamps);
  }

  private drawGroundDetails(): void {
    const details: ReadonlyArray<readonly [GroundDecalFrame, number, number]> = [
      ["grass-two-blade", 1.4, 4.1], ["grass-three-blade", 4.3, 1.4],
      ["grass-fan", 5.1, 4.5], ["clover-two-leaf", 11.4, 1.7],
      ["ground-plant-round", 1.5, 13.4], ["stones-two", 15.8, 3.1],
      ["grass-two-blade", 3.2, 11.8], ["fallen-leaves", 4.2, 15.8],
      ["grass-three-blade", 6.2, 14.2], ["flowers-coral", 5.1, 16.2],
      ["stones-three", 12.5, 11.7], ["flowers-cream", 13.8, 12.5],
      ["ground-plant-round", 15.5, 11.2], ["bare-earth", 15.4, 15.5],
      ["mushrooms", 13.2, 16.4], ["clover-two-leaf", 2.1, 16.1],
      ["grass-fan", 16.2, 9.9], ["grass-two-blade", 11.8, 15.1],
    ];
    for (const [frame, x, y] of details) this.placeGroundDecal(frame, x, y);
  }

  private registerGeneratedFrames(): void {
    for (const [key, spec] of Object.entries(BUILDING_FRAMES)) {
      const [x, y, width, height] = spec.crop;
      this.textures.get(key).add("body", 0, x, y, width, height);
    }
    const propsTexture = this.textures.get("gate-props");
    for (const [name, spec] of Object.entries(PROP_FRAMES)) {
      const [x, y, width, height] = spec.crop;
      propsTexture.add(name, 0, x, y, width, height);
    }
    const decalsTexture = this.textures.get("gate-ground-decals");
    for (const [name, spec] of Object.entries(GROUND_DECAL_FRAMES)) {
      const [x, y, width, height] = spec.crop;
      decalsTexture.add(name, 0, x, y, width, height);
    }
    const lightTexture = this.textures.get("gate-light-fx");
    for (const [name, spec] of Object.entries(LIGHT_FX_FRAMES)) {
      const [x, y, width, height] = spec.crop;
      lightTexture.add(name, 0, x, y, width, height);
    }
  }

  private placeBuildingSprite(key: BuildingFrame, gridX: number, gridY: number): void {
    const base = isoPoint(gridX, gridY);
    const spec = BUILDING_FRAMES[key];
    const shadow = this.add.graphics().setDepth(depthFor(gridX, gridY, 55));
    shadow.fillStyle(palette.outlineDeep, 0.23).fillEllipse(
      base.x,
      base.y + 4,
      key === "gate-cafe" ? 128 : 104,
      key === "gate-cafe" ? 30 : 25,
    );
    const building = this.add
      .image(base.x, base.y, key, "body")
      .setOrigin(spec.pivot[0], spec.pivot[1])
      .setDisplaySize(spec.draw[0], spec.draw[1])
      .setDepth(depthFor(gridX, gridY, 60));
    this.worldSprites.push(building);
  }

  private placeProp(frame: PropFrame, gridX: number, gridY: number): void {
    const base = isoPoint(gridX, gridY);
    const [width, height] = PROP_FRAMES[frame].draw;
    const prop = this.add
      .image(base.x, base.y + 9, "gate-props", frame)
      .setOrigin(0.5, 1)
      .setDisplaySize(width, height)
      .setDepth(depthFor(gridX, gridY, 80));
    if (frame === "lamp") this.lampSprites.push(prop);
    else this.worldSprites.push(prop);
  }

  private placeGroundDecal(frame: GroundDecalFrame, gridX: number, gridY: number): void {
    const base = isoPoint(gridX, gridY);
    const spec = GROUND_DECAL_FRAMES[frame];
    const decal = this.add
      .image(base.x, base.y + 9, "gate-ground-decals", frame)
      .setOrigin(0.5, spec.originY)
      .setDisplaySize(spec.draw[0], spec.draw[1])
      .setDepth(-900 + gridX + gridY);
    this.worldSprites.push(decal);
  }

  private createLightSources(lamps: ReadonlyArray<readonly [number, number]>): void {
    for (const [index, [x, y]] of lamps.entries()) {
      const ground = isoPoint(x, y);
      this.createLightEffect(
        index % 3 === 0 ? "streetlamp-pool-large" : "streetlamp-pool-small",
        ground.x,
        ground.y + 9,
        -700 + x + y,
        index % 3 === 0 ? 0.75 : 0.62,
      );
    }

    this.createLightEffect("doorway-spill", 858, 177, -680, 0.68);
    this.createLightEffect("cafe-spill-wide", 1044, 248, -680, 0.78);
  }

  private createLightEffect(
    frame: LightFxFrame,
    x: number,
    y: number,
    depth: number,
    strength: number,
  ): void {
    const spec = LIGHT_FX_FRAMES[frame];
    const sprite = this.add
      .image(x, y, "gate-light-fx", frame)
      .setOrigin(spec.origin[0], spec.origin[1])
      .setDisplaySize(spec.draw[0], spec.draw[1])
      .setDepth(depth)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.lightEffects.push({ sprite, strength });
  }

  private createMinimalHud(): void {
    const frame = this.add.graphics().setScrollFactor(0).setDepth(910000);
    frame.fillStyle(palette.nightDeep, 0.9).fillRect(16, 16, 190, 48);
    frame.lineStyle(1, palette.timberLight, 1).strokeRect(16, 16, 190, 48);
    frame.fillStyle(palette.windowNight, 1).fillRect(25, 25, 4, 30);

    this.add
      .text(38, 23, "SYKA WORLD", {
        fontFamily: "Georgia, serif",
        fontSize: "12px",
        color: "#ffe39a",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setScrollFactor(0)
      .setDepth(910001)
      .setResolution(2);
    this.hourLabel = this.add
      .text(38, 42, "Atardecer · 19:15", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "9px",
        color: "#f0dba9",
      })
      .setScrollFactor(0)
      .setDepth(910001)
      .setResolution(2);

    const hint = this.add
      .text(704, 426, "ARRASTRAR · RUEDA PARA ZOOM", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "8px",
        color: "#f0dba9",
        backgroundColor: "#192d38cc",
        padding: { x: 8, y: 5 },
      })
      .setOrigin(1)
      .setScrollFactor(0)
      .setDepth(910001)
      .setResolution(2);
    hint.setAlpha(0.9);
  }

  private createCameraControls(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.dragging = true;
        this.dragStart.set(pointer.x, pointer.y);
        this.cameraStart.set(this.cameras.main.scrollX, this.cameras.main.scrollY);
      }
    });
    this.input.on("pointerup", () => {
      this.dragging = false;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const camera = this.cameras.main;
      camera.scrollX = Math.round(this.cameraStart.x - (pointer.x - this.dragStart.x) / camera.zoom);
      camera.scrollY = Math.round(this.cameraStart.y - (pointer.y - this.dragStart.y) / camera.zoom);
    });
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      const current = this.cameras.main.zoom;
      const index = ZOOM_LEVELS.reduce((best, value, candidate) => {
        const bestValue = ZOOM_LEVELS[best] ?? ZOOM_LEVELS[0];
        return Math.abs(value - current) < Math.abs(bestValue - current) ? candidate : best;
      }, 0);
      const next = Phaser.Math.Clamp(index + (dy > 0 ? -1 : 1), 0, ZOOM_LEVELS.length - 1);
      this.setZoom(ZOOM_LEVELS[next] ?? 1);
    });
  }

  private exposeQaControls(): void {
    window.__SYKA_QA__ = {
      setZoom: (zoom) => this.setZoom(zoom),
      setTime: (hour) => this.setHour(hour),
      resetCamera: () => this.resetCamera(),
      getState: () => ({
        zoom: this.cameras.main.zoom,
        hour: this.hour,
        ready: true,
        camera: {
          scrollX: this.cameras.main.scrollX,
          scrollY: this.cameras.main.scrollY,
        },
      }),
    };
  }

  private setZoom(zoom: number): void {
    const nearest = ZOOM_LEVELS.reduce((best, value) =>
      Math.abs(value - zoom) < Math.abs(best - zoom) ? value : best, ZOOM_LEVELS[0]);
    this.cameras.main.setZoom(nearest);
    this.cameras.main.scrollX = Math.round(this.cameras.main.scrollX);
    this.cameras.main.scrollY = Math.round(this.cameras.main.scrollY);
  }

  private setHour(hour: number): void {
    this.hour = ((hour % 24) + 24) % 24;
    const isNight = this.hour >= 20 || this.hour < 6;
    const twilightProgress = this.hour >= 17 && this.hour < 20 ? (this.hour - 17) / 3 : 0;
    const isTwilight = this.hour >= 17 && this.hour < 20;
    const ambientTint = isNight ? 0x8799b0 : isTwilight ? 0xd5e0ee : 0xffffff;
    for (const sprite of this.worldSprites) sprite.setTint(ambientTint);
    const lampTint = isNight ? 0xf0d9aa : isTwilight ? 0xffefd2 : 0xffffff;
    for (const sprite of this.lampSprites) sprite.setTint(lampTint);
    const lightPhase = isNight ? 0.9 : isTwilight ? 0.42 + twilightProgress * 0.28 : 0.08;
    for (const effect of this.lightEffects) effect.sprite.setAlpha(effect.strength * lightPhase);
    this.cameras.main.setBackgroundColor(isNight ? 0x36566a : isTwilight ? 0x7896aa : palette.skyTwilight);
    const period = this.hour >= 20 || this.hour < 6 ? "Noche" : this.hour >= 17 ? "Atardecer" : "Día";
    const hourValue = Math.floor(this.hour).toString().padStart(2, "0");
    const minuteValue = Math.round((this.hour % 1) * 60).toString().padStart(2, "0");
    this.hourLabel?.setText(`${period} · ${hourValue}:${minuteValue}`);
  }

  private resetCamera(): void {
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(900, 240);
  }
}
