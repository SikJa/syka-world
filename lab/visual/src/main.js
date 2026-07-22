import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import "./style.css";

const canvas = document.querySelector("#world");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#cddfae");
scene.fog = new THREE.Fog("#cddfae", 44, 78);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const camera = new THREE.OrthographicCamera(-24, 24, 18, -18, 0.1, 150);
camera.position.set(31, 36, 34);
camera.lookAt(0, 0, 0);
const controls = new MapControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enableRotate = true;
controls.maxPolarAngle = Math.PI / 2.35;
controls.minPolarAngle = Math.PI / 5;
controls.minZoom = 0.72;
controls.maxZoom = 2.1;
controls.screenSpacePanning = false;
controls.target.set(0, 0, 0);

const hemi = new THREE.HemisphereLight("#fff4d1", "#516653", 2.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#ffe4ad", 3.6);
sun.position.set(-22, 35, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -38;
sun.shadow.camera.right = 38;
sun.shadow.camera.top = 38;
sun.shadow.camera.bottom = -38;
sun.shadow.bias = -0.00025;
scene.add(sun);

const palette = {
  grass: "#a8c98d",
  grassDark: "#82aa7a",
  path: "#e8d9ad",
  pathEdge: "#c7b989",
  wallCream: "#f0dba9",
  wallPink: "#d9998a",
  wallBlue: "#8aa9a3",
  wallClay: "#c5785e",
  wallGold: "#d6a85f",
  roof: "#a85443",
  wood: "#795a42",
  leaf: "#527a52",
  leafLight: "#79a85d",
};

const town = new THREE.Group();
scene.add(town);
const selectable = [];
const windowMaterials = [];
const buildingRegistry = new Map();

const ground = mesh(new THREE.BoxGeometry(52, 1, 42), material(palette.grass));
ground.position.y = -0.55;
ground.receiveShadow = true;
town.add(ground);
addGroundDetails();

function mesh(geometry, mat) {
  const item = new THREE.Mesh(geometry, mat);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0, ...options });
}

function addGroundDetails() {
  const patches = new THREE.InstancedMesh(new THREE.CircleGeometry(0.08, 5), material(palette.grassDark), 260);
  patches.rotation.x = -Math.PI / 2;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 260; i++) {
    const angle = i * 2.399;
    const radius = 2.5 + ((i * 7) % 220) / 5;
    dummy.position.set(Math.cos(angle) * Math.min(radius, 24), 0.02, Math.sin(angle) * Math.min(radius * .78, 19));
    dummy.scale.setScalar(.5 + (i % 4) * .15);
    dummy.updateMatrix();
    patches.setMatrixAt(i, dummy.matrix);
  }
  patches.receiveShadow = true;
  town.add(patches);
}

function addPath(x, z, width, depth, rotation = 0) {
  const group = new THREE.Group();
  const edge = mesh(new THREE.BoxGeometry(width + .35, .1, depth + .35), material(palette.pathEdge));
  edge.position.y = .02;
  const path = mesh(new THREE.BoxGeometry(width, .12, depth), material(palette.path));
  path.position.y = .09;
  group.add(edge, path);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  town.add(group);
}

addPath(0, 0, 7.5, 36);
addPath(0, 0, 39, 6.5);
addPath(0, 11, 26, 3.2);
addPath(-12, -9, 3.2, 13);
addPath(12, -9, 3.2, 13);

function createBuilding({ id, name, kind, x, z, color, width = 7, depth = 6, height = 4.2, roof = palette.roof }) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.userData = { type: "building", id, name, kind };

  const foundation = mesh(new THREE.BoxGeometry(width + .45, .35, depth + .45), material("#d1bd8d"));
  foundation.position.y = .18;
  group.add(foundation);

  const floor = mesh(new THREE.BoxGeometry(width, .18, depth), material("#b98964"));
  floor.position.y = .42;
  group.add(floor);

  const back = mesh(new THREE.BoxGeometry(width, height, .35), material(color));
  back.position.set(0, height / 2 + .45, -depth / 2 + .18);
  const left = mesh(new THREE.BoxGeometry(.35, height, depth), material(color));
  left.position.set(-width / 2 + .18, height / 2 + .45, 0);
  const right = left.clone();
  right.position.x = width / 2 - .18;
  const frontLeft = mesh(new THREE.BoxGeometry(width * .33, height * .62, .35), material(color));
  frontLeft.position.set(-width * .335, height * .31 + .45, depth / 2 - .18);
  const frontRight = frontLeft.clone();
  frontRight.position.x = width * .335;
  group.add(back, left, right, frontLeft, frontRight);

  const roofGroup = new THREE.Group();
  const roofMat = material(roof);
  const roofMesh = mesh(new THREE.ConeGeometry(Math.max(width, depth) * .67, 2.15, 4), roofMat);
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.scale.z = depth / width;
  roofMesh.position.y = height + 1.48;
  roofGroup.add(roofMesh);
  group.add(roofGroup);
  group.userData.roof = roofGroup;

  const door = mesh(new THREE.BoxGeometry(1.25, 2.1, .22), material(palette.wood));
  door.position.set(0, 1.48, depth / 2 + .02);
  group.add(door);

  for (const side of [-1, 1]) {
    const winMat = material("#ffe39a", { emissive: "#ffb755", emissiveIntensity: .08, roughness: .35 });
    windowMaterials.push(winMat);
    const window = mesh(new THREE.BoxGeometry(1.25, 1.15, .18), winMat);
    window.position.set(side * width * .27, 2.65, depth / 2 + .03);
    group.add(window);
  }

  addInterior(group, width, depth, kind);
  addChimney(group, width, depth, height);
  town.add(group);
  selectable.push(group);
  buildingRegistry.set(id, group);
  return group;
}

function addInterior(group, width, depth, kind) {
  const deskColor = kind === "cafe" ? "#b66e50" : "#8c6a4d";
  const positions = kind === "cafe" ? [[-1.8, 0], [1.8, 0], [0, -1.45]] : [[-1.6, -1], [1.6, -1]];
  for (const [x, z] of positions) {
    const table = mesh(new THREE.BoxGeometry(1.4, .18, .8), material(deskColor));
    table.position.set(x, 1.2, z);
    const stem = mesh(new THREE.BoxGeometry(.18, .78, .18), material(palette.wood));
    stem.position.set(x, .8, z);
    group.add(table, stem);
    const chair = mesh(new THREE.BoxGeometry(.62, .55, .62), material(kind === "cafe" ? "#e7b56b" : "#6d8f7a"));
    chair.position.set(x, .8, z + .78);
    group.add(chair);
  }
  if (kind !== "cafe") {
    const screen = mesh(new THREE.BoxGeometry(.72, .52, .08), material("#314b48", { emissive: "#5bb4a0", emissiveIntensity: .2 }));
    screen.position.set(-1.6, 1.62, -.98);
    group.add(screen);
  }
  const plant = createPlant(.32, 1.2);
  plant.position.set(width / 2 - .7, .48, depth / 2 - .7);
  group.add(plant);
}

function addChimney(group, width, depth, height) {
  const chimney = mesh(new THREE.BoxGeometry(.62, 1.6, .62), material("#a96856"));
  chimney.position.set(width * .25, height + 1.2, -depth * .18);
  group.add(chimney);
}

function createPlant(scale = 1, height = 2.2) {
  const group = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(.12 * scale, .18 * scale, height * .58, 6), material("#72553b"));
  trunk.position.y = height * .29;
  group.add(trunk);
  const crown = mesh(new THREE.IcosahedronGeometry(.72 * scale, 1), material(palette.leaf));
  crown.scale.set(1, 1.25, 1);
  crown.position.y = height * .76;
  group.add(crown);
  const crown2 = mesh(new THREE.IcosahedronGeometry(.5 * scale, 1), material(palette.leafLight));
  crown2.position.set(.35 * scale, height * .86, .12 * scale);
  group.add(crown2);
  return group;
}

createBuilding({ id: "central-office", name: "Casa de ideas", kind: "work", x: -13, z: -10, color: palette.wallCream, roof: "#a55e47" });
createBuilding({ id: "marketing-studio", name: "Estudio de Elen", kind: "work", x: 13, z: -10, color: palette.wallPink, roof: "#8f5f66" });
createBuilding({ id: "commercial-office", name: "Casa comercial", kind: "work", x: -13, z: 9, color: palette.wallBlue, roof: "#4f6f68" });
createBuilding({ id: "crm-workshop", name: "Taller de Zerny", kind: "work", x: 13, z: 9, color: palette.wallClay, roof: "#8b4d3d" });
createBuilding({ id: "cafe", name: "Café Lumbre", kind: "cafe", x: 0, z: 15, color: palette.wallGold, width: 8, depth: 5.5, height: 3.7, roof: "#835644" });

function addPlaza() {
  const plaza = new THREE.Group();
  plaza.userData = { type: "building", id: "plaza", name: "Plaza de los cuatro", kind: "public" };
  const disk = mesh(new THREE.CylinderGeometry(5.3, 5.3, .18, 32), material("#dfcfa0"));
  disk.position.y = .18;
  plaza.add(disk);
  const fountainBase = mesh(new THREE.CylinderGeometry(1.2, 1.45, .55, 16), material("#839c92"));
  fountainBase.position.y = .55;
  const water = mesh(new THREE.CylinderGeometry(.95, .95, .08, 24), material("#7fc2b7", { roughness: .25 }));
  water.position.y = .86;
  plaza.add(fountainBase, water);
  for (let i = 0; i < 4; i++) {
    const bench = mesh(new THREE.BoxGeometry(1.65, .25, .55), material(palette.wood));
    const angle = i * Math.PI / 2 + Math.PI / 4;
    bench.position.set(Math.cos(angle) * 3.25, .65, Math.sin(angle) * 3.25);
    bench.rotation.y = -angle;
    plaza.add(bench);
  }
  town.add(plaza);
  selectable.push(plaza);
  buildingRegistry.set("plaza", plaza);
}
addPlaza();

for (let i = 0; i < 48; i++) {
  const angle = i * 2.399;
  const radiusX = 19 + (i % 5) * 1.2;
  const radiusZ = 14 + (i % 4) * 1.1;
  const tree = createPlant(.72 + (i % 3) * .13, 2.5 + (i % 4) * .18);
  tree.position.set(Math.cos(angle) * radiusX, 0, Math.sin(angle) * radiusZ);
  town.add(tree);
}

for (const [x, z] of [[-7,14],[7,14],[-8,-15],[8,-15],[-19,2],[19,-3],[-6,8],[6,-7]]) {
  const lamp = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(.07, .1, 2.6, 8), material("#41534a"));
  pole.position.y = 1.3;
  const glow = mesh(new THREE.SphereGeometry(.22, 10, 8), material("#ffe6a3", { emissive: "#ffc35b", emissiveIntensity: .2 }));
  glow.position.y = 2.65;
  windowMaterials.push(glow.material);
  lamp.add(pole, glow);
  lamp.position.set(x, 0, z);
  town.add(lamp);
}

const states = {
  idle: { label: "Vida libre", color: "#6c9b72", action: "Paseando sin consumir IA." },
  thinking: { label: "Pensando", color: "#5f83a8", action: "Organizando una tarea en su espacio de trabajo." },
  "using-tool": { label: "Trabajando", color: "#d39845", action: "Usando una herramienta segura." },
  waiting: { label: "Esperando", color: "#d7a536", action: "Esperando una aprobación." },
  done: { label: "Tarea terminada", color: "#4b9a68", action: "Celebrando brevemente el resultado." },
  interrupted: { label: "Interrumpido", color: "#8a8f88", action: "Reorganizando su rutina." },
  error: { label: "Problema", color: "#bb6658", action: "Se produjo un problema sin castigo." },
  offline: { label: "Desconectado", color: "#69736f", action: "Descansando fuera de línea." },
};

const agentData = [
  { id: "syka", name: "Syka", profile: "default", color: "#d56a4c", workplace: "central-office", start: [-2, 2] },
  { id: "elen", name: "Elen", profile: "elen", color: "#e3a5a8", workplace: "marketing-studio", start: [2, 2] },
  { id: "astrelis", name: "Astrelis", profile: "astrelis", color: "#4f6570", workplace: "commercial-office", start: [-2, -2] },
  { id: "zerny", name: "Zerny", profile: "zerny", color: "#db765c", workplace: "crm-workshop", start: [2, -2] },
];

const agents = new Map();
for (const data of agentData) createAgent(data);

function createAgent(data) {
  const group = new THREE.Group();
  const torso = mesh(new THREE.CapsuleGeometry(.38, .72, 4, 8), material(data.color));
  torso.position.y = 1.15;
  torso.scale.set(.82, 1, .72);
  const head = mesh(new THREE.SphereGeometry(.31, 12, 10), material("#f1c6a0"));
  head.position.y = 1.95;
  const hair = mesh(new THREE.SphereGeometry(.325, 12, 8, 0, Math.PI * 2, 0, Math.PI * .52), material(data.id === "astrelis" ? "#202927" : "#59483e"));
  hair.position.y = 2.01;
  const ringMat = new THREE.MeshBasicMaterial({ color: states.idle.color, transparent: true, opacity: .68, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.62, .74, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .06;
  group.add(ring, torso, head, hair);
  group.position.set(data.start[0], 0, data.start[1]);
  group.userData = { type: "agent", ...data, status: "idle", source: "Simulación local", sessions: 0, ring, baseY: 0 };
  town.add(group);
  selectable.push(...group.children.filter((child) => child !== ring));
  for (const child of group.children) child.userData.agentRoot = group;
  agents.set(data.id, group);
}

const roamTargets = [[-4, 0], [0, 4], [4, 0], [0, -4], [0, 12], [-7, 6], [7, -5]];
const destinationIndex = new Map(agentData.map((item, index) => [item.id, index]));
const buildingPositions = {
  "central-office": [-13, -7],
  "marketing-studio": [13, -7],
  "commercial-office": [-13, 6],
  "crm-workshop": [13, 6],
  cafe: [0, 12],
  plaza: [0, 0],
};

function setAgentState(id, status, extra = {}) {
  const agent = agents.get(id);
  if (!agent || !states[status]) return;
  Object.assign(agent.userData, { status, ...extra });
  agent.userData.ring.material.color.set(states[status].color);
  if (selected === agent || selected?.userData?.agentRoot === agent) inspect(agent);
}

// Small read-only test surface: validates every visual state without coupling
// the lab to a test framework or exposing bridge commands.
window.__sykaVisualLab = {
  stateNames: Object.keys(states),
  setAgentState: (id, status) => setAgentState(id, status),
  setWorldMinutes: (minutes) => {
    worldMinutes = ((minutes % 1440) + 1440) % 1440;
    updateTime(0);
  },
  inspectBuilding: (id) => inspect(buildingRegistry.get(id)),
  inspectAgent: (id) => inspect(agents.get(id)),
  setCamera: (position, target = [0, 0, 0], zoom = 1) => {
    camera.position.set(...position);
    controls.target.set(...target);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    controls.update();
  },
};

function destinationFor(agent) {
  const status = agent.userData.status;
  if (status === "offline") return [agent.position.x, agent.position.z];
  if (status === "idle" || ["done", "interrupted", "error"].includes(status)) {
    return roamTargets[destinationIndex.get(agent.userData.id) % roamTargets.length];
  }
  return buildingPositions[agent.userData.workplace];
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selected = null;
canvas.addEventListener("pointerup", (event) => {
  if (Math.abs(event.movementX) + Math.abs(event.movementY) > 4) return;
  pointer.x = (event.clientX / innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(selectable, true);
  if (!hits.length) return;
  const hit = hits[0].object;
  const root = hit.userData.agentRoot || findSelectableRoot(hit);
  inspect(root);
});

function findSelectableRoot(object) {
  let current = object;
  while (current.parent && !current.userData.type) current = current.parent;
  return current;
}

function inspect(item) {
  if (!item) return;
  selected = item;
  document.querySelector("#inspector").classList.add("open");
  if (item.userData.type === "agent") {
    const state = states[item.userData.status];
    document.querySelector("#inspect-kicker").textContent = `habitante · ${item.userData.profile}`;
    document.querySelector("#inspect-name").textContent = item.userData.name;
    document.querySelector("#inspect-state").textContent = state.label;
    document.querySelector("#inspect-summary").textContent = item.userData.summary || state.action;
    document.querySelector("#inspect-place").textContent = item.userData.status === "idle" ? "Ciudad" : buildingRegistry.get(item.userData.workplace)?.userData.name || "Ciudad";
    document.querySelector("#inspect-source").textContent = item.userData.source;
    document.querySelector("#inspect-sessions").textContent = `${item.userData.sessions || 0} activas`;
    document.querySelector("#state-dot").style.background = state.color;
  } else {
    document.querySelector("#inspect-kicker").textContent = item.userData.kind === "public" ? "espacio común" : "edificio inspeccionable";
    document.querySelector("#inspect-name").textContent = item.userData.name;
    document.querySelector("#inspect-state").textContent = "Disponible";
    document.querySelector("#inspect-summary").textContent = item.userData.kind === "cafe" ? "Un refugio para conversar, recuperar concentración y mirar pasar el día." : "Interior recortado con objetos que podrán personalizarse.";
    document.querySelector("#inspect-place").textContent = "Syka World";
    document.querySelector("#inspect-source").textContent = "Escena local";
    document.querySelector("#inspect-sessions").textContent = "—";
    document.querySelector("#state-dot").style.background = "#6c9b72";
    if (item.userData.roof) item.userData.roof.position.y = 2.4;
  }
}

document.querySelector("#close-inspector").addEventListener("click", () => {
  document.querySelector("#inspector").classList.remove("open");
  if (selected?.userData?.roof) selected.userData.roof.position.y = 0;
  selected = null;
});

document.querySelectorAll("[data-agent]").forEach((button) => button.addEventListener("click", () => inspect(agents.get(button.dataset.agent))));

let dataMode = "simulated";
let bridgeTimer = null;
document.querySelector("#data-button").addEventListener("click", async () => {
  if (dataMode === "simulated") {
    const ok = await pollBridge();
    if (ok) {
      dataMode = "bridge";
      document.querySelector("#data-label").textContent = "Bridge";
      document.querySelector("#data-button").classList.add("active");
      bridgeTimer = setInterval(pollBridge, 1500);
      toast("Bridge local conectado en modo lectura");
    } else toast("Bridge no disponible · seguimos con datos simulados");
  } else {
    dataMode = "simulated";
    clearInterval(bridgeTimer);
    document.querySelector("#data-label").textContent = "Simulado";
    document.querySelector("#data-button").classList.remove("active");
    for (const item of agentData) setAgentState(item.id, "idle", { source: "Simulación local", sessions: 0, summary: null });
    toast("Datos simulados activados");
  }
});

async function pollBridge() {
  try {
    const response = await fetch("/bridge/api/world/state", { cache: "no-store", signal: AbortSignal.timeout(1200) });
    if (!response.ok) return false;
    const payload = await response.json();
    for (const character of payload.characters || []) {
      let status = character.status;
      if (status === "working") status = character.activity === "using-tool" ? "using-tool" : "thinking";
      if (!states[status]) status = "idle";
      setAgentState(character.character_id, status, {
        source: character.active_source || "Bridge local",
        sessions: character.active_session_count || 0,
        summary: character.task_summary || null,
      });
    }
    return true;
  } catch { return false; }
}

let sequenceTimer = null;
document.querySelector("#sequence-button").addEventListener("click", () => {
  if (dataMode === "bridge") return toast("Cambiá a Simulado para ejecutar la secuencia");
  clearInterval(sequenceTimer);
  const order = ["idle", "thinking", "using-tool", "waiting", "thinking", "done", "interrupted", "error", "offline", "idle"];
  let index = 0;
  const advance = () => {
    const status = order[index % order.length];
    agentData.forEach((item, offset) => setAgentState(item.id, order[(index + offset) % order.length], { sessions: ["thinking", "using-tool", "waiting"].includes(order[(index + offset) % order.length]) ? 1 : 0 }));
    toast(`Secuencia visual · ${states[status].label}`);
    index += 1;
  };
  advance();
  sequenceTimer = setInterval(advance, 2600);
});

document.querySelector("#reset-button").addEventListener("click", () => {
  camera.position.set(31, 36, 34);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  toast("Vista centrada");
});

let paused = false;
document.querySelector("#time-toggle").addEventListener("click", (event) => {
  paused = !paused;
  event.currentTarget.textContent = paused ? "▶" : "Ⅱ";
  event.currentTarget.ariaLabel = paused ? "Reanudar el tiempo" : "Pausar el tiempo";
});

let toastHandle;
function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastHandle);
  toastHandle = setTimeout(() => node.classList.remove("show"), 2200);
}

const dayBackground = new THREE.Color("#cddfae");
const nightBackground = new THREE.Color("#263c49");
const dayFog = new THREE.Color("#cddfae");
const nightFog = new THREE.Color("#38515c");
let worldMinutes = 8 * 60 + 15;
let last = performance.now();
let frames = 0;
let frameWindow = performance.now();

function updateTime(delta) {
  if (!paused) worldMinutes = (worldMinutes + delta * 5.8) % 1440;
  const hour = worldMinutes / 60;
  const daylight = THREE.MathUtils.smoothstep(Math.sin(((hour - 6) / 24) * Math.PI * 2) * .5 + .5, .12, .78);
  scene.background.copy(nightBackground).lerp(dayBackground, daylight);
  scene.fog.color.copy(nightFog).lerp(dayFog, daylight);
  hemi.intensity = .55 + daylight * 1.85;
  sun.intensity = .18 + daylight * 3.42;
  sun.color.set(daylight > .4 ? "#ffe4ad" : "#9bb7d1");
  renderer.toneMappingExposure = .78 + daylight * .3;
  for (const mat of windowMaterials) mat.emissiveIntensity = .12 + (1 - daylight) * 2.4;
  const hours = Math.floor(worldMinutes / 60);
  const minutes = Math.floor(worldMinutes % 60);
  document.querySelector("#clock").textContent = `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}`;
  document.querySelector("#period").textContent = hour < 6 ? "madrugada" : hour < 12 ? "mañana" : hour < 18 ? "tarde" : "noche";
}

function updateAgents(elapsed, delta) {
  for (const agent of agents.values()) {
    const [tx, tz] = destinationFor(agent);
    const dx = tx - agent.position.x;
    const dz = tz - agent.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > .24 && agent.userData.status !== "offline") {
      const speed = Math.min(distance, delta * 1.75);
      agent.position.x += (dx / distance) * speed;
      agent.position.z += (dz / distance) * speed;
      agent.rotation.y = Math.atan2(dx, dz);
      agent.position.y = Math.abs(Math.sin(elapsed * 7 + destinationIndex.get(agent.userData.id))) * .08;
    } else {
      const state = agent.userData.status;
      const amplitude = state === "done" ? .2 : state === "using-tool" ? .07 : .025;
      agent.position.y = Math.sin(elapsed * (state === "done" ? 8 : 3) + destinationIndex.get(agent.userData.id)) * amplitude;
      if (state === "offline") agent.rotation.z = THREE.MathUtils.lerp(agent.rotation.z, Math.PI / 2, .05);
      else agent.rotation.z = THREE.MathUtils.lerp(agent.rotation.z, 0, .08);
      if (["idle", "done", "interrupted", "error"].includes(state) && distance < .3) {
        destinationIndex.set(agent.userData.id, (destinationIndex.get(agent.userData.id) + 1) % roamTargets.length);
      }
    }
    agent.userData.ring.rotation.z += delta * (agent.userData.status === "waiting" ? 2.3 : .35);
    agent.userData.ring.material.opacity = agent.userData.status === "offline" ? .22 : .68 + Math.sin(elapsed * 3) * .08;
  }
}

function resize() {
  const width = innerWidth;
  const height = innerHeight;
  renderer.setSize(width, height, false);
  const aspect = width / height;
  const view = 18;
  camera.left = -view * aspect;
  camera.right = view * aspect;
  camera.top = view;
  camera.bottom = -view;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min((now - last) / 1000, .05);
  last = now;
  const elapsed = now / 1000;
  updateTime(delta);
  updateAgents(elapsed, delta);
  controls.update();
  renderer.render(scene, camera);
  frames += 1;
  if (now - frameWindow > 1000) {
    document.querySelector("#perf").textContent = `${Math.round((frames * 1000) / (now - frameWindow))} fps · ${renderer.info.render.calls} draws`;
    frames = 0;
    frameWindow = now;
  }
}
requestAnimationFrame(animate);

setTimeout(() => inspect(agents.get("syka")), 800);
