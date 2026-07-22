import type { ControllerSnapshot } from "../application/AlphaRuntime";
import {
  ALPHA_CATALOG,
  currentAgentBuildingId,
  getBuildingDefinition,
  getConstructionAccelerationQuote,
  getExteriorObjectDefinition,
  isAgentTraveling,
  type AgentActivity,
  type BuildingKind,
} from "../core";
import { sanitizeTaskSummary } from "../integrations";
import type {
  AgentStripItemModel,
  AlphaUiViewModel,
  BuildingPaletteItemModel,
  InteriorShopModel,
  ExteriorPaletteItemModel,
  LockedSectorModel,
  SelectedAgentModel,
  SelectedBuildingModel,
  SelectedWorldObjectModel,
} from "./types";

const BUILDING_ICONS: Readonly<Record<BuildingKind, string>> = {
  home: "⌂",
  cafe: "☕",
  "marketing-office": "✦",
  "commercial-office": "◇",
  "crm-workshop": "⚒",
  "community-hall": "❖",
};

const EXTERIOR_ICONS: Readonly<Record<ExteriorPaletteItemModel["category"], string>> = {
  "ground-cover": "✿",
  shrub: "♣",
  hedge: "▰",
  planter: "▣",
  "street-furniture": "⌑",
  tree: "♠",
};

const ACTIVITY_LABELS: Readonly<Record<AgentActivity, string>> = {
  idle: "Roaming",
  thinking: "Thinking",
  "using-tool": "Working",
  waiting: "Waiting for approval",
  done: "Completed a task",
  interrupted: "Taking a break",
  error: "Recovering",
  offline: "Resting",
};

const WORKPLACE_KIND_BY_PROFILE: Readonly<
  Record<string, BuildingKind>
> = {
  default: "community-hall",
  elen: "marketing-office",
  astrelis: "commercial-office",
  zerny: "crm-workshop",
};

export function buildAlphaUiModel(
  snapshot: ControllerSnapshot,
  selectedBuildingId: string | null,
  selectedAgentProfileId: string | null = null,
  selectedWorldObjectId: string | null = null,
): AlphaUiViewModel {
  const { game, bridge } = snapshot;
  const agents = game.agents.map((agent): AgentStripItemModel => {
    const live = bridge.agents.find((candidate) => candidate.profileId === agent.profileId);
    const activity = live && live.status !== "idle" ? bridgeActivityToCore(live.activity) : agent.activity;
    const summary = sanitizeUiSummary(agent.taskSummary ?? live?.taskSummary ?? null);
    const presence = live?.presence ?? agent.presence;
    const destination = game.buildings.find((building) => building.id === agent.destinationBuildingId);
    const workplaceKind = WORKPLACE_KIND_BY_PROFILE[agent.profileId] ?? "community-hall";
    const destinationDefinition = getBuildingDefinition(destination?.definitionId ?? agent.destinationBuildingId)
      ?? (agent.destinationBuildingId === agent.bindings.workplaceBuildingId
        ? ALPHA_CATALOG.buildings.find((definition) => definition.kind === workplaceKind)
        : undefined);
    const destinationLabel = destinationDefinition?.name ?? "town";
    const locationBuildingId = currentAgentBuildingId(game, agent);
    const location = locationBuildingId ? game.buildings.find((building) => building.id === locationBuildingId) : undefined;
    const locationDefinition = location ? getBuildingDefinition(location.definitionId) : undefined;
    const traveling = isAgentTraveling(agent);
    const waitingForAccess =
      !traveling &&
      locationBuildingId !== agent.destinationBuildingId &&
      (!destination || destination.status !== "complete" || agent.activeSessions.length > 0);
    const activityLabel = ACTIVITY_LABELS[activity];
    const locationLabel = traveling
      ? "On the way"
      : locationDefinition
        ? `At ${locationDefinition.name}`
        : "In town";
    const phaseLabel = waitingForAccess
      ? `Waiting for access to ${destinationLabel}`
      : traveling
      ? `Heading to ${destinationLabel}`
      : activity === "idle"
        ? locationLabel
        : `${activityLabel} · ${locationLabel}`;
    return {
      profileId: agent.profileId,
      name: agent.name,
      initials: agent.name.slice(0, 2).toUpperCase(),
      activityLabel,
      phaseLabel,
      destinationLabel,
      locationLabel,
      traveling,
      pathRemaining: Math.max(0, agent.path.length - 1),
      presence,
      presenceLabel: presenceLabel(presence, snapshot.bridgeMode),
      summary,
      activeSessionCount: live?.activeSessionCount ?? agent.activeSessions.length,
    };
  });
  return {
    mode: game.mode,
    modeLabel: game.mode === "showcase" ? "Showcase" : "New game",
    balanceLabel: formatLumenes(game.economy.balance),
    dayTimeLabel: `Day ${game.clock.day} · ${formatClock(game.clock.minuteOfDay)}`,
    speed: game.clock.speed,
    bridgeMode: snapshot.bridgeMode,
    bridgeLabel: bridgeModeLabel(snapshot.bridgeMode),
    bridgeHint: bridgeModeHint(snapshot.bridgeMode),
    townLevel: game.progression.townLevel,
    agentsVisible: game.agentsVisible,
    scene: game.camera.scene,
    palette: ALPHA_CATALOG.buildings.map((definition): BuildingPaletteItemModel => {
      const unlocked = game.progression.unlockedBuildingIds.includes(definition.id);
      const affordable = game.economy.balance >= definition.cost;
      return {
        id: definition.id,
        name: definition.name,
        kind: definition.kind,
        icon: BUILDING_ICONS[definition.kind],
        cost: definition.cost,
        unlocked,
        affordable,
        requiredTownLevel: definition.requiredTownLevel,
        disabledReason: !unlocked
          ? `Unlocks at level ${definition.requiredTownLevel}`
          : !affordable
            ? `Need ${formatLumenes(definition.cost - game.economy.balance)} more`
            : null,
      };
    }),
    exteriorPalette: ALPHA_CATALOG.exteriorObjects.map((definition): ExteriorPaletteItemModel => ({
      id: definition.id,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      icon: EXTERIOR_ICONS[definition.category],
      cost: definition.price,
      affordable: game.economy.balance >= definition.price,
      placementHint: definition.placementRule === "grass-near-road" ? "Grass near road" : "Open grass",
    })),
    agents,
    selectedBuilding: selectedBuilding(game, selectedBuildingId),
    selectedAgent: selectedAgent(game, agents, selectedAgentProfileId),
    selectedWorldObject: selectedWorldObject(game, selectedWorldObjectId),
    lockedSector: lockedSector(game),
    interiorShop: interiorShop(game),
  };
}

function selectedAgent(
  game: ControllerSnapshot["game"],
  agents: readonly AgentStripItemModel[],
  profileId: string | null,
): SelectedAgentModel | null {
  if (!profileId) return null;
  const state = game.agents.find((agent) => agent.profileId === profileId);
  const model = agents.find((agent) => agent.profileId === profileId);
  if (!state || !model) return null;
  const cafe = game.buildings.find((building) => building.kind === "cafe" && building.status === "complete");
  const localOrderLabels = {
    traveling: "Heading to Cafe Library",
    entering: "Entering the cafe",
    acting: "Performing a cafe action",
    staying: "Staying at the cafe",
  } as const;
  const actionLabels = {
    sit: "Sitting at a table",
    read: "Reading",
    "serve-coffee": "Brewing coffee",
    "warm-fireplace": "By the fireplace",
  } as const;
  const insideCafe = state.location.kind === "interior" && state.location.buildingId === cafe?.id;
  return {
    ...model,
    role: state.role,
    canGoToCafe: Boolean(cafe && !insideCafe),
    canReturnToCity: state.location.kind === "interior",
    localOrderLabel: state.localOrder ? localOrderLabels[state.localOrder.phase] : null,
    interiorActionLabel: state.location.kind === "interior" && state.location.action
      ? actionLabels[state.location.action]
      : null,
  };
}

function selectedWorldObject(
  game: ControllerSnapshot["game"],
  instanceId: string | null,
): SelectedWorldObjectModel | null {
  if (!instanceId) return null;
  const instance = game.worldObjects.find((object) => object.instanceId === instanceId);
  if (!instance) return null;
  const definition = getExteriorObjectDefinition(instance.definitionId);
  if (!definition) return null;
  return {
    instanceId: instance.instanceId,
    name: definition.name,
    description: definition.description,
    category: definition.category,
    placementLabel: definition.placementRule === "grass-near-road" ? "Near road" : "On grass",
    removable: instance.removable,
    refund: instance.provenance === "player" ? Math.floor(definition.price / 2) : 0,
    provenanceLabel: instance.provenance === "player" ? "Placed by you" : "Part of the initial landscape",
  };
}

function lockedSector(game: ControllerSnapshot["game"]): LockedSectorModel | null {
  const sector = game.map.sectors.find((candidate) => !candidate.unlocked);
  if (!sector) return null;
  const affordable = game.economy.balance >= sector.unlockCost;
  return {
    id: sector.id,
    name: sector.name,
    cost: sector.unlockCost,
    affordable,
    stateLabel: affordable
      ? "Ready to explore"
      : `Need ${formatLumenes(sector.unlockCost - game.economy.balance)} more`,
  };
}

function interiorShop(game: ControllerSnapshot["game"]): InteriorShopModel | null {
  if (game.camera.scene !== "interior" || !game.camera.interiorBuildingId) return null;
  const building = game.buildings.find((candidate) => candidate.id === game.camera.interiorBuildingId);
  const interior = game.interiors.find((candidate) => candidate.buildingId === game.camera.interiorBuildingId);
  if (!building || !interior) return null;
  const definition = ALPHA_CATALOG.interiors.find((candidate) => candidate.id === interior.definitionId);
  if (!definition) return null;
  const options = definition.slots
    .filter((slot) => slot.optional)
    .flatMap((slot) =>
      slot.accepts.flatMap((furnitureId) => {
        const furniture = ALPHA_CATALOG.furniture.find((candidate) => candidate.id === furnitureId);
        if (!furniture) return [];
        const installed = interior.furniture.some(
          (placement) => placement.slotId === slot.id && placement.furnitureId === furniture.id,
        );
        return [{
          slotId: slot.id,
          slotLabel: humanizeSlot(slot.id),
          furnitureId: furniture.id,
          name: furniture.name,
          price: furniture.price,
          installed,
          affordable: game.economy.balance >= furniture.price,
        }];
      }),
    );
  return { buildingId: building.id, name: definition.name, options };
}

function humanizeSlot(value: string): string {
  const words = value.split(/[-_]+/g).filter(Boolean);
  if (words.length === 0) return "Free corner";
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatClock(minuteOfDay: number): string {
  const safe = ((Math.trunc(minuteOfDay) % 1_440) + 1_440) % 1_440;
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatLumenes(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  return `${new Intl.NumberFormat("en-US").format(safe)} Lumens`;
}

export function sanitizeUiSummary(value: unknown): string | null {
  return sanitizeTaskSummary(value, 120);
}

export function friendlyActionError(code: string): string {
  const messages: Readonly<Record<string, string>> = {
    CATALOG_LOCKED: "That place is not available yet.",
    INVALID_PLACEMENT: "Try another spot with road access.",
    INSUFFICIENT_FUNDS: "Not enough Lumens yet.",
    BUILDING_INCOMPLETE: "Construction must finish first.",
    UPGRADE_IN_PROGRESS: "Upgrade is already in progress.",
    INVALID_UPGRADE: "That upgrade does not apply to this place.",
    NOT_FOUND: "No saved game found yet.",
    STORAGE_ERROR: "Could not access local storage.",
    INVALID_SAVE: "The save could not be recovered.",
    UNSUPPORTED_SCHEMA: "That save belongs to a different version.",
    DEVELOPMENT_DISABLED: "Development mode is not active.",
    INVALID_DEVELOPMENT_VALUE: "That dev shortcut is not valid.",
    NOTHING_TO_FINISH: "No construction in progress right now.",
    NOTHING_TO_ACCELERATE: "That place has no active construction.",
    UNKNOWN_WORLD_OBJECT: "That exterior object is no longer available.",
    INVALID_WORLD_OBJECT_PLACEMENT: "Choose a compatible grass tile.",
    WORLD_OBJECT_NOT_FOUND: "That exterior object is no longer in town.",
    WORLD_OBJECT_NOT_REMOVABLE: "That detail is a fixed part of the world.",
    CAFE_UNAVAILABLE: "The Cafe Library must be completed first.",
    CAFE_UNREACHABLE: "No clear path to the cafe yet.",
    AGENT_NOT_INTERIOR: "That inhabitant must be inside to do that.",
    ANCHOR_OCCUPIED: "That spot is occupied; try another action.",
  };
  return messages[code] ?? "Could not complete that action.";
}

function selectedBuilding(
  game: ControllerSnapshot["game"],
  selectedBuildingId: string | null,
): SelectedBuildingModel | null {
  if (!selectedBuildingId) return null;
  const instance = game.buildings.find((building) => building.id === selectedBuildingId);
  if (!instance) return null;
  const definition = getBuildingDefinition(instance.definitionId);
  if (!definition) return null;
  const activeTimeline = instance.status !== "complete"
    ? instance.construction
    : instance.activeUpgrade ?? null;
  const progress = activeTimeline && activeTimeline.totalMinutes > 0
    ? Math.max(0, Math.min(1, activeTimeline.elapsedMinutes / activeTimeline.totalMinutes))
    : 1;
  const upgrade = ALPHA_CATALOG.upgrades.find(
    (candidate) => candidate.buildingKind === instance.kind && candidate.requiredLevel === instance.level,
  );
  const upgradeAvailable = Boolean(
    upgrade &&
      instance.status === "complete" &&
      !instance.activeUpgrade &&
      !instance.installedUpgrades.includes(upgrade.id),
  );
  const occupants = game.agents
    .filter((agent) => currentAgentBuildingId(game, agent) === instance.id)
    .map((agent) => ({
      profileId: agent.profileId,
      name: agent.name,
      activityLabel: ACTIVITY_LABELS[agent.activity],
    }));
  const acceleration = (["one-hour", "finish-now"] as const).flatMap((mode) => {
    const quote = getConstructionAccelerationQuote(game, instance.id, mode);
    return quote.ok ? [quote.value] : [];
  });
  return {
    id: instance.id,
    name: definition.name,
    kind: instance.kind,
    description: definition.description,
    status: instance.status,
    statusLabel: instance.activeUpgrade ? "Upgrading" : buildingStatusLabel(instance.status),
    level: instance.level,
    progress,
    progressLabel: instance.activeUpgrade
      ? `${Math.round(progress * 100)}% of upgrade`
      : instance.status === "complete"
        ? "Furnished and ready"
        : `${Math.round(progress * 100)}% built`,
    canEnterCafe: instance.kind === "cafe" && instance.status === "complete",
    upgradeId: upgrade?.id ?? null,
    upgradeName: upgrade?.name ?? null,
    upgradeCost: upgrade?.cost ?? null,
    upgradeAvailable,
    upgradeInProgress: Boolean(instance.activeUpgrade),
    acceleration,
    occupants,
    occupancyLabel:
      occupants.length === 0
        ? "Currently empty"
        : occupants.length === 1
          ? "1 inhabitant here"
          : `${occupants.length} inhabitants here`,
  };
}

function bridgeActivityToCore(activity: string): AgentActivity {
  if (activity === "completed") return "done";
  if (activity === "roaming") return "idle";
  if (
    activity === "thinking" ||
    activity === "using-tool" ||
    activity === "waiting" ||
    activity === "interrupted" ||
    activity === "error" ||
    activity === "offline"
  ) {
    return activity as AgentActivity;
  }
  return "idle";
}

function buildingStatusLabel(status: string): string {
  const labels: Readonly<Record<string, string>> = {
    planned: "Planned",
    foundation: "Preparing foundations",
    framing: "Raising the frame",
    finishing: "Finishing touches",
    complete: "Complete",
  };
  return labels[status] ?? "In progress";
}

function bridgeModeLabel(mode: ControllerSnapshot["bridgeMode"]): string {
  const labels = {
    simulated: "Local life",
    online: "Hermes connected",
    degraded: "Hermes limited",
    offline: "Hermes offline",
  } as const;
  return labels[mode];
}

function bridgeModeHint(mode: ControllerSnapshot["bridgeMode"]): string {
  const hints = {
    simulated: "The town stays alive with local routines.",
    online: "Real activity is reflected in the town.",
    degraded: "Recovered activity in read-only mode.",
    offline: "Local routines continue without a connection.",
  } as const;
  return hints[mode];
}

function presenceLabel(
  presence: AgentStripItemModel["presence"],
  bridgeMode: ControllerSnapshot["bridgeMode"],
): string {
  if (bridgeMode === "simulated") return "Local routine";
  const labels = {
    online: "Present",
    degraded: "Limited signal",
    offline: "Resting",
    unknown: "No signal yet",
  } as const;
  return labels[presence];
}
