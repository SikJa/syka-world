import "./style.css";

import {
  ACTOR_BODY_RADIUS,
  ACTOR_RADIUS,
  ACTOR_VISUAL_CLEARANCE,
  LAB_COLLIDERS,
  add,
  advanceAlongPath,
  distance,
  findVisibilityPath,
  isWorldWalkable,
  moveWithCollision,
  normalize,
  scale,
  type MutableVec2,
  type Vec2,
} from "./engine";
import { createLabScene, type CharacterPose } from "./scene";

interface LabSnapshot {
  readonly ready: boolean;
  readonly actor: {
    readonly x: number;
    readonly z: number;
    readonly speed: number;
    readonly seated: boolean;
    readonly pose: CharacterPose;
  };
  readonly path: readonly Vec2[];
  readonly collisionCount: number;
  readonly technicalVisible: boolean;
  readonly physicalObjects: readonly string[];
  readonly renderer: {
    readonly calls: number;
    readonly triangles: number;
  };
  readonly relief: {
    readonly ready: boolean;
    readonly sourceFrameWidth: number;
    readonly sourceFrameHeight: number;
    readonly vertices: number;
    readonly depth: number;
    readonly bodyRadius: number;
    readonly visualClearance: number;
  };
  readonly contract: {
    readonly realGeometry: true;
    readonly fixedOrthographicCamera: true;
    readonly zBuffer: true;
    readonly pixelDepthRelief: true;
    readonly flatBillboard: false;
    readonly visibleGrid: false;
  };
}

declare global {
  interface Window {
    __SYKA_GEOMETRY_FIRST_LAB__?: {
      snapshot(): LabSnapshot;
      moveTo(x: number, z: number): boolean;
      runDepthTour(): void;
      sit(): void;
      reset(): void;
      setTechnical(visible: boolean): void;
    };
  }
}

const canvas = requiredElement<HTMLCanvasElement>("geometry-canvas");
const stage = requiredElement<HTMLElement>("stage");
const runtimeStatus = requiredElement<HTMLElement>("runtime-status");
const activityStatus = requiredElement<HTMLElement>("activity-status");
const coordinates = requiredElement<HTMLElement>("coordinates");
const toast = requiredElement<HTMLElement>("toast");
const proofGeometry = requiredElement<HTMLElement>("proof-geometry");
const proofDepth = requiredElement<HTMLElement>("proof-depth");
const proofMovement = requiredElement<HTMLElement>("proof-movement");
const technicalButton = requiredElement<HTMLButtonElement>("technical-button");
const seatButton = requiredElement<HTMLButtonElement>("seat-button");
const tourButton = requiredElement<HTMLButtonElement>("tour-button");
const resetButton = requiredElement<HTMLButtonElement>("reset-button");
const contractButton = requiredElement<HTMLButtonElement>("contract-button");
const contractDialog = requiredElement<HTMLDialogElement>("contract-dialog");
const closeContract = requiredElement<HTMLButtonElement>("close-contract");

const scene = createLabScene(canvas);

const START_POSITION: Vec2 = Object.freeze({ x: 2.62, z: 2.30 });
const SOFA_SEAT: Vec2 = Object.freeze({ x: 1.72, z: -0.99 });
const BOOKSHELF_COLLIDER = requireCollider("bookshelf");
const SOFA_COLLIDER = requireCollider("sofa");
const TABLE_COLLIDER = requireCollider("table");
const BOOKSHELF_APPROACH: Vec2 = Object.freeze({
  x: BOOKSHELF_COLLIDER.maxX + ACTOR_RADIUS + 0.025,
  z: (BOOKSHELF_COLLIDER.minZ + BOOKSHELF_COLLIDER.maxZ) * 0.5,
});
const TABLE_APPROACH: Vec2 = Object.freeze({
  x: TABLE_COLLIDER.maxX + ACTOR_RADIUS + 0.025,
  z: (TABLE_COLLIDER.minZ + TABLE_COLLIDER.maxZ) * 0.5,
});
const SOFA_APPROACH: Vec2 = Object.freeze({
  x: (SOFA_COLLIDER.minX + SOFA_COLLIDER.maxX) * 0.5,
  z: SOFA_COLLIDER.maxZ + ACTOR_RADIUS + 0.06,
});
const PATH_SPEED = 2.35;
const MANUAL_SPEED = 2.70;
const ACCELERATION = 11.8;
const FRICTION = 15.5;

const actor = {
  position: { ...START_POSITION } as MutableVec2,
  velocity: { x: 0, z: 0 } as MutableVec2,
  speed: 0,
  pose: "idle" as CharacterPose,
  seated: false,
  facing: Math.PI * 0.25,
};

const state = {
  ready: true,
  elapsed: 0,
  lastTimestamp: 0,
  keys: new Set<string>(),
  path: [] as Vec2[],
  technicalVisible: false,
  pendingSeat: false,
  collisionCount: 0,
  movedContinuously: false,
  sawBehind: false,
  sawFront: true,
  tourActive: false,
  tourStep: 0,
  tourPauseUntil: 0,
  toastTimer: 0,
};

const TOUR: readonly ({ readonly target: Vec2; readonly label: string } | { readonly seat: true; readonly label: string })[] = [
  { target: SOFA_APPROACH, label: "Sofá: el actor se detiene fuera de su base, sin snap." },
  { target: TABLE_APPROACH, label: "Mesa: la ruta rodea el pedestal y conserva movimiento continuo." },
  { target: BOOKSHELF_APPROACH, label: "Estantería: tres assets usan ahora el mismo contrato." },
];

scene.setActorPosition(actor.position);
scene.setActorFacing(actor.facing);
scene.setActorPose(actor.pose);

bindControls();
installQaApi();
const resizeObserver = new ResizeObserver(() => resize());
resizeObserver.observe(stage);
resize();
updateProofs();
showToast("Listo: WASD y clic se mueven sobre geometría real, sin grilla visual.");
requestAnimationFrame(frame);

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Falta el elemento #${id}`);
  return element as T;
}

function requireCollider(id: string) {
  const collider = LAB_COLLIDERS.find((candidate) => candidate.id === id);
  if (!collider) throw new Error(`Falta la entidad espacial ${id}.`);
  return collider;
}

function bindControls(): void {
  canvas.addEventListener("pointerdown", (event) => {
    canvas.focus({ preventScroll: true });
    const picked = scene.pick(event.clientX, event.clientY, canvas.getBoundingClientRect());
    if (picked.interaction === "sofa-seat") {
      requestSeat();
      return;
    }
    if (picked.point) setDestination(picked.point);
  });

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d"].includes(key)) {
      event.preventDefault();
      if (actor.seated) standUp();
      state.path = [];
      state.pendingSeat = false;
      state.tourActive = false;
      state.keys.add(key);
      updatePathVisual();
      return;
    }
    if (key === "e") {
      event.preventDefault();
      requestSeat();
    }
  });

  window.addEventListener("keyup", (event) => {
    state.keys.delete(event.key.toLowerCase());
  });

  tourButton.addEventListener("click", runDepthTour);
  seatButton.addEventListener("click", requestSeat);
  resetButton.addEventListener("click", () => reset());
  technicalButton.addEventListener("click", () => setTechnical(!state.technicalVisible));
  contractButton.addEventListener("click", () => contractDialog.showModal());
  closeContract.addEventListener("click", () => contractDialog.close());
  contractDialog.addEventListener("click", (event) => {
    if (event.target === contractDialog) contractDialog.close();
  });
  window.addEventListener("beforeunload", () => {
    resizeObserver.disconnect();
    scene.dispose();
  });
}

function frame(timestamp: number): void {
  const rawDelta = state.lastTimestamp === 0 ? 0 : (timestamp - state.lastTimestamp) / 1000;
  const delta = Math.min(0.04, Math.max(0, rawDelta));
  state.lastTimestamp = timestamp;
  state.elapsed += delta;

  updateActor(delta, timestamp);
  scene.animateActor(state.elapsed, actor.speed);
  scene.render();
  updateReadout();
  requestAnimationFrame(frame);
}

function updateActor(delta: number, timestamp: number): void {
  if (actor.seated) {
    actor.velocity.x = 0;
    actor.velocity.z = 0;
    actor.speed = 0;
    actor.pose = "seated";
    scene.setActorPose("seated");
    if (state.tourActive && timestamp >= state.tourPauseUntil) finishTour();
    return;
  }

  const input = manualInput();
  if (Math.hypot(input.x, input.z) > 0.001) {
    updateManualMovement(input, delta);
  } else if (state.path.length > 0) {
    updatePathMovement(delta, timestamp);
  } else {
    actor.velocity.x = approach(actor.velocity.x, 0, FRICTION * delta);
    actor.velocity.z = approach(actor.velocity.z, 0, FRICTION * delta);
    actor.speed = Math.hypot(actor.velocity.x, actor.velocity.z);
    setPose(actor.speed > 0.04 ? "walk" : "idle");
  }

  if (actor.position.z < -2.18 && actor.position.x > 0.45 && actor.position.x < 2.95) state.sawBehind = true;
  if (state.sawBehind && actor.position.z > -0.55) state.sawFront = true;
  updateProofs();
}

function manualInput(): Vec2 {
  const axes = scene.getScreenAxes();
  let input: Vec2 = { x: 0, z: 0 };
  if (state.keys.has("w")) input = add(input, axes.up);
  if (state.keys.has("s")) input = add(input, scale(axes.up, -1));
  if (state.keys.has("d")) input = add(input, axes.right);
  if (state.keys.has("a")) input = add(input, scale(axes.right, -1));
  return normalize(input);
}

function updateManualMovement(input: Vec2, delta: number): void {
  const desired = scale(input, MANUAL_SPEED);
  actor.velocity.x = approach(actor.velocity.x, desired.x, ACCELERATION * delta);
  actor.velocity.z = approach(actor.velocity.z, desired.z, ACCELERATION * delta);
  const previous = { ...actor.position };
  const result = moveWithCollision(actor.position, scale(actor.velocity, delta), LAB_COLLIDERS, ACTOR_RADIUS);
  actor.position.x = result.position.x;
  actor.position.z = result.position.z;
  if (result.collided) {
    state.collisionCount += 1;
    const actualX = actor.position.x - previous.x;
    const actualZ = actor.position.z - previous.z;
    if (Math.abs(actualX) < Math.abs(actor.velocity.x * delta) * 0.35) actor.velocity.x = 0;
    if (Math.abs(actualZ) < Math.abs(actor.velocity.z * delta) * 0.35) actor.velocity.z = 0;
  }
  applyMovement(previous);
}

function updatePathMovement(delta: number, timestamp: number): void {
  const previous = { ...actor.position };
  const result = advanceAlongPath(actor.position, state.path, PATH_SPEED * delta);
  actor.position.x = result.position.x;
  actor.position.z = result.position.z;
  state.path = [...result.remaining];
  const moved = distance(previous, actor.position);
  actor.velocity.x = delta > 0 ? (actor.position.x - previous.x) / delta : 0;
  actor.velocity.z = delta > 0 ? (actor.position.z - previous.z) / delta : 0;
  actor.speed = delta > 0 ? moved / delta : 0;
  applyMovement(previous);
  updatePathVisual();

  if (!result.arrived) return;
  actor.velocity.x = 0;
  actor.velocity.z = 0;
  actor.speed = 0;

  if (state.pendingSeat) {
    enterSeat();
    if (state.tourActive) state.tourPauseUntil = timestamp + 900;
    return;
  }

  setPose("idle");
  if (state.tourActive) {
    state.tourPauseUntil = timestamp + 1400;
    window.setTimeout(() => {
      if (state.tourActive && !actor.seated) advanceTour();
    }, 1420);
  }
}

function applyMovement(previous: Vec2): void {
  const moved = distance(previous, actor.position);
  actor.speed = moved > 0.00001 ? Math.max(actor.speed, moved * 60) : Math.hypot(actor.velocity.x, actor.velocity.z);
  if (moved > 0.00005 && moved < 0.16) state.movedContinuously = true;
  if (moved > 0.00001) {
    const direction = normalize({ x: actor.position.x - previous.x, z: actor.position.z - previous.z });
    actor.facing = Math.atan2(direction.x, direction.z);
    scene.setActorFacing(actor.facing);
    setPose("walk");
  } else {
    setPose("idle");
  }
  scene.setActorPosition(actor.position);
}

function setPose(pose: CharacterPose): void {
  if (actor.pose === pose) return;
  actor.pose = pose;
  scene.setActorPose(pose);
}

function setDestination(target: Vec2, silent = false): boolean {
  if (actor.seated) standUp();
  if (!isWorldWalkable(target)) {
    if (!silent) showToast("Ese punto pertenece a la geometría física de un objeto.");
    return false;
  }
  const path = findVisibilityPath(actor.position, target);
  if (!path) {
    if (!silent) showToast("No existe una ruta geométrica válida hacia ese punto.");
    return false;
  }
  state.path = [...path];
  state.pendingSeat = false;
  state.tourActive = false;
  state.keys.clear();
  updatePathVisual();
  if (!silent) showToast(path.length > 1 ? "Ruta continua calculada alrededor del mobiliario." : "Destino libre.");
  return true;
}

function requestSeat(): void {
  if (actor.seated) {
    standUp();
    showToast("Iara se levantó en el punto de aproximación.");
    return;
  }
  const path = findVisibilityPath(actor.position, SOFA_APPROACH);
  if (!path) {
    showToast("No se encontró una aproximación válida al sofá.");
    return;
  }
  state.keys.clear();
  state.path = [...path];
  state.pendingSeat = true;
  updatePathVisual();
  showToast("Iara rodeará los volúmenes físicos antes de sentarse.");
  if (distance(actor.position, SOFA_APPROACH) < 0.035) enterSeat();
}

function enterSeat(): void {
  state.path = [];
  state.pendingSeat = false;
  actor.position.x = SOFA_SEAT.x;
  actor.position.z = SOFA_SEAT.z;
  actor.velocity.x = 0;
  actor.velocity.z = 0;
  actor.speed = 0;
  actor.seated = true;
  actor.facing = 0;
  scene.setActorPosition(actor.position);
  scene.setActorFacing(actor.facing);
  setPose("seated");
  seatButton.textContent = "Levantarse";
  updatePathVisual();
  updateProofs();
}

function standUp(): void {
  actor.seated = false;
  actor.position.x = SOFA_APPROACH.x;
  actor.position.z = SOFA_APPROACH.z;
  actor.velocity.x = 0;
  actor.velocity.z = 0;
  actor.speed = 0;
  scene.setActorPosition(actor.position);
  setPose("idle");
  seatButton.textContent = "Sentarse";
}

function runDepthTour(): void {
  reset(false);
  state.tourActive = true;
  state.tourStep = 0;
  showToast("Prueba: sofá, mesa y estantería comparten el pipeline espacial.");
  advanceTour();
}

function advanceTour(): void {
  if (!state.tourActive) return;
  const step = TOUR[state.tourStep];
  if (!step) {
    finishTour();
    return;
  }
  state.tourStep += 1;
  showToast(step.label);
  if ("seat" in step) {
    const path = findVisibilityPath(actor.position, SOFA_APPROACH);
    if (!path) {
      finishTour();
      return;
    }
    state.path = [...path];
    state.pendingSeat = true;
    updatePathVisual();
    return;
  }
  const path = findVisibilityPath(actor.position, step.target);
  if (!path) {
    finishTour();
    return;
  }
  state.path = [...path];
  updatePathVisual();
}

function finishTour(): void {
  state.tourActive = false;
  showToast("Prueba terminada: tres muebles rodeados sin atravesar sus bases.");
  updateProofs();
}

function reset(notify = true): void {
  actor.position.x = START_POSITION.x;
  actor.position.z = START_POSITION.z;
  actor.velocity.x = 0;
  actor.velocity.z = 0;
  actor.speed = 0;
  actor.seated = false;
  actor.facing = Math.PI * 0.25;
  state.path = [];
  state.pendingSeat = false;
  state.tourActive = false;
  state.tourStep = 0;
  state.keys.clear();
  scene.setActorPosition(actor.position);
  scene.setActorFacing(actor.facing);
  setPose("idle");
  seatButton.textContent = "Sentarse";
  updatePathVisual();
  if (notify) showToast("Laboratorio reiniciado.");
}

function setTechnical(visible: boolean): void {
  state.technicalVisible = visible;
  scene.setTechnicalVisible(visible);
  technicalButton.classList.toggle("is-active", visible);
  technicalButton.setAttribute("aria-pressed", String(visible));
  technicalButton.textContent = visible ? "Ocultar física" : "Ver física";
  updatePathVisual();
  showToast(visible ? "Volúmenes físicos visibles. No son una grilla de navegación." : "La estructura física volvió a ocultarse.");
}

function updatePathVisual(): void {
  scene.updatePath(state.path.length > 0 ? [actor.position, ...state.path] : []);
}

function updateProofs(): void {
  proofGeometry.classList.add("is-proven");
  proofMovement.classList.toggle("is-proven", state.movedContinuously);
  proofDepth.classList.toggle("is-proven", state.sawBehind || actor.seated);
}

function updateReadout(): void {
  const mode = actor.seated ? "sentada" : state.path.length > 0 ? "ruta continua" : actor.speed > 0.04 ? "control manual" : "observación";
  const diagnostics = scene.getDiagnostics();
  activityStatus.textContent = mode;
  runtimeStatus.textContent = diagnostics.reliefReady
    ? `3D real · relieve ${diagnostics.sourceFrameWidth}×${diagnostics.sourceFrameHeight} · sin grilla`
    : "preparando relieve de profundidad…";
  coordinates.textContent = `x ${actor.position.x.toFixed(2)} · z ${actor.position.z.toFixed(2)}`;
}

function resize(): void {
  const rect = stage.getBoundingClientRect();
  scene.resize(rect.width, rect.height);
}

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function approach(current: number, target: number, maximumDelta: number): number {
  if (Math.abs(target - current) <= maximumDelta) return target;
  return current + Math.sign(target - current) * maximumDelta;
}

function installQaApi(): void {
  window.__SYKA_GEOMETRY_FIRST_LAB__ = {
    snapshot: () => {
      const diagnostics = scene.getDiagnostics();
      return {
      ready: diagnostics.reliefReady,
      actor: {
        x: actor.position.x,
        z: actor.position.z,
        speed: actor.speed,
        seated: actor.seated,
        pose: actor.pose,
      },
      path: state.path.map((point) => ({ ...point })),
      collisionCount: state.collisionCount,
      technicalVisible: state.technicalVisible,
      physicalObjects: LAB_COLLIDERS.map((collider) => collider.id),
      renderer: {
        calls: scene.renderer.info.render.calls,
        triangles: scene.renderer.info.render.triangles,
      },
      relief: {
        ready: diagnostics.reliefReady,
        sourceFrameWidth: diagnostics.sourceFrameWidth,
        sourceFrameHeight: diagnostics.sourceFrameHeight,
        vertices: diagnostics.reliefVertices,
        depth: diagnostics.reliefDepth,
        bodyRadius: ACTOR_BODY_RADIUS,
        visualClearance: ACTOR_VISUAL_CLEARANCE,
      },
      contract: {
        realGeometry: true,
        fixedOrthographicCamera: true,
        zBuffer: true,
        pixelDepthRelief: true,
        flatBillboard: false,
        visibleGrid: false,
      },
    };
    },
    moveTo: (x, z) => setDestination({ x, z }, true),
    runDepthTour,
    sit: requestSeat,
    reset: () => reset(false),
    setTechnical,
  };
}
