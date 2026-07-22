import * as THREE from "three";

import { ACTOR_RADIUS, LAB_COLLIDERS, type RectCollider, type Vec2 } from "./engine";
import { alphaChannelFromRgba, buildAlphaRelief } from "./relief";
import {
  BOOKSHELF_ASSET,
  SOFA_ASSET,
  TABLE_ASSET,
  type SpatialAssetDefinition,
} from "./spatialAssets";

export type CharacterPose = "idle" | "walk" | "seated";

export interface PickResult {
  readonly point?: Vec2;
  readonly interaction?: "sofa-seat";
}

export interface LabSceneController {
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly actorRoot: THREE.Group;
  resize(width: number, height: number): void;
  render(): void;
  setActorPosition(position: Vec2): void;
  setActorFacing(angle: number): void;
  setActorPose(pose: CharacterPose): void;
  animateActor(elapsed: number, speed: number): void;
  setTechnicalVisible(visible: boolean): void;
  updatePath(points: readonly Vec2[]): void;
  pick(clientX: number, clientY: number, rect: DOMRect): PickResult;
  getScreenAxes(): { readonly up: Vec2; readonly right: Vec2 };
  getDiagnostics(): LabSceneDiagnostics;
  dispose(): void;
}

export interface LabSceneDiagnostics {
  readonly reliefReady: boolean;
  readonly sourceFrameWidth: number;
  readonly sourceFrameHeight: number;
  readonly reliefVertices: number;
  readonly reliefDepth: number;
  readonly internalWidth: number;
  readonly internalHeight: number;
}

const PALETTE = {
  night: 0x243b46,
  twilight: 0x537b8c,
  cream: 0xe8d4ad,
  creamShadow: 0xb9966a,
  wood: 0x6f4934,
  woodDark: 0x37281f,
  woodLight: 0xa7754b,
  green: 0x315d47,
  greenLight: 0x4e7b5c,
  coral: 0xc56347,
  amber: 0xffd58a,
  rug: 0x724335,
  rugDark: 0x392d2b,
  slate: 0x2d4650,
} as const;

const disposables: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];
const ATLAS_COLUMNS = 5;
const ATLAS_ROWS = 4;
const ACTOR_WORLD_WIDTH = 1.12;
const ACTOR_STANDING_HEIGHT = 1.52;
const ACTOR_SEATED_HEIGHT = 1.46;
const ACTOR_SEATED_BASE = 0.43;
const ACTOR_RELIEF_DEPTH = 0.46;

function track<T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(value: T): T {
  disposables.push(value);
  return value;
}

function createGradientMap(): THREE.DataTexture {
  const data = new Uint8Array([38, 98, 166, 232]);
  const texture = track(new THREE.DataTexture(data, 4, 1, THREE.RedFormat));
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createPixelTexture(
  painter: (context: CanvasRenderingContext2D, size: number) => void,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo crear la textura procedural.");
  context.imageSmoothingEnabled = false;
  painter(context, size);
  const texture = track(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function woodTexture(): THREE.CanvasTexture {
  return createPixelTexture((context, size) => {
    context.fillStyle = "#6f4934";
    context.fillRect(0, 0, size, size);
    const rows = [0, 13, 27, 41, 55];
    for (const row of rows) {
      context.fillStyle = "#39291f";
      context.fillRect(0, row, size, 2);
      context.fillStyle = "#9b6946";
      context.fillRect(0, row + 2, size, 1);
    }
    context.fillStyle = "#573a2c";
    for (let index = 0; index < 18; index += 1) {
      const x = (index * 19 + 7) % size;
      const y = (index * 31 + 9) % size;
      context.fillRect(x, y, 6 + (index % 5), 1);
    }
    context.fillStyle = "#bd8251";
    context.fillRect(4, 7, 16, 1);
    context.fillRect(39, 35, 18, 1);
  }, 5, 4);
}

function rugTexture(): THREE.CanvasTexture {
  return createPixelTexture((context, size) => {
    context.fillStyle = "#493233";
    context.fillRect(0, 0, size, size);
    context.fillStyle = "#8a4f3d";
    context.fillRect(3, 3, size - 6, size - 6);
    context.fillStyle = "#c99a65";
    context.fillRect(6, 6, size - 12, 2);
    context.fillRect(6, size - 8, size - 12, 2);
    context.fillRect(6, 6, 2, size - 12);
    context.fillRect(size - 8, 6, 2, size - 12);
    context.fillStyle = "#315d47";
    for (let index = 0; index < 4; index += 1) {
      const inset = 14 + index * 5;
      context.fillRect(inset, 21 + index * 3, size - inset * 2, 2);
    }
    context.fillStyle = "#f0c67e";
    context.fillRect(29, 29, 6, 6);
  }, 1.8, 1.4);
}

function toonMaterial(
  gradient: THREE.Texture,
  color: number,
  options: { readonly map?: THREE.Texture; readonly emissive?: number; readonly emissiveIntensity?: number } = {},
): THREE.MeshToonMaterial {
  const parameters: THREE.MeshToonMaterialParameters = {
    color,
    gradientMap: gradient,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
  };
  if (options.map) parameters.map = options.map;
  const material = track(new THREE.MeshToonMaterial(parameters));
  material.side = THREE.FrontSide;
  return material;
}

function basicMaterial(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return track(new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }));
}

function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  position: readonly [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(track(new THREE.BoxGeometry(width, height, depth)), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(
  radius: number,
  height: number,
  material: THREE.Material,
  position: readonly [number, number, number],
  segments = 12,
): THREE.Mesh {
  const mesh = new THREE.Mesh(track(new THREE.CylinderGeometry(radius, radius, height, segments)), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function plane(
  width: number,
  height: number,
  material: THREE.Material,
  position: readonly [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(width, height)), material);
  mesh.position.set(...position);
  mesh.receiveShadow = true;
  return mesh;
}

function markInteractive(root: THREE.Object3D, interaction: "sofa-seat"): void {
  root.traverse((object) => {
    object.userData["interaction"] = interaction;
  });
}

function createFloor(gradient: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = "floor-shell";
  const floorMap = woodTexture();
  const floorMaterial = toonMaterial(gradient, 0xffffff, { map: floorMap });
  group.add(box(8, 0.18, 7, floorMaterial, [0, -0.10, 0]));

  const foundation = toonMaterial(gradient, 0x3c312b);
  group.add(box(8.2, 0.24, 7.2, foundation, [0, -0.29, 0]));

  const edge = toonMaterial(gradient, 0x1f292a);
  group.add(box(8.35, 0.08, 0.14, edge, [0, -0.14, 3.57]));
  group.add(box(0.14, 0.08, 7.2, edge, [4.08, -0.14, 0]));
  return group;
}

function createWalls(gradient: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = "room-walls";
  const cream = toonMaterial(gradient, PALETTE.cream);
  const wood = toonMaterial(gradient, PALETTE.wood);
  const woodDark = toonMaterial(gradient, PALETTE.woodDark);

  group.add(box(8, 0.90, 0.18, wood, [0, 0.45, -3.47]));
  group.add(box(2.50, 2.25, 0.18, cream, [-2.75, 1.92, -3.47]));
  group.add(box(2.10, 2.25, 0.18, cream, [2.95, 1.92, -3.47]));
  group.add(box(3.40, 0.42, 0.18, cream, [0.60, 2.84, -3.47]));
  group.add(box(8.10, 0.12, 0.25, woodDark, [0, 0.93, -3.40]));
  group.add(box(8.10, 0.12, 0.25, woodDark, [0, 3.08, -3.40]));

  group.add(box(0.18, 0.90, 7, wood, [-3.97, 0.45, 0]));
  group.add(box(0.18, 2.25, 7, cream, [-3.97, 1.92, 0]));
  group.add(box(0.25, 0.12, 7.10, woodDark, [-3.90, 0.93, 0]));
  group.add(box(0.25, 0.12, 7.10, woodDark, [-3.90, 3.08, 0]));

  for (let x = -3.5; x <= 3.5; x += 0.7) {
    group.add(box(0.045, 0.70, 0.04, woodDark, [x, 0.47, -3.35]));
  }
  for (let z = -3.0; z <= 3.0; z += 0.7) {
    group.add(box(0.04, 0.70, 0.045, woodDark, [-3.84, 0.47, z]));
  }

  return group;
}

function createWindow(gradient: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = "twilight-window";
  const frame = toonMaterial(gradient, 0x382a24);
  const glass = toonMaterial(gradient, 0x406c7c, { emissive: 0x243d4d, emissiveIntensity: 0.7 });
  const city = toonMaterial(gradient, 0x263944, { emissive: 0x192c36, emissiveIntensity: 0.45 });
  const windowWidth = 3.3;
  const windowHeight = 1.82;
  const centerX = 0.55;
  const centerY = 1.83;

  const glassPane = plane(windowWidth, windowHeight, glass, [centerX, centerY, -3.365]);
  group.add(glassPane);
  group.add(box(windowWidth + 0.18, 0.13, 0.14, frame, [centerX, centerY - windowHeight / 2, -3.28]));
  group.add(box(windowWidth + 0.18, 0.13, 0.14, frame, [centerX, centerY + windowHeight / 2, -3.28]));
  group.add(box(0.13, windowHeight + 0.18, 0.14, frame, [centerX - windowWidth / 2, centerY, -3.28]));
  group.add(box(0.13, windowHeight + 0.18, 0.14, frame, [centerX + windowWidth / 2, centerY, -3.28]));
  group.add(box(0.10, windowHeight, 0.12, frame, [centerX, centerY, -3.27]));
  group.add(box(windowWidth, 0.10, 0.12, frame, [centerX, centerY, -3.27]));

  for (let index = 0; index < 8; index += 1) {
    const width = 0.23 + (index % 3) * 0.08;
    const height = 0.34 + (index % 4) * 0.18;
    const building = box(width, height, 0.10, city, [
      centerX - 1.35 + index * 0.38,
      1.02 + height / 2,
      -3.43,
    ]);
    group.add(building);
    if (index % 2 === 0) {
      const light = basicMaterial(PALETTE.amber);
      group.add(box(0.055, 0.055, 0.015, light, [building.position.x, building.position.y, -3.355]));
    }
  }
  return group;
}

function createAuthoredPixelAsset(
  asset: SpatialAssetDefinition,
  camera: THREE.OrthographicCamera,
): THREE.Group {
  const group = new THREE.Group();
  group.name = asset.id;
  group.position.set(asset.position.x, 0, asset.position.z);
  group.userData["spatialAsset"] = asset.id;

  const texture = track(new THREE.TextureLoader().load(asset.skin.src));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.generateMipmaps = true;
  const material = track(new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.06,
    depthTest: true,
    depthWrite: true,
    toneMapped: false,
    side: THREE.DoubleSide,
  }));
  const geometry = track(new THREE.PlaneGeometry(asset.skin.width, asset.skin.height));
  geometry.translate(
    (0.5 - asset.skin.groundAnchorX) * asset.skin.width,
    asset.skin.height * 0.5,
    0,
  );
  const visual = new THREE.Mesh(geometry, material);
  visual.name = `${asset.id}-authored-pixel-skin`;
  visual.position.y = asset.skin.baseY;
  visual.quaternion.copy(camera.quaternion);
  visual.castShadow = true;
  group.add(visual);
  return group;
}

function createSofa(camera: THREE.OrthographicCamera): THREE.Group {
  const group = createAuthoredPixelAsset(SOFA_ASSET, camera);
  markInteractive(group, "sofa-seat");
  return group;
}

function createTable(camera: THREE.OrthographicCamera): THREE.Group {
  return createAuthoredPixelAsset(TABLE_ASSET, camera);
}

function createChair(gradient: THREE.Texture, x: number, z: number, rotation: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "chair";
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  const wood = toonMaterial(gradient, PALETTE.woodLight);
  const dark = toonMaterial(gradient, PALETTE.woodDark);
  const fabric = toonMaterial(gradient, PALETTE.greenLight);

  group.add(box(0.60, 0.13, 0.58, fabric, [0, 0.53, 0]));
  group.add(box(0.68, 0.10, 0.66, dark, [0, 0.44, 0]));
  for (const xOffset of [-0.25, 0.25]) {
    for (const zOffset of [-0.24, 0.24]) group.add(box(0.08, 0.50, 0.08, wood, [xOffset, 0.22, zOffset]));
  }
  group.add(box(0.09, 1.16, 0.09, wood, [-0.27, 0.88, -0.27]));
  group.add(box(0.09, 1.16, 0.09, wood, [0.27, 0.88, -0.27]));
  group.add(box(0.56, 0.11, 0.09, wood, [0, 1.24, -0.27]));
  group.add(box(0.50, 0.32, 0.07, fabric, [0, 0.99, -0.25]));
  return group;
}

function createRugs(gradient: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  const rug = toonMaterial(gradient, 0xffffff, { map: rugTexture() });
  const tableRug = plane(2.75, 2.55, rug, [-0.54, 0.018, 1.08]);
  tableRug.rotation.x = -Math.PI / 2;
  tableRug.rotation.z = Math.PI / 2;
  group.add(tableRug);
  const sofaRug = plane(3.05, 1.80, rug, [1.72, 0.016, -0.58]);
  sofaRug.rotation.x = -Math.PI / 2;
  sofaRug.rotation.z = Math.PI / 2;
  group.add(sofaRug);
  return group;
}

function createPlant(gradient: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.position.set(3.20, 0, -2.55);
  const pot = toonMaterial(gradient, PALETTE.coral);
  const leaves = toonMaterial(gradient, 0x3f7650);
  group.add(cylinder(0.24, 0.43, pot, [0, 0.22, 0], 10));
  for (let index = 0; index < 7; index += 1) {
    const leaf = new THREE.Mesh(track(new THREE.SphereGeometry(0.18, 6, 4)), leaves);
    const angle = (index / 7) * Math.PI * 2;
    leaf.scale.set(0.55, 1.45, 0.44);
    leaf.position.set(Math.cos(angle) * 0.19, 0.54 + (index % 2) * 0.13, Math.sin(angle) * 0.19);
    leaf.rotation.z = Math.cos(angle) * 0.45;
    leaf.castShadow = true;
    group.add(leaf);
  }
  return group;
}

interface CharacterParts {
  readonly torso: THREE.Mesh;
  readonly head: THREE.Mesh;
  readonly hair: THREE.Group;
  readonly leftArm: THREE.Mesh;
  readonly rightArm: THREE.Mesh;
  readonly leftLeg: THREE.Mesh;
  readonly rightLeg: THREE.Mesh;
  readonly leftFoot: THREE.Mesh;
  readonly rightFoot: THREE.Mesh;
  readonly shadow: THREE.Mesh;
}

function createCharacter(gradient: THREE.Texture): { readonly root: THREE.Group; readonly parts: CharacterParts } {
  const root = new THREE.Group();
  root.name = "iara-3d";
  const skin = toonMaterial(gradient, 0xb87554);
  const jacket = toonMaterial(gradient, PALETTE.coral);
  const shirt = toonMaterial(gradient, 0xe2c898);
  const denim = toonMaterial(gradient, 0x34536b);
  const hairMaterial = toonMaterial(gradient, 0x2e201c);
  const shoe = toonMaterial(gradient, 0xe3c7a2);

  const shadowMaterial = basicMaterial(0x152126, 0.28);
  shadowMaterial.depthWrite = false;
  const shadow = plane(0.72, 0.42, shadowMaterial, [0, 0.014, 0]);
  shadow.rotation.x = -Math.PI / 2;
  root.add(shadow);

  const torso = box(0.55, 0.68, 0.30, jacket, [0, 1.10, 0]);
  const shirtPanel = box(0.21, 0.48, 0.025, shirt, [0, 1.12, 0.165]);
  const head = box(0.45, 0.46, 0.40, skin, [0, 1.73, 0]);
  const leftArm = box(0.15, 0.61, 0.19, jacket, [-0.36, 1.09, 0]);
  const rightArm = box(0.15, 0.61, 0.19, jacket, [0.36, 1.09, 0]);
  const leftLeg = box(0.19, 0.62, 0.23, denim, [-0.15, 0.47, 0]);
  const rightLeg = box(0.19, 0.62, 0.23, denim, [0.15, 0.47, 0]);
  const leftFoot = box(0.22, 0.13, 0.38, shoe, [-0.15, 0.10, 0.09]);
  const rightFoot = box(0.22, 0.13, 0.38, shoe, [0.15, 0.10, 0.09]);
  root.add(torso, shirtPanel, head, leftArm, rightArm, leftLeg, rightLeg, leftFoot, rightFoot);

  const hair = new THREE.Group();
  hair.add(box(0.49, 0.16, 0.44, hairMaterial, [0, 1.98, -0.01]));
  hair.add(box(0.11, 0.38, 0.43, hairMaterial, [-0.24, 1.79, -0.01]));
  hair.add(box(0.11, 0.38, 0.43, hairMaterial, [0.24, 1.79, -0.01]));
  const bun = new THREE.Mesh(track(new THREE.SphereGeometry(0.18, 7, 5)), hairMaterial);
  bun.position.set(0, 2.10, -0.10);
  bun.castShadow = true;
  hair.add(bun);
  root.add(hair);

  const face = basicMaterial(0x2b2421);
  root.add(box(0.045, 0.045, 0.02, face, [-0.10, 1.77, 0.21]));
  root.add(box(0.045, 0.045, 0.02, face, [0.10, 1.77, 0.21]));

  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = object !== shadow;
      object.receiveShadow = true;
    }
  });
  return { root, parts: { torso, head, hair, leftArm, rightArm, leftLeg, rightLeg, leftFoot, rightFoot, shadow } };
}

interface ReliefFrame {
  readonly texture: THREE.CanvasTexture;
  readonly geometry: THREE.PlaneGeometry;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
}

interface DepthReliefActor {
  readonly root: THREE.Group;
  readonly proxy: THREE.Group;
  readonly proxyParts: CharacterParts;
  readonly collisionVolume: THREE.Mesh;
  setPose(pose: CharacterPose): void;
  setFacing(angle: number): void;
  animate(pose: CharacterPose, elapsed: number, speed: number): void;
  setTechnical(visible: boolean): void;
  getDiagnostics(): Pick<LabSceneDiagnostics, "reliefReady" | "sourceFrameWidth" | "sourceFrameHeight" | "reliefVertices" | "reliefDepth">;
}

function createReliefFrame(
  image: HTMLImageElement,
  column: number,
  row: number,
  worldHeight: number,
): ReliefFrame {
  const sourceWidth = Math.floor(image.naturalWidth / ATLAS_COLUMNS);
  const sourceHeight = Math.floor(image.naturalHeight / ATLAS_ROWS);
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No se pudo preparar la piel 2D con relieve.");
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, sourceWidth, sourceHeight);
  context.drawImage(
    image,
    column * sourceWidth,
    row * sourceHeight,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );

  const pixels = context.getImageData(0, 0, sourceWidth, sourceHeight);
  const alpha = alphaChannelFromRgba(pixels.data);
  const relief = buildAlphaRelief(alpha, sourceWidth, sourceHeight, { maximumInset: 11 });

  // One vertex per authored source pixel. The original RGBA artwork remains
  // untouched; only the hidden Z coordinate changes.
  const geometry = track(new THREE.PlaneGeometry(
    ACTOR_WORLD_WIDTH,
    worldHeight,
    sourceWidth - 1,
    sourceHeight - 1,
  ));
  geometry.translate(0, worldHeight * 0.5, 0);
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index += 1) {
    const sourceX = Math.min(sourceWidth - 1, Math.max(0, Math.round(uvs.getX(index) * (sourceWidth - 1))));
    const sourceY = Math.min(sourceHeight - 1, Math.max(0, Math.round((1 - uvs.getY(index)) * (sourceHeight - 1))));
    const sourceIndex = sourceY * sourceWidth + sourceX;
    const depth = relief[sourceIndex] ?? 0;
    const visible = (alpha[sourceIndex] ?? 0) >= 36;
    positions.setZ(index, visible ? (depth - 0.5) * ACTOR_RELIEF_DEPTH : 0);
  }
  positions.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const texture = track(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, geometry, sourceWidth, sourceHeight };
}

function createDepthReliefActor(gradient: THREE.Texture, camera: THREE.OrthographicCamera): DepthReliefActor {
  const root = new THREE.Group();
  root.name = "actor-spatial-root";
  const { root: proxy, parts: proxyParts } = createCharacter(gradient);
  root.add(proxy);

  const atlas = new Image();
  const frames: Partial<Record<CharacterPose, ReliefFrame>> = {};
  let reliefSurface: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  let activePose: CharacterPose = "idle";
  let facingSign = 1;

  const shadowMaterial = basicMaterial(0x132328, 0.30);
  shadowMaterial.depthWrite = false;
  const spriteShadow = plane(0.72, 0.44, shadowMaterial, [0, 0.015, 0]);
  spriteShadow.rotation.x = -Math.PI / 2;
  spriteShadow.visible = false;
  root.add(spriteShadow);

  const colliderGeometry = track(new THREE.CylinderGeometry(ACTOR_RADIUS, ACTOR_RADIUS, 1.72, 12, 1, true));
  const colliderMaterial = track(new THREE.MeshBasicMaterial({
    color: 0x8df5c5,
    wireframe: true,
    transparent: true,
    opacity: 0.72,
    depthTest: false,
  }));
  const collisionVolume = new THREE.Mesh(colliderGeometry, colliderMaterial);
  collisionVolume.position.y = 0.86;
  collisionVolume.visible = false;
  collisionVolume.renderOrder = 40;
  root.add(collisionVolume);

  function applySurfaceFrame(): void {
    const frame = frames[activePose];
    if (!frame || !reliefSurface) return;
    reliefSurface.geometry = frame.geometry;
    reliefSurface.material.map = frame.texture;
    reliefSurface.material.needsUpdate = true;
    reliefSurface.position.y = activePose === "seated" ? ACTOR_SEATED_BASE : 0.02;
    reliefSurface.scale.x = facingSign;
  }

  atlas.addEventListener("load", () => {
    frames.idle = createReliefFrame(atlas, 2, 0, ACTOR_STANDING_HEIGHT);
    frames.walk = createReliefFrame(atlas, 2, 1, ACTOR_STANDING_HEIGHT);
    frames.seated = createReliefFrame(atlas, 2, 3, ACTOR_SEATED_HEIGHT);
    const material = track(new THREE.MeshBasicMaterial({
      map: frames.idle.texture,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.16,
      depthTest: true,
      depthWrite: true,
      toneMapped: false,
      side: THREE.DoubleSide,
    }));
    reliefSurface = new THREE.Mesh(frames.idle.geometry, material);
    reliefSurface.name = "iara-pixel-depth-relief";
    reliefSurface.quaternion.copy(camera.quaternion);
    reliefSurface.castShadow = true;
    root.add(reliefSurface);
    applySurfaceFrame();
    proxy.visible = false;
    spriteShadow.visible = true;
  }, { once: true });
  atlas.src = "/assets/generated/npc-v1/cafe-npcs-atlas-v1.png";

  return {
    root,
    proxy,
    proxyParts,
    collisionVolume,
    setPose: (pose) => {
      activePose = pose;
      applySurfaceFrame();
      applyCharacterPose(proxyParts, pose, 0, 0);
    },
    setFacing: (angle) => {
      proxy.rotation.y = angle;
      facingSign = Math.sin(angle - Math.PI / 4) > 0 ? -1 : 1;
      if (reliefSurface) reliefSurface.scale.x = facingSign;
    },
    animate: (pose, elapsed, speed) => {
      applyCharacterPose(proxyParts, pose, elapsed, speed);
      if (reliefSurface && pose !== "seated") {
        reliefSurface.position.y = 0.02 + (pose === "walk" ? Math.abs(Math.sin(elapsed * 10.5)) * 0.028 : 0);
      }
    },
    setTechnical: (visible) => { collisionVolume.visible = visible; },
    getDiagnostics: () => {
      const frame = frames.idle;
      return {
        reliefReady: reliefSurface !== null,
        sourceFrameWidth: frame?.sourceWidth ?? 0,
        sourceFrameHeight: frame?.sourceHeight ?? 0,
        reliefVertices: frame?.geometry.getAttribute("position").count ?? 0,
        reliefDepth: ACTOR_RELIEF_DEPTH,
      };
    },
  };
}

function applyCharacterPose(parts: CharacterParts, pose: CharacterPose, elapsed: number, speed: number): void {
  const walking = pose === "walk" && speed > 0.02;
  const stride = walking ? Math.sin(elapsed * 10.5) * Math.min(0.62, speed * 0.24) : 0;

  if (pose === "seated") {
    parts.torso.position.set(0, 1.15, -0.02);
    parts.head.position.set(0, 1.76, -0.02);
    parts.hair.position.set(0, 0.03, -0.02);
    parts.leftArm.position.set(-0.36, 1.13, 0.10);
    parts.rightArm.position.set(0.36, 1.13, 0.10);
    parts.leftArm.rotation.x = -0.42;
    parts.rightArm.rotation.x = -0.42;
    parts.leftLeg.position.set(-0.15, 0.62, 0.28);
    parts.rightLeg.position.set(0.15, 0.62, 0.28);
    parts.leftLeg.rotation.x = Math.PI / 2;
    parts.rightLeg.rotation.x = Math.PI / 2;
    parts.leftFoot.position.set(-0.15, 0.24, 0.62);
    parts.rightFoot.position.set(0.15, 0.24, 0.62);
    parts.shadow.scale.set(0.82, 0.82, 0.82);
    return;
  }

  parts.torso.position.set(0, 1.10 + Math.abs(stride) * 0.025, 0);
  parts.head.position.set(0, 1.73 + Math.abs(stride) * 0.02, 0);
  parts.hair.position.set(0, 0, 0);
  parts.leftArm.position.set(-0.36, 1.09, 0);
  parts.rightArm.position.set(0.36, 1.09, 0);
  parts.leftArm.rotation.x = stride;
  parts.rightArm.rotation.x = -stride;
  parts.leftLeg.position.set(-0.15, 0.47, 0);
  parts.rightLeg.position.set(0.15, 0.47, 0);
  parts.leftLeg.rotation.x = -stride;
  parts.rightLeg.rotation.x = stride;
  parts.leftFoot.position.set(-0.15, 0.10, 0.09 + stride * 0.11);
  parts.rightFoot.position.set(0.15, 0.10, 0.09 - stride * 0.11);
  parts.shadow.scale.set(1, 1, 1);
}

function createTechnicalOverlay(colliders: readonly RectCollider[]): THREE.Group {
  const group = new THREE.Group();
  group.name = "physical-colliders";
  for (const collider of colliders) {
    const width = collider.maxX - collider.minX;
    const depth = collider.maxZ - collider.minZ;
    const geometry = track(new THREE.BoxGeometry(width, 0.10, depth));
    const fill = track(new THREE.MeshBasicMaterial({ color: 0xff775c, transparent: true, opacity: 0.20, depthWrite: false }));
    const mesh = new THREE.Mesh(geometry, fill);
    mesh.position.set((collider.minX + collider.maxX) / 2, 0.07, (collider.minZ + collider.maxZ) / 2);
    mesh.renderOrder = 20;
    group.add(mesh);
    const edges = new THREE.LineSegments(track(new THREE.EdgesGeometry(geometry)), basicMaterial(0xffd17a));
    edges.position.copy(mesh.position);
    edges.renderOrder = 21;
    group.add(edges);
  }
  group.visible = false;
  return group;
}

export function createLabScene(canvas: HTMLCanvasElement): LabSceneController {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.night);
  scene.fog = new THREE.Fog(PALETTE.night, 11, 22);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(1);

  const camera = new THREE.OrthographicCamera(-5, 5, 3.125, -3.125, 0.1, 50);
  camera.position.set(8.4, 8.2, 8.4);
  camera.lookAt(0, 0.55, 0);
  camera.updateMatrixWorld();

  const gradient = createGradientMap();
  scene.add(createFloor(gradient));
  scene.add(createRugs(gradient));
  scene.add(createWalls(gradient));
  scene.add(createWindow(gradient));
  scene.add(createAuthoredPixelAsset(BOOKSHELF_ASSET, camera));
  const sofa = createSofa(camera);
  const table = createTable(camera);
  const chairWest = createChair(gradient, -1.64, 0.74, -Math.PI / 2);
  const chairSouth = createChair(gradient, -0.52, 2.00, Math.PI);
  scene.add(sofa, table, chairWest, chairSouth, createPlant(gradient));

  const ambient = new THREE.HemisphereLight(0x7e9aaa, 0x2b201c, 1.35);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffd7a0, 3.25);
  key.position.set(4.8, 8.5, 5.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0007;
  scene.add(key);
  const windowFill = new THREE.DirectionalLight(0x6caac2, 1.0);
  windowFill.position.set(0, 3, -6);
  scene.add(windowFill);
  const lamp = new THREE.PointLight(PALETTE.amber, 4.2, 4.8, 1.8);
  lamp.position.set(1.15, 2.20, -2.48);
  scene.add(lamp);
  const lampMaterial = toonMaterial(gradient, 0xb77942, {
    emissive: 0xffa63d,
    emissiveIntensity: 0.62,
  });
  const lampShade = new THREE.Mesh(track(new THREE.CylinderGeometry(0.23, 0.11, 0.22, 8)), lampMaterial);
  lampShade.position.set(1.15, 2.35, -2.48);
  lampShade.castShadow = true;
  const bulb = new THREE.Mesh(track(new THREE.SphereGeometry(0.08, 6, 4)), basicMaterial(PALETTE.amber));
  bulb.position.set(1.15, 2.19, -2.48);
  const cord = box(0.025, 0.55, 0.025, toonMaterial(gradient, PALETTE.woodDark), [1.15, 2.73, -2.48]);
  scene.add(lampShade, bulb, cord);

  const depthActor = createDepthReliefActor(gradient, camera);
  const actorRoot = depthActor.root;
  scene.add(actorRoot);

  const technical = createTechnicalOverlay(LAB_COLLIDERS);
  scene.add(technical);

  const pathMaterial = track(new THREE.LineBasicMaterial({ color: 0x8df5c5, transparent: true, opacity: 0.92 }));
  let pathGeometry = track(new THREE.BufferGeometry());
  const pathLine = new THREE.Line(pathGeometry, pathMaterial);
  pathLine.visible = false;
  pathLine.renderOrder = 30;
  scene.add(pathLine);

  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pose: CharacterPose = "idle";
  let technicalVisible = false;

  const interactiveObjects: THREE.Object3D[] = [];
  sofa.traverse((object) => {
    if (object instanceof THREE.Mesh) interactiveObjects.push(object);
  });

  function resize(width: number, height: number): void {
    const safeWidth = Math.max(320, width);
    const safeHeight = Math.max(220, height);
    const aspect = safeWidth / safeHeight;
    const viewHeight = 7.35;
    camera.left = -(viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();

    // At desktop scale the 128x160 authored actor now lands close to one
    // source pixel per rendered pixel instead of being halved and enlarged.
    const internalHeight = Math.max(320, Math.min(720, Math.round(safeHeight * 0.92)));
    const internalWidth = Math.max(180, Math.round(internalHeight * aspect));
    renderer.setSize(internalWidth, internalHeight, false);
  }

  function updatePath(points: readonly Vec2[]): void {
    pathGeometry.dispose();
    pathGeometry = track(new THREE.BufferGeometry());
    const vectors = points.map((point) => new THREE.Vector3(point.x, 0.055, point.z));
    if (vectors.length >= 2) pathGeometry.setFromPoints(vectors);
    pathLine.geometry = pathGeometry;
    pathLine.visible = technicalVisible && vectors.length >= 2;
  }

  function pick(clientX: number, clientY: number, rect: DOMRect): PickResult {
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const interactions = raycaster.intersectObjects(interactiveObjects, false);
    const firstInteraction = interactions[0];
    if (firstInteraction?.object.userData["interaction"] === "sofa-seat") {
      return { interaction: "sofa-seat" };
    }
    const point = new THREE.Vector3();
    const intersection = raycaster.ray.intersectPlane(floorPlane, point);
    if (!intersection) return {};
    return { point: { x: point.x, z: point.z } };
  }

  return {
    scene,
    camera,
    renderer,
    actorRoot,
    resize,
    render: () => renderer.render(scene, camera),
    setActorPosition: (position) => actorRoot.position.set(position.x, 0, position.z),
    setActorFacing: (angle) => { depthActor.setFacing(angle); },
    setActorPose: (nextPose) => {
      pose = nextPose;
      depthActor.setPose(pose);
    },
    animateActor: (elapsed, speed) => depthActor.animate(pose, elapsed, speed),
    setTechnicalVisible: (visible) => {
      technicalVisible = visible;
      technical.visible = visible;
      depthActor.setTechnical(visible);
      pathLine.visible = visible && pathLine.geometry.getAttribute("position") !== undefined;
    },
    updatePath,
    pick,
    getScreenAxes: () => {
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      const up = { x: cameraDirection.x, z: cameraDirection.z };
      const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const right = { x: rightVector.x, z: rightVector.z };
      const upLength = Math.hypot(up.x, up.z) || 1;
      const rightLength = Math.hypot(right.x, right.z) || 1;
      return {
        up: { x: up.x / upLength, z: up.z / upLength },
        right: { x: right.x / rightLength, z: right.z / rightLength },
      };
    },
    getDiagnostics: () => ({
      ...depthActor.getDiagnostics(),
      internalWidth: renderer.domElement.width,
      internalHeight: renderer.domElement.height,
    }),
    dispose: () => {
      renderer.dispose();
      for (const disposable of disposables.splice(0)) disposable.dispose();
    },
  };
}
