import {
  CATALOG_SCHEMA,
  INTERIOR_SCHEMA,
  type BuildingDefinitionV1,
  type BuildingKind,
  type BuildingUpgradeDefinitionV1,
  type CatalogV1,
  type FurnitureDefinitionV1,
  type InteriorDefinitionV1,
  type ExteriorObjectDefinitionV1,
} from "./contracts";

const STANDARD_STAGES = [
  { id: "foundation", durationMinutes: 90 },
  { id: "framing", durationMinutes: 150 },
  { id: "finishing", durationMinutes: 120 },
] as const;

const makeInterior = (
  id: string,
  name: string,
  theme: string,
  furniture: ReadonlyArray<readonly [string, string]>,
  optionalSlots: ReadonlyArray<readonly [string, readonly string[]]> = [],
): InteriorDefinitionV1 => ({
  schema: INTERIOR_SCHEMA,
  id,
  name,
  theme,
  furnishedByDefault: true,
  defaultFurniture: furniture.map(([slotId, furnitureId], index) => ({
    instanceId: `${id}-default-${index + 1}`,
    furnitureId,
    slotId,
  })),
  slots: [
    ...furniture.map(([slotId, furnitureId]) => ({
      id: slotId,
      accepts: [furnitureId],
      optional: false,
    })),
    ...optionalSlots.map(([slotId, accepts]) => ({ id: slotId, accepts, optional: true })),
  ],
});

const FURNITURE: readonly FurnitureDefinitionV1[] = [
  { id: "oak-table", name: "Mesa de roble", category: "table", price: 18, slotTags: ["table"] },
  { id: "reading-chair", name: "Sillón de lectura", category: "seat", price: 22, slotTags: ["seat"] },
  { id: "bookcase", name: "Biblioteca", category: "storage", price: 24, slotTags: ["storage", "books"] },
  { id: "warm-lamp", name: "Lámpara cálida", category: "light", price: 10, slotTags: ["light"] },
  { id: "fern", name: "Helecho", category: "plant", price: 9, slotTags: ["plant"] },
  { id: "fireplace", name: "Chimenea", category: "decor", price: 30, slotTags: ["fireplace"] },
  { id: "cafe-counter", name: "Barra de cafetería", category: "workstation", price: 26, slotTags: ["cafe"] },
  { id: "work-desk", name: "Escritorio", category: "workstation", price: 20, slotTags: ["desk"] },
  { id: "notice-board", name: "Tablero comunitario", category: "decor", price: 15, slotTags: ["board"] },
] as const;

const INTERIORS: readonly InteriorDefinitionV1[] = [
  makeInterior(
    "interior-home",
    "Hogar acogedor",
    "wood-home",
    [
      ["table-main", "oak-table"],
      ["seat-main", "reading-chair"],
      ["light-main", "warm-lamp"],
    ],
    [["decor-optional", ["fern", "warm-lamp"]]],
  ),
  makeInterior(
    "interior-cafe-library",
    "Café Biblioteca",
    "warm-library-cafe",
    [
      ["counter", "cafe-counter"],
      ["table-window", "oak-table"],
      ["chair-fire", "reading-chair"],
      ["books-west", "bookcase"],
      ["fireplace", "fireplace"],
      ["lamp-counter", "warm-lamp"],
    ],
    [
      ["decor-window", ["fern", "warm-lamp"]],
      ["decor-books", ["fern", "notice-board"]],
    ],
  ),
  makeInterior(
    "interior-marketing",
    "Estudio de marketing",
    "creative-office",
    [
      ["desk-main", "work-desk"],
      ["board-main", "notice-board"],
      ["light-main", "warm-lamp"],
    ],
    [["decor-optional", ["fern", "bookcase"]]],
  ),
  makeInterior(
    "interior-commercial",
    "Oficina comercial",
    "relationship-office",
    [
      ["desk-main", "work-desk"],
      ["table-meeting", "oak-table"],
      ["light-main", "warm-lamp"],
    ],
    [["decor-optional", ["fern", "bookcase"]]],
  ),
  makeInterior(
    "interior-workshop",
    "Taller de construcción y CRM",
    "organized-workshop",
    [
      ["desk-main", "work-desk"],
      ["board-main", "notice-board"],
      ["storage-main", "bookcase"],
    ],
    [["decor-optional", ["fern", "warm-lamp"]]],
  ),
  makeInterior(
    "interior-community",
    "Casa comunitaria",
    "community-lounge",
    [
      ["table-main", "oak-table"],
      ["seat-main", "reading-chair"],
      ["board-main", "notice-board"],
    ],
    [["decor-optional", ["fern", "warm-lamp"]]],
  ),
] as const;

const building = (
  id: string,
  kind: BuildingKind,
  name: string,
  description: string,
  cost: number,
  footprint: readonly [number, number],
  interiorId: string,
  requiredTownLevel: number,
  capacity: number,
): BuildingDefinitionV1 => ({
  id,
  kind,
  name,
  description,
  cost,
  requiredTownLevel,
  footprint: { width: footprint[0], height: footprint[1] },
  entrance: { offset: { x: Math.floor(footprint[0] / 2), y: footprint[1] - 1 }, facing: "south" },
  constructionStages: STANDARD_STAGES,
  interiorId,
  capacity,
  tags: [kind, "furnished", "alpha"],
});

const BUILDINGS: readonly BuildingDefinitionV1[] = [
  building("home-cozy", "home", "Casa acogedora", "Hogar completamente amueblado.", 110, [4, 3], "interior-home", 1, 2),
  building("cafe-library", "cafe", "Café Biblioteca", "Madera, libros, chimenea y cocina cálida.", 240, [5, 4], "interior-cafe-library", 1, 8),
  building("office-marketing", "marketing-office", "Estudio de Elen", "Oficina creativa de marketing.", 190, [4, 4], "interior-marketing", 2, 4),
  building("office-commercial", "commercial-office", "Oficina de Astrelis", "Espacio comercial y de relaciones.", 190, [4, 4], "interior-commercial", 2, 4),
  building("workshop-crm", "crm-workshop", "Taller de Zerny", "Construcción, organización y CRM.", 210, [5, 4], "interior-workshop", 2, 4),
  building("hall-community", "community-hall", "Casa comunitaria", "Punto de encuentro para los cuatro habitantes.", 170, [5, 4], "interior-community", 1, 10),
] as const;

const UPGRADES: readonly BuildingUpgradeDefinitionV1[] = [
  {
    id: "cafe-reading-loft",
    name: "Altillo de lectura",
    buildingKind: "cafe",
    requiredLevel: 1,
    targetLevel: 2,
    cost: 220,
    constructionMinutes: 240,
    visualVariant: "cafe-reading-loft",
  },
] as const;

/** Alpha-v1 exterior economy. Visual keys are semantic asset names, never Phaser frame state. */
const EXTERIOR_OBJECTS: readonly ExteriorObjectDefinitionV1[] = [
  {
    id: "wildflowers",
    name: "Flores silvestres",
    description: "Un detalle bajo que puede retirarse al construir con aviso previo.",
    category: "ground-cover",
    visualKey: "flowers-cream",
    price: 4,
    removalCost: 0,
    placementRule: "grass",
    physical: false,
    removable: true,
  },
  {
    id: "shrub-round",
    name: "Arbusto redondo",
    description: "Vegetación compacta para jardines y bordes.",
    category: "shrub",
    visualKey: "shrub-round",
    price: 8,
    removalCost: 1,
    placementRule: "grass",
    physical: true,
    removable: true,
  },
  {
    id: "shrub-flowering",
    name: "Arbusto con flores",
    description: "Un arbusto físico con pequeños acentos de color.",
    category: "shrub",
    visualKey: "shrub-flowering",
    price: 10,
    removalCost: 1,
    placementRule: "grass",
    physical: true,
    removable: true,
  },
  {
    id: "hedge-short",
    name: "Seto corto",
    description: "Dos segmentos bajos para ordenar un borde verde.",
    category: "hedge",
    visualKey: "hedge-two-segment",
    price: 12,
    removalCost: 2,
    placementRule: "grass",
    physical: true,
    removable: true,
  },
  {
    id: "planter",
    name: "Jardinera",
    description: "Una jardinera de madera para pasto o borde peatonal.",
    category: "planter",
    visualKey: "planter-wood",
    price: 14,
    removalCost: 2,
    placementRule: "grass",
    physical: true,
    removable: true,
  },
  {
    id: "bench",
    name: "Banco",
    description: "Banco pequeño alineado con el camino cercano.",
    category: "street-furniture",
    visualKey: "bench",
    price: 16,
    removalCost: 0,
    placementRule: "grass-near-road",
    physical: true,
    removable: true,
  },
  {
    id: "streetlamp",
    name: "Farola",
    description: "Luz cálida compacta colocada fuera de la calzada.",
    category: "street-furniture",
    visualKey: "streetlamp",
    price: 24,
    removalCost: 0,
    placementRule: "grass-near-road",
    physical: true,
    removable: true,
    lightSource: { kind: "warm-compact", activePeriod: "night" },
  },
  {
    id: "tree-round",
    name: "Árbol redondo",
    description: "Árbol frondoso de copa redonda.",
    category: "tree",
    visualKey: "tree-round",
    price: 20,
    removalCost: 3,
    placementRule: "grass",
    physical: true,
    removable: true,
  },
  {
    id: "tree-narrow",
    name: "Árbol alto",
    description: "Árbol angosto para sumar altura sin tapar la calle.",
    category: "tree",
    visualKey: "tree-narrow",
    price: 22,
    removalCost: 3,
    placementRule: "grass",
    physical: true,
    removable: true,
  },
] as const;

export const ALPHA_CATALOG: CatalogV1 = Object.freeze({
  schema: CATALOG_SCHEMA,
  buildings: BUILDINGS,
  upgrades: UPGRADES,
  interiors: INTERIORS,
  furniture: FURNITURE,
  exteriorObjects: EXTERIOR_OBJECTS,
});

export const getBuildingDefinition = (id: string, catalog: CatalogV1 = ALPHA_CATALOG): BuildingDefinitionV1 | undefined =>
  catalog.buildings.find((definition) => definition.id === id);

export const getInteriorDefinition = (id: string, catalog: CatalogV1 = ALPHA_CATALOG): InteriorDefinitionV1 | undefined =>
  catalog.interiors.find((definition) => definition.id === id);

export const getUpgradeDefinition = (id: string, catalog: CatalogV1 = ALPHA_CATALOG): BuildingUpgradeDefinitionV1 | undefined =>
  catalog.upgrades.find((definition) => definition.id === id);

export const getFurnitureDefinition = (id: string, catalog: CatalogV1 = ALPHA_CATALOG): FurnitureDefinitionV1 | undefined =>
  catalog.furniture.find((definition) => definition.id === id);

export const getExteriorObjectDefinition = (
  id: string,
  catalog: CatalogV1 = ALPHA_CATALOG,
): ExteriorObjectDefinitionV1 | undefined => catalog.exteriorObjects.find((definition) => definition.id === id);
