import {
  AGENT_SCHEMA,
  BALANCE_VERSION,
  GAME_STATE_SCHEMA,
  MAP_SCHEMA,
  NPC_SCHEMA,
  SAVE_SCHEMA,
  WORLD_OBJECT_SCHEMA,
  type GameStateV1,
  type LegacySaveV0,
  type Result,
  type SaveGameV1,
} from "./contracts";
import { reconcileAgentBindings } from "./agents";
import { CAFE_NPC_ANCHOR_IDS, CAFE_NPC_IDS, createCafeNpcs } from "./npcs";
import type { KeyValueStorage } from "./storage";

export interface SaveError {
  readonly code: "INVALID_JSON" | "UNSUPPORTED_SCHEMA" | "INVALID_SAVE" | "STORAGE_ERROR" | "NOT_FOUND";
  readonly message: string;
  readonly issues?: readonly string[];
}

export interface LoadedGame {
  readonly save: SaveGameV1;
  readonly migratedFrom?: string;
  readonly recoveredFromTemporary: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finiteInteger = (value: unknown): value is number => Number.isSafeInteger(value);

const validPoint = (value: unknown): value is Record<"x" | "y", number> =>
  isRecord(value) && finiteInteger(value.x) && finiteInteger(value.y);

const tileAt = (map: unknown, point: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(map) || !Array.isArray(map.tiles) || !validPoint(point)) return undefined;
  return map.tiles.find((candidate): candidate is Record<string, unknown> =>
    isRecord(candidate) &&
    validPoint(candidate.position) &&
    candidate.position.x === point.x &&
    candidate.position.y === point.y,
  );
};

const sameStoredPoint = (left: unknown, right: unknown): boolean =>
  validPoint(left) && validPoint(right) && left.x === right.x && left.y === right.y;

const storedBorderPoint = (map: unknown, point: unknown): boolean => {
  if (!isRecord(map) || !isRecord(map.size) || !finiteInteger(map.size.width) || !finiteInteger(map.size.height) || !validPoint(point)) {
    return false;
  }
  return point.x === 0 || point.y === 0 || point.x === map.size.width - 1 || point.y === map.size.height - 1;
};

const legacyMilestones = (buildings: unknown): readonly string[] => {
  if (!Array.isArray(buildings)) return [];
  const keys: string[] = [];
  for (const item of buildings) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    if (item.status === "complete") keys.push(`building:${item.id}`);
    if (Array.isArray(item.installedUpgrades)) {
      for (const upgrade of item.installedUpgrades) {
        if (typeof upgrade === "string") keys.push(`upgrade:${item.id}:${upgrade}`);
      }
    }
  }
  return keys;
};

/** Explicit deterministic upgrade for pre-mechanics v1 saves. */
const normalizeMechanicsState = (value: unknown): { readonly value: unknown; readonly migrated: boolean } => {
  if (!isRecord(value)) return { value, migrated: false };
  let migrated = false;
  let normalized: Record<string, unknown> = { ...value };
  const savedTotalMinute = isRecord(value.clock) && finiteInteger(value.clock.totalMinutes)
    ? value.clock.totalMinutes
    : 0;
  if (!Array.isArray(value.worldObjects)) {
    normalized.worldObjects = [];
    migrated = true;
  }
  if (!Array.isArray(value.npcs)) {
    normalized.npcs = createCafeNpcs(savedTotalMinute);
    migrated = true;
  } else {
    const npcs = value.npcs.map((npc) => {
      if (!isRecord(npc) || finiteInteger(npc.lastRoutineTotalMinute)) return npc;
      migrated = true;
      return { ...npc, lastRoutineTotalMinute: savedTotalMinute };
    });
    normalized.npcs = npcs;
  }
  if (isRecord(value.progression) && !Array.isArray(value.progression.rewardedMilestones)) {
    normalized.progression = {
      ...value.progression,
      rewardedMilestones: legacyMilestones(value.buildings),
    };
    migrated = true;
  }
  if (Array.isArray(value.agents)) {
    const agents = value.agents.map((agent) => {
      if (!isRecord(agent) || isRecord(agent.location)) return agent;
      const position = isRecord(agent.position) ? agent.position : { x: 0, y: 0 };
      const traveling = Array.isArray(agent.path) && agent.path.length > 1;
      migrated = true;
      return {
        ...agent,
        location: traveling
          ? {
              kind: "transit",
              tile: position,
              destinationBuildingId: typeof agent.destinationBuildingId === "string" ? agent.destinationBuildingId : "",
            }
          : { kind: "exterior", tile: position },
      };
    });
    normalized = { ...normalized, agents };
  }
  return { value: normalized, migrated };
};

export const validateGameState = (value: unknown): readonly string[] => {
  const issues: string[] = [];
  if (!isRecord(value)) return ["game must be an object"];
  if (value.schema !== GAME_STATE_SCHEMA) issues.push("game schema is unsupported");
  if (value.balanceVersion !== BALANCE_VERSION) issues.push("balance version is unsupported");
  if (value.mode !== "showcase" && value.mode !== "progressive") issues.push("game mode is invalid");

  const map = value.map;
  if (!isRecord(map) || map.schema !== MAP_SCHEMA) {
    issues.push("map schema is invalid");
  } else {
    const size = map.size;
    if (!isRecord(size) || !finiteInteger(size.width) || !finiteInteger(size.height) || size.width < 1 || size.height < 1) {
      issues.push("map dimensions are invalid");
    }
    if (!Array.isArray(map.tiles)) {
      issues.push("map tiles are missing");
    } else if (isRecord(size) && finiteInteger(size.width) && finiteInteger(size.height) && map.tiles.length !== size.width * size.height) {
      issues.push("map tile count does not match dimensions");
    }
    if (!Array.isArray(map.sectors)) issues.push("map sectors are missing");
  }

  if (!Array.isArray(value.buildings)) issues.push("buildings must be an array");
  if (!Array.isArray(value.interiors)) issues.push("interiors must be an array");
  if (!Array.isArray(value.worldObjects)) {
    issues.push("worldObjects must be an array");
  } else {
    const ids: string[] = [];
    const hostTiles: string[] = [];
    for (const object of value.worldObjects) {
      if (
        !isRecord(object) ||
        object.schema !== WORLD_OBJECT_SCHEMA ||
        typeof object.instanceId !== "string" ||
        object.instanceId.length < 1 ||
        typeof object.definitionId !== "string" ||
        !validPoint(object.hostTile) ||
        !["north", "east", "south", "west"].includes(object.orientation as string) ||
        object.placementState !== "placed" ||
        typeof object.removable !== "boolean" ||
        !["seeded", "player"].includes(object.provenance as string)
      ) continue;
      ids.push(object.instanceId);
      hostTiles.push(`${object.hostTile.x},${object.hostTile.y}`);
      const tile = tileAt(map, object.hostTile);
      if (!tile || tile.terrain !== "grass" || tile.buildingId !== undefined) {
        issues.push(`world object ${object.instanceId} host tile is invalid`);
      }
      if (
        object.lightSource !== undefined &&
        (!isRecord(object.lightSource) ||
          object.lightSource.kind !== "warm-compact" ||
          object.lightSource.activePeriod !== "night")
      ) {
        issues.push(`world object ${object.instanceId} light source is invalid`);
      }
    }
    if (ids.length !== value.worldObjects.length) issues.push("every world object requires a valid schema and id");
    if (new Set(ids).size !== ids.length) issues.push("world object ids must be unique");
    if (new Set(hostTiles).size !== hostTiles.length) issues.push("world object host tiles must be unique");
  }
  if (Array.isArray(value.buildings)) {
    const ids = value.buildings.flatMap((item) => (isRecord(item) && typeof item.id === "string" ? [item.id] : []));
    if (ids.length !== value.buildings.length) issues.push("every building requires an id");
    if (new Set(ids).size !== ids.length) issues.push("building ids must be unique");
    if (isRecord(map) && Array.isArray(map.tiles)) {
      for (const item of value.buildings) {
        if (!isRecord(item) || typeof item.id !== "string" || !Array.isArray(item.occupiedTiles)) continue;
        for (const occupied of item.occupiedTiles) {
          if (!isRecord(occupied) || !finiteInteger(occupied.x) || !finiteInteger(occupied.y)) continue;
          const tile = map.tiles.find((candidate) =>
            isRecord(candidate) &&
            isRecord(candidate.position) &&
            candidate.position.x === occupied.x &&
            candidate.position.y === occupied.y,
          );
          if (!isRecord(tile) || tile.terrain !== "grass") {
            issues.push(`building ${item.id} footprint is not on buildable terrain`);
            break;
          }
        }
      }
    }
  }

  const economy = value.economy;
  if (
    !isRecord(economy) ||
    !finiteInteger(economy.balance) ||
    economy.balance < 0 ||
    !finiteInteger(economy.earned) ||
    !finiteInteger(economy.spent) ||
    !finiteInteger(economy.lastLocalRewardTotalMinute)
  ) {
    issues.push("economy is invalid");
  }
  const progression = value.progression;
  if (
    !isRecord(progression) ||
    !finiteInteger(progression.townLevel) ||
    !finiteInteger(progression.townXp) ||
    !Array.isArray(progression.unlockedBuildingIds) ||
    !Array.isArray(progression.rewardedMilestones)
  ) {
    issues.push("progression is invalid");
  }
  const clock = value.clock;
  if (
    !isRecord(clock) ||
    !finiteInteger(clock.day) ||
    !finiteInteger(clock.minuteOfDay) ||
    clock.minuteOfDay < 0 ||
    clock.minuteOfDay >= 1_440 ||
    !finiteInteger(clock.totalMinutes)
  ) {
    issues.push("clock is invalid");
  }
  const camera = value.camera;
  if (!isRecord(camera) || !isRecord(camera.center) || ![1, 1.5, 2].includes(camera.zoom as number)) {
    issues.push("camera is invalid");
  }
  if (!Array.isArray(value.agents)) {
    issues.push("agents must be an array");
  } else {
    const profiles = value.agents.flatMap((agent) =>
      isRecord(agent) && agent.schema === AGENT_SCHEMA && typeof agent.profileId === "string" ? [agent.profileId] : [],
    );
    if (profiles.length !== value.agents.length) issues.push("every agent requires a valid schema and profile");
    if (new Set(profiles).size !== profiles.length) issues.push("agent profiles must be unique");
    const localActions = ["sit", "read", "serve-coffee", "warm-fireplace"];
    const localPhases = ["traveling", "entering", "acting", "staying"];
    for (const agent of value.agents) {
      if (!isRecord(agent) || !validPoint(agent.position) || !isRecord(agent.location)) {
        issues.push("every agent requires a persistent location");
        continue;
      }
      const exteriorTile = tileAt(map, agent.position);
      if (!exteriorTile || exteriorTile.terrain !== "road") {
        issues.push(`agent ${String(agent.profileId)} exterior position is invalid`);
      }
      const location = agent.location;
      if (location.kind === "exterior" || location.kind === "transit") {
        if (!validPoint(location.tile) || !sameStoredPoint(location.tile, agent.position)) {
          issues.push(`agent ${String(agent.profileId)} location tile is invalid`);
        }
        if (location.kind === "transit" && typeof location.destinationBuildingId !== "string") {
          issues.push(`agent ${String(agent.profileId)} transit destination is invalid`);
        }
      } else if (location.kind === "interior") {
        const building = Array.isArray(value.buildings)
          ? value.buildings.find((candidate) =>
              isRecord(candidate) && candidate.id === location.buildingId && candidate.status === "complete",
            )
          : undefined;
        const interior = Array.isArray(value.interiors)
          ? value.interiors.find((candidate) => isRecord(candidate) && candidate.buildingId === location.buildingId)
          : undefined;
        if (
          typeof location.buildingId !== "string" ||
          !building ||
          !interior ||
          typeof location.anchorId !== "string" ||
          location.anchorId.length < 1 ||
          location.anchorId.length > 80 ||
          (location.tile !== undefined && !validPoint(location.tile)) ||
          (location.action !== undefined && !localActions.includes(location.action as string))
        ) {
          issues.push(`agent ${String(agent.profileId)} interior location is invalid`);
        }
      } else {
        issues.push(`agent ${String(agent.profileId)} location kind is invalid`);
      }
      if (agent.localOrder !== undefined) {
        const order = agent.localOrder;
        const target = isRecord(order) && Array.isArray(value.buildings)
          ? value.buildings.find((candidate) =>
              isRecord(candidate) &&
              candidate.id === order.targetBuildingId &&
              candidate.kind === "cafe" &&
              candidate.status === "complete",
            )
          : undefined;
        if (
          !isRecord(order) ||
          order.kind !== "go-to-cafe" ||
          !target ||
          !localActions.includes(order.action as string) ||
          !localPhases.includes(order.phase as string) ||
          !finiteInteger(order.issuedAtTotalMinute) ||
          (order.phaseUntilTotalMinute !== undefined && !finiteInteger(order.phaseUntilTotalMinute))
        ) {
          issues.push(`agent ${String(agent.profileId)} local order is invalid`);
        } else if (
          order.phase !== "traveling" &&
          (location.kind !== "interior" || location.buildingId !== order.targetBuildingId)
        ) {
          issues.push(`agent ${String(agent.profileId)} local order location is inconsistent`);
        }
      }
    }
  }
  if (!Array.isArray(value.npcs)) {
    issues.push("npcs must be an array");
  } else {
    const ids: string[] = [];
    const occupiedAnchors: string[] = [];
    let scheduledCount = 0;
    const activities = ["idle", "walking", "working", "social"];
    const routines = ["offstage", "serving", "brewing", "baking", "illustrating", "reading", "delivering"];
    for (const npc of value.npcs) {
      if (
        !isRecord(npc) ||
        npc.schema !== NPC_SCHEMA ||
        typeof npc.id !== "string" ||
        !CAFE_NPC_IDS.includes(npc.id as (typeof CAFE_NPC_IDS)[number]) ||
        typeof npc.name !== "string" ||
        npc.name.length < 1 ||
        typeof npc.role !== "string" ||
        npc.role.length < 1 ||
        typeof npc.visualKey !== "string" ||
        npc.visualKey.length < 1 ||
        !activities.includes(npc.activity as string) ||
        !routines.includes(npc.routine as string) ||
        !isRecord(npc.location) ||
        !finiteInteger(npc.lastRoutineTotalMinute) ||
        npc.lastRoutineTotalMinute < 0 ||
        (isRecord(clock) && finiteInteger(clock.totalMinutes) && npc.lastRoutineTotalMinute > clock.totalMinutes) ||
        "profileId" in npc ||
        "activeSessions" in npc ||
        "taskSummary" in npc
      ) {
        issues.push("every npc requires a valid local-only contract");
        continue;
      }
      ids.push(npc.id);
      const location = npc.location;
      if (location.kind === "offstage") {
        if (npc.routine !== "offstage" || npc.activity !== "idle") {
          issues.push(`npc ${npc.id} offstage routine is inconsistent`);
        }
        continue;
      }
      if (location.kind !== "interior" && location.kind !== "transit") {
        issues.push(`npc ${npc.id} location kind is invalid`);
        continue;
      }
      const cafeBuildingId = location.kind === "interior" ? location.buildingId : location.cafeBuildingId;
      const building = Array.isArray(value.buildings)
        ? value.buildings.find((candidate) =>
            isRecord(candidate) &&
            candidate.id === cafeBuildingId &&
            candidate.kind === "cafe" &&
            candidate.status === "complete",
          )
        : undefined;
      const interior = Array.isArray(value.interiors)
        ? value.interiors.find((candidate) => isRecord(candidate) && candidate.buildingId === cafeBuildingId)
        : undefined;
      if (!building || !interior) {
        issues.push(`npc ${npc.id} cafe destination is invalid`);
        continue;
      }
      if (location.kind === "transit") {
        const path = location.path;
        const validPath =
          validPoint(location.tile) &&
          validPoint(location.destination) &&
          Array.isArray(path) &&
          path.length > 0 &&
          path.every((point) => validPoint(point) && tileAt(map, point)?.terrain === "road") &&
          sameStoredPoint(path[0], location.tile) &&
          sameStoredPoint(path[path.length - 1], location.destination) &&
          path.every((point, index) => {
            if (index === 0) return true;
            const previous = path[index - 1];
            return validPoint(previous) && validPoint(point) &&
              Math.abs(previous.x - point.x) + Math.abs(previous.y - point.y) === 1;
          });
        if (
          !validPath ||
          (location.direction !== "arriving" && location.direction !== "departing") ||
          npc.activity !== "walking" ||
          (location.direction === "arriving" && npc.routine === "offstage") ||
          (location.direction === "departing" && npc.routine !== "offstage") ||
          (location.direction === "arriving" && !sameStoredPoint(location.destination, building.accessTile)) ||
          (location.direction === "departing" && !storedBorderPoint(map, location.destination))
        ) {
          issues.push(`npc ${npc.id} transit route is invalid`);
          continue;
        }
        if (location.direction === "arriving") scheduledCount += 1;
        continue;
      }
      if (
        typeof location.buildingId !== "string" ||
        typeof location.anchorId !== "string" ||
        !CAFE_NPC_ANCHOR_IDS.includes(location.anchorId as (typeof CAFE_NPC_ANCHOR_IDS)[number]) ||
        npc.routine === "offstage"
      ) {
        issues.push(`npc ${npc.id} interior location is invalid`);
        continue;
      }
      scheduledCount += 1;
      occupiedAnchors.push(`${location.buildingId}:${location.anchorId}`);
    }
    if (ids.length !== CAFE_NPC_IDS.length || CAFE_NPC_IDS.some((id) => !ids.includes(id))) {
      issues.push("the five fixed cafe npcs are required");
    }
    if (new Set(ids).size !== ids.length) issues.push("npc ids must be unique");
    if (scheduledCount > 3) issues.push("at most three cafe npcs may be active");
    if (new Set(occupiedAnchors).size !== occupiedAnchors.length) issues.push("active npc anchors must be unique");
  }
  if (typeof value.agentsVisible !== "boolean") issues.push("agentsVisible must be boolean");
  return issues;
};

const validateAndCreateSave = (
  value: unknown,
): Result<{ readonly save: SaveGameV1; readonly migrated: boolean }, SaveError> => {
  if (!isRecord(value) || value.schema !== SAVE_SCHEMA) {
    return { ok: false, error: { code: "UNSUPPORTED_SCHEMA", message: "Save schema is not supported." } };
  }
  if (typeof value.savedAt !== "string" || Number.isNaN(Date.parse(value.savedAt))) {
    return { ok: false, error: { code: "INVALID_SAVE", message: "Save timestamp is invalid." } };
  }
  const normalized = normalizeMechanicsState(value.game);
  const issues = validateGameState(normalized.value);
  if (issues.length > 0) {
    return { ok: false, error: { code: "INVALID_SAVE", message: "Save validation failed.", issues } };
  }
  const game = reconcileAgentBindings(normalized.value as GameStateV1);
  return {
    ok: true,
    value: { save: { schema: SAVE_SCHEMA, savedAt: value.savedAt, game }, migrated: normalized.migrated },
  };
};

const migrateLegacyV0 = (value: LegacySaveV0): Result<SaveGameV1, SaveError> => {
  const normalized = normalizeMechanicsState(value.state);
  const issues = validateGameState(normalized.value);
  if (issues.length > 0) {
    return { ok: false, error: { code: "INVALID_SAVE", message: "Legacy save cannot be migrated.", issues } };
  }
  return {
    ok: true,
    value: {
      schema: SAVE_SCHEMA,
      savedAt: value.savedAt && !Number.isNaN(Date.parse(value.savedAt)) ? value.savedAt : new Date(0).toISOString(),
      game: reconcileAgentBindings(normalized.value as GameStateV1),
    },
  };
};

export const serializeGame = (game: GameStateV1, savedAt = new Date().toISOString()): string => {
  const issues = validateGameState(game);
  if (issues.length > 0) throw new Error(`Cannot serialize invalid game state: ${issues.join("; ")}`);
  const save: SaveGameV1 = { schema: SAVE_SCHEMA, savedAt, game };
  return JSON.stringify(save);
};

export const deserializeGame = (serialized: string): Result<LoadedGame, SaveError> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    return { ok: false, error: { code: "INVALID_JSON", message: "Save is not valid JSON." } };
  }
  if (isRecord(parsed) && parsed.schema === "syka.world.save.v0") {
    const migrated = migrateLegacyV0(parsed as unknown as LegacySaveV0);
    return migrated.ok
      ? { ok: true, value: { save: migrated.value, migratedFrom: "syka.world.save.v0", recoveredFromTemporary: false } }
      : migrated;
  }
  const validated = validateAndCreateSave(parsed);
  return validated.ok
    ? {
        ok: true,
        value: {
          save: validated.value.save,
          ...(validated.value.migrated ? { migratedFrom: "syka.world.game-state.v1.pre-mechanics" } : {}),
          recoveredFromTemporary: false,
        },
      }
    : validated;
};

const temporaryKey = (key: string): string => `${key}.tmp`;

export const saveGameToStorage = (
  storage: KeyValueStorage,
  key: string,
  game: GameStateV1,
  savedAt = new Date().toISOString(),
): Result<void, SaveError> => {
  try {
    const serialized = serializeGame(game, savedAt);
    storage.setItem(temporaryKey(key), serialized);
    storage.setItem(key, serialized);
    storage.removeItem(temporaryKey(key));
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: { code: "STORAGE_ERROR", message: error instanceof Error ? error.message : "Storage write failed." },
    };
  }
};

export const loadGameFromStorage = (storage: KeyValueStorage, key: string): Result<LoadedGame, SaveError> => {
  let primary: string | null;
  let temporary: string | null;
  try {
    primary = storage.getItem(key);
    temporary = storage.getItem(temporaryKey(key));
  } catch (error) {
    return {
      ok: false,
      error: { code: "STORAGE_ERROR", message: error instanceof Error ? error.message : "Storage read failed." },
    };
  }
  if (primary !== null) {
    const loaded = deserializeGame(primary);
    if (loaded.ok) return loaded;
    if (temporary === null) return loaded;
  }
  if (temporary !== null) {
    const recovered = deserializeGame(temporary);
    return recovered.ok
      ? { ok: true, value: { ...recovered.value, recoveredFromTemporary: true } }
      : recovered;
  }
  return { ok: false, error: { code: "NOT_FOUND", message: "No saved game exists." } };
};

export const removeGameFromStorage = (storage: KeyValueStorage, key: string): Result<void, SaveError> => {
  try {
    storage.removeItem(key);
    storage.removeItem(temporaryKey(key));
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: { code: "STORAGE_ERROR", message: error instanceof Error ? error.message : "Storage removal failed." },
    };
  }
};
