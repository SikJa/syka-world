import "./style.css";
import {
  ACTOR_RADIUS,
  SOURCE_ROOM,
  WORLD_BOUNDS,
  canvasToWorld,
  depthOf,
  distance,
  findSmoothPath,
  isWalkable,
  moveWithSliding,
  worldToCanvas,
  type MutableVec2,
  type Vec2,
  type ViewTransform,
  type WorldRect,
} from "./engine";

interface CropRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface FurnitureEntity {
  readonly id: "counter" | "table" | "sofa";
  readonly label: string;
  readonly texture: keyof LabAssets;
  readonly crop: CropRect;
  readonly collider: WorldRect;
  readonly visualAnchor: Vec2;
  readonly renderWidth: number;
  readonly depth: number;
}

interface InteractionAnchor {
  readonly id: string;
  readonly label: string;
  readonly point: Vec2;
  readonly response: string;
}

interface LabAssets {
  readonly room: HTMLImageElement;
  readonly counter: HTMLImageElement;
  readonly table: HTMLImageElement;
  readonly sofa: HTMLImageElement;
  readonly elen: HTMLImageElement;
  readonly npcs: HTMLImageElement;
}

interface ActorState {
  readonly id: string;
  readonly label: string;
  readonly kind: "profile" | "npc";
  position: MutableVec2;
  moving: boolean;
  facing: -1 | 1;
}

interface LabSnapshot {
  readonly ready: boolean;
  readonly possessed: boolean;
  readonly actor: {
    readonly x: number;
    readonly y: number;
    readonly depth: number;
    readonly moving: boolean;
    readonly insideCollider: boolean;
  };
  readonly pathLength: number;
  readonly collisionAvoidances: number;
  readonly debugVisible: boolean;
  readonly checks: {
    readonly motion: boolean;
    readonly collision: boolean;
    readonly depth: boolean;
    readonly style: boolean;
  };
}

declare global {
  interface Window {
    __SYKA_SPATIAL_LAB__?: {
      readonly snapshot: () => LabSnapshot;
      readonly moveTo: (x: number, y: number) => boolean;
      readonly reset: () => void;
      readonly setDebug: (visible: boolean) => void;
    };
  }
}

const canvas = requiredElement<HTMLCanvasElement>("#spatial-canvas");
const context = requireCanvasContext(canvas);

const view: ViewTransform = createView();
const furniture: readonly FurnitureEntity[] = [
  {
    id: "counter",
    label: "Barra de café",
    texture: "counter",
    crop: { x: 244, y: 153, width: 1001, height: 763 },
    collider: { id: "counter", label: "Barra de café", minX: 0.8, maxX: 2.9, minY: 4.25, maxY: 5.5 },
    visualAnchor: { x: 1.85, y: 5.55 },
    renderWidth: 420,
    depth: 8.25,
  },
  {
    id: "sofa",
    label: "Sofá verde",
    texture: "sofa",
    crop: { x: 369, y: 208, width: 736, height: 662 },
    collider: { id: "sofa", label: "Sofá verde", minX: 4.85, maxX: 6.7, minY: 1.15, maxY: 2.65 },
    visualAnchor: { x: 5.78, y: 2.72 },
    renderWidth: 300,
    depth: 9.35,
  },
  {
    id: "table",
    label: "Mesa y sillas",
    texture: "table",
    crop: { x: 246, y: 216, width: 947, height: 604 },
    collider: { id: "table", label: "Mesa y sillas", minX: 3.55, maxX: 5.25, minY: 3.55, maxY: 5.15 },
    visualAnchor: { x: 4.4, y: 5.2 },
    renderWidth: 285,
    depth: 10.35,
  },
];

const colliders = furniture.map((entity) => entity.collider);
const anchors: readonly InteractionAnchor[] = [
  { id: "order", label: "Pedir café", point: { x: 2.9, y: 5.82 }, response: "Elen pidió un café. La barra respondió como entidad." },
  { id: "table-seat", label: "Usar la mesa", point: { x: 5.42, y: 5.25 }, response: "La silla está ocupable: el ancla pertenece a la mesa, no al fondo." },
  { id: "sofa-seat", label: "Sentarse", point: { x: 5.8, y: 2.96 }, response: "El sofá encontró su punto de interacción sin atravesar el respaldo." },
];

const startPosition = Object.freeze({ x: 3.15, y: 6.55 });
const elen: ActorState = {
  id: "elen",
  label: "Elen",
  kind: "profile",
  position: { ...startPosition },
  moving: false,
  facing: 1,
};
const bartender: ActorState = {
  id: "alma",
  label: "Alma · anfitriona",
  kind: "npc",
  position: { x: 1.45, y: 6.95 },
  moving: false,
  facing: 1,
};

const state = {
  ready: false,
  possessed: true,
  debug: false,
  elapsed: 0,
  path: [] as Vec2[],
  keys: new Set<string>(),
  collisionAvoidances: 0,
  movingDistance: 0,
  sawBehind: false,
  sawFront: false,
  styleValidated: false,
  collisionValidated: false,
  demoIndex: 0,
};

let assets: LabAssets | undefined;
let animationFrame = 0;
let lastTimestamp = 0;
let toastTimer = 0;

const possessButton = requiredElement<HTMLButtonElement>("#possess-button");
const routeButton = requiredElement<HTMLButtonElement>("#route-button");
const debugButton = requiredElement<HTMLButtonElement>("#debug-button");
const resetButton = requiredElement<HTMLButtonElement>("#reset-button");
const toast = requiredElement<HTMLElement>("#toast");

bindControls();
populateEntityList();
installQaApi();

void loadAssets()
  .then((loaded) => {
    assets = loaded;
    state.ready = true;
    state.styleValidated = true;
    state.collisionValidated = colliders.every((collider) => {
      const center = { x: (collider.minX + collider.maxX) / 2, y: (collider.minY + collider.maxY) / 2 };
      return !isWalkable(center, colliders);
    });
    document.body.classList.add("is-ready");
    requiredElement("#runtime-status").textContent = "4 texturas · 3 sólidos · coordenadas continuas";
    canvas.focus({ preventScroll: true });
    showToast("Listo. Mové a Elen con WASD o hacé clic sobre el piso.");
    lastTimestamp = performance.now();
    animationFrame = requestAnimationFrame(frame);
  })
  .catch((error: unknown) => {
    requiredElement("#runtime-status").textContent = "No se pudieron cargar los assets";
    showToast(error instanceof Error ? error.message : "Falló la carga del laboratorio.");
    console.error(error);
  });

function bindControls(): void {
  possessButton.addEventListener("click", () => {
    state.possessed = !state.possessed;
    state.keys.clear();
    state.path = [];
    possessButton.textContent = state.possessed ? "Soltar a Elen" : "Poseer a Elen";
    possessButton.classList.toggle("action-button--primary", state.possessed);
    showToast(state.possessed ? "Elen está poseída: WASD y clic están activos." : "Control liberado. El laboratorio sigue renderizando.");
    if (state.possessed) canvas.focus({ preventScroll: true });
  });

  routeButton.addEventListener("click", () => {
    if (!state.possessed) {
      showToast("Primero poseé a Elen para ejecutar la ruta.");
      return;
    }
    const destinations: readonly Vec2[] = [
      { x: 6.0, y: 4.6 },
      { x: 3.05, y: 2.55 },
      { x: 3.15, y: 6.55 },
    ];
    const target = destinations[state.demoIndex % destinations.length];
    state.demoIndex += 1;
    if (target) setDestination(target, true);
    canvas.focus({ preventScroll: true });
  });

  debugButton.addEventListener("click", () => setDebug(!state.debug));
  resetButton.addEventListener("click", reset);

  canvas.addEventListener("pointerdown", (event) => {
    canvas.focus({ preventScroll: true });
    if (!state.possessed) {
      showToast("Poseé a Elen para darle un destino.");
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
    setDestination(canvasToWorld(point, view), false);
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "e"].includes(key)) event.preventDefault();
    if (key === "e" && !event.repeat) interact();
    if (["w", "a", "s", "d"].includes(key)) state.keys.add(key);
  });
  window.addEventListener("keyup", (event) => state.keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => state.keys.clear());
  window.addEventListener("pagehide", () => cancelAnimationFrame(animationFrame), { once: true });
}

function frame(timestamp: number): void {
  const deltaSeconds = Math.min(0.04, Math.max(0, (timestamp - lastTimestamp) / 1000));
  lastTimestamp = timestamp;
  state.elapsed += deltaSeconds;
  update(deltaSeconds);
  render();
  updateTelemetry();
  animationFrame = requestAnimationFrame(frame);
}

function update(deltaSeconds: number): void {
  const previous = { ...elen.position };
  const manual = manualDirection();
  elen.moving = false;
  if (state.possessed && (manual.x !== 0 || manual.y !== 0)) {
    state.path = [];
    const magnitude = Math.hypot(manual.x, manual.y);
    const speed = 2.55;
    const movement = {
      x: (manual.x / magnitude) * speed * deltaSeconds,
      y: (manual.y / magnitude) * speed * deltaSeconds,
    };
    applyMovement(movement);
  } else if (state.possessed && state.path.length > 0) {
    const waypoint = state.path[0];
    if (waypoint) {
      const remaining = distance(elen.position, waypoint);
      const step = 2.25 * deltaSeconds;
      if (remaining <= step) {
        elen.position.x = waypoint.x;
        elen.position.y = waypoint.y;
        state.path.shift();
        elen.moving = state.path.length > 0;
      } else {
        applyMovement({
          x: ((waypoint.x - elen.position.x) / remaining) * step,
          y: ((waypoint.y - elen.position.y) / remaining) * step,
        });
      }
    }
  }

  const travelled = distance(previous, elen.position);
  if (travelled > 0.0001) {
    state.movingDistance += travelled;
    const beforeScreen = worldToCanvas(previous, view);
    const afterScreen = worldToCanvas(elen.position, view);
    if (Math.abs(afterScreen.x - beforeScreen.x) > 0.01) elen.facing = afterScreen.x >= beforeScreen.x ? 1 : -1;
  }
  const actorDepth = depthOf(elen.position);
  if (actorDepth < furniture[2]!.depth - 0.2) state.sawBehind = true;
  if (actorDepth > furniture[2]!.depth + 0.2) state.sawFront = true;
}

function applyMovement(delta: Vec2): void {
  const previous = { ...elen.position };
  const result = moveWithSliding(elen.position, delta, colliders);
  if (result.collided) state.collisionAvoidances += 1;
  elen.position.x = result.position.x;
  elen.position.y = result.position.y;
  elen.moving = distance(previous, result.position) > 0.0001;
}

function manualDirection(): Vec2 {
  let x = 0;
  let y = 0;
  if (state.keys.has("w")) { x -= 1; y -= 1; }
  if (state.keys.has("s")) { x += 1; y += 1; }
  if (state.keys.has("a")) { x -= 1; y += 1; }
  if (state.keys.has("d")) { x += 1; y -= 1; }
  return { x, y };
}

function setDestination(target: Vec2, demo: boolean): boolean {
  if (!state.ready || !state.possessed) return false;
  if (
    target.x < WORLD_BOUNDS.minX || target.x > WORLD_BOUNDS.maxX ||
    target.y < WORLD_BOUNDS.minY || target.y > WORLD_BOUNDS.maxY
  ) {
    showToast("Ese punto está fuera del piso caminable.");
    return false;
  }
  const route = findSmoothPath(elen.position, target, colliders);
  if (!route) {
    showToast("Ese lugar pertenece a un objeto sólido.");
    return false;
  }
  const direct = distance(elen.position, target);
  const routeDistance = route.reduce((total, point, index) => {
    const previous = index === 0 ? elen.position : route[index - 1];
    return total + (previous ? distance(previous, point) : 0);
  }, 0);
  if (routeDistance > direct + 0.12) state.collisionAvoidances += 1;
  state.path = [...route];
  if (demo) showToast("Ruta calculada alrededor de los muebles; mirá cómo cambia la profundidad.");
  return true;
}

function interact(): void {
  if (!state.possessed) {
    showToast("Poseé a Elen antes de interactuar.");
    return;
  }
  let nearest: InteractionAnchor | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    const currentDistance = distance(elen.position, anchor.point);
    if (currentDistance < nearestDistance) {
      nearest = anchor;
      nearestDistance = currentDistance;
    }
  }
  if (!nearest || nearestDistance > 0.82) {
    showToast("No hay una interacción cerca. Acercate a una marca turquesa.");
    return;
  }
  showToast(nearest.response);
}

function render(): void {
  if (!assets) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawRoom(assets.room);
  drawFloorGuides();
  drawRoute();

  const renderItems: { readonly depth: number; readonly order: number; readonly draw: () => void }[] = [];
  furniture.forEach((entity, index) => {
    renderItems.push({ depth: entity.depth, order: 10 + index, draw: () => drawFurniture(entity) });
  });
  renderItems.push({ depth: depthOf(bartender.position), order: 30, draw: () => drawNpc(bartender) });
  renderItems.push({ depth: depthOf(elen.position), order: 31, draw: () => drawElen() });
  renderItems.sort((a, b) => a.depth - b.depth || a.order - b.order);
  renderItems.forEach((item) => item.draw());

  if (state.debug) drawDebugGeometry();
}

function drawRoom(image: HTMLImageElement): void {
  context.save();
  context.shadowColor = "rgba(0, 0, 0, .32)";
  context.shadowBlur = 24;
  context.shadowOffsetY = 18;
  context.drawImage(
    image,
    view.offsetX,
    view.offsetY,
    SOURCE_ROOM.width * view.scale,
    SOURCE_ROOM.height * view.scale,
  );
  context.restore();
}

function drawFurniture(entity: FurnitureEntity): void {
  if (!assets) return;
  const image = assets[entity.texture];
  const anchor = worldToCanvas(entity.visualAnchor, view);
  const height = entity.renderWidth * (entity.crop.height / entity.crop.width);
  context.drawImage(
    image,
    entity.crop.x,
    entity.crop.y,
    entity.crop.width,
    entity.crop.height,
    anchor.x - entity.renderWidth / 2,
    anchor.y - height,
    entity.renderWidth,
    height,
  );
}

function drawElen(): void {
  if (!assets) return;
  const idle: CropRect = { x: 154, y: 182, width: 160, height: 490 };
  const walkA: CropRect = { x: 580, y: 188, width: 189, height: 486 };
  const walkB: CropRect = { x: 989, y: 189, width: 192, height: 488 };
  const walkingCrop = Math.floor(state.elapsed * 7) % 2 === 0 ? walkA : walkB;
  drawActorSprite(assets.elen, elen, elen.moving ? walkingCrop : idle, 126, "#efad68", state.possessed);
}

function drawNpc(actor: ActorState): void {
  if (!assets) return;
  drawActorSprite(assets.npcs, actor, { x: 0, y: 0, width: 128, height: 160 }, 126, "#7cc6af", false);
}

function drawActorSprite(
  image: HTMLImageElement,
  actor: ActorState,
  crop: CropRect,
  renderHeight: number,
  ringColor: string,
  selected: boolean,
): void {
  const feet = worldToCanvas(actor.position, view);
  const renderWidth = renderHeight * (crop.width / crop.height);
  context.save();
  context.fillStyle = selected ? "rgba(239, 173, 104, .24)" : "rgba(11, 22, 22, .28)";
  context.beginPath();
  context.ellipse(feet.x, feet.y - 3, Math.max(15, renderWidth * .38), 7, 0, 0, Math.PI * 2);
  context.fill();
  if (selected) {
    context.strokeStyle = ringColor;
    context.lineWidth = 2;
    context.stroke();
  }
  context.translate(feet.x, feet.y);
  context.scale(actor.facing, 1);
  context.imageSmoothingEnabled = true;
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, -renderWidth / 2, -renderHeight, renderWidth, renderHeight);
  context.restore();
}

function drawFloorGuides(): void {
  if (!state.debug) return;
  context.save();
  context.globalAlpha = 0.2;
  context.strokeStyle = "#d9c28f";
  context.lineWidth = 1;
  for (let index = 1; index <= 7; index += 1) {
    drawWorldLine({ x: index, y: WORLD_BOUNDS.minY }, { x: index, y: WORLD_BOUNDS.maxY });
    drawWorldLine({ x: WORLD_BOUNDS.minX, y: index }, { x: WORLD_BOUNDS.maxX, y: index });
  }
  context.restore();
}

function drawRoute(): void {
  if (state.path.length === 0) return;
  context.save();
  context.strokeStyle = "rgba(237, 190, 112, .72)";
  context.lineWidth = 2;
  context.setLineDash([7, 8]);
  context.beginPath();
  const start = worldToCanvas(elen.position, view);
  context.moveTo(start.x, start.y);
  for (const point of state.path) {
    const screen = worldToCanvas(point, view);
    context.lineTo(screen.x, screen.y);
  }
  context.stroke();
  const destination = state.path.at(-1);
  if (destination) drawDiamond(destination, 0.24, "rgba(237, 190, 112, .2)", "#edbe70");
  context.restore();
}

function drawDebugGeometry(): void {
  context.save();
  context.font = "700 11px Aptos, sans-serif";
  for (const collider of colliders) {
    const points = [
      { x: collider.minX, y: collider.minY },
      { x: collider.maxX, y: collider.minY },
      { x: collider.maxX, y: collider.maxY },
      { x: collider.minX, y: collider.maxY },
    ].map((point) => worldToCanvas(point, view));
    context.beginPath();
    points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
    context.closePath();
    context.fillStyle = "rgba(239, 90, 108, .22)";
    context.strokeStyle = "#ef6977";
    context.lineWidth = 2;
    context.fill();
    context.stroke();
    const labelPoint = points[0];
    if (labelPoint) {
      context.fillStyle = "#fff2e8";
      context.fillText(`${collider.label} · solid`, labelPoint.x + 5, labelPoint.y - 7);
    }
  }
  for (const anchor of anchors) {
    const point = worldToCanvas(anchor.point, view);
    context.fillStyle = "rgba(83, 213, 194, .25)";
    context.strokeStyle = "#75d7c7";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(point.x, point.y, 9, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#dffff8";
    context.fillText(anchor.label, point.x + 13, point.y + 4);
  }
  const feet = worldToCanvas(elen.position, view);
  context.fillStyle = "#ffe3af";
  context.fillText(`feet (${elen.position.x.toFixed(2)}, ${elen.position.y.toFixed(2)})`, feet.x + 13, feet.y + 17);
  context.restore();
}

function drawWorldLine(from: Vec2, to: Vec2): void {
  const start = worldToCanvas(from, view);
  const end = worldToCanvas(to, view);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
}

function drawDiamond(center: Vec2, radius: number, fill: string, stroke: string): void {
  const corners = [
    { x: center.x - radius, y: center.y },
    { x: center.x, y: center.y - radius },
    { x: center.x + radius, y: center.y },
    { x: center.x, y: center.y + radius },
  ].map((point) => worldToCanvas(point, view));
  context.beginPath();
  corners.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
  context.closePath();
  context.fillStyle = fill;
  context.strokeStyle = stroke;
  context.fill();
  context.stroke();
}

function updateTelemetry(): void {
  const actorDepth = depthOf(elen.position);
  requiredElement("#actor-position").textContent = `x ${elen.position.x.toFixed(2)} · y ${elen.position.y.toFixed(2)}`;
  requiredElement("#actor-depth").textContent = actorDepth.toFixed(2);
  requiredElement("#actor-state").textContent = !state.possessed ? "libre" : elen.moving ? "caminando" : "poseída";
  requiredElement("#collision-count").textContent = String(state.collisionAvoidances);
  requiredElement<HTMLInputElement>("#check-motion").checked = state.movingDistance > 0.25;
  requiredElement<HTMLInputElement>("#check-collision").checked = state.collisionValidated;
  requiredElement<HTMLInputElement>("#check-depth").checked = state.sawBehind && state.sawFront;
  requiredElement<HTMLInputElement>("#check-style").checked = state.styleValidated;
}

function populateEntityList(): void {
  const list = requiredElement<HTMLUListElement>("#entity-list");
  const entities = [
    ...furniture.map((entity) => ({ label: entity.label, type: "sprite + collider" })),
    { label: "Elen", type: "actor continuo" },
    { label: "Alma", type: "npc con depth" },
  ];
  requiredElement("#entity-count").textContent = String(entities.length);
  for (const entity of entities) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    const type = document.createElement("span");
    label.textContent = entity.label;
    type.textContent = entity.type;
    item.append(label, type);
    list.append(item);
  }
}

function setDebug(visible: boolean): void {
  state.debug = visible;
  debugButton.setAttribute("aria-pressed", String(visible));
  debugButton.textContent = visible ? "Ocultar geometría" : "Ver geometría";
}

function reset(): void {
  elen.position.x = startPosition.x;
  elen.position.y = startPosition.y;
  elen.moving = false;
  elen.facing = 1;
  state.path = [];
  state.keys.clear();
  state.collisionAvoidances = 0;
  state.movingDistance = 0;
  state.sawBehind = false;
  state.sawFront = false;
  state.demoIndex = 0;
  showToast("Laboratorio reiniciado. La geometría sigue siendo independiente del arte.");
}

function installQaApi(): void {
  window.__SYKA_SPATIAL_LAB__ = {
    snapshot: () => ({
      ready: state.ready,
      possessed: state.possessed,
      actor: {
        x: elen.position.x,
        y: elen.position.y,
        depth: depthOf(elen.position),
        moving: elen.moving,
        insideCollider: colliders.some((collider) => !isWalkable(elen.position, [collider], ACTOR_RADIUS)),
      },
      pathLength: state.path.length,
      collisionAvoidances: state.collisionAvoidances,
      debugVisible: state.debug,
      checks: {
        motion: state.movingDistance > 0.25,
        collision: state.collisionValidated,
        depth: state.sawBehind && state.sawFront,
        style: state.styleValidated,
      },
    }),
    moveTo: (x, y) => setDestination({ x, y }, false),
    reset,
    setDebug,
  };
}

function showToast(message: string): void {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function createView(): ViewTransform {
  const scale = Math.min((canvas.width - 70) / SOURCE_ROOM.width, (canvas.height - 24) / SOURCE_ROOM.height);
  return {
    scale,
    offsetX: (canvas.width - SOURCE_ROOM.width * scale) / 2,
    offsetY: (canvas.height - SOURCE_ROOM.height * scale) / 2,
  };
}

async function loadAssets(): Promise<LabAssets> {
  const entries = await Promise.all([
    loadImage("/assets/generated/spatial-lab-v1/room-base.png"),
    loadImage("/assets/generated/spatial-lab-v1/counter.png"),
    loadImage("/assets/generated/spatial-lab-v1/table-chairs.png"),
    loadImage("/assets/generated/spatial-lab-v1/sofa.png"),
    loadImage("/assets/generated/alpha-v1/agents-elen-row-v1.png"),
    loadImage("/assets/generated/npc-v1/cafe-npcs-atlas-v1.png"),
  ]);
  const [room, counter, table, sofa, elenImage, npcs] = entries;
  if (!room || !counter || !table || !sofa || !elenImage || !npcs) throw new Error("Faltan texturas del laboratorio.");
  return { room, counter, table, sofa, elen: elenImage, npcs };
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar ${source}`));
    image.src = source;
  });
}

function requireCanvasContext(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const value = target.getContext("2d", { alpha: true });
  if (!value) throw new Error("Canvas 2D is not available.");
  return value;
}

function requiredElement<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}
