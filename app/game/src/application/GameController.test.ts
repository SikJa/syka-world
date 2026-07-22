import { describe, expect, it, vi } from "vitest";
import {
  MemoryStorage,
  SPATIAL_SCENE_SCHEMA,
  serializeGame,
  type GridPoint,
  type SpatialSceneDefinitionV1,
} from "../core";
import { createSimulatedSnapshot, type BridgeEventListener, type BridgeVisualSnapshot } from "../integrations";
import {
  CLICK_ORDER_ARRIVAL_HOLD_MS,
  GameController,
  INTERIOR_AUTONOMY_EXIT_GRACE_MS,
} from "./GameController";

class FakeBridge {
  snapshot = createSimulatedSnapshot(new Date("2026-07-16T12:00:00Z"));
  listener: BridgeEventListener | undefined;
  snapshotListener: ((snapshot: BridgeVisualSnapshot) => void) | undefined;
  stopped = false;

  async start(): Promise<BridgeVisualSnapshot> {
    return this.snapshot;
  }

  async stop(): Promise<void> {
    this.stopped = true;
  }

  getState(): BridgeVisualSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: BridgeVisualSnapshot) => void, emitCurrent = true): () => void {
    this.snapshotListener = listener;
    if (emitCurrent) listener(this.snapshot);
    return () => {
      this.snapshotListener = undefined;
    };
  }

  subscribeEvents(listener: BridgeEventListener): () => void {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }
}

describe("GameController", () => {
  it("owns mode, deterministic ticking and manual save/load", async () => {
    const storage = new MemoryStorage();
    const bridge = new FakeBridge();
    const controller = new GameController({ mode: "progressive", storage, bridge, autoLoad: false });
    await controller.start();
    const before = controller.getSnapshot().game.clock.totalMinutes;
    controller.tick(1_000);
    expect(controller.getSnapshot().game.clock.totalMinutes).toBe(before + 1);
    expect(controller.save().ok).toBe(true);
    controller.step(30);
    expect(controller.load().ok).toBe(true);
    expect(controller.getSnapshot().game.clock.totalMinutes).toBe(before + 1);
    await controller.stop();
    expect(bridge.stopped).toBe(true);
  });

  it("routes an agent from an already-working initial Hermes snapshot without granting a reward", async () => {
    const bridge = new FakeBridge();
    bridge.snapshot = workingSnapshot(bridge.snapshot, "elen", {
      activity: "using-tool",
      animation: "using-computer",
      taskSummary: "Preparando campaña",
      toolFamily: "browser",
      dominantSessionId: "existing-session",
    });
    const controller = new GameController({
      mode: "showcase",
      storage: new MemoryStorage(),
      bridge,
      autoLoad: false,
    });
    const balanceBefore = controller.getSnapshot().game.economy.balance;
    const positionBefore = controller.getSnapshot().game.agents.find((agent) => agent.profileId === "elen")?.position;

    await controller.start();

    const routed = controller.getSnapshot().game.agents.find((agent) => agent.profileId === "elen");
    expect(routed).toMatchObject({
      activity: "using-tool",
      destinationBuildingId: "office-marketing",
      taskSummary: "Preparando campaña",
      activeSessions: [expect.objectContaining({ sessionId: "existing-session", toolFamily: "browser" })],
    });
    expect(routed?.path.length).toBeGreaterThan(1);
    expect(controller.getSnapshot().game.economy.balance).toBe(balanceBefore);

    controller.step(3);
    expect(controller.getSnapshot().game.agents.find((agent) => agent.profileId === "elen")?.position)
      .not.toEqual(positionBefore);
    expect(controller.getSnapshot().game.economy.balance).toBe(balanceBefore);
  });

  it("lets a fresh event win over the stale snapshot delivered with the same bridge callback", async () => {
    const bridge = new FakeBridge();
    const controller = new GameController({ mode: "showcase", storage: new MemoryStorage(), bridge, autoLoad: false });
    const listener = vi.fn();
    controller.subscribe(listener, false);
    await controller.start();
    bridge.listener?.(
      [
        {
          eventId: "event-1",
          occurredAt: "2026-07-16T12:00:01Z",
          profileId: "elen",
          sessionId: "session-1",
          type: "activity.started",
          source: "hermes-plugin",
          activity: "thinking",
          taskSummary: "Preparar campaña",
          toolFamily: null,
          waitingReason: null,
        },
      ],
      bridge.snapshot,
    );
    const elen = controller.getSnapshot().game.agents.find((agent) => agent.profileId === "elen");
    expect(elen?.activity).toBe("thinking");
    expect(elen?.taskSummary).toBe("Preparar campaña");
    expect(elen?.activeSessions).toEqual([
      expect.objectContaining({ sessionId: "session-1", activity: "thinking" }),
    ]);
    expect(elen?.destinationBuildingId).toBe("office-marketing");
    expect(controller.getSnapshot().game.lastBridgeEventId).toBe("event-1");
    expect(listener).toHaveBeenCalled();
  });

  it("preserves exact city camera through the isolated interior", () => {
    const controller = new GameController({ mode: "showcase", storage: new MemoryStorage(), bridge: new FakeBridge(), autoLoad: false });
    controller.panCamera({ x: 2, y: -1 });
    controller.setZoom(1.5);
    const before = controller.getSnapshot().game.camera;
    const cafe = controller.getSnapshot().game.buildings.find((building) => building.kind === "cafe");
    expect(cafe).toBeDefined();
    expect(controller.enterInterior(cafe!.id).ok).toBe(true);
    expect(controller.getSnapshot().game.camera.scene).toBe("interior");
    expect(controller.exitInterior().ok).toBe(true);
    expect(controller.getSnapshot().game.camera).toEqual({ center: before.center, zoom: before.zoom, scene: "city" });
  });

  it("can import a versioned save without browser globals", () => {
    const first = new GameController({ mode: "showcase", storage: new MemoryStorage(), bridge: new FakeBridge(), autoLoad: false });
    first.step(45);
    const serialized = serializeGame(first.getSnapshot().game, "2026-07-16T12:00:00Z");
    const second = new GameController({ mode: "progressive", storage: new MemoryStorage(), bridge: new FakeBridge(), autoLoad: false });
    expect(second.importSave(serialized).ok).toBe(true);
    expect(second.getSnapshot().game.mode).toBe("showcase");
    expect(second.getSnapshot().game.clock.totalMinutes).toBe(first.getSnapshot().game.clock.totalMinutes);
  });

  it("keeps QA currency and construction actions behind explicit development opt-in", () => {
    const normal = new GameController({
      mode: "showcase",
      storage: new MemoryStorage(),
      bridge: new FakeBridge(),
      autoLoad: false,
    });
    expect(normal.grantDevelopmentLumenes(500)).toMatchObject({
      ok: false,
      error: { code: "DEVELOPMENT_DISABLED" },
    });

    const qa = new GameController({
      mode: "showcase",
      storage: new MemoryStorage(),
      bridge: new FakeBridge(),
      autoLoad: false,
      developmentMode: true,
    });
    const balance = qa.getSnapshot().game.economy.balance;
    expect(qa.grantDevelopmentLumenes(500).ok).toBe(true);
    expect(qa.getSnapshot().game.economy.balance).toBe(balance + 500);
    expect(qa.advanceDevelopmentTime(60).ok).toBe(true);
    expect(qa.getSnapshot().game.clock.totalMinutes).toBe(60);

    const cafe = qa.getSnapshot().game.buildings.find((building) => building.kind === "cafe");
    expect(cafe).toBeDefined();
    expect(qa.startUpgrade(cafe!.id, "cafe-reading-loft").ok).toBe(true);
    expect(qa.finishDevelopmentConstruction().ok).toBe(true);
    expect(qa.getSnapshot().game.buildings.find((building) => building.id === cafe!.id)).toMatchObject({
      level: 2,
      visualVariant: "cafe-reading-loft",
    });
  });

  it("moves a possessed profile on real-time ticks while the world clock is paused", () => {
    const controller = new GameController({
      mode: "showcase",
      storage: new MemoryStorage(),
      bridge: new FakeBridge(),
      autoLoad: false,
    });
    const agent = controller.getSnapshot().game.agents.find((candidate) => candidate.profileId === "default")!;
    const adjacent = adjacentRoad(controller.getSnapshot().game.map.tiles, agent.position);
    expect(adjacent).toBeDefined();
    const key = movementKey(agent.position, adjacent!);
    const config = {
      scene: citySpatialScene(controller, "city-control"),
      binding: { kind: "city" as const },
      actors: [{ actorId: "default", sceneId: "city-control", possessible: true, cell: agent.position, facing: "south" }],
    } satisfies Parameters<GameController["configureSpatialScene"]>[0];
    expect(controller.configureSpatialScene(config).ok).toBe(true);
    expect(controller.selectProfile("default").ok).toBe(true);
    expect(controller.togglePossession().ok).toBe(true);
    controller.setClockSpeed(0);
    const clockBefore = controller.getSnapshot().game.clock.totalMinutes;

    expect(controller.movePossessed(key).ok).toBe(true);
    expect(controller.configureSpatialScene(config).ok).toBe(true);
    expect(controller.getSnapshot().control.actors[0]?.path).toHaveLength(2);
    controller.tick(160);

    expect(controller.getSnapshot().game.clock.totalMinutes).toBe(clockBefore);
    expect(controller.getSnapshot().game.agents.find((candidate) => candidate.profileId === "default")?.position)
      .toEqual(adjacent);
    expect(controller.getSnapshot().control).toMatchObject({
      selectedProfileId: "default",
      possessedProfileId: "default",
      actors: [expect.objectContaining({ actorId: "default", cell: adjacent, possessed: true })],
    });
    controller.step(60);
    expect(controller.getSnapshot().game.agents.find((candidate) => candidate.profileId === "default")?.position)
      .toEqual(adjacent);
  });

  it("holds a completed click order for exactly three seconds before resuming autonomy", () => {
    const controller = new GameController({
      mode: "showcase",
      storage: new MemoryStorage(),
      bridge: new FakeBridge(),
      autoLoad: false,
    });
    const agent = controller.getSnapshot().game.agents.find((candidate) => candidate.profileId === "default")!;
    const adjacent = adjacentRoad(controller.getSnapshot().game.map.tiles, agent.position)!;
    const scene = citySpatialScene(controller, "city-click-hold");
    expect(controller.configureSpatialScene({
      scene,
      binding: { kind: "city" },
      actors: [{ actorId: "default", sceneId: scene.id, possessible: true, cell: agent.position, facing: "south" }],
    }).ok).toBe(true);
    expect(controller.selectProfile("default").ok).toBe(true);
    controller.setClockSpeed(0);
    expect(controller.clickMove(scene.id, adjacent).ok).toBe(true);

    controller.tick(160);
    expect(controller.getSnapshot().control.actors[0]?.cell).toEqual(adjacent);
    controller.tick(CLICK_ORDER_ARRIVAL_HOLD_MS - 1);
    expect(controller.getSnapshot().control.notice?.code).not.toBe("CLICK_ORDER_COMPLETED");
    controller.tick(1);
    expect(controller.getSnapshot().control.notice).toMatchObject({
      code: "CLICK_ORDER_COMPLETED",
      message: "Destino alcanzado; la rutina retomó desde esa casilla.",
    });
    expect(controller.getSnapshot().game.agents.find((candidate) => candidate.profileId === "default")?.position)
      .toEqual(adjacent);
  });

  it("persists a real interior tile but never revives possession on load", () => {
    const storage = new MemoryStorage();
    const first = new GameController({ mode: "showcase", storage, bridge: new FakeBridge(), autoLoad: false });
    const cafe = first.getSnapshot().game.buildings.find((building) => building.kind === "cafe")!;
    expect(first.enterInterior(cafe.id).ok).toBe(true);
    expect(first.configureSpatialScene({
      scene: interiorSpatialScene("cafe-control", "city-control"),
      binding: { kind: "interior", buildingId: cafe.id },
      actors: [{ actorId: "default", sceneId: "cafe-control", possessible: true, cell: { x: 0, y: 0 }, facing: "east" }],
    }).ok).toBe(true);
    expect(first.selectProfile("default").ok).toBe(true);
    expect(first.togglePossession().ok).toBe(true);
    expect(first.movePossessed("d").ok).toBe(true);
    first.tick(160);
    expect(first.getSnapshot().game.agents.find((agent) => agent.profileId === "default")?.location)
      .toMatchObject({ kind: "interior", buildingId: cafe.id, tile: { x: 1, y: 0 } });
    expect(first.save().ok).toBe(true);

    const second = new GameController({ mode: "progressive", storage, bridge: new FakeBridge(), autoLoad: true });
    expect(second.getSnapshot().control).toMatchObject({ configured: false, actors: [] });
    expect(second.getSnapshot().game.agents.find((agent) => agent.profileId === "default")?.location)
      .toMatchObject({ kind: "interior", buildingId: cafe.id, tile: { x: 1, y: 0 } });
  });

  it("releases inside by walking to the exit before autonomy resumes outside", () => {
    const controller = new GameController({ mode: "showcase", storage: new MemoryStorage(), bridge: new FakeBridge(), autoLoad: false });
    const cafe = controller.getSnapshot().game.buildings.find((building) => building.kind === "cafe")!;
    expect(controller.enterInterior(cafe.id).ok).toBe(true);
    expect(controller.configureSpatialScene({
      scene: interiorSpatialScene("cafe-release", "city"),
      binding: { kind: "interior", buildingId: cafe.id },
      actors: [{ actorId: "default", sceneId: "cafe-release", possessible: true, cell: { x: 0, y: 0 }, facing: "south" }],
    }).ok).toBe(true);
    expect(controller.selectProfile("default").ok).toBe(true);
    expect(controller.togglePossession().ok).toBe(true);
    expect(controller.releaseLocalControl().ok).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      game: { camera: { scene: "interior" } },
      control: {
        actors: [expect.objectContaining({ actorId: "default", path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] })],
      },
    });
    expect(controller.getSnapshot().control.possessedProfileId).toBeUndefined();

    controller.tick(INTERIOR_AUTONOMY_EXIT_GRACE_MS);
    expect(controller.getSnapshot().game.camera.scene).toBe("interior");
    controller.tick(160);
    expect(controller.getSnapshot().game).toMatchObject({ camera: { scene: "city" } });
    expect(controller.getSnapshot().game.agents.find((agent) => agent.profileId === "default")).toMatchObject({
      position: cafe.accessTile,
      location: { kind: "transit", tile: cafe.accessTile },
    });
    expect(controller.getSnapshot().control.notice).toMatchObject({
      code: "CONTROL_RELEASED",
      message: "La rutina retomó desde la puerta, sin teletransporte.",
    });
  });

  it("releases local control when a real Hermes snapshot starts working", async () => {
    const bridge = new FakeBridge();
    const controller = new GameController({ mode: "showcase", storage: new MemoryStorage(), bridge, autoLoad: false });
    const agent = controller.getSnapshot().game.agents.find((candidate) => candidate.profileId === "elen")!;
    expect(controller.configureSpatialScene({
      scene: citySpatialScene(controller, "city-control"),
      binding: { kind: "city" },
      actors: [{ actorId: "elen", sceneId: "city-control", possessible: true, cell: agent.position, facing: "south" }],
    }).ok).toBe(true);
    expect(controller.selectProfile("elen").ok).toBe(true);
    expect(controller.togglePossession().ok).toBe(true);
    await controller.start();

    bridge.snapshot = workingSnapshot(bridge.snapshot, "elen", { dominantSessionId: "real-hermes" });
    bridge.snapshotListener?.(bridge.snapshot);

    expect(controller.getSnapshot().control.possessedProfileId).toBeUndefined();
    expect(controller.getSnapshot().control.notice).toMatchObject({ code: "HERMES_TAKEN_OVER" });
    expect(controller.getSnapshot().game.agents.find((candidate) => candidate.profileId === "elen")?.activeSessions)
      .toHaveLength(1);
  });

  it("crosses F portals atomically with camera and persistent location", () => {
    const controller = new GameController({ mode: "showcase", storage: new MemoryStorage(), bridge: new FakeBridge(), autoLoad: false });
    const cafe = controller.getSnapshot().game.buildings.find((building) => building.kind === "cafe")!;
    expect(controller.enterInterior(cafe.id).ok).toBe(true);
    expect(controller.configureSpatialScene({
      scene: interiorSpatialScene("cafe-control", "city-control"),
      binding: { kind: "interior", buildingId: cafe.id },
      actors: [{ actorId: "default", sceneId: "cafe-control", possessible: true, cell: { x: 1, y: 0 }, facing: "east" }],
    }).ok).toBe(true);
    expect(controller.selectProfile("default").ok).toBe(true);
    expect(controller.togglePossession().ok).toBe(true);
    const portal = controller.usePortal();
    expect(portal.ok).toBe(true);
    if (!portal.ok) return;

    expect(controller.traversePortal(portal.value, { binding: { kind: "city" }, cell: cafe.accessTile }).ok).toBe(true);
    const snapshot = controller.getSnapshot();
    expect(snapshot.game.camera.scene).toBe("city");
    expect(snapshot.game.agents.find((agent) => agent.profileId === "default")).toMatchObject({
      position: cafe.accessTile,
      location: { kind: "exterior", tile: cafe.accessTile },
    });
    expect(snapshot.control.possessedProfileId).toBe("default");
    expect(controller.configureSpatialScene({
      scene: citySpatialScene(controller, "city-control"),
      binding: { kind: "city" },
      actors: [{ actorId: "default", sceneId: "city-control", possessible: true, cell: cafe.accessTile, facing: "south" }],
    }).ok).toBe(true);
    expect(controller.getSnapshot().control).toMatchObject({
      sceneId: "city-control",
      possessedProfileId: "default",
      actors: [expect.objectContaining({ actorId: "default", cell: cafe.accessTile, possessed: true })],
    });
  });

  it("preserves possession and its in-flight step when refreshed autonomous seeds collide with its destination", () => {
    const controller = new GameController({ mode: "showcase", storage: new MemoryStorage(), bridge: new FakeBridge(), autoLoad: false });
    const agent = controller.getSnapshot().game.agents.find((candidate) => candidate.profileId === "default")!;
    const destination = adjacentRoad(controller.getSnapshot().game.map.tiles, agent.position)!;
    const scene = citySpatialScene(controller, "city-refresh");
    expect(controller.configureSpatialScene({
      scene,
      binding: { kind: "city" },
      actors: [
        { actorId: "default", sceneId: scene.id, possessible: true, cell: agent.position, facing: "south" },
        { actorId: "npc:test", sceneId: scene.id, possessible: false, cell: destination, facing: "south" },
      ],
    }).ok).toBe(true);
    expect(controller.selectProfile("default").ok).toBe(true);
    expect(controller.clickMove(scene.id, destination).ok).toBe(false); // occupied in v1

    // Move the autonomous seed away, issue the route, then refresh it back on
    // top of the controlled destination in v2.
    const spare = scene.walkableCells.find((cell) =>
      (cell.x !== destination.x || cell.y !== destination.y) &&
      (cell.x !== agent.position.x || cell.y !== agent.position.y),
    )!;
    expect(controller.configureSpatialScene({
      scene: { ...scene, version: 2 },
      binding: { kind: "city" },
      actors: [
        { actorId: "default", sceneId: scene.id, possessible: true, cell: agent.position, facing: "south" },
        { actorId: "npc:test", sceneId: scene.id, possessible: false, cell: spare, facing: "south" },
      ],
    }).ok).toBe(true);
    expect(controller.togglePossession().ok).toBe(true);
    expect(controller.movePossessed(movementKey(agent.position, destination)).ok).toBe(true);
    const routeBefore = controller.getSnapshot().control.actors.find((actor) => actor.actorId === "default")!.path;
    expect(controller.configureSpatialScene({
      scene: { ...scene, version: 3 },
      binding: { kind: "city" },
      actors: [
        { actorId: "default", sceneId: scene.id, possessible: true, cell: spare, facing: "north" },
        { actorId: "npc:test", sceneId: scene.id, possessible: false, cell: destination, facing: "south" },
      ],
    }).ok).toBe(true);

    const refreshed = controller.getSnapshot().control;
    expect(refreshed.possessedProfileId).toBe("default");
    expect(refreshed.actors.find((actor) => actor.actorId === "default")?.path).toEqual(routeBefore);
    expect(refreshed.actors.find((actor) => actor.actorId === "npc:test")?.cell).not.toEqual(destination);
    controller.tick(160);
    expect(controller.getSnapshot().control.actors.find((actor) => actor.actorId === "default")?.cell).toEqual(destination);
  });

  it("emits a repeated spatial configuration failure only once instead of recursing", () => {
    const controller = new GameController({ mode: "showcase", storage: new MemoryStorage(), bridge: new FakeBridge(), autoLoad: false });
    const agent = controller.getSnapshot().game.agents.find((candidate) => candidate.profileId === "default")!;
    const scene = citySpatialScene(controller, "invalid-refresh");
    const invalid = {
      scene,
      binding: { kind: "city" as const },
      actors: [
        { actorId: "default", sceneId: scene.id, possessible: true, cell: agent.position, facing: "south" as const },
        { actorId: "default", sceneId: scene.id, possessible: true, cell: agent.position, facing: "south" as const },
      ],
    };
    let listenerCalls = 0;
    controller.subscribe(() => {
      listenerCalls += 1;
      if (listenerCalls < 5) controller.configureSpatialScene(invalid);
    }, false);

    expect(controller.configureSpatialScene(invalid)).toMatchObject({ ok: false, error: { code: "DUPLICATE_ACTOR" } });
    expect(listenerCalls).toBe(1);
    expect(controller.configureSpatialScene(invalid)).toMatchObject({ ok: false, error: { code: "DUPLICATE_ACTOR" } });
    expect(listenerCalls).toBe(1);
  });
});

function citySpatialScene(controller: GameController, id: string): SpatialSceneDefinitionV1 {
  const map = controller.getSnapshot().game.map;
  return {
    schema: SPATIAL_SCENE_SCHEMA,
    id,
    version: 1,
    grid: map.size,
    projection: { kind: "isometric-fixed", tileWidth: 64, tileHeight: 32, origin: { x: 0, y: 0 } },
    walkableCells: map.tiles.filter((tile) => tile.terrain === "road" && !tile.buildingId).map((tile) => tile.position),
    entities: [],
    anchors: [],
    interactions: [],
    portals: [],
    entryAnchorIds: [],
    exitAnchorIds: [],
    lighting: "inherit-world-clock",
    assets: [],
  };
}

function interiorSpatialScene(id: string, targetSceneId: string): SpatialSceneDefinitionV1 {
  return {
    schema: SPATIAL_SCENE_SCHEMA,
    id,
    version: 1,
    grid: { width: 2, height: 1 },
    projection: { kind: "isometric-fixed", tileWidth: 64, tileHeight: 32, origin: { x: 0, y: 0 } },
    walkableCells: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    entities: [],
    anchors: [{ id: "exit-approach", cell: { x: 1, y: 0 }, facing: "east", reservable: true }],
    interactions: [],
    portals: [{
      id: "exit-door",
      cell: { x: 1, y: 0 },
      approachAnchorIds: ["exit-approach"],
      requiredFacing: "east",
      target: { sceneId: targetSceneId, portalId: "cafe-door" },
      enabled: true,
    }],
    entryAnchorIds: ["exit-approach"],
    exitAnchorIds: ["exit-approach"],
    lighting: "inherit-world-clock",
    assets: [],
  };
}

function adjacentRoad(
  tiles: readonly { readonly position: GridPoint; readonly terrain: string; readonly buildingId?: string }[],
  origin: GridPoint,
): GridPoint | undefined {
  return tiles.find((tile) =>
    tile.terrain === "road" &&
    !tile.buildingId &&
    Math.abs(tile.position.x - origin.x) + Math.abs(tile.position.y - origin.y) === 1,
  )?.position;
}

function movementKey(from: GridPoint, to: GridPoint): "w" | "a" | "s" | "d" {
  if (to.x > from.x) return "d";
  if (to.x < from.x) return "a";
  return to.y > from.y ? "s" : "w";
}

function workingSnapshot(
  snapshot: BridgeVisualSnapshot,
  profileId: BridgeVisualSnapshot["agents"][number]["profileId"],
  overrides: Partial<BridgeVisualSnapshot["agents"][number]> = {},
): BridgeVisualSnapshot {
  return {
    ...snapshot,
    source: "bridge",
    mode: "online",
    generatedAt: "2026-07-16T12:00:00.000Z",
    agents: snapshot.agents.map((agent) =>
      agent.profileId === profileId
        ? {
            ...agent,
            status: "working",
            activity: "thinking",
            destinationId: agent.workplaceId,
            animation: "thinking",
            taskSummary: "Tarea activa",
            presence: "online",
            activeSessionCount: 1,
            dominantSessionId: "active-session",
            lastEventId: "snapshot-event",
            updatedAt: "2026-07-16T12:00:00.000Z",
            ...overrides,
          }
        : agent,
    ),
  };
}
