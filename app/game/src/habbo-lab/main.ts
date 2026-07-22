import "./style.css";

import {
  depthAt,
  findTilePath,
  interpolate,
  isTileInside,
  isTileWalkable,
  sameTile,
  tileCenter,
  tileKey,
  type Position,
  type RoomGrid,
  type Tile,
} from "./engine";

interface RenderItem {
  readonly id: string;
  readonly label: string;
  readonly depth: number;
  readonly draw: () => void;
}

interface MovementSegment {
  readonly from: Position;
  readonly to: Position;
  readonly target: Tile;
  readonly startedAt: number;
  readonly duration: number;
}

interface ContractChecks {
  tiles: boolean;
  smooth: boolean;
  behind: boolean;
  between: boolean;
  front: boolean;
}

interface LabSnapshot {
  readonly ready: boolean;
  readonly actor: {
    readonly logicalTile: Tile;
    readonly visualPosition: Position;
    readonly depth: number;
    readonly relation: "behind" | "between" | "front";
    readonly moving: boolean;
    readonly seated: boolean;
    readonly insideOccupiedTile: boolean;
  };
  readonly pathLength: number;
  readonly demoActive: boolean;
  readonly blockedAttempts: number;
  readonly checks: Readonly<ContractChecks>;
  readonly renderOrder: readonly string[];
}

interface HabboLabApi {
  readonly snapshot: () => LabSnapshot;
  readonly moveTo: (x: number, y: number) => boolean;
  readonly runDemo: () => void;
  readonly reset: () => void;
  readonly setDebug: (enabled: boolean) => void;
  readonly sit: () => void;
}

declare global {
  interface Window {
    __SYKA_HABBO_LAB__?: HabboLabApi;
  }
}

const canvas = requireElement<HTMLCanvasElement>("habbo-canvas");
const context = requireCanvasContext(canvas);

const demoButton = requireElement<HTMLButtonElement>("demo-button");
const seatButton = requireElement<HTMLButtonElement>("seat-button");
const debugButton = requireElement<HTMLButtonElement>("debug-button");
const resetButton = requireElement<HTMLButtonElement>("reset-button");
const toast = requireElement<HTMLElement>("toast");
const runtimeSeal = requireElement<HTMLElement>("runtime-seal");
const runtimeStatus = requireElement<HTMLElement>("runtime-status");
const logicalTileReadout = requireElement<HTMLElement>("logical-tile");
const visualPositionReadout = requireElement<HTMLElement>("visual-position");
const depthRelationReadout = requireElement<HTMLElement>("depth-relation");
const actorStateReadout = requireElement<HTMLElement>("actor-state");
const renderStack = requireElement<HTMLOListElement>("render-stack");
const gateScore = requireElement<HTMLElement>("gate-score");
const checkElements: Record<keyof ContractChecks, HTMLInputElement> = {
  tiles: requireElement<HTMLInputElement>("check-tiles"),
  smooth: requireElement<HTMLInputElement>("check-smooth"),
  behind: requireElement<HTMLInputElement>("check-behind"),
  between: requireElement<HTMLInputElement>("check-between"),
  front: requireElement<HTMLInputElement>("check-front"),
};

const ROOM: RoomGrid = { width: 8, height: 7 };
const TILE_WIDTH = 72;
const TILE_HEIGHT = 36;
const HALF_TILE_WIDTH = TILE_WIDTH / 2;
const HALF_TILE_HEIGHT = TILE_HEIGHT / 2;
const HEIGHT_UNIT = 42;
const ORIGIN = { x: 478, y: 150 };

const SOFA_TILES: readonly Tile[] = [{ x: 4, y: 2 }, { x: 5, y: 2 }];
const TABLE_TILE: Tile = { x: 2, y: 4 };
const OCCUPIED = new Set<string>([
  ...SOFA_TILES.map(tileKey),
  tileKey(TABLE_TILE),
]);
const SOFA_APPROACH: Tile = { x: 5, y: 3 };
const SOFA_SEAT: Position = { x: 5.1, y: 2.58 };
const START_TILE: Tile = { x: 4, y: 5 };
const DEMO_WAYPOINTS: readonly Tile[] = [{ x: 4, y: 1 }, START_TILE];

const SOFA_BACK_DEPTH = 6.35;
const SOFA_SEAT_DEPTH = 7.28;
const SOFA_FRONT_DEPTH = 8.15;
const SEATED_ACTOR_DEPTH = 7.72;

let logicalTile: Tile = { ...START_TILE };
let visualPosition: Position = tileCenter(logicalTile);
let route: Tile[] = [];
let segment: MovementSegment | null = null;
let destination: Tile | null = null;
let facing = 1;
let seated = false;
let pendingSeat = false;
let debug = false;
let demoActive = false;
let demoWaypointIndex = 0;
let blockedAttempts = 0;
let lastRenderOrder: readonly string[] = [];
let previousStackSignature = "";
let toastTimer: number | undefined;

const checks: ContractChecks = {
  tiles: SOFA_TILES.every((tile) => !isTileWalkable(tile, ROOM, OCCUPIED)),
  smooth: false,
  behind: false,
  between: false,
  front: false,
};

context.imageSmoothingEnabled = false;
installEvents();
resetLab(false);
runtimeSeal.classList.add("is-ready");
runtimeStatus.textContent = "Renderer activo · contrato medible";
window.__SYKA_HABBO_LAB__ = {
  snapshot: getSnapshot,
  moveTo: (x, y) => requestMove({ x, y }),
  runDemo,
  reset: () => resetLab(true),
  setDebug: (enabled) => setDebug(enabled),
  sit: requestSeat,
};
requestAnimationFrame(frame);

function installEvents(): void {
  canvas.addEventListener("pointerdown", (event) => {
    canvas.focus();
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
    const tile = screenToTile(point);
    if (!isTileInside(tile, ROOM)) {
      showToast("Ese punto está fuera de la habitación lógica.");
      return;
    }
    requestMove(tile);
  });

  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === "e") {
      event.preventDefault();
      requestSeat();
      return;
    }
    const offset: Record<string, Tile> = {
      w: { x: 0, y: -1 },
      a: { x: -1, y: 0 },
      s: { x: 0, y: 1 },
      d: { x: 1, y: 0 },
    };
    const delta = offset[key];
    if (!delta) return;
    event.preventDefault();
    if (segment || route.length > 0) return;
    if (seated) leaveSeat();
    requestMove({ x: logicalTile.x + delta.x, y: logicalTile.y + delta.y });
  });

  demoButton.addEventListener("click", runDemo);
  seatButton.addEventListener("click", requestSeat);
  debugButton.addEventListener("click", () => setDebug(!debug));
  resetButton.addEventListener("click", () => resetLab(true));
}

function runDemo(): void {
  resetLab(false);
  demoActive = true;
  demoWaypointIndex = 0;
  showToast("Recorrido: delante → detrás → delante, siempre por tiles libres.");
  const firstWaypoint = DEMO_WAYPOINTS[demoWaypointIndex];
  if (firstWaypoint) beginPath(firstWaypoint);
}

function requestMove(target: Tile): boolean {
  if (segment || route.length > 0) {
    showToast("Esperá a que termine el tramo actual.");
    return false;
  }
  demoActive = false;
  pendingSeat = false;
  if (seated) leaveSeat();
  return beginPath(target);
}

function beginPath(target: Tile): boolean {
  if (!isTileWalkable(target, ROOM, OCCUPIED)) {
    blockedAttempts += 1;
    showToast(OCCUPIED.has(tileKey(target))
      ? "Bloqueado: ese tile pertenece a un mueble."
      : "Bloqueado: no existe un tile caminable ahí.");
    return false;
  }
  const nextRoute = findTilePath(logicalTile, target, ROOM, OCCUPIED);
  if (!nextRoute) {
    blockedAttempts += 1;
    showToast("No hay una ruta válida hasta ese tile.");
    return false;
  }
  destination = { ...target };
  route = [...nextRoute];
  if (route.length === 0) {
    onRouteComplete();
    return true;
  }
  startNextSegment(performance.now());
  return true;
}

function startNextSegment(now: number): void {
  const next = route.shift();
  if (!next) {
    segment = null;
    onRouteComplete();
    return;
  }
  const from = { ...visualPosition };
  const to = tileCenter(next);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  facing = dx - dy >= 0 ? 1 : -1;
  const diagonal = Math.abs(dx) > 0.8 && Math.abs(dy) > 0.8;
  segment = {
    from,
    to,
    target: next,
    startedAt: now,
    duration: diagonal ? 300 : 225,
  };
}

function advanceMovement(now: number): void {
  if (!segment) return;
  const progress = (now - segment.startedAt) / segment.duration;
  visualPosition = interpolate(segment.from, segment.to, progress);
  if (progress > 0.08 && progress < 0.92) checks.smooth = true;
  if (progress < 1) return;

  logicalTile = { ...segment.target };
  visualPosition = tileCenter(logicalTile);
  segment = null;
  if (route.length > 0) startNextSegment(now);
  else onRouteComplete();
}

function onRouteComplete(): void {
  destination = null;
  if (pendingSeat && sameTile(logicalTile, SOFA_APPROACH)) {
    pendingSeat = false;
    enterSeat();
    return;
  }
  if (!demoActive) return;
  demoWaypointIndex += 1;
  if (demoWaypointIndex < DEMO_WAYPOINTS.length) {
    const nextWaypoint = DEMO_WAYPOINTS[demoWaypointIndex];
    if (nextWaypoint) beginPath(nextWaypoint);
    return;
  }
  demoActive = false;
  showToast("Recorrido completo: el actor cambió de profundidad sin atravesar el sofá.");
}

function requestSeat(): void {
  if (segment || route.length > 0) {
    showToast("Terminá el movimiento antes de interactuar.");
    return;
  }
  demoActive = false;
  if (seated) {
    leaveSeat();
    showToast("La habitante volvió al tile de aproximación.");
    return;
  }
  if (sameTile(logicalTile, SOFA_APPROACH)) {
    enterSeat();
    return;
  }
  pendingSeat = true;
  if (!beginPath(SOFA_APPROACH)) pendingSeat = false;
}

function enterSeat(): void {
  seated = true;
  visualPosition = { ...SOFA_SEAT };
  checks.between = true;
  showToast("Asiento especial: actor insertado entre sofa-back y sofa-front.");
}

function leaveSeat(): void {
  seated = false;
  visualPosition = tileCenter(logicalTile);
}

function resetLab(announce: boolean): void {
  logicalTile = { ...START_TILE };
  visualPosition = tileCenter(logicalTile);
  route = [];
  segment = null;
  destination = null;
  facing = 1;
  seated = false;
  pendingSeat = false;
  demoActive = false;
  demoWaypointIndex = 0;
  blockedAttempts = 0;
  checks.smooth = false;
  checks.behind = false;
  checks.between = false;
  checks.front = true;
  if (announce) showToast("Laboratorio reiniciado.");
}

function setDebug(enabled: boolean): void {
  debug = enabled;
  debugButton.setAttribute("aria-pressed", String(enabled));
  debugButton.textContent = enabled ? "Ocultar contrato" : "Mostrar contrato";
}

function frame(now: number): void {
  advanceMovement(now);
  renderScene();
  updateReadouts();
  requestAnimationFrame(frame);
}

function renderScene(): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawBackdrop();
  drawRoomShell();
  drawFloor();
  if (debug) drawLogicalContract();

  const actorDepth = getActorDepth();
  const renderItems: RenderItem[] = [
    { id: "sofa-back", label: "Sofá · respaldo", depth: SOFA_BACK_DEPTH, draw: drawSofaBack },
    { id: "table", label: "Mesa · entidad completa", depth: 7.02, draw: drawTable },
    { id: "sofa-seat", label: "Sofá · asiento", depth: SOFA_SEAT_DEPTH, draw: drawSofaSeat },
    { id: "actor", label: seated ? "Habitante · sentada" : "Habitante", depth: actorDepth, draw: drawActor },
    { id: "sofa-front", label: "Sofá · frente", depth: SOFA_FRONT_DEPTH, draw: drawSofaFront },
  ].sort((a, b) => a.depth - b.depth);

  for (const item of renderItems) item.draw();
  lastRenderOrder = renderItems.map((item) => item.id);
  if (debug) drawDepthLabels(renderItems);
  drawTarget();
  updateRelationChecks(actorDepth);
}

function drawBackdrop(): void {
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#688b91");
  gradient.addColorStop(0.62, "#36585d");
  gradient.addColorStop(1, "#213c41");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalAlpha = 0.14;
  context.fillStyle = "#d9f1e5";
  for (let index = 0; index < 34; index += 1) {
    const x = (index * 137) % canvas.width;
    const y = 24 + ((index * 83) % 230);
    context.fillRect(x, y, 2, 2);
  }
  context.globalAlpha = 1;
}

function drawRoomShell(): void {
  const wallHeight = 2.55;
  const corner = project(0, 0, wallHeight);
  const rightTop = project(ROOM.width, 0, wallHeight);
  const rightBottom = project(ROOM.width, 0, 0);
  const leftTop = project(0, ROOM.height, wallHeight);
  const leftBottom = project(0, ROOM.height, 0);
  const groundCorner = project(0, 0, 0);

  polygon([corner, rightTop, rightBottom, groundCorner], "#bca579", "#5d4933", 3);
  polygon([corner, groundCorner, leftBottom, leftTop], "#a88e69", "#5d4933", 3);

  context.strokeStyle = "rgba(89, 67, 45, .24)";
  context.lineWidth = 1;
  for (let z = 0.45; z < wallHeight; z += 0.45) {
    line(project(0, 0, z), project(ROOM.width, 0, z));
    line(project(0, 0, z), project(0, ROOM.height, z));
  }

  drawWindow(1.15, 0.01, 1.15, "right");
  drawWindow(0.01, 1.15, 1.12, "left");
  drawWallPicture(5.9, 0.01, 1.0);
}

function drawWindow(x: number, y: number, z: number, side: "left" | "right"): void {
  const width = 1.45;
  const height = 1.05;
  const start = side === "right" ? project(x, y, z) : project(y, x, z);
  const end = side === "right" ? project(x + width, y, z) : project(y, x + width, z);
  const topStart = { x: start.x, y: start.y - height * HEIGHT_UNIT };
  const topEnd = { x: end.x, y: end.y - height * HEIGHT_UNIT };
  polygon([topStart, topEnd, end, start], "#315765", "#573f2c", 5);
  line(midpoint(topStart, start), midpoint(topEnd, end), "#d1b477", 3);
  const centerTop = midpoint(topStart, topEnd);
  const centerBottom = midpoint(start, end);
  line(centerTop, centerBottom, "#d1b477", 3);
}

function drawWallPicture(x: number, y: number, z: number): void {
  const bottomA = project(x, y, z);
  const bottomB = project(x + 0.75, y, z);
  const topA = { x: bottomA.x, y: bottomA.y - 42 };
  const topB = { x: bottomB.x, y: bottomB.y - 42 };
  polygon([topA, topB, bottomB, bottomA], "#d98656", "#493727", 4);
  const insetA = lerpPoint(topA, bottomA, 0.2);
  const insetB = lerpPoint(topB, bottomB, 0.2);
  line(insetA, insetB, "#f1c87c", 3);
}

function drawFloor(): void {
  for (let y = 0; y < ROOM.height; y += 1) {
    for (let x = 0; x < ROOM.width; x += 1) {
      const tone = (x + y) % 2 === 0 ? "#9a6b45" : "#93633f";
      drawTile({ x, y }, tone, "rgba(70, 43, 29, .42)", 1);
      const a = project(x + 0.18, y + 0.5, 0.006);
      const b = project(x + 0.82, y + 0.5, 0.006);
      line(a, b, "rgba(69, 42, 28, .28)", 1);
    }
  }

  const frontLeft = project(0, ROOM.height, 0);
  const front = project(ROOM.width, ROOM.height, 0);
  const right = project(ROOM.width, 0, 0);
  polygon([
    frontLeft,
    front,
    { x: front.x, y: front.y + 14 },
    { x: frontLeft.x, y: frontLeft.y + 14 },
  ], "#59402e", "#32261f", 2);
  polygon([
    right,
    front,
    { x: front.x, y: front.y + 14 },
    { x: right.x, y: right.y + 14 },
  ], "#4d382a", "#32261f", 2);
}

function drawLogicalContract(): void {
  for (let y = 0; y < ROOM.height; y += 1) {
    for (let x = 0; x < ROOM.width; x += 1) {
      const tile = { x, y };
      const occupied = OCCUPIED.has(tileKey(tile));
      drawTile(tile, occupied ? "rgba(219, 83, 69, .33)" : "rgba(60, 224, 176, .07)", occupied ? "#f19a75" : "rgba(137, 236, 201, .4)", occupied ? 2 : 1);
      if (occupied) drawTileLabel(tile, "SOLID", "#ffd2b7");
    }
  }
  drawAnchor(SOFA_SEAT, "SEAT", "#84e7ed");
  drawTileLabel(SOFA_APPROACH, "E", "#fff1ac");
}

function drawSofaBack(): void {
  drawIsoBox(4.02, 2.04, 5.98, 2.31, 0.28, 1.38, {
    top: "#577b68",
    faceX: "#274b43",
    faceY: "#315c50",
    outline: "#18342f",
  });

  for (let index = 0; index < 2; index += 1) {
    const x0 = 4.13 + index * 0.9;
    const x1 = x0 + 0.78;
    const lowerA = project(x0, 2.325, 0.5);
    const lowerB = project(x1, 2.325, 0.5);
    const upperA = project(x0, 2.325, 1.2);
    const upperB = project(x1, 2.325, 1.2);
    polygon([upperA, upperB, lowerB, lowerA], index === 0 ? "#416b58" : "#3b6553", "#193b32", 2);
    const button = project((x0 + x1) / 2, 2.33, 0.86);
    context.fillStyle = "#d5a864";
    context.fillRect(Math.round(button.x) - 2, Math.round(button.y) - 2, 4, 4);
  }

  const woodA = project(4, 2.02, 1.43);
  const woodB = project(6, 2.02, 1.43);
  line(woodA, woodB, "#6a3c27", 6);
  line(woodA, woodB, "#b37443", 2);
}

function drawSofaSeat(): void {
  drawIsoBox(4.08, 2.27, 5.92, 2.92, 0.28, 0.52, {
    top: "#4c745f",
    faceX: "#284c40",
    faceY: "#315744",
    outline: "#19372f",
  });
  const seamA = project(5, 2.3, 0.535);
  const seamB = project(5, 2.89, 0.535);
  line(seamA, seamB, "rgba(24, 55, 47, .75)", 2);
}

function drawSofaFront(): void {
  drawIsoBox(4, 2.79, 6, 3, 0.05, 0.42, {
    top: "#4a705b",
    faceX: "#234639",
    faceY: "#2d5343",
    outline: "#17342c",
  });
  drawIsoBox(3.98, 2.16, 4.23, 3.02, 0.08, 0.84, {
    top: "#52765f",
    faceX: "#25483b",
    faceY: "#315743",
    outline: "#17342d",
  });
  drawIsoBox(5.77, 2.16, 6.02, 3.02, 0.08, 0.84, {
    top: "#52765f",
    faceX: "#25483b",
    faceY: "#315743",
    outline: "#17342d",
  });
  line(project(4.15, 3.01, 0.14), project(5.85, 3.01, 0.14), "#b47945", 4);
}

function drawTable(): void {
  for (const [x, y] of [[2.22, 4.22], [2.72, 4.22], [2.22, 4.72], [2.72, 4.72]] as const) {
    drawIsoBox(x, y, x + 0.08, y + 0.08, 0.03, 0.61, {
      top: "#8c5c3b",
      faceX: "#4c3024",
      faceY: "#5b3828",
      outline: "#36251d",
    });
  }
  drawIsoBox(2.12, 4.12, 2.88, 4.88, 0.57, 0.69, {
    top: "#b17a4c",
    faceX: "#68452e",
    faceY: "#795039",
    outline: "#3f2b20",
  });
  const cup = project(2.46, 4.48, 0.74);
  context.fillStyle = "#ead5b1";
  context.strokeStyle = "#614835";
  context.lineWidth = 2;
  context.fillRect(Math.round(cup.x) - 5, Math.round(cup.y) - 7, 10, 7);
  context.strokeRect(Math.round(cup.x) - 5, Math.round(cup.y) - 7, 10, 7);
  context.fillStyle = "#4d382b";
  context.fillRect(Math.round(cup.x) - 3, Math.round(cup.y) - 6, 6, 2);
}

function drawActor(): void {
  const elevation = seated ? 0.36 : 0;
  const foot = project(visualPosition.x, visualPosition.y, elevation);
  const bob = segment && !seated ? Math.round(Math.sin(performance.now() / 55) * 1.4) : 0;
  const x = Math.round(foot.x);
  const y = Math.round(foot.y) + bob;

  context.save();
  context.translate(x, y);
  context.scale(facing, 1);
  context.fillStyle = "rgba(18, 29, 29, .32)";
  context.beginPath();
  context.ellipse(0, seated ? 5 : 1, seated ? 17 : 14, 6, 0, 0, Math.PI * 2);
  context.fill();

  if (seated) drawSeatedActorShape();
  else drawStandingActorShape();
  context.restore();
}

function drawStandingActorShape(): void {
  pixelRect(-12, -25, 9, 24, "#293744", "#172029");
  pixelRect(3, -25, 9, 24, "#293744", "#172029");
  pixelRect(-14, -5, 11, 5, "#d4a16c", "#3f2b25");
  pixelRect(3, -5, 11, 5, "#d4a16c", "#3f2b25");
  pixelRect(-17, -53, 34, 31, "#c85f4f", "#542e2c");
  pixelRect(-22, -49, 8, 25, "#df7862", "#542e2c");
  pixelRect(14, -49, 8, 25, "#df7862", "#542e2c");
  pixelRect(-12, -71, 25, 22, "#e2aa79", "#4c312b");
  pixelRect(-15, -76, 28, 12, "#3c2d32", "#221d22");
  pixelRect(-15, -68, 7, 11, "#3c2d32", "#221d22");
  pixelRect(3, -64, 3, 3, "#24232a");
  pixelRect(10, -50, 9, 5, "#dca476", "#4c312b");
}

function drawSeatedActorShape(): void {
  pixelRect(-15, -18, 13, 18, "#293744", "#172029");
  pixelRect(2, -18, 13, 18, "#293744", "#172029");
  pixelRect(-17, -43, 34, 28, "#c85f4f", "#542e2c");
  pixelRect(-21, -40, 8, 20, "#df7862", "#542e2c");
  pixelRect(13, -40, 8, 20, "#df7862", "#542e2c");
  pixelRect(-12, -61, 25, 22, "#e2aa79", "#4c312b");
  pixelRect(-15, -66, 28, 12, "#3c2d32", "#221d22");
  pixelRect(-15, -58, 7, 11, "#3c2d32", "#221d22");
  pixelRect(3, -54, 3, 3, "#24232a");
}

function drawTarget(): void {
  if (!destination || debug) return;
  const center = project(destination.x + 0.5, destination.y + 0.5, 0.02);
  context.strokeStyle = "#f4d17f";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(center.x, center.y, 8, 0, Math.PI * 2);
  context.stroke();
}

function drawDepthLabels(items: readonly RenderItem[]): void {
  const labels = [
    { point: project(4.08, 2.08, 1.52), label: `BACK ${SOFA_BACK_DEPTH.toFixed(2)}` },
    { point: project(5.05, 2.52, 0.72), label: `SEAT ${SEATED_ACTOR_DEPTH.toFixed(2)}` },
    { point: project(5.85, 3.02, 0.62), label: `FRONT ${SOFA_FRONT_DEPTH.toFixed(2)}` },
  ];
  context.font = "bold 10px Trebuchet MS";
  context.textBaseline = "middle";
  for (const item of labels) {
    const width = context.measureText(item.label).width + 10;
    context.fillStyle = "rgba(13, 29, 31, .88)";
    context.fillRect(item.point.x - width / 2, item.point.y - 8, width, 16);
    context.fillStyle = "#f4d196";
    context.fillText(item.label, item.point.x - width / 2 + 5, item.point.y);
  }

  context.fillStyle = "rgba(12, 27, 29, .8)";
  context.fillRect(18, 18, 255, 24);
  context.fillStyle = "#d7e3df";
  context.fillText(`STACK: ${items.map((item) => item.id).join(" → ")}`, 26, 30);
}

function updateRelationChecks(actorDepth: number): void {
  if (actorDepth < SOFA_BACK_DEPTH) checks.behind = true;
  else if (actorDepth < SOFA_FRONT_DEPTH) checks.between = true;
  else checks.front = true;
}

function updateReadouts(): void {
  const actorDepth = getActorDepth();
  const relation = getDepthRelation(actorDepth);
  logicalTileReadout.textContent = `(${logicalTile.x}, ${logicalTile.y})`;
  visualPositionReadout.textContent = `${visualPosition.x.toFixed(2)} · ${visualPosition.y.toFixed(2)}`;
  depthRelationReadout.textContent = relation === "behind" ? "Detrás" : relation === "between" ? "Entre capas" : "Delante";
  actorStateReadout.textContent = seated ? "Sentada · anchor" : segment ? "Caminando · tween" : "De pie · tile";

  const signature = lastRenderOrder.join("|");
  if (signature !== previousStackSignature) {
    previousStackSignature = signature;
    renderStack.replaceChildren(...lastRenderOrder.map((id) => {
      const item = document.createElement("li");
      const depth = depthForRenderId(id);
      item.append(document.createTextNode(labelForRenderId(id)));
      const value = document.createElement("span");
      value.textContent = `z ${depth.toFixed(2)}`;
      item.append(value);
      return item;
    }));
  }

  let score = 0;
  for (const key of Object.keys(checks) as (keyof ContractChecks)[]) {
    checkElements[key].checked = checks[key];
    if (checks[key]) score += 1;
  }
  gateScore.textContent = `${score} / 5`;
  runtimeStatus.textContent = score === 5 ? "Contrato probado · 5/5" : `Renderer activo · ${score}/5`;
}

function getSnapshot(): LabSnapshot {
  const actorDepth = getActorDepth();
  return {
    ready: true,
    actor: {
      logicalTile: { ...logicalTile },
      visualPosition: { ...visualPosition },
      depth: actorDepth,
      relation: getDepthRelation(actorDepth),
      moving: Boolean(segment || route.length > 0),
      seated,
      insideOccupiedTile: !seated && OCCUPIED.has(tileKey(logicalTile)),
    },
    pathLength: route.length + (segment ? 1 : 0),
    demoActive,
    blockedAttempts,
    checks: { ...checks },
    renderOrder: [...lastRenderOrder],
  };
}

function getActorDepth(): number {
  return seated ? SEATED_ACTOR_DEPTH : depthAt(visualPosition);
}

function getDepthRelation(depth: number): "behind" | "between" | "front" {
  if (depth < SOFA_BACK_DEPTH) return "behind";
  if (depth < SOFA_FRONT_DEPTH) return "between";
  return "front";
}

function depthForRenderId(id: string): number {
  if (id === "sofa-back") return SOFA_BACK_DEPTH;
  if (id === "table") return 7.02;
  if (id === "sofa-seat") return SOFA_SEAT_DEPTH;
  if (id === "sofa-front") return SOFA_FRONT_DEPTH;
  return getActorDepth();
}

function labelForRenderId(id: string): string {
  const labels: Record<string, string> = {
    "sofa-back": "Sofá · respaldo",
    table: "Mesa",
    "sofa-seat": "Sofá · asiento",
    actor: seated ? "Habitante · sentada" : "Habitante",
    "sofa-front": "Sofá · frente",
  };
  return labels[id] ?? id;
}

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add("is-visible");
  if (toastTimer !== undefined) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function project(x: number, y: number, z = 0): Position {
  return {
    x: ORIGIN.x + (x - y) * HALF_TILE_WIDTH,
    y: ORIGIN.y + (x + y) * HALF_TILE_HEIGHT - z * HEIGHT_UNIT,
  };
}

function screenToTile(point: Position): Tile {
  const screenX = (point.x - ORIGIN.x) / HALF_TILE_WIDTH;
  const screenY = (point.y - ORIGIN.y) / HALF_TILE_HEIGHT;
  return {
    x: Math.floor((screenX + screenY) / 2),
    y: Math.floor((screenY - screenX) / 2),
  };
}

function drawTile(tile: Tile, fill: string, stroke: string, width: number): void {
  polygon([
    project(tile.x, tile.y),
    project(tile.x + 1, tile.y),
    project(tile.x + 1, tile.y + 1),
    project(tile.x, tile.y + 1),
  ], fill, stroke, width);
}

function drawTileLabel(tile: Tile, label: string, color: string): void {
  const center = project(tile.x + 0.5, tile.y + 0.5, 0.04);
  context.font = "900 9px Trebuchet MS";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(19, 28, 28, .8)";
  context.fillRect(center.x - 19, center.y - 7, 38, 14);
  context.fillStyle = color;
  context.fillText(label, center.x, center.y);
  context.textAlign = "start";
}

function drawAnchor(position: Position, label: string, color: string): void {
  const point = project(position.x, position.y, 0.53);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(point.x, point.y, 8, 0, Math.PI * 2);
  context.stroke();
  context.font = "900 9px Trebuchet MS";
  context.fillStyle = color;
  context.fillText(label, point.x + 11, point.y);
}

function drawIsoBox(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z0: number,
  z1: number,
  colors: { readonly top: string; readonly faceX: string; readonly faceY: string; readonly outline: string },
): void {
  const p000 = project(x0, y0, z0);
  const p100 = project(x1, y0, z0);
  const p110 = project(x1, y1, z0);
  const p010 = project(x0, y1, z0);
  const p001 = project(x0, y0, z1);
  const p101 = project(x1, y0, z1);
  const p111 = project(x1, y1, z1);
  const p011 = project(x0, y1, z1);
  polygon([p100, p110, p111, p101], colors.faceX, colors.outline, 2);
  polygon([p010, p110, p111, p011], colors.faceY, colors.outline, 2);
  polygon([p001, p101, p111, p011], colors.top, colors.outline, 2);
  void p000;
}

function pixelRect(x: number, y: number, width: number, height: number, fill: string, stroke = "transparent"): void {
  context.fillStyle = stroke;
  context.fillRect(x - 2, y - 2, width + 4, height + 4);
  context.fillStyle = fill;
  context.fillRect(x, y, width, height);
}

function polygon(points: readonly Position[], fill: string, stroke: string, width: number): void {
  const first = points[0];
  if (!first) return;
  context.beginPath();
  context.moveTo(Math.round(first.x), Math.round(first.y));
  for (const point of points.slice(1)) context.lineTo(Math.round(point.x), Math.round(point.y));
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = stroke;
  context.lineWidth = width;
  context.lineJoin = "round";
  context.stroke();
}

function line(a: Position, b: Position, color = context.strokeStyle as string, width = context.lineWidth): void {
  context.beginPath();
  context.moveTo(Math.round(a.x), Math.round(a.y));
  context.lineTo(Math.round(b.x), Math.round(b.y));
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function midpoint(a: Position, b: Position): Position {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function lerpPoint(a: Position, b: Position, amount: number): Position {
  return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Falta el elemento #${id}.`);
  return element as T;
}

function requireCanvasContext(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const renderingContext = target.getContext("2d");
  if (!renderingContext) throw new Error("Canvas 2D no está disponible.");
  return renderingContext;
}
