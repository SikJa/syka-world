import type { CardinalDirection, GridPoint, Result } from "./contracts";
import {
  EMPTY_SPATIAL_OCCUPANCY,
  findSpatialPath,
  isSpatialCellWalkable,
  releaseSpatialActor,
  reserveSpatialActor,
  resolveSpatialInteraction,
  resolveSpatialPortal,
  sameSpatialPoint,
  spatialPointKey,
  type SpatialActorReservationV1,
  type SpatialInteractionResolutionV1,
  type SpatialOccupancyV1,
  type SpatialPortalResolutionV1,
  type SpatialSceneIndexV1,
} from "./spatial";

export type ScreenRelativeMovementKey = "w" | "a" | "s" | "d" | "W" | "A" | "S" | "D";

export type ManualActorIntent = "autonomous" | "manual-click" | "possessed" | "interaction" | "hold";

export interface PendingSpatialInteractionV1 {
  readonly interactionId: string;
  readonly action: string;
  readonly anchorId: string;
}

export interface ManualSpatialActorV1 {
  readonly actorId: string;
  readonly sceneId: string;
  readonly possessible: boolean;
  readonly cell: GridPoint;
  readonly facing: CardinalDirection;
  /** Remaining path always starts at `cell`. */
  readonly path: readonly GridPoint[];
  readonly destination?: GridPoint | undefined;
  readonly intent: ManualActorIntent;
  readonly pendingInteraction?: PendingSpatialInteractionV1 | undefined;
}

export interface ManualSpatialActorSeedV1 {
  readonly actorId: string;
  readonly sceneId: string;
  readonly possessible: boolean;
  readonly cell: GridPoint;
  readonly facing: CardinalDirection;
}

/** Ephemeral local-control state. Active possession is intentionally not part of GameState/save. */
export interface ManualControlStateV1 {
  readonly actors: readonly ManualSpatialActorV1[];
  readonly occupancy: SpatialOccupancyV1;
  readonly selectedActorId?: string;
  readonly possessedActorId?: string;
}

export interface ReconcileManualControlOptionsV1 {
  /** Actors under local control keep their in-flight route when the scene version refreshes. */
  readonly preserveActorIds?: readonly string[];
}

export type ManualControlErrorCode =
  | "DUPLICATE_ACTOR"
  | "UNKNOWN_ACTOR"
  | "NO_SELECTED_ACTOR"
  | "NOT_POSSESSIBLE"
  | "NO_POSSESSED_ACTOR"
  | "POSSESSION_ACTIVE"
  | "MOVE_IN_PROGRESS"
  | "INVALID_DESTINATION"
  | "DESTINATION_OCCUPIED"
  | "NO_PATH"
  | "RESERVATION_FAILED"
  | "STEP_BLOCKED"
  | "NO_REACHABLE_INTERACTION"
  | "NO_PORTAL_IN_FRONT";

export interface ManualControlError {
  readonly code: ManualControlErrorCode;
  readonly message: string;
}

export interface ManualPortalRequestV1 {
  readonly actorId: string;
  readonly portal: SpatialPortalResolutionV1;
}

export interface ManualInteractionRequestV1 {
  readonly state: ManualControlStateV1;
  readonly interaction: SpatialInteractionResolutionV1;
}

const keyDirection: Readonly<Record<Lowercase<ScreenRelativeMovementKey>, CardinalDirection>> = {
  w: "north",
  a: "west",
  s: "south",
  d: "east",
};

const directionOffset: Readonly<Record<CardinalDirection, GridPoint>> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

/**
 * Fixed-camera isometric controls: W/S move along the north/south grid axis;
 * A/D use west/east. Each key requests exactly one cardinal neighbour.
 */
export const screenRelativeDirectionForKey = (key: ScreenRelativeMovementKey): CardinalDirection =>
  keyDirection[key.toLowerCase() as Lowercase<ScreenRelativeMovementKey>];

export const screenRelativeNeighbourForKey = (
  cell: GridPoint,
  key: ScreenRelativeMovementKey,
): GridPoint => {
  const offset = directionOffset[screenRelativeDirectionForKey(key)];
  return { x: cell.x + offset.x, y: cell.y + offset.y };
};

const actorById = (state: ManualControlStateV1, actorId: string): ManualSpatialActorV1 | undefined =>
  state.actors.find((actor) => actor.actorId === actorId);

const replaceActor = (
  state: ManualControlStateV1,
  replacement: ManualSpatialActorV1,
  occupancy = state.occupancy,
): ManualControlStateV1 => ({
  ...state,
  occupancy,
  actors: state.actors.map((actor) => actor.actorId === replacement.actorId ? replacement : actor),
});

const currentReservation = (
  actor: ManualSpatialActorV1,
  anchorId?: string,
): SpatialActorReservationV1 => ({
  actorId: actor.actorId,
  kind: "current",
  cell: actor.cell,
  ...(anchorId ? { anchorId } : {}),
});

export const createManualControlState = (
  scene: SpatialSceneIndexV1,
  seeds: readonly ManualSpatialActorSeedV1[],
): Result<ManualControlStateV1, ManualControlError> => {
  const ids = seeds.map((seed) => seed.actorId);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: { code: "DUPLICATE_ACTOR", message: "Manual actors require unique ids." } };
  }
  let occupancy = EMPTY_SPATIAL_OCCUPANCY;
  const actors: ManualSpatialActorV1[] = [];
  for (const seed of seeds) {
    const actor: ManualSpatialActorV1 = {
      ...seed,
      path: [seed.cell],
      intent: "autonomous",
    };
    const reserved = reserveSpatialActor(scene, occupancy, currentReservation(actor));
    if (!reserved.ok) {
      return { ok: false, error: { code: "RESERVATION_FAILED", message: reserved.error.message } };
    }
    occupancy = reserved.value;
    actors.push(actor);
  }
  return { ok: true, value: { actors, occupancy } };
};

const isBaseWalkable = (scene: SpatialSceneIndexV1, cell: GridPoint): boolean =>
  isSpatialCellWalkable(scene, cell, EMPTY_SPATIAL_OCCUPANCY);

const isCardinalStep = (from: GridPoint, to: GridPoint): boolean =>
  Math.abs(from.x - to.x) + Math.abs(from.y - to.y) === 1;

const canPreserveActorRoute = (
  scene: SpatialSceneIndexV1,
  actor: ManualSpatialActorV1,
): boolean =>
  actor.path.length > 0 &&
  sameSpatialPoint(actor.path[0]!, actor.cell) &&
  actor.path.every((cell) => isBaseWalkable(scene, cell)) &&
  actor.path.slice(1).every((cell, index) => isCardinalStep(actor.path[index]!, cell));

const deterministicFreeCell = (
  scene: SpatialSceneIndexV1,
  occupancy: SpatialOccupancyV1,
  preferred: GridPoint,
  actorId: string,
  excludedKeys: ReadonlySet<string> = new Set(),
): GridPoint | undefined =>
  [...scene.definition.walkableCells]
    .filter((cell) => !excludedKeys.has(spatialPointKey(cell)))
    .filter((cell) => isSpatialCellWalkable(scene, cell, occupancy, actorId))
    .sort((left, right) =>
      (Math.abs(left.x - preferred.x) + Math.abs(left.y - preferred.y)) -
        (Math.abs(right.x - preferred.x) + Math.abs(right.y - preferred.y)) ||
      left.y - right.y ||
      left.x - right.x,
    )[0];

/**
 * Rebuilds occupancy for a refreshed scene without throwing away active local
 * movement. Locally-controlled actors are authoritative; refreshed autonomous
 * seeds are placed afterwards and deterministically moved away from the
 * controlled route/current/destination cells. An autonomous actor is omitted
 * only when the refreshed scene has no free cell at all.
 */
export const reconcileManualControlState = (
  scene: SpatialSceneIndexV1,
  previous: ManualControlStateV1,
  seeds: readonly ManualSpatialActorSeedV1[],
  options: ReconcileManualControlOptionsV1 = {},
): Result<ManualControlStateV1, ManualControlError> => {
  const seedIds = seeds.map((seed) => seed.actorId);
  if (new Set(seedIds).size !== seedIds.length) {
    return { ok: false, error: { code: "DUPLICATE_ACTOR", message: "Manual actors require unique ids." } };
  }

  const previousById = new Map(previous.actors.map((actor) => [actor.actorId, actor]));
  const preserveIds = new Set(options.preserveActorIds ?? []);
  const controlledSeeds = seeds
    .filter((seed) => preserveIds.has(seed.actorId))
    .sort((left, right) => left.actorId.localeCompare(right.actorId));
  const autonomousSeeds = seeds
    .filter((seed) => !preserveIds.has(seed.actorId))
    .sort((left, right) => left.actorId.localeCompare(right.actorId));
  const actorsById = new Map<string, ManualSpatialActorV1>();
  const protectedRouteKeys = new Set<string>();
  let occupancy = EMPTY_SPATIAL_OCCUPANCY;

  for (const seed of controlledSeeds) {
    const previousActor = previousById.get(seed.actorId);
    const preferred = previousActor?.cell ?? seed.cell;
    const cell = deterministicFreeCell(scene, occupancy, preferred, seed.actorId);
    if (!cell) {
      return {
        ok: false,
        error: { code: "RESERVATION_FAILED", message: `No free spatial cell remains for controlled actor ${seed.actorId}.` },
      };
    }
    const preservesRoute = previousActor !== undefined &&
      sameSpatialPoint(cell, previousActor.cell) &&
      canPreserveActorRoute(scene, previousActor);
    const actor: ManualSpatialActorV1 = preservesRoute
      ? { ...previousActor, sceneId: scene.definition.id }
      : {
          ...seed,
          sceneId: scene.definition.id,
          cell,
          path: [cell],
          destination: cell,
          intent: previous.possessedActorId === seed.actorId ? "possessed" : "hold",
        };
    const current = reserveSpatialActor(scene, occupancy, currentReservation(actor));
    if (!current.ok) {
      return { ok: false, error: { code: "RESERVATION_FAILED", message: current.error.message } };
    }
    occupancy = current.value;
    actorsById.set(seed.actorId, actor);
  }

  // Destination reservations are restored before autonomous actors are placed,
  // so a moved seed can never steal an active local destination.
  for (const seed of controlledSeeds) {
    const actor = actorsById.get(seed.actorId)!;
    if (actor.path.length <= 1) {
      protectedRouteKeys.add(spatialPointKey(actor.cell));
      continue;
    }
    const destination = actor.path[actor.path.length - 1]!;
    const reserved = reserveSpatialActor(scene, occupancy, {
      actorId: actor.actorId,
      kind: "destination",
      cell: destination,
    });
    if (!reserved.ok) {
      const stationary: ManualSpatialActorV1 = {
        ...actor,
        path: [actor.cell],
        destination: actor.cell,
        intent: previous.possessedActorId === actor.actorId ? "possessed" : "hold",
        pendingInteraction: undefined,
      };
      actorsById.set(actor.actorId, stationary);
      protectedRouteKeys.add(spatialPointKey(actor.cell));
      continue;
    }
    occupancy = reserved.value;
    for (const cell of actor.path) protectedRouteKeys.add(spatialPointKey(cell));
  }

  for (const seed of autonomousSeeds) {
    const cell = deterministicFreeCell(scene, occupancy, seed.cell, seed.actorId, protectedRouteKeys);
    if (!cell) continue;
    const actor: ManualSpatialActorV1 = {
      ...seed,
      sceneId: scene.definition.id,
      cell,
      path: [cell],
      intent: "autonomous",
    };
    const current = reserveSpatialActor(scene, occupancy, currentReservation(actor));
    if (!current.ok) continue;
    occupancy = current.value;
    actorsById.set(seed.actorId, actor);
  }

  const actors = seeds.flatMap((seed) => {
    const actor = actorsById.get(seed.actorId);
    return actor ? [actor] : [];
  });
  const selectedActorId = previous.selectedActorId && actorsById.has(previous.selectedActorId)
    ? previous.selectedActorId
    : undefined;
  const possessedActorId = previous.possessedActorId && actorsById.has(previous.possessedActorId)
    ? previous.possessedActorId
    : undefined;
  return {
    ok: true,
    value: {
      actors,
      occupancy,
      ...(selectedActorId ? { selectedActorId } : {}),
      ...(possessedActorId ? { possessedActorId } : {}),
    },
  };
};

export const selectManualActor = (
  state: ManualControlStateV1,
  actorId: string,
): Result<ManualControlStateV1, ManualControlError> =>
  actorById(state, actorId)
    ? { ok: true, value: { ...state, selectedActorId: actorId } }
    : { ok: false, error: { code: "UNKNOWN_ACTOR", message: `Unknown spatial actor ${actorId}.` } };

export const possessSelectedActor = (
  state: ManualControlStateV1,
): Result<ManualControlStateV1, ManualControlError> => {
  if (!state.selectedActorId) {
    return { ok: false, error: { code: "NO_SELECTED_ACTOR", message: "Select an actor before activating possession." } };
  }
  const actor = actorById(state, state.selectedActorId);
  if (!actor) return { ok: false, error: { code: "UNKNOWN_ACTOR", message: "Selected actor no longer exists." } };
  if (!actor.possessible) {
    return { ok: false, error: { code: "NOT_POSSESSIBLE", message: "This actor cannot be possessed in v1." } };
  }
  const occupancy = releaseSpatialActor(state.occupancy, actor.actorId, "destination");
  const possessed: ManualSpatialActorV1 = {
    ...actor,
    path: [actor.cell],
    destination: actor.cell,
    intent: "possessed",
    pendingInteraction: undefined,
  };
  return { ok: true, value: { ...replaceActor(state, possessed, occupancy), possessedActorId: actor.actorId } };
};

/** Returns control to autonomous code from the actor's actual final cell. */
export const releasePossessedActor = (
  state: ManualControlStateV1,
): Result<ManualControlStateV1, ManualControlError> => {
  if (!state.possessedActorId) {
    return { ok: false, error: { code: "NO_POSSESSED_ACTOR", message: "No actor is currently possessed." } };
  }
  const actor = actorById(state, state.possessedActorId);
  if (!actor) return { ok: false, error: { code: "UNKNOWN_ACTOR", message: "Possessed actor no longer exists." } };
  const occupancy = releaseSpatialActor(state.occupancy, actor.actorId, "destination");
  const released: ManualSpatialActorV1 = {
    ...actor,
    path: [actor.cell],
    destination: actor.cell,
    intent: "hold",
    pendingInteraction: undefined,
  };
  const replaced = replaceActor(state, released, occupancy);
  const { possessedActorId: _released, ...withoutPossession } = replaced;
  return { ok: true, value: withoutPossession };
};

const facingBetween = (from: GridPoint, to: GridPoint): CardinalDirection => {
  if (to.x > from.x) return "east";
  if (to.x < from.x) return "west";
  if (to.y > from.y) return "south";
  return "north";
};

/** Faces an authored doorway when a route finishes on one of its approach anchors. */
const portalFacingAt = (
  scene: SpatialSceneIndexV1,
  cell: GridPoint,
): CardinalDirection | undefined => {
  for (const portal of [...scene.definition.portals].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!portal.enabled) continue;
    for (const anchorId of portal.approachAnchorIds) {
      const anchor = scene.anchorsById.get(anchorId);
      if (!anchor || anchor.cell.x !== cell.x || anchor.cell.y !== cell.y) continue;
      return portal.requiredFacing ?? anchor.facing;
    }
  }
  return undefined;
};

const mapPathError = (code: string, message: string): ManualControlError => {
  if (code === "DESTINATION_OCCUPIED") return { code: "DESTINATION_OCCUPIED", message };
  if (code === "INVALID_DESTINATION" || code === "INVALID_START") return { code: "INVALID_DESTINATION", message };
  return { code: "NO_PATH", message };
};

const issuePath = (
  scene: SpatialSceneIndexV1,
  state: ManualControlStateV1,
  actor: ManualSpatialActorV1,
  target: GridPoint,
  intent: "manual-click" | "possessed",
): Result<ManualControlStateV1, ManualControlError> => {
  let occupancy = releaseSpatialActor(state.occupancy, actor.actorId, "destination");
  const path = findSpatialPath(scene, actor.cell, target, { occupancy, actorId: actor.actorId });
  if (!path.ok) return { ok: false, error: mapPathError(path.error.code, path.error.message) };
  if (path.value.length === 1) {
    const stationary: ManualSpatialActorV1 = {
      ...actor,
      facing: portalFacingAt(scene, actor.cell) ?? actor.facing,
      path: [actor.cell],
      destination: actor.cell,
      intent: intent === "possessed" ? "possessed" : "hold",
      pendingInteraction: undefined,
    };
    return { ok: true, value: replaceActor(state, stationary, occupancy) };
  }
  const reservation = reserveSpatialActor(scene, occupancy, {
    actorId: actor.actorId,
    kind: "destination",
    cell: target,
  });
  if (!reservation.ok) {
    return { ok: false, error: { code: "RESERVATION_FAILED", message: reservation.error.message } };
  }
  occupancy = reservation.value;
  const moving: ManualSpatialActorV1 = {
    ...actor,
    facing: facingBetween(actor.cell, path.value[1]!),
    path: path.value,
    destination: target,
    intent,
    pendingInteraction: undefined,
  };
  return { ok: true, value: replaceActor(state, moving, occupancy) };
};

export const issueSelectedClickMove = (
  scene: SpatialSceneIndexV1,
  state: ManualControlStateV1,
  target: GridPoint,
): Result<ManualControlStateV1, ManualControlError> => {
  if (!state.selectedActorId) {
    return { ok: false, error: { code: "NO_SELECTED_ACTOR", message: "Select an actor before clicking a destination." } };
  }
  if (state.possessedActorId) {
    return { ok: false, error: { code: "POSSESSION_ACTIVE", message: "Use WASD while an actor is possessed." } };
  }
  const actor = actorById(state, state.selectedActorId);
  if (!actor) return { ok: false, error: { code: "UNKNOWN_ACTOR", message: "Selected actor no longer exists." } };
  return issuePath(scene, state, actor, target, "manual-click");
};

export const requestPossessedStep = (
  scene: SpatialSceneIndexV1,
  state: ManualControlStateV1,
  key: ScreenRelativeMovementKey,
): Result<ManualControlStateV1, ManualControlError> => {
  if (!state.possessedActorId) {
    return { ok: false, error: { code: "NO_POSSESSED_ACTOR", message: "WASD requires an actively possessed actor." } };
  }
  const actor = actorById(state, state.possessedActorId);
  if (!actor) return { ok: false, error: { code: "UNKNOWN_ACTOR", message: "Possessed actor no longer exists." } };
  if (actor.path.length > 1) {
    return { ok: false, error: { code: "MOVE_IN_PROGRESS", message: "Wait for the current grid step before queueing another." } };
  }
  const direction = screenRelativeDirectionForKey(key);
  const target = screenRelativeNeighbourForKey(actor.cell, key);
  const moved = issuePath(scene, state, actor, target, "possessed");
  if (!moved.ok) return moved;
  const updated = actorById(moved.value, actor.actorId);
  if (!updated) return { ok: false, error: { code: "UNKNOWN_ACTOR", message: "Possessed actor no longer exists." } };
  return { ok: true, value: replaceActor(moved.value, { ...updated, facing: direction }) };
};

export const advanceManualActorStep = (
  scene: SpatialSceneIndexV1,
  state: ManualControlStateV1,
  actorId: string,
): Result<ManualControlStateV1, ManualControlError> => {
  const actor = actorById(state, actorId);
  if (!actor) return { ok: false, error: { code: "UNKNOWN_ACTOR", message: `Unknown spatial actor ${actorId}.` } };
  if (actor.path.length <= 1) return { ok: true, value: state };
  const nextCell = actor.path[1]!;
  if (!isSpatialCellWalkable(scene, nextCell, state.occupancy, actor.actorId)) {
    return { ok: false, error: { code: "STEP_BLOCKED", message: "The next grid cell became occupied before the step completed." } };
  }

  let occupancy = releaseSpatialActor(state.occupancy, actor.actorId, "current");
  const remaining = actor.path.slice(1);
  const arrived = remaining.length === 1;
  const anchorId = arrived ? actor.pendingInteraction?.anchorId : undefined;
  const movedActor: ManualSpatialActorV1 = {
    ...actor,
    cell: nextCell,
    facing: (arrived ? portalFacingAt(scene, nextCell) : undefined) ?? facingBetween(actor.cell, nextCell),
    path: remaining,
    destination: remaining[remaining.length - 1],
    intent: arrived
      ? actor.pendingInteraction
        ? "interaction"
        : state.possessedActorId === actor.actorId
          ? "possessed"
          : "hold"
      : actor.intent,
  };
  const current = reserveSpatialActor(scene, occupancy, currentReservation(movedActor, anchorId));
  if (!current.ok) {
    return { ok: false, error: { code: "STEP_BLOCKED", message: current.error.message } };
  }
  occupancy = arrived ? releaseSpatialActor(current.value, actor.actorId, "destination") : current.value;
  return { ok: true, value: replaceActor(state, movedActor, occupancy) };
};

const controlledActor = (
  state: ManualControlStateV1,
): Result<ManualSpatialActorV1, ManualControlError> => {
  const actorId = state.possessedActorId ?? state.selectedActorId;
  if (!actorId) {
    return { ok: false, error: { code: "NO_SELECTED_ACTOR", message: "Select or possess an actor first." } };
  }
  const actor = actorById(state, actorId);
  return actor
    ? { ok: true, value: actor }
    : { ok: false, error: { code: "UNKNOWN_ACTOR", message: "Controlled actor no longer exists." } };
};

export const requestContextInteraction = (
  scene: SpatialSceneIndexV1,
  state: ManualControlStateV1,
): Result<ManualInteractionRequestV1, ManualControlError> => {
  const controlled = controlledActor(state);
  if (!controlled.ok) return controlled;
  const actor = controlled.value;
  if (actor.path.length > 1) {
    return { ok: false, error: { code: "MOVE_IN_PROGRESS", message: "Finish the current step before using E." } };
  }
  const resolved = resolveSpatialInteraction(scene, state.occupancy, actor.actorId, actor.cell);
  if (!resolved.ok) {
    return { ok: false, error: { code: "NO_REACHABLE_INTERACTION", message: resolved.error.message } };
  }
  const interaction = resolved.value;
  let occupancy = releaseSpatialActor(state.occupancy, actor.actorId, "destination");
  const pendingInteraction: PendingSpatialInteractionV1 = {
    interactionId: interaction.interactionId,
    action: interaction.action,
    anchorId: interaction.anchorId,
  };
  let updated: ManualSpatialActorV1;
  if (interaction.path.length === 1) {
    const current = reserveSpatialActor(scene, occupancy, currentReservation(actor, interaction.anchorId));
    if (!current.ok) {
      return { ok: false, error: { code: "RESERVATION_FAILED", message: current.error.message } };
    }
    occupancy = current.value;
    updated = {
      ...actor,
      ...(interaction.facing ? { facing: interaction.facing } : {}),
      path: [actor.cell],
      destination: actor.cell,
      intent: "interaction",
      pendingInteraction,
    };
  } else {
    const anchor = scene.anchorsById.get(interaction.anchorId)!;
    const destination = reserveSpatialActor(scene, occupancy, {
      actorId: actor.actorId,
      kind: "destination",
      cell: anchor.cell,
      anchorId: anchor.id,
    });
    if (!destination.ok) {
      return { ok: false, error: { code: "RESERVATION_FAILED", message: destination.error.message } };
    }
    occupancy = destination.value;
    updated = {
      ...actor,
      facing: facingBetween(actor.cell, interaction.path[1]!),
      path: interaction.path,
      destination: anchor.cell,
      intent: "interaction",
      pendingInteraction,
    };
  }
  return { ok: true, value: { state: replaceActor(state, updated, occupancy), interaction } };
};

export const finishContextInteraction = (
  scene: SpatialSceneIndexV1,
  state: ManualControlStateV1,
  actorId: string,
): Result<ManualControlStateV1, ManualControlError> => {
  const actor = actorById(state, actorId);
  if (!actor) return { ok: false, error: { code: "UNKNOWN_ACTOR", message: `Unknown spatial actor ${actorId}.` } };
  let occupancy = releaseSpatialActor(state.occupancy, actor.actorId, "current");
  const current = reserveSpatialActor(scene, occupancy, currentReservation(actor));
  if (!current.ok) return { ok: false, error: { code: "RESERVATION_FAILED", message: current.error.message } };
  occupancy = current.value;
  const finished: ManualSpatialActorV1 = {
    ...actor,
    intent: state.possessedActorId === actor.actorId ? "possessed" : "hold",
    pendingInteraction: undefined,
  };
  return { ok: true, value: replaceActor(state, finished, occupancy) };
};

export const requestPortalUse = (
  scene: SpatialSceneIndexV1,
  state: ManualControlStateV1,
): Result<ManualPortalRequestV1, ManualControlError> => {
  const controlled = controlledActor(state);
  if (!controlled.ok) return controlled;
  const actor = controlled.value;
  if (actor.path.length > 1) {
    return { ok: false, error: { code: "MOVE_IN_PROGRESS", message: "Finish movement before using F." } };
  }
  const portal = resolveSpatialPortal(scene, actor.cell, actor.facing);
  return portal.ok
    ? { ok: true, value: { actorId: actor.actorId, portal: portal.value } }
    : { ok: false, error: { code: "NO_PORTAL_IN_FRONT", message: portal.error.message } };
};

export const manualActorAt = (state: ManualControlStateV1, actorId: string): ManualSpatialActorV1 | undefined =>
  actorById(state, actorId);

export const isManualActorStationary = (actor: ManualSpatialActorV1): boolean =>
  actor.path.length <= 1 && sameSpatialPoint(actor.cell, actor.destination ?? actor.cell);
