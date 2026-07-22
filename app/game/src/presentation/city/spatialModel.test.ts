import { describe, expect, it } from "vitest";
import {
  ALPHA_CATALOG,
  WORLD_OBJECT_SCHEMA,
  compileSpatialScene,
  createManualControlState,
  computePlacementGeometry,
  createBlankGameState,
  createProgressiveGameState,
  createShowcaseGameState,
  getBuildingDefinition,
  isSpatialCellWalkable,
  occupyBuildingTiles,
  paintTerrain,
  spatialEntityBlockedCells,
  spatialPointKey,
  validateSpatialScene,
  type BuildingInstanceV1,
  type GameStateV1,
  type GridPoint,
  type WorldObjectInstanceV1,
} from "../../core";
import {
  cityBuildingAccessAnchorId,
  cityBuildingEntityId,
  cityBuildingPortalId,
  cityInteriorExitPortalId,
  cityInteriorSceneId,
  createCitySpatialModel,
  createCitySpatialActorSeeds,
  createCitySpatialSceneDefinition,
} from "./spatialModel";

const pointKeys = (points: readonly GridPoint[]): readonly string[] =>
  points.map(spatialPointKey).sort();

const compiledCity = (state: GameStateV1) => {
  const model = createCitySpatialModel(state);
  const compiled = compileSpatialScene(model.definition);
  if (!compiled.ok) throw new Error(compiled.error.issues.map((issue) => issue.message).join("; "));
  return { model, scene: compiled.value };
};

describe("city spatial scene derivation", () => {
  it("uses roads as the only walkable floor and exact persisted building footprints as blockers", () => {
    const state = createShowcaseGameState();
    const definition = createCitySpatialSceneDefinition(state);

    expect(validateSpatialScene(definition)).toEqual([]);
    expect(pointKeys(definition.walkableCells)).toEqual(pointKeys(
      state.map.tiles
        .filter((tile) => tile.terrain === "road" && tile.buildingId === undefined)
        .map((tile) => tile.position),
    ));
    expect(definition.entities.filter((entity) => entity.kind === "building")).toHaveLength(state.buildings.length);

    for (const building of state.buildings) {
      const entity = definition.entities.find((candidate) => candidate.id === cityBuildingEntityId(building.id));
      expect(entity).toBeDefined();
      if (!entity) continue;
      expect(pointKeys(spatialEntityBlockedCells(entity))).toEqual(pointKeys(building.occupiedTiles));
    }
  });

  it("creates an access interaction and an F portal only for every complete building", () => {
    const showcase = createShowcaseGameState();
    const cafe = showcase.buildings.find((building) => building.kind === "cafe");
    expect(cafe).toBeDefined();
    if (!cafe) return;
    const state: GameStateV1 = {
      ...showcase,
      buildings: showcase.buildings.map((building) =>
        building.id === cafe.id ? { ...building, status: "framing" as const } : building,
      ),
    };
    const definition = createCitySpatialSceneDefinition(state);
    const anchor = definition.anchors.find((candidate) => candidate.id === cityBuildingAccessAnchorId(cafe.id));
    const interaction = definition.interactions.find((candidate) =>
      candidate.entityId === cityBuildingEntityId(cafe.id),
    );

    expect(anchor).toMatchObject({ cell: cafe.accessTile, entityId: cityBuildingEntityId(cafe.id), reservable: true });
    expect(interaction).toMatchObject({ action: "inspect-construction", anchorIds: [anchor?.id] });
    expect(definition.portals.some((portal) => portal.id === cityBuildingPortalId(cafe.id))).toBe(false);

    const complete = cafe;
    const completeDefinition = createCitySpatialSceneDefinition(showcase);
    const portal = completeDefinition.portals.find((candidate) => candidate.id === cityBuildingPortalId(complete.id));
    expect(portal).toMatchObject({
      cell: complete.entranceTile,
      approachAnchorIds: [cityBuildingAccessAnchorId(complete.id)],
      target: {
        sceneId: cityInteriorSceneId(complete.id),
        portalId: cityInteriorExitPortalId(complete.id),
      },
      enabled: true,
    });
    expect(completeDefinition.portals.every((candidate) => candidate.target.sceneId.startsWith("cafe:"))).toBe(true);
  });

  it("preserves an east-oriented catalog footprint instead of flattening its physical cells", () => {
    const definition = getBuildingDefinition("home-cozy");
    expect(definition).toBeDefined();
    if (!definition) return;
    const origin = { x: 3, y: 2 };
    const geometry = computePlacementGeometry(definition, origin, "east");
    const totalMinutes = definition.constructionStages.reduce((total, stage) => total + stage.durationMinutes, 0);
    const building: BuildingInstanceV1 = {
      id: "rotated-home",
      definitionId: definition.id,
      kind: definition.kind,
      origin,
      orientation: "east",
      occupiedTiles: geometry.occupiedTiles,
      entranceTile: geometry.entranceTile,
      accessTile: geometry.accessTile,
      status: "complete",
      construction: {
        elapsedMinutes: totalMinutes,
        totalMinutes,
        stageIndex: definition.constructionStages.length,
      },
      level: 1,
      visualVariant: definition.id,
      installedUpgrades: [],
      interiorId: definition.interiorId,
    };
    let state = createBlankGameState({ mode: "progressive", width: 12, height: 12 });
    state = {
      ...state,
      map: occupyBuildingTiles(paintTerrain(state.map, [building.accessTile], "road"), building),
      buildings: [building],
    };
    const city = createCitySpatialSceneDefinition(state);
    const entity = city.entities.find((candidate) => candidate.id === cityBuildingEntityId(building.id));

    expect(validateSpatialScene(city)).toEqual([]);
    expect(entity?.orientation).toBe("east");
    expect(entity?.footprint).toEqual(definition.footprint);
    expect(entity && pointKeys(spatialEntityBlockedCells(entity))).toEqual(pointKeys(geometry.occupiedTiles));
  });

  it("models persistent exterior objects and blocks only physical definitions", () => {
    let state = createBlankGameState({ mode: "progressive", width: 8, height: 8 });
    state = {
      ...state,
      map: paintTerrain(state.map, Array.from({ length: 8 }, (_, x) => ({ x, y: 5 })), "road"),
    };
    const objects: readonly WorldObjectInstanceV1[] = [
      {
        schema: WORLD_OBJECT_SCHEMA,
        instanceId: "flowers-test",
        definitionId: "wildflowers",
        hostTile: { x: 2, y: 4 },
        orientation: "south",
        placementState: "placed",
        removable: true,
        provenance: "player",
      },
      {
        schema: WORLD_OBJECT_SCHEMA,
        instanceId: "tree-test",
        definitionId: "tree-round",
        hostTile: { x: 4, y: 4 },
        orientation: "south",
        placementState: "placed",
        removable: true,
        provenance: "player",
      },
    ];
    const definition = createCitySpatialSceneDefinition({ ...state, worldObjects: objects }, ALPHA_CATALOG);
    const flowers = definition.entities.find((entity) => entity.id.endsWith("flowers-test"));
    const tree = definition.entities.find((entity) => entity.id.endsWith("tree-test"));

    expect(validateSpatialScene(definition)).toEqual([]);
    expect(flowers && spatialEntityBlockedCells(flowers)).toEqual([]);
    expect(tree && spatialEntityBlockedCells(tree)).toEqual([{ x: 4, y: 4 }]);
    expect(definition.interactions.find((interaction) => interaction.entityId === tree?.id)?.anchorIds).toHaveLength(1);
  });
});

describe("city actor occupancy", () => {
  it("reserves agents and NPCs while the queried actor never blocks itself", () => {
    const progressive = createProgressiveGameState();
    const agentSeed = progressive.agents.find((agent) => agent.id === "syka");
    const npcSeed = progressive.npcs[0];
    expect(agentSeed).toBeDefined();
    expect(npcSeed).toBeDefined();
    if (!agentSeed || !npcSeed) return;
    const agent = {
      ...agentSeed,
      position: { x: 4, y: 8 },
      location: { kind: "exterior" as const, tile: { x: 4, y: 8 } },
      destination: { x: 5, y: 8 },
      path: [{ x: 4, y: 8 }, { x: 5, y: 8 }],
    };
    const npc = {
      ...npcSeed,
      activity: "walking" as const,
      location: {
        kind: "transit" as const,
        tile: { x: 7, y: 8 },
        destination: { x: 8, y: 8 },
        path: [{ x: 7, y: 8 }, { x: 8, y: 8 }],
        cafeBuildingId: "cafe-test",
        direction: "arriving" as const,
      },
    };
    const state: GameStateV1 = { ...progressive, agents: [agent], npcs: [npc] };
    const { model, scene } = compiledCity(state);

    expect(model.occupancy.reservations).toEqual(expect.arrayContaining([
      expect.objectContaining({ actorId: "syka", kind: "current", cell: { x: 4, y: 8 } }),
      expect.objectContaining({ actorId: "syka", kind: "destination", cell: { x: 5, y: 8 } }),
      expect.objectContaining({ actorId: npc.id, kind: "current", cell: { x: 7, y: 8 } }),
      expect.objectContaining({ actorId: npc.id, kind: "destination", cell: { x: 8, y: 8 } }),
    ]));
    expect(isSpatialCellWalkable(scene, { x: 4, y: 8 }, model.occupancy)).toBe(false);
    expect(isSpatialCellWalkable(scene, { x: 4, y: 8 }, model.occupancy, "syka")).toBe(true);
    expect(isSpatialCellWalkable(scene, { x: 7, y: 8 }, model.occupancy, "syka")).toBe(false);
  });

  it("uses profile ids for possessible seeds and keeps NPC ids separate", () => {
    const state = createShowcaseGameState();
    const seeds = createCitySpatialActorSeeds(state);
    expect(seeds.some((seed) => seed.actorId === "default" && seed.possessible)).toBe(true);
    expect(seeds.filter((seed) => seed.possessible).every((seed) => !seed.actorId.startsWith("npc:"))).toBe(true);
    const compiled = compileSpatialScene(createCitySpatialSceneDefinition(state));
    expect(compiled.ok).toBe(true);
    if (compiled.ok) expect(createManualControlState(compiled.value, seeds).ok).toBe(true);
  });
});
