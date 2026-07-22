export const BRIDGE_STATE_SCHEMA = "syka.world.state.v1" as const;
export const BRIDGE_EVENT_SCHEMA = "syka.world.event.v1" as const;
export const BRIDGE_EVENTS_SCHEMA = "syka.world.events.v1" as const;
export const FRONTEND_BRIDGE_SCHEMA = "syka.world.frontend-bridge.v1" as const;

/**
 * Legacy preset list kept for backwards compatibility with existing bridge
 * payloads and saves. The dynamic profile registry is the authority; this array
 * is only used to seed the default snapshot when no registry is available.
 */
export const PROFILE_IDS = ["default", "elen", "astrelis", "zerny"] as const;

export type ProfileId = string;
export type CharacterId = string;
export type BridgeConnectionMode = "simulated" | "online" | "degraded" | "offline";
export type BridgeSnapshotSource = "bridge" | "simulation";
export type BridgePresence = "online" | "degraded" | "offline" | "unknown";
export type BridgeAgentStatus =
  | "idle"
  | "working"
  | "waiting"
  | "done"
  | "interrupted"
  | "error"
  | "offline";
export type BridgeAgentActivity =
  | "roaming"
  | "thinking"
  | "using-tool"
  | "waiting"
  | "completed"
  | "interrupted"
  | "error"
  | "offline";
export type BridgeToolFamily =
  | "files"
  | "terminal"
  | "code"
  | "browser"
  | "research"
  | "communication"
  | "crm"
  | "other";
export type BridgeAnimation =
  | "walk"
  | "thinking"
  | "reading"
  | "typing"
  | "using-computer"
  | "using-phone"
  | "organizing"
  | "working"
  | "waiting"
  | "celebrate"
  | "confused"
  | "error"
  | "sleep";
export type BridgeLastOutcome = "completed" | "interrupted" | "failed" | null;

export interface BridgeVisualAgent {
  readonly profileId: ProfileId;
  readonly characterId: CharacterId;
  readonly displayName: string;
  readonly homeId: string;
  readonly workplaceId: string;
  readonly status: BridgeAgentStatus;
  readonly activity: BridgeAgentActivity;
  readonly destinationId: string;
  readonly animation: BridgeAnimation;
  readonly taskSummary: string | null;
  readonly toolFamily: BridgeToolFamily | null;
  readonly waitingReason: "approval" | "input" | "unknown" | null;
  readonly lastOutcome: BridgeLastOutcome;
  readonly lastOutcomeAt: string | null;
  readonly presence: BridgePresence;
  readonly activeSessionCount: number;
  readonly dominantSessionId: string | null;
  readonly lastEventId: string | null;
  readonly updatedAt: string | null;
}

export interface BridgeVisualSnapshot {
  readonly schema: typeof FRONTEND_BRIDGE_SCHEMA;
  readonly source: BridgeSnapshotSource;
  readonly mode: BridgeConnectionMode;
  readonly generatedAt: string;
  readonly lastEventId: string | null;
  readonly agents: readonly BridgeVisualAgent[];
}

export type BridgeEventType =
  | "session.started"
  | "profile.online"
  | "profile.offline"
  | "profile.unknown"
  | "activity.started"
  | "activity.waiting"
  | "activity.resumed"
  | "tool.started"
  | "tool.finished"
  | "activity.completed"
  | "activity.interrupted"
  | "activity.failed"
  | "activity.settled";

export interface SafeBridgeEvent {
  readonly eventId: string;
  readonly occurredAt: string | null;
  readonly profileId: ProfileId | null;
  readonly sessionId: string | null;
  readonly type: BridgeEventType | null;
  readonly source: "hermes-plugin" | "hermes-session-sqlite" | "bridge-recovery" | "unknown";
  readonly activity: BridgeAgentActivity | null;
  readonly taskSummary: string | null;
  readonly toolFamily: BridgeToolFamily | null;
  readonly waitingReason: "approval" | "input" | "unknown" | null;
}

export interface BridgeBackoffOptions {
  readonly initialMs?: number;
  readonly maximumMs?: number;
  readonly multiplier?: number;
  readonly jitterRatio?: number;
}

export interface BridgeClientOptions {
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
  readonly fallbackEnabled?: boolean;
  readonly simulatedSnapshotFactory?: () => BridgeVisualSnapshot;
  readonly longPollSeconds?: number;
  readonly backoff?: BridgeBackoffOptions;
  readonly now?: () => Date;
  readonly random?: () => number;
  readonly delay?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}

export type BridgeSnapshotListener = (snapshot: BridgeVisualSnapshot) => void;
export type BridgeEventListener = (
  events: readonly SafeBridgeEvent[],
  snapshot: BridgeVisualSnapshot,
) => void;
