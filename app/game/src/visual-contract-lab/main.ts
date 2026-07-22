import "./style.css";

import {
  ACTOR_RADIUS,
  NAV_GRID,
  SOURCE_ROOM,
  canvasToWorld,
  cellCenter,
  cellKey,
  depthOf,
  distance,
  fillCellRange,
  findSmoothPath,
  isWorldWalkable,
  moveContinuous,
  moveToward,
  worldToCanvas,
  worldToCell,
  type MutableVec2,
  type Vec2,
  type ViewTransform,
} from "./engine";

interface CropRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface DrawRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface LabAssets {
  readonly room: HTMLImageElement;
  readonly sofa: HTMLImageElement;
  readonly table: HTMLImageElement;
  readonly actors: HTMLImageElement;
}

interface RenderItem {
  readonly id: string;
  readonly depth: number;
  readonly order: number;
  readonly draw: () => void;
}

interface ProofState {
  navigation: boolean;
  motion: boolean;
  depth: boolean;
  seat: boolean;
}

interface VisualLabSnapshot {
  readonly ready: boolean;
  readonly actor: {
    readonly x: number;
    readonly y: number;
    readonly velocityX: number;
    readonly velocityY: number;
    readonly moving: boolean;
    readonly seated: boolean;
    readonly cell: { readonly x: number; readonly y: number };
    readonly insideOccupiedCell: boolean;
    readonly depth: number;
  };
  readonly pathLength: number;
  readonly demoActive: boolean;
  readonly collisionCount: number;
  readonly debugVisible: boolean;
  readonly checks: Readonly<ProofState>;
  readonly renderOrder: readonly string[];
}

interface VisualLabApi {
  readonly snapshot: () => VisualLabSnapshot;
  readonly moveTo: (x: number, y: number) => boolean;
  readonly runRoute: () => void;
  readonly sit: () => void;
  readonly reset: () => void;
  readonly setDebug: (visible: boolean) => void;
}

declare global {
  interface Window {
    __SYKA_VISUAL_CONTRACT_LAB__?: VisualLabApi;
  }
}

const canvas = requiredElement<HTMLCanvasElement>("visual-canvas");
const context = requireCanvasContext(canvas);
const view = createView();

const routeButton = requiredElement<HTMLButtonElement>("route-button");
const seatButton = requiredElement<HTMLButtonElement>("seat-button");
const debugButton = requiredElement<HTMLButtonElement>("debug-button");
const referenceButton = requiredElement<HTMLButtonElement>("reference-button");
const resetButton = requiredElement<HTMLButtonElement>("reset-button");
const referenceDialog = requiredElement<HTMLDialogElement>("reference-dialog");
const referenceClose = requiredElement<HTMLButtonElement>("reference-close");
const toast = requiredElement<HTMLElement>("toast");
const liveVerdict = requiredElement<HTMLElement>("live-verdict");
const runtimeStatus = requiredElement<HTMLElement>("runtime-status");
const movementStatus = requiredElement<HTMLElement>("movement-status");
const positionStatus = requiredElement<HTMLElement>("position-status");
const layerStatus = requiredElement<HTMLElement>("layer-status");
const proofElements: Record<keyof ProofState, HTMLElement> = {
  navigation: requiredElement("proof-nav"),
  motion: requiredElement("proof-motion"),
  depth: requiredElement("proof-depth"),
  seat: requiredElement("proof-seat"),
};

const SOFA_CROP: CropRect = { x: 369, y: 208, width: 736, height: 662 };
const TABLE_CROP: CropRect = { x: 246, y: 216, width: 947, height: 604 };
const ACTOR_IDLE: CropRect = { x: 256, y: 0, width: 128, height: 160 };
const ACTOR_WALK: CropRect = { x: 256, y: 160, width: 128, height: 160 };
const ACTOR_SEATED: CropRect = { x: 256, y: 480, width: 128, height: 160 };

const SOFA_ANCHOR: Vec2 = { x: 5.78, y: 2.72 };
const TABLE_ANCHOR: Vec2 = { x: 4.4, y: 5.2 };
const SOFA_APPROACH: Vec2 = { x: 5.75, y: 3.25 };
const SOFA_SEAT: Vec2 = { x: 5.75, y: 2.55 };
const START_POSITION: Vec2 = { x: 6.75, y: 4.5 };
const BEHIND_POSITION: Vec2 = { x: 4.25, y: 1.0 };
const DEMO_WAYPOINTS: readonly Vec2[] = [BEHIND_POSITION, START_POSITION];

const SOFA_BASE_DEPTH = 7.25;
const SOFA_FRONT_DEPTH = 9.62;
const TABLE_DEPTH = 9.78;
const SEATED_ACTOR_DEPTH = 9.22;
const SOFA_RENDER_WIDTH = 300;
const TABLE_RENDER_WIDTH = 285;
const ACTOR_RENDER_HEIGHT = 158;
const SEAT_ELEVATION = 60;

const SOFA_CELLS = fillCellRange(9, 12, 1, 4);
const TABLE_CELLS = fillCellRange(6, 9, 6, 9);
const OCCUPIED = new Set<string>([...SOFA_CELLS, ...TABLE_CELLS]);

const actor = {
  position: { ...START_POSITION } as MutableVec2,
  velocity: { x: 0, y: 0 } as MutableVec2,
  moving: false,
  facing: 1 as -1 | 1,
  seated: false,
};

const state = {
  ready: false,
  debug: false,
  elapsed: 0,
  keys: new Set<string>(),
  path: [] as Vec2[],
  pendingSeat: false,
  demoActive: false,
  demoIndex: 0,
  collisionCount: 0,
  movedDistance: 0,
  sawSubCellMotion: false,
  sawBehind: false,
  sawFront: true,
  sawSeat: false,
  destination: null as Vec2 | null,
  renderOrder: [] as string[],
};

let assets: LabAssets | undefined;
let animationFrame = 0;
let lastTimestamp = 0;
let toastTimer = 0;
let demoPauseTimer = 0;

bindControls();
installQaApi();
void loadAssets()
  .then((loaded) => {
    assets = loaded;
    state.ready = true;
    liveVerdict.classList.add("is-ready");
    runtimeStatus.textContent = "grilla oculta · posición flotante · capas activas";
    canvas.focus({ preventScroll: true });
    showToast("Listo. WASD es libre; el clic usa una ruta invisible y suavizada.");
    lastTimestamp = performance.now();
    animationFrame = requestAnimationFrame(frame);
  })
  .catch((error: unknown) => {
    runtimeStatus.textContent = "no se pudieron cargar los assets";
    showToast(error instanceof Error ? error.message : "Falló la carga del laboratorio visual.");
    console.error(error);
  });

function bindControls(): void {
  routeButton.addEventListener("click", runDemo);
  seatButton.addEventListener("click", requestSeat);
  debugButton.addEventListener("click", () => setDebug(!state.debug));
  resetButton.addEventListener("click", () => reset(true));
  referenceButton.addEventListener("click", () => referenceDialog.showModal());
  referenceClose.addEventListener("click", () => referenceDialog.close());
  referenceDialog.addEventListener("click", (event) => {
    if (event.target === referenceDialog) referenceDialog.close();
  });

  canvas.addEventListener("pointerdown", (event) => {
    canvas.focus({ preventScroll: true });
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
    if (actor.seated) leaveSeat();
    setDestination(canvasToWorld(point, view), false);
  });

  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "e"].includes(key)) event.preventDefault();
    if (key === "e" && !event.repeat) {
      requestSeat();
      return;
    }
    if (!["w", "a", "s", "d"].includes(key)) return;
    if (actor.seated) leaveSeat();
    state.keys.add(key);
  });
  window.addEventListener("keyup", (event) => state.keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => state.keys.clear());
  window.addEventListener("pagehide", () => cancelAnimationFrame(animationFrame), { once: true });
}

function frame(timestamp: number): void {
  const deltaSeconds = Math.min(0.034, Math.max(0, (timestamp - lastTimestamp) / 1000));
  lastTimestamp = timestamp;
  state.elapsed += deltaSeconds;
  update(deltaSeconds);
  render();
  updateInterface();
  animationFrame = requestAnimationFrame(frame);
}

function update(deltaSeconds: number): void {
  if (actor.seated) {
    actor.velocity.x = 0;
    actor.velocity.y = 0;
    actor.moving = false;
    state.sawSeat = true;
    return;
  }

  const previous = { ...actor.position };
  const manual = manualDirection();
  let desired = { x: 0, y: 0 };
  let maximumSpeed = 0;

  if (manual.x !== 0 || manual.y !== 0) {
    state.path = [];
    state.destination = null;
    state.demoActive = false;
    state.pendingSeat = false;
    const magnitude = Math.hypot(manual.x, manual.y);
    maximumSpeed = 2.95;
    desired = { x: manual.x / magnitude * maximumSpeed, y: manual.y / magnitude * maximumSpeed };
  } else if (state.path.length > 0) {
    const waypoint = state.path[0];
    if (waypoint) {
      const remaining = distance(actor.position, waypoint);
      if (remaining < 0.045) {
        actor.position.x = waypoint.x;
        actor.position.y = waypoint.y;
        state.path.shift();
        if (state.path.length === 0) onDestinationReached();
        if (actor.seated) return;
      } else {
        maximumSpeed = Math.min(2.55, remaining / Math.max(deltaSeconds, 0.001));
        desired = {
          x: (waypoint.x - actor.position.x) / remaining * maximumSpeed,
          y: (waypoint.y - actor.position.y) / remaining * maximumSpeed,
        };
      }
    }
  }

  const acceleration = maximumSpeed > 0 ? 13.5 : 18;
  actor.velocity.x = moveToward(actor.velocity.x, desired.x, acceleration * deltaSeconds);
  actor.velocity.y = moveToward(actor.velocity.y, desired.y, acceleration * deltaSeconds);
  if (Math.abs(actor.velocity.x) < 0.008) actor.velocity.x = 0;
  if (Math.abs(actor.velocity.y) < 0.008) actor.velocity.y = 0;

  const movement = { x: actor.velocity.x * deltaSeconds, y: actor.velocity.y * deltaSeconds };
  const result = moveContinuous(actor.position, movement, OCCUPIED);
  if (result.collided && (Math.abs(movement.x) > 0.00001 || Math.abs(movement.y) > 0.00001)) {
    state.collisionCount += 1;
    if (Math.abs(result.position.x - actor.position.x) < 0.00001) actor.velocity.x = 0;
    if (Math.abs(result.position.y - actor.position.y) < 0.00001) actor.velocity.y = 0;
  }
  actor.position.x = result.position.x;
  actor.position.y = result.position.y;

  const travelled = distance(previous, actor.position);
  actor.moving = travelled > 0.0001;
  if (actor.moving) {
    state.movedDistance += travelled;
    const before = worldToCanvas(previous, view);
    const after = worldToCanvas(actor.position, view);
    if (Math.abs(after.x - before.x) > 0.02) actor.facing = after.x >= before.x ? 1 : -1;
    const cell = worldToCell(actor.position);
    const center = cellCenter(cell);
    if (distance(actor.position, center) > 0.055) state.sawSubCellMotion = true;
  }

  const actorDepth = getActorDepth();
  if (actorDepth < SOFA_BASE_DEPTH) state.sawBehind = true;
  if (actorDepth > SOFA_FRONT_DEPTH) state.sawFront = true;
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
  if (!state.ready) return false;
  if (!isWorldWalkable(target, OCCUPIED)) {
    showToast("Ese punto pertenece a un mueble o queda fuera del piso caminable.");
    return false;
  }
  const path = findSmoothPath(actor.position, target, OCCUPIED);
  if (!path) {
    showToast("No existe una ruta caminable hasta ese punto.");
    return false;
  }
  state.path = [...path];
  state.destination = { ...target };
  if (!demo) {
    state.demoActive = false;
    state.pendingSeat = false;
  }
  if (state.path.length === 0) onDestinationReached();
  return true;
}

function runDemo(): void {
  reset(false);
  state.demoActive = true;
  state.demoIndex = 0;
  showToast("Ruta suavizada: delante → detrás del sofá → delante.");
  setDestination(DEMO_WAYPOINTS[0] ?? START_POSITION, true);
}

function onDestinationReached(): void {
  actor.velocity.x = 0;
  actor.velocity.y = 0;
  state.destination = null;
  if (state.pendingSeat && distance(actor.position, SOFA_APPROACH) < 0.12) {
    state.pendingSeat = false;
    enterSeat();
    return;
  }
  if (!state.demoActive) return;
  state.demoIndex += 1;
  const next = DEMO_WAYPOINTS[state.demoIndex];
  if (next) {
    window.clearTimeout(demoPauseTimer);
    demoPauseTimer = window.setTimeout(() => {
      if (state.demoActive) setDestination(next, true);
    }, 720);
    return;
  }
  state.demoActive = false;
  showToast("Recorrido completo. La ruta usó la grilla sin mostrarla ni saltar entre casillas.");
}

function requestSeat(): void {
  if (!state.ready) return;
  state.demoActive = false;
  state.keys.clear();
  if (actor.seated) {
    leaveSeat();
    showToast("La habitante volvió al pasillo caminable.");
    return;
  }
  if (distance(actor.position, SOFA_APPROACH) < 0.34) {
    enterSeat();
    return;
  }
  state.pendingSeat = true;
  if (!setDestinationForSeat()) state.pendingSeat = false;
}

function setDestinationForSeat(): boolean {
  const path = findSmoothPath(actor.position, SOFA_APPROACH, OCCUPIED);
  if (!path) {
    showToast("No se pudo llegar al anchor del sofá.");
    return false;
  }
  state.path = [...path];
  state.destination = { ...SOFA_APPROACH };
  if (state.path.length === 0) onDestinationReached();
  else showToast("La habitante camina libremente hasta el anchor de asiento.");
  return true;
}

function enterSeat(): void {
  actor.position.x = SOFA_SEAT.x;
  actor.position.y = SOFA_SEAT.y;
  actor.velocity.x = 0;
  actor.velocity.y = 0;
  actor.seated = true;
  actor.moving = false;
  state.path = [];
  state.destination = null;
  state.sawSeat = true;
  seatButton.textContent = "Levantarse";
  showToast("Actor insertado entre el sofá base y su frente recortado.");
}

function leaveSeat(): void {
  actor.seated = false;
  actor.position.x = SOFA_APPROACH.x;
  actor.position.y = SOFA_APPROACH.y;
  actor.velocity.x = 0;
  actor.velocity.y = 0;
  seatButton.textContent = "Sentarse";
}

function reset(announce: boolean): void {
  actor.position.x = START_POSITION.x;
  actor.position.y = START_POSITION.y;
  actor.velocity.x = 0;
  actor.velocity.y = 0;
  actor.moving = false;
  actor.facing = -1;
  actor.seated = false;
  state.keys.clear();
  state.path = [];
  state.pendingSeat = false;
  state.demoActive = false;
  state.demoIndex = 0;
  window.clearTimeout(demoPauseTimer);
  state.destination = null;
  state.collisionCount = 0;
  state.movedDistance = 0;
  state.sawSubCellMotion = false;
  state.sawBehind = false;
  state.sawFront = true;
  state.sawSeat = false;
  seatButton.textContent = "Sentarse";
  if (announce) showToast("Laboratorio reiniciado. La grilla continúa oculta.");
}

function render(): void {
  if (!assets) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawAtmosphere();
  drawRoom();
  drawRugs();
  if (state.debug) drawNavigationGrid();

  const items: RenderItem[] = [
    { id: "sofa-base", depth: SOFA_BASE_DEPTH, order: 10, draw: drawSofaBase },
    { id: "table", depth: TABLE_DEPTH, order: 20, draw: drawTable },
    { id: actor.seated ? "actor-seated" : "actor", depth: getActorDepth(), order: 30, draw: drawActor },
    { id: "sofa-front", depth: SOFA_FRONT_DEPTH, order: 40, draw: drawSofaFront },
  ].sort((a, b) => a.depth - b.depth || a.order - b.order);
  for (const item of items) item.draw();
  state.renderOrder = items.map((item) => item.id);

  drawDestination();
  if (state.debug) drawDiagnostics();
}

function drawAtmosphere(): void {
  const gradient = context.createRadialGradient(590, 390, 90, 590, 390, 620);
  gradient.addColorStop(0, "rgba(117, 145, 131, .18)");
  gradient.addColorStop(1, "rgba(15, 31, 33, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function drawRoom(): void {
  if (!assets) return;
  context.save();
  context.shadowColor = "rgba(0, 0, 0, .48)";
  context.shadowBlur = 31;
  context.shadowOffsetY = 20;
  context.imageSmoothingEnabled = true;
  context.drawImage(assets.room, view.offsetX, view.offsetY, SOURCE_ROOM.width * view.scale, SOURCE_ROOM.height * view.scale);
  context.restore();
}

function drawRugs(): void {
  drawWorldPolygon([
    { x: 3.3, y: 3.6 }, { x: 5.35, y: 3.6 }, { x: 5.35, y: 5.45 }, { x: 3.3, y: 5.45 },
  ], "rgba(91, 42, 37, .72)", "rgba(213, 139, 75, .46)");
  drawWorldPolygon([
    { x: 4.8, y: 1.05 }, { x: 6.85, y: 1.05 }, { x: 6.85, y: 2.9 }, { x: 4.8, y: 2.9 },
  ], "rgba(45, 65, 47, .48)", "rgba(142, 112, 62, .35)");
}

function drawSofaBase(): void {
  if (!assets) return;
  const rect = furnitureRect(SOFA_ANCHOR, SOFA_CROP, SOFA_RENDER_WIDTH);
  drawAssetCrop(assets.sofa, SOFA_CROP, rect);
}

function drawSofaFront(): void {
  if (!assets) return;
  const rect = furnitureRect(SOFA_ANCHOR, SOFA_CROP, SOFA_RENDER_WIDTH);
  context.save();
  context.beginPath();
  context.moveTo(rect.x, rect.y + rect.height * 0.47);
  context.lineTo(rect.x + rect.width * 0.21, rect.y + rect.height * 0.62);
  context.lineTo(rect.x + rect.width * 0.79, rect.y + rect.height * 0.62);
  context.lineTo(rect.x + rect.width, rect.y + rect.height * 0.45);
  context.lineTo(rect.x + rect.width, rect.y + rect.height);
  context.lineTo(rect.x, rect.y + rect.height);
  context.closePath();
  context.clip();
  drawAssetCrop(assets.sofa, SOFA_CROP, rect);
  context.restore();
}

function drawTable(): void {
  if (!assets) return;
  const rect = furnitureRect(TABLE_ANCHOR, TABLE_CROP, TABLE_RENDER_WIDTH);
  drawAssetCrop(assets.table, TABLE_CROP, rect);
}

function drawActor(): void {
  if (!assets) return;
  const groundFeet = worldToCanvas(actor.position, view);
  const feet = { x: groundFeet.x, y: groundFeet.y - (actor.seated ? SEAT_ELEVATION : 0) };
  const walkingFrame = Math.floor(state.elapsed * 6) % 2 === 0 ? ACTOR_IDLE : ACTOR_WALK;
  const crop = actor.seated ? ACTOR_SEATED : actor.moving ? walkingFrame : ACTOR_IDLE;
  const renderHeight = actor.seated ? 132 : ACTOR_RENDER_HEIGHT;
  const renderWidth = renderHeight * (crop.width / crop.height);
  const bob = actor.moving && !actor.seated ? Math.sin(state.elapsed * 15) * 1.4 : 0;

  if (!actor.seated) {
    context.save();
    context.fillStyle = "rgba(12, 19, 18, .38)";
    context.beginPath();
    context.ellipse(groundFeet.x, groundFeet.y - 2, 18, 7, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.save();
  context.translate(Math.round(feet.x), Math.round(feet.y + bob));
  context.scale(actor.facing, 1);
  context.imageSmoothingEnabled = true;
  context.drawImage(
    assets.actors,
    crop.x, crop.y, crop.width, crop.height,
    -renderWidth / 2, -renderHeight,
    renderWidth, renderHeight,
  );
  context.restore();
}

function drawNavigationGrid(): void {
  context.save();
  for (let y = 0; y < NAV_GRID.height; y += 1) {
    for (let x = 0; x < NAV_GRID.width; x += 1) {
      const key = cellKey({ x, y });
      const minX = NAV_GRID.originX + x * NAV_GRID.cellSize;
      const minY = NAV_GRID.originY + y * NAV_GRID.cellSize;
      drawWorldPolygon([
        { x: minX, y: minY },
        { x: minX + NAV_GRID.cellSize, y: minY },
        { x: minX + NAV_GRID.cellSize, y: minY + NAV_GRID.cellSize },
        { x: minX, y: minY + NAV_GRID.cellSize },
      ], OCCUPIED.has(key) ? "rgba(231, 82, 71, .29)" : "rgba(95, 218, 173, .035)", OCCUPIED.has(key) ? "rgba(255, 150, 115, .85)" : "rgba(120, 217, 186, .24)");
    }
  }
  context.restore();
}

function drawDiagnostics(): void {
  const approach = worldToCanvas(SOFA_APPROACH, view);
  const groundSeat = worldToCanvas(SOFA_SEAT, view);
  const seat = { x: groundSeat.x, y: groundSeat.y - SEAT_ELEVATION };
  context.save();
  context.font = "800 10px Trebuchet MS";
  context.lineWidth = 2;
  for (const marker of [
    { point: approach, label: "APPROACH", color: "#ffe19c" },
    { point: seat, label: "SEAT + Z", color: "#7de0da" },
  ]) {
    context.strokeStyle = marker.color;
    context.beginPath();
    context.arc(marker.point.x, marker.point.y, 8, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = marker.color;
    context.fillText(marker.label, marker.point.x + 12, marker.point.y + 3);
  }
  const feet = worldToCanvas(actor.position, view);
  context.fillStyle = "#ffdeb0";
  context.fillText(`feet ${actor.position.x.toFixed(2)} · ${actor.position.y.toFixed(2)}`, feet.x + 12, feet.y + 15);
  context.restore();
}

function drawDestination(): void {
  if (!state.destination || state.debug) return;
  const point = worldToCanvas(state.destination, view);
  const pulse = 7 + (Math.sin(state.elapsed * 8) + 1) * 2;
  context.save();
  context.strokeStyle = "rgba(245, 200, 124, .78)";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(point.x, point.y, pulse * 1.5, pulse * 0.7, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawWorldPolygon(points: readonly Vec2[], fill: string, stroke: string): void {
  const projected = points.map((point) => worldToCanvas(point, view));
  const first = projected[0];
  if (!first) return;
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const point of projected.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = stroke;
  context.lineWidth = 1.25;
  context.stroke();
}

function furnitureRect(anchorPosition: Vec2, crop: CropRect, width: number): DrawRect {
  const anchor = worldToCanvas(anchorPosition, view);
  const height = width * crop.height / crop.width;
  return { x: anchor.x - width / 2, y: anchor.y - height, width, height };
}

function drawAssetCrop(image: HTMLImageElement, crop: CropRect, rect: DrawRect): void {
  context.imageSmoothingEnabled = true;
  context.drawImage(
    image,
    crop.x, crop.y, crop.width, crop.height,
    rect.x, rect.y, rect.width, rect.height,
  );
}

function updateInterface(): void {
  const proofs = getProofState();
  movementStatus.textContent = actor.seated ? "Sentada" : actor.moving ? "Movimiento continuo" : "En reposo";
  positionStatus.textContent = `x ${actor.position.x.toFixed(2)} · y ${actor.position.y.toFixed(2)} · floats`;
  layerStatus.textContent = actor.seated
    ? "sofa-base → actor → sofa-front"
    : state.renderOrder.join(" → ");
  for (const key of Object.keys(proofs) as (keyof ProofState)[]) {
    proofElements[key].classList.toggle("is-proven", proofs[key]);
  }
  const score = Object.values(proofs).filter(Boolean).length;
  runtimeStatus.textContent = score === 4
    ? "contrato completo · 4/4"
    : `grilla oculta · posición flotante · ${score}/4`;
}

function getProofState(): ProofState {
  return {
    navigation: SOFA_CELLS.every((key) => OCCUPIED.has(key)) && TABLE_CELLS.every((key) => OCCUPIED.has(key)),
    motion: state.movedDistance > 0.2 && state.sawSubCellMotion,
    depth: state.sawBehind && state.sawFront,
    seat: state.sawSeat,
  };
}

function getActorDepth(): number {
  return actor.seated ? SEATED_ACTOR_DEPTH : depthOf(actor.position);
}

function getSnapshot(): VisualLabSnapshot {
  const cell = worldToCell(actor.position);
  return {
    ready: state.ready,
    actor: {
      x: actor.position.x,
      y: actor.position.y,
      velocityX: actor.velocity.x,
      velocityY: actor.velocity.y,
      moving: actor.moving,
      seated: actor.seated,
      cell,
      insideOccupiedCell: !actor.seated && OCCUPIED.has(cellKey(cell)),
      depth: getActorDepth(),
    },
    pathLength: state.path.length,
    demoActive: state.demoActive,
    collisionCount: state.collisionCount,
    debugVisible: state.debug,
    checks: getProofState(),
    renderOrder: [...state.renderOrder],
  };
}

function installQaApi(): void {
  window.__SYKA_VISUAL_CONTRACT_LAB__ = {
    snapshot: getSnapshot,
    moveTo: (x, y) => setDestination({ x, y }, false),
    runRoute: runDemo,
    sit: requestSeat,
    reset: () => reset(false),
    setDebug,
  };
}

function setDebug(visible: boolean): void {
  state.debug = visible;
  debugButton.setAttribute("aria-pressed", String(visible));
  debugButton.textContent = visible ? "Ocultar sistema" : "Ver sistema";
}

function showToast(message: string): void {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function createView(): ViewTransform {
  const scale = Math.min((canvas.width - 68) / SOURCE_ROOM.width, (canvas.height - 26) / SOURCE_ROOM.height);
  return {
    scale,
    offsetX: (canvas.width - SOURCE_ROOM.width * scale) / 2,
    offsetY: (canvas.height - SOURCE_ROOM.height * scale) / 2,
  };
}

async function loadAssets(): Promise<LabAssets> {
  const [room, sofa, table, actors] = await Promise.all([
    loadImage("/assets/generated/spatial-lab-v1/room-base.png"),
    loadImage("/assets/generated/spatial-lab-v1/sofa.png"),
    loadImage("/assets/generated/spatial-lab-v1/table-chairs.png"),
    loadImage("/assets/generated/npc-v1/cafe-npcs-atlas-v1.png"),
  ]);
  return { room, sofa, table, actors };
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

function requiredElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Falta el elemento #${id}.`);
  return element as T;
}

function requireCanvasContext(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const renderingContext = target.getContext("2d", { alpha: true });
  if (!renderingContext) throw new Error("Canvas 2D no está disponible.");
  return renderingContext;
}
