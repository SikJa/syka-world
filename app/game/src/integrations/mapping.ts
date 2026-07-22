import { isProfileId, SIKORA_PRESET, type PresetCharacterSeed, type ProfileRegistry } from "./profiles";
import {
  sanitizeIsoTimestamp,
  sanitizeOpaqueIdentifier,
  sanitizeTaskSummary,
} from "./sanitization";
import {
  BRIDGE_EVENTS_SCHEMA,
  BRIDGE_EVENT_SCHEMA,
  BRIDGE_STATE_SCHEMA,
  FRONTEND_BRIDGE_SCHEMA,
  type BridgeAgentActivity,
  type BridgeAgentStatus,
  type BridgeAnimation,
  type BridgeConnectionMode,
  type BridgeLastOutcome,
  type BridgePresence,
  type BridgeToolFamily,
  type BridgeVisualAgent,
  type BridgeVisualSnapshot,
  type SafeBridgeEvent,
  type BridgeEventType,
} from "./types";

const STATUSES = new Set<BridgeAgentStatus>([
  "idle",
  "working",
  "waiting",
  "done",
  "interrupted",
  "error",
  "offline",
]);
const ACTIVITIES = new Set<BridgeAgentActivity>([
  "roaming",
  "thinking",
  "using-tool",
  "waiting",
  "completed",
  "interrupted",
  "error",
  "offline",
]);
const ANIMATIONS = new Set<BridgeAnimation>([
  "walk",
  "thinking",
  "reading",
  "typing",
  "using-computer",
  "using-phone",
  "organizing",
  "working",
  "waiting",
  "celebrate",
  "confused",
  "error",
  "sleep",
]);
const TOOL_FAMILIES = new Set<BridgeToolFamily>([
  "files",
  "terminal",
  "code",
  "browser",
  "research",
  "communication",
  "crm",
  "other",
]);
const PRESENCES = new Set<BridgePresence>(["online", "degraded", "offline", "unknown"]);
const EVENT_TYPES = new Set<BridgeEventType>([
  "session.started",
  "profile.online",
  "profile.offline",
  "profile.unknown",
  "activity.started",
  "activity.waiting",
  "activity.resumed",
  "tool.started",
  "tool.finished",
  "activity.completed",
  "activity.interrupted",
  "activity.failed",
  "activity.settled",
]);

export class BridgePayloadError extends Error {
  readonly code = "invalid-bridge-payload";

  constructor() {
    super("The local bridge returned an unsupported payload.");
    this.name = "BridgePayloadError";
  }
}

/**
 * Resolves a character seed for a profile id. When a dynamic registry is
 * provided it is the authority; otherwise the Sikora preset is used as a
 * fallback so legacy bridge payloads still map to the four known characters.
 * Unknown profile ids produce an "unassigned" placeholder so events are never
 * silently attributed to Syka or dropped.
 */
const DEFAULT_PRESET_MAP: ReadonlyMap<string, PresetCharacterSeed> = new Map(
  SIKORA_PRESET.characters.map((seed) => [seed.profileId, seed]),
);

const resolveCharacterSeed = (
  profileId: string,
  registry?: ProfileRegistry,
): PresetCharacterSeed | undefined => {
  if (registry) {
    const character = registry.resolve(profileId);
    if (character) {
      return {
        profileId: character.profileId,
        characterId: character.characterId,
        displayName: character.displayName,
        role: character.role,
        avatarKey: character.avatarKey,
        homeId: character.homeId ?? "",
        workplaceId: character.workplaceId ?? "",
        communityId: character.communityId ?? "",
        cafeId: character.cafeId,
        theme: character.theme,
      };
    }
  }
  return DEFAULT_PRESET_MAP.get(profileId);
};

export function mapBridgeStatePayload(
  payload: unknown,
  now: () => Date = () => new Date(),
  lastEventId: string | null = null,
  registry?: ProfileRegistry,
): BridgeVisualSnapshot {
  if (!isRecord(payload) || payload.schema !== BRIDGE_STATE_SCHEMA || !Array.isArray(payload.characters)) {
    throw new BridgePayloadError();
  }

  const generatedAt = sanitizeIsoTimestamp(payload.generated_at) ?? now().toISOString();
  // Legacy preset order is preserved first so existing UI indices and tests
  // that assume agents[0] === "default" continue to work. Unknown profiles
  // discovered from the bridge are appended after the known set.
  const legacyOrder = registry
    ? registry.snapshot().characters.map((c) => c.profileId)
    : [...DEFAULT_PRESET_MAP.keys()];
  const mapped = new Map<string, BridgeVisualAgent>();

  for (const profileId of legacyOrder) {
    mapped.set(profileId, createUnknownAgent(profileId, registry));
  }

  const unknownProfiles: string[] = [];
  for (const rawCharacter of payload.characters) {
    if (!isRecord(rawCharacter) || !isProfileId(rawCharacter.profile_id)) continue;
    const profileId = rawCharacter.profile_id;
    const candidate = mapBridgeCharacter(profileId, rawCharacter, registry);
    const current = mapped.get(profileId);
    if (!current || timestamp(candidate.updatedAt) >= timestamp(current.updatedAt)) {
      mapped.set(profileId, candidate);
    }
    if (!mapped.has(profileId) || !legacyOrder.includes(profileId)) {
      if (!unknownProfiles.includes(profileId)) unknownProfiles.push(profileId);
    }
    if (registry && !registry.isKnown(profileId)) {
      registry.discover({
        profileId,
        source: "bridge-payload",
        detectedAt: generatedAt,
        label: typeof rawCharacter.display_name === "string" ? rawCharacter.display_name : undefined,
      });
    }
  }

  const agents = [
    ...legacyOrder.map((id) => mapped.get(id)!).filter(Boolean),
    ...unknownProfiles.map((id) => mapped.get(id)!).filter(Boolean),
  ];
  const safeCursor = sanitizeOpaqueIdentifier(lastEventId) ?? newestCharacterEventId(agents);

  return {
    schema: FRONTEND_BRIDGE_SCHEMA,
    source: "bridge",
    mode: deriveBridgeMode(agents),
    generatedAt,
    lastEventId: safeCursor,
    agents,
  };
}

export function mapBridgeEventsPayload(payload: unknown): SafeBridgeEvent[] {
  if (!isRecord(payload) || payload.schema !== BRIDGE_EVENTS_SCHEMA || !Array.isArray(payload.events)) {
    throw new BridgePayloadError();
  }
  const result: SafeBridgeEvent[] = [];
  for (const item of payload.events) {
    const event = mapBridgeEvent(item);
    if (event) result.push(event);
  }
  return result;
}

export function mapBridgeEvent(value: unknown): SafeBridgeEvent | null {
  if (!isRecord(value) || value.schema !== BRIDGE_EVENT_SCHEMA) return null;
  const eventId = sanitizeOpaqueIdentifier(value.event_id);
  if (!eventId) return null;

  const rawType = typeof value.type === "string" ? value.type : "";
  const metadata = isRecord(value.metadata) ? value.metadata : null;

  return {
    eventId,
    occurredAt: sanitizeIsoTimestamp(value.occurred_at),
    profileId: isProfileId(value.profile_id) ? value.profile_id : null,
    sessionId: sanitizeOpaqueIdentifier(value.session_id),
    type: EVENT_TYPES.has(rawType as BridgeEventType) ? (rawType as BridgeEventType) : null,
    source: mapSource(value.source),
    activity: mapSetMember(value.activity, ACTIVITIES),
    taskSummary: sanitizeTaskSummary(value.task_summary),
    toolFamily: mapSetMember(value.tool_family, TOOL_FAMILIES),
    waitingReason: mapWaitingReason(metadata?.reason),
  };
}

export function deriveBridgeMode(agents: readonly BridgeVisualAgent[]): BridgeConnectionMode {
  if (agents.some((agent) => agent.presence === "online")) return "online";
  if (agents.some((agent) => agent.presence === "degraded")) return "degraded";
  if (agents.length > 0 && agents.every((agent) => agent.presence === "offline")) return "offline";
  // The HTTP bridge answered, but it has not yet received enough official
  // presence evidence. This is distinct from local simulation.
  return "degraded";
}

export function createUnknownAgent(profileId: string, registry?: ProfileRegistry): BridgeVisualAgent {
  const seed = resolveCharacterSeed(profileId, registry);
  const displayName = seed?.displayName ?? profileId;
  const homeId = seed?.homeId ?? "";
  const workplaceId = seed?.workplaceId ?? "";
  const characterId = seed?.characterId ?? `unassigned:${profileId}`;
  return {
    profileId,
    characterId,
    displayName,
    homeId,
    workplaceId,
    status: "idle",
    activity: "roaming",
    destinationId: "town",
    animation: "walk",
    taskSummary: null,
    toolFamily: null,
    waitingReason: null,
    lastOutcome: null,
    lastOutcomeAt: null,
    presence: "unknown",
    activeSessionCount: 0,
    dominantSessionId: null,
    lastEventId: null,
    updatedAt: null,
  };
}

function mapBridgeCharacter(
  profileId: string,
  value: Record<string, unknown>,
  registry?: ProfileRegistry,
): BridgeVisualAgent {
  const seed = resolveCharacterSeed(profileId, registry);
  const homeId = seed?.homeId ?? "";
  const workplaceId = seed?.workplaceId ?? "";
  const characterId = seed?.characterId ?? `unassigned:${profileId}`;
  const displayName = seed?.displayName ?? profileId;

  const presence = mapSetMember(value.presence, PRESENCES) ?? "unknown";
  let status = mapSetMember(value.status, STATUSES) ?? (presence === "offline" ? "offline" : "idle");
  const activeSessionCount = clampCount(value.active_session_count);
  if (activeSessionCount > 0 && !["working", "waiting"].includes(status)) status = "working";

  const activity = mapSetMember(value.activity, ACTIVITIES) ?? activityForStatus(status);
  const animation = mapSetMember(value.animation, ANIMATIONS) ?? animationFor(status, activity);
  const destinationId = mapDestination(value.destination, homeId, workplaceId, status);
  const taskSummary = status === "idle" || status === "offline" ? null : sanitizeTaskSummary(value.task_summary);

  return {
    profileId,
    characterId,
    displayName,
    homeId,
    workplaceId,
    status,
    activity,
    destinationId,
    animation,
    taskSummary,
    toolFamily: mapSetMember(value.tool_family, TOOL_FAMILIES),
    waitingReason: status === "waiting" ? mapWaitingReason(value.waiting_reason) ?? "unknown" : null,
    lastOutcome: mapLastOutcome(value.last_outcome),
    lastOutcomeAt: sanitizeIsoTimestamp(value.last_outcome_at),
    presence,
    activeSessionCount,
    dominantSessionId:
      activeSessionCount > 0 ? sanitizeOpaqueIdentifier(value.dominant_session_id) : null,
    lastEventId: sanitizeOpaqueIdentifier(value.last_event_id),
    updatedAt: sanitizeIsoTimestamp(value.updated_at),
  };
}

function mapDestination(
  value: unknown,
  homeId: string,
  workplaceId: string,
  status: BridgeAgentStatus,
): string {
  if (value === homeId || value === workplaceId || value === "town") return value;
  if (status === "offline") return homeId;
  if (status === "working" || status === "waiting" || status === "done" || status === "error") {
    return workplaceId;
  }
  return "town";
}

function mapWaitingReason(value: unknown): "approval" | "input" | "unknown" | null {
  if (value === "approval" || value === "input") return value;
  return typeof value === "string" && value.trim() ? "unknown" : null;
}

function mapLastOutcome(value: unknown): BridgeLastOutcome {
  return value === "completed" || value === "interrupted" || value === "failed" ? value : null;
}

function mapSource(value: unknown): SafeBridgeEvent["source"] {
  if (value === "hermes-plugin" || value === "hermes-session-sqlite" || value === "bridge-recovery") {
    return value;
  }
  return "unknown";
}

function activityForStatus(status: BridgeAgentStatus): BridgeAgentActivity {
  switch (status) {
    case "working":
      return "thinking";
    case "waiting":
      return "waiting";
    case "done":
      return "completed";
    case "interrupted":
      return "interrupted";
    case "error":
      return "error";
    case "offline":
      return "offline";
    default:
      return "roaming";
  }
}

function animationFor(status: BridgeAgentStatus, activity: BridgeAgentActivity): BridgeAnimation {
  if (status === "waiting") return "waiting";
  if (status === "done") return "celebrate";
  if (status === "interrupted") return "confused";
  if (status === "error") return "error";
  if (status === "offline") return "sleep";
  if (activity === "using-tool") return "working";
  if (status === "working") return "thinking";
  return "walk";
}

function clampCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(value)));
}

function newestCharacterEventId(agents: readonly BridgeVisualAgent[]): string | null {
  let selected: BridgeVisualAgent | null = null;
  for (const agent of agents) {
    if (!agent.lastEventId) continue;
    if (!selected || timestamp(agent.updatedAt) > timestamp(selected.updatedAt)) selected = agent;
  }
  return selected?.lastEventId ?? null;
}

function timestamp(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function mapSetMember<T extends string>(value: unknown, allowed: ReadonlySet<T>): T | null {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
