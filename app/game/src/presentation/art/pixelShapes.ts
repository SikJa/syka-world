import Phaser from "phaser";
import { depthFor, diamondPoints, footprintPoints, isoPoint } from "./iso";
import { palette } from "./palette";

export interface BuildingSpec {
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  kind: "house" | "cafe";
}

const line = (graphics: Phaser.GameObjects.Graphics, color: number = palette.outline, alpha = 1) =>
  graphics.lineStyle(1, color, alpha);

export function drawTile(
  scene: Phaser.Scene,
  gridX: number,
  gridY: number,
  kind: "grass" | "road" | "path",
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  const points = diamondPoints(gridX, gridY);
  const color = kind === "road" ? palette.asphalt : kind === "path" ? palette.path : palette.grass;
  graphics.fillStyle(color, 1).fillPoints(points, true);
  line(graphics, kind === "road" ? palette.asphaltDark : palette.grassDark, kind === "road" ? 0.28 : 0.14);
  graphics.strokePoints(points, true);

  const center = isoPoint(gridX, gridY);
  if (kind === "grass" && (gridX * 7 + gridY * 11) % 9 === 0) {
    graphics.fillStyle(palette.grassLight, 0.72).fillRect(center.x - 4, center.y + 7, 2, 1);
    graphics.fillStyle(palette.grassDark, 0.58).fillRect(center.x + 5, center.y + 10, 1, 2);
  }
  if (kind === "road") {
    graphics.fillStyle(palette.asphaltDark, 0.35).fillRect(center.x - 6, center.y + 7, 2, 1);
    graphics.fillStyle(0x73807e, 0.25).fillRect(center.x + 6, center.y + 10, 3, 1);
  }
  graphics.setDepth(-2000 + gridX + gridY);
  return graphics;
}

export function drawLaneMark(scene: Phaser.Scene, gridX: number, gridY: number): void {
  const center = isoPoint(gridX, gridY);
  const graphics = scene.add.graphics().setDepth(-1200 + gridX + gridY);
  graphics.fillStyle(palette.lane, 0.75);
  graphics.fillPoints(
    [
      new Phaser.Math.Vector2(center.x - 4, center.y + 7),
      new Phaser.Math.Vector2(center.x + 1, center.y + 9.5),
      new Phaser.Math.Vector2(center.x - 1, center.y + 10.5),
      new Phaser.Math.Vector2(center.x - 6, center.y + 8),
    ],
    true,
  );
}

export function drawIslandEdge(scene: Phaser.Scene, size: number): void {
  const graphics = scene.add.graphics().setDepth(-2100);
  const leftTop = isoPoint(0, size);
  const bottom = isoPoint(size, size);
  const rightTop = isoPoint(size, 0);
  graphics.fillStyle(palette.soil, 1).fillPoints(
    [
      new Phaser.Math.Vector2(leftTop.x, leftTop.y),
      new Phaser.Math.Vector2(bottom.x, bottom.y),
      new Phaser.Math.Vector2(bottom.x, bottom.y + 7),
      new Phaser.Math.Vector2(leftTop.x, leftTop.y + 7),
    ],
    true,
  );
  graphics.fillStyle(0x4b382d, 1).fillPoints(
    [
      new Phaser.Math.Vector2(rightTop.x, rightTop.y),
      new Phaser.Math.Vector2(bottom.x, bottom.y),
      new Phaser.Math.Vector2(bottom.x, bottom.y + 7),
      new Phaser.Math.Vector2(rightTop.x, rightTop.y + 7),
    ],
    true,
  );
}

export function drawBuilding(scene: Phaser.Scene, spec: BuildingSpec): Phaser.GameObjects.Container {
  const { x, y, width, depth, height, kind } = spec;
  const container = scene.add.container(0, 0).setDepth(depthFor(x + width, y + depth, 20));
  const graphics = scene.add.graphics();
  const floor = footprintPoints(x, y, width, depth);
  const roof = footprintPoints(x, y, width, depth, height);
  const [top, right, bottom, left] = floor as [Phaser.Math.Vector2, Phaser.Math.Vector2, Phaser.Math.Vector2, Phaser.Math.Vector2];
  const [roofTop, roofRight, roofBottom, roofLeft] = roof as [Phaser.Math.Vector2, Phaser.Math.Vector2, Phaser.Math.Vector2, Phaser.Math.Vector2];

  graphics.fillStyle(palette.outlineDeep, 0.35).fillPoints(
    floor.map((point) => new Phaser.Math.Vector2(point.x + 5, point.y + 7)),
    true,
  );

  graphics.fillStyle(kind === "cafe" ? palette.timberLight : palette.plasterShadow, 1).fillPoints(
    [roofLeft, roofBottom, bottom, left],
    true,
  );
  graphics.fillStyle(kind === "cafe" ? palette.timber : palette.cream, 1).fillPoints(
    [roofRight, roofBottom, bottom, right],
    true,
  );
  line(graphics, palette.outlineDeep, 1);
  graphics.strokePoints([roofLeft, roofBottom, bottom, left], true);
  graphics.strokePoints([roofRight, roofBottom, bottom, right], true);

  const roofColor = kind === "cafe" ? palette.slateDark : palette.coral;
  const roofAccent = kind === "cafe" ? palette.slate : palette.coralDark;
  const ridgeY = roofTop.y - (kind === "cafe" ? 11 : 14);
  const ridge = new Phaser.Math.Vector2(roofTop.x, ridgeY);
  const ridgeBack = new Phaser.Math.Vector2(roofBottom.x, roofBottom.y - (kind === "cafe" ? 11 : 14));
  graphics.fillStyle(roofColor, 1).fillPoints([roofLeft, ridge, ridgeBack, roofBottom], true);
  graphics.fillStyle(roofAccent, 1).fillPoints([ridge, roofRight, roofBottom, ridgeBack], true);
  line(graphics, palette.outlineDeep, 1);
  graphics.strokePoints([roofLeft, ridge, ridgeBack, roofBottom], true);
  graphics.strokePoints([ridge, roofRight, roofBottom, ridgeBack], true);

  for (let index = 1; index < width * 2; index += 1) {
    const ratio = index / (width * 2);
    const x1 = Phaser.Math.Linear(ridge.x, roofRight.x, ratio);
    const y1 = Phaser.Math.Linear(ridge.y, roofRight.y, ratio);
    const x2 = Phaser.Math.Linear(ridgeBack.x, roofBottom.x, ratio);
    const y2 = Phaser.Math.Linear(ridgeBack.y, roofBottom.y, ratio);
    graphics.lineStyle(1, palette.outline, 0.22).lineBetween(x1, y1, x2, y2);
  }

  const windows = scene.add.graphics();
  const rightWallWidth = bottom.x - right.x;
  const rightWallHeight = bottom.y - right.y;
  const windowCount = kind === "cafe" ? 3 : 2;
  for (let index = 0; index < windowCount; index += 1) {
    const ratio = (index + 1) / (windowCount + 1);
    const wx = right.x + rightWallWidth * ratio - 4;
    const wy = right.y + rightWallHeight * ratio - height * 0.58;
    windows.fillStyle(palette.outlineDeep, 1).fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 9, 9);
    windows.fillStyle(palette.windowNight, 1).fillRect(Math.round(wx), Math.round(wy), 7, 7);
    windows.fillStyle(palette.windowCore, 0.9).fillRect(Math.round(wx) + 1, Math.round(wy) + 1, 2, 2);
    windows.fillStyle(palette.timberDark, 1).fillRect(Math.round(wx) + 3, Math.round(wy), 1, 7);
    windows.fillRect(Math.round(wx), Math.round(wy) + 3, 7, 1);
  }

  const leftWallWidth = bottom.x - left.x;
  const leftWallHeight = bottom.y - left.y;
  const leftCount = kind === "cafe" ? 4 : 2;
  for (let index = 0; index < leftCount; index += 1) {
    const ratio = (index + 1) / (leftCount + 1);
    const wx = left.x + leftWallWidth * ratio - 3;
    const wy = left.y + leftWallHeight * ratio - height * 0.58;
    windows.fillStyle(palette.outlineDeep, 1).fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 8, 9);
    windows.fillStyle(palette.windowNight, 1).fillRect(Math.round(wx), Math.round(wy), 6, 7);
    windows.fillStyle(palette.windowCore, 0.85).fillRect(Math.round(wx) + 1, Math.round(wy) + 1, 2, 2);
    windows.fillStyle(palette.timberDark, 1).fillRect(Math.round(wx) + 3, Math.round(wy), 1, 7);
  }

  const entrance = scene.add.graphics();
  const doorX = Math.round(bottom.x - 13);
  const doorY = Math.round(bottom.y - 17);
  entrance.fillStyle(palette.outlineDeep, 1).fillRect(doorX - 1, doorY - 1, 11, 18);
  entrance.fillStyle(palette.timberDark, 1).fillRect(doorX, doorY, 9, 17);
  entrance.fillStyle(palette.windowNight, 0.9).fillRect(doorX + 2, doorY + 2, 5, 6);
  entrance.fillStyle(palette.windowCore, 1).fillRect(doorX + 6, doorY + 11, 1, 1);

  if (kind === "cafe") {
    const awning = scene.add.graphics();
    awning.fillStyle(0x3f7668, 1).fillPoints(
      [
        new Phaser.Math.Vector2(left.x + 13, left.y + 10 - height * 0.42),
        new Phaser.Math.Vector2(bottom.x - 20, bottom.y - 10 - height * 0.42),
        new Phaser.Math.Vector2(bottom.x - 20, bottom.y - 3 - height * 0.42),
        new Phaser.Math.Vector2(left.x + 13, left.y + 17 - height * 0.42),
      ],
      true,
    );
    for (let stripe = 0; stripe < 5; stripe += 1) {
      const sx = left.x + 17 + stripe * 11;
      const sy = left.y + 12 + stripe * 5.5 - height * 0.42;
      awning.fillStyle(stripe % 2 ? palette.cream : 0x3f7668, 0.95).fillRect(Math.round(sx), Math.round(sy), 7, 3);
    }
    const sign = scene.add.graphics();
    sign.fillStyle(palette.timberDark, 1).fillRect(doorX - 19, doorY - 3, 15, 10);
    sign.fillStyle(palette.cream, 1).fillRect(doorX - 17, doorY - 1, 11, 6);
    sign.fillStyle(palette.coral, 1).fillRect(doorX - 13, doorY, 3, 3);
    container.add([awning, sign]);
  }

  const chimney = scene.add.graphics();
  const chimneyX = roofTop.x + (kind === "cafe" ? 18 : -8);
  const chimneyY = roofTop.y - height - 10;
  chimney.fillStyle(palette.outlineDeep, 1).fillRect(chimneyX - 1, chimneyY - 1, 8, 15);
  chimney.fillStyle(0x87715a, 1).fillRect(chimneyX, chimneyY, 6, 13);
  chimney.fillStyle(palette.outlineDeep, 1).fillRect(chimneyX - 2, chimneyY - 2, 10, 3);

  container.add([graphics, windows, entrance, chimney]);
  return container;
}

export function drawTree(
  scene: Phaser.Scene,
  gridX: number,
  gridY: number,
  variant = 0,
): Phaser.GameObjects.Container {
  const base = isoPoint(gridX, gridY);
  const container = scene.add.container(0, 0).setDepth(depthFor(gridX, gridY, 70));
  const shadow = scene.add.graphics();
  shadow.fillStyle(palette.outlineDeep, 0.22).fillEllipse(base.x + 3, base.y + 12, 23, 8);
  const graphics = scene.add.graphics();
  graphics.fillStyle(palette.outlineDeep, 1).fillRect(base.x - 2, base.y - 18, 6, 28);
  graphics.fillStyle(palette.timber, 1).fillRect(base.x - 1, base.y - 17, 4, 27);
  const crowns = variant % 2
    ? [[-7, -34, 15, 15], [1, -38, 17, 17], [8, -29, 13, 15], [-1, -25, 19, 16]]
    : [[-9, -31, 17, 17], [-1, -39, 18, 18], [8, -32, 15, 17], [0, -24, 20, 16]];
  for (const [ox = 0, oy = 0, width = 1, height = 1] of crowns) {
    graphics.fillStyle(palette.outlineDeep, 1).fillRect(base.x + ox - 1, base.y + oy - 1, width + 2, height + 2);
    graphics.fillStyle(palette.grassDark, 1).fillRect(base.x + ox, base.y + oy, width, height);
    graphics.fillStyle(palette.grass, 1).fillRect(base.x + ox + 2, base.y + oy + 2, Math.max(3, width - 5), Math.max(3, height - 7));
    graphics.fillStyle(palette.grassLight, 0.9).fillRect(base.x + ox + 4, base.y + oy + 3, 3, 2);
  }
  if (variant % 3 === 0) {
    graphics.fillStyle(palette.flowerGold, 1).fillRect(base.x - 5, base.y - 31, 2, 2);
    graphics.fillStyle(palette.flowerGold, 1).fillRect(base.x + 8, base.y - 27, 2, 2);
  }
  container.add([shadow, graphics]);
  return container;
}

export function drawLamp(scene: Phaser.Scene, gridX: number, gridY: number): Phaser.GameObjects.Container {
  const base = isoPoint(gridX, gridY);
  const container = scene.add.container(0, 0).setDepth(depthFor(gridX, gridY, 80));
  const glow = scene.add.graphics();
  glow.fillStyle(palette.windowNight, 0.08).fillRect(base.x - 17, base.y - 37, 35, 35);
  glow.fillStyle(palette.windowNight, 0.13).fillRect(base.x - 11, base.y - 31, 23, 23);
  glow.fillStyle(palette.windowNight, 0.18).fillRect(base.x - 6, base.y - 26, 13, 13);
  const graphics = scene.add.graphics();
  graphics.fillStyle(palette.outlineDeep, 1).fillRect(base.x - 2, base.y - 24, 4, 34);
  graphics.fillStyle(0x526064, 1).fillRect(base.x - 1, base.y - 23, 2, 32);
  graphics.fillStyle(palette.outlineDeep, 1).fillRect(base.x - 5, base.y - 30, 10, 9);
  graphics.fillStyle(palette.windowCore, 1).fillRect(base.x - 3, base.y - 28, 6, 5);
  graphics.fillStyle(palette.white, 1).fillRect(base.x - 2, base.y - 27, 2, 2);
  graphics.fillStyle(palette.outlineDeep, 1).fillRect(base.x - 4, base.y + 8, 8, 3);
  container.add([glow, graphics]);
  return container;
}

export function drawBench(scene: Phaser.Scene, gridX: number, gridY: number): void {
  const base = isoPoint(gridX, gridY);
  const graphics = scene.add.graphics().setDepth(depthFor(gridX, gridY, 40));
  graphics.fillStyle(palette.outlineDeep, 1).fillRect(base.x - 10, base.y + 2, 22, 3);
  graphics.fillStyle(palette.timberLight, 1).fillRect(base.x - 9, base.y + 1, 20, 2);
  graphics.fillStyle(palette.timber, 1).fillRect(base.x - 9, base.y - 4, 20, 3);
  graphics.fillStyle(palette.outlineDeep, 1).fillRect(base.x - 8, base.y + 4, 2, 7);
  graphics.fillRect(base.x + 8, base.y + 4, 2, 7);
}

export function drawFlowerBed(scene: Phaser.Scene, gridX: number, gridY: number, seed = 0): void {
  const base = isoPoint(gridX, gridY);
  const graphics = scene.add.graphics().setDepth(depthFor(gridX, gridY, 25));
  graphics.fillStyle(palette.soil, 1).fillPoints(diamondPoints(gridX, gridY), true);
  const colors = [palette.flowerRed, palette.flowerGold, palette.flowerPink];
  for (let index = 0; index < 7; index += 1) {
    const ox = ((index * 7 + seed * 3) % 17) - 8;
    const oy = ((index * 5 + seed) % 7) + 5;
    graphics.fillStyle(palette.grassDark, 1).fillRect(base.x + ox, base.y + oy, 1, 3);
    graphics.fillStyle(colors[(index + seed) % colors.length] ?? palette.flowerGold, 1).fillRect(base.x + ox - 1, base.y + oy - 1, 3, 2);
  }
}
