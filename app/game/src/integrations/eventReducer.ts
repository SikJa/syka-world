import { deriveBridgeMode } from "./mapping";
import {
  type BridgeAgentActivity,
  type BridgeAgentStatus,
  type BridgePresence,
  type BridgeToolFamily,
  type BridgeVisualAgent,
  type BridgeVisualSnapshot,
  type ProfileId,
  type SafeBridgeEvent,
} from "./types";

interface SessionTracker {
  readonly sessionId: string;
  active: boolean;
  status: "working" | "waiting";
  activity: "thinking" | "using-tool" | "waiting";
  taskSummary: string | null;
  toolFamily: BridgeToolFamily | null;
  waitingReason: "approval" | "input" | "unknown" | null;
  updatedAt: string | null;
  lastEventId: string | null;
}

const TERMINAL_TYPES = new Set([
  "activity.completed",
  "activity.interrupted",
  "activity.failed",
  "activity.settled",
]);

/**
 * Frontend-side projection of incremental bridge events. The authoritative
 * active count is seeded from every fresh bridge snapshot, including sessions
 * that are not dominant, so one terminal event cannot incorrectly idle a
 * character that still has concurrent work.
 */
export class BridgeEventReducer {
  private snapshot: BridgeVisualSnapshot;
  private readonly sessions = new Map<ProfileId, Map<string, SessionTracker>>();
  private readonly seenEventIds = new Set<string>();
  private snapshotCutoff = Number.NEGATIVE_INFINITY;

  constructor(snapshot: BridgeVisualSnapshot) {
    this.snapshot = snapshot;
    this.replaceSnapshot(snapshot);
  }

  replaceSnapshot(snapshot: BridgeVisualSnapshot): void {
    this.snapshot = snapshot;
    this.snapshotCutoff = timestamp(snapshot.generatedAt);
    this.sessions.clear();
    this.seenEventIds.clear();

    for (const agent of snapshot.agents) {
      const profileSessions = new Map<string, SessionTracker>();
      const dominantId = agent.dominantSessionId;
      if (agent.activeSessionCount > 0 && dominantId) {
        profileSessions.set(dominantId, trackerFromAgent(dominantId, agent));
      }
      const remaining = agent.activeSessionCount - profileSessions.size;
      for (let index = 0; index < remaining; index += 1) {
        const ghostId = `snapshot:${agent.profileId}:${index}`;
        profileSessions.set(ghostId, {
          sessionId: ghostId,
          active: true,
          status: "working",
          activity: "thinking",
          taskSummary: null,
          toolFamily: null,
          waitingReason: null,
          updatedAt: agent.updatedAt,
          lastEventId: agent.lastEventId,
        });
      }
      this.sessions.set(agent.profileId, profileSessions);
    }
  }

  getSnapshot(): BridgeVisualSnapshot {
    return this.snapshot;
  }

  apply(events: readonly SafeBridgeEvent[], now: Date = new Date()): BridgeVisualSnapshot {
    let agents = [...this.snapshot.agents];
    let cursor = this.snapshot.lastEventId;

    for (const event of events) {
      cursor = event.eventId;
      if (this.seenEventIds.has(event.eventId)) continue;
      remember(this.seenEventIds, event.eventId);
      if (!event.profileId || !event.type || !event.occurredAt) continue;
      if (timestamp(event.occurredAt) <= this.snapshotCutoff) continue;

      const index = agents.findIndex((agent) => agent.profileId === event.profileId);
      if (index < 0) continue;
      const current = agents[index];
      if (!current) continue;
      agents[index] = this.applyOne(current, event);
    }

    this.snapshot = {
      ...this.snapshot,
      source: "bridge",
      mode: deriveBridgeMode(agents),
      generatedAt: now.toISOString(),
      lastEventId: cursor,
      agents,
    };
    return this.snapshot;
  }

  private applyOne(agent: BridgeVisualAgent, event: SafeBridgeEvent): BridgeVisualAgent {
    const profileSessions = this.sessions.get(agent.profileId) ?? new Map<string, SessionTracker>();
    this.sessions.set(agent.profileId, profileSessions);
    const presence = presenceAfterEvent(agent.presence, event);
    const sessionId = event.sessionId;

    let tracker = sessionId ? profileSessions.get(sessionId) : undefined;
    if (sessionId && TERMINAL_TYPES.has(event.type ?? "") && !tracker) {
      const ghost = [...profileSessions.values()].find((item) => item.sessionId.startsWith("snapshot:"));
      if (ghost) {
        profileSessions.delete(ghost.sessionId);
        tracker = { ...ghost, sessionId };
        profileSessions.set(sessionId, tracker);
      }
    }
    if (sessionId && !tracker) {
      tracker = {
        sessionId,
        active: false,
        status: "working",
        activity: "thinking",
        taskSummary: agent.taskSummary,
        toolFamily: null,
        waitingReason: null,
        updatedAt: null,
        lastEventId: null,
      };
      profileSessions.set(sessionId, tracker);
    }

    if (tracker && timestamp(event.occurredAt) < timestamp(tracker.updatedAt)) {
      return { ...agent, presence };
    }
    if (tracker) {
      tracker.updatedAt = event.occurredAt;
      tracker.lastEventId = event.eventId;
    }

    switch (event.type) {
      case "activity.started":
        if (tracker) {
          tracker.active = true;
          tracker.status = "working";
          tracker.activity = event.activity === "using-tool" ? "using-tool" : "thinking";
          tracker.taskSummary = event.taskSummary;
          tracker.toolFamily = null;
          tracker.waitingReason = null;
        }
        break;
      case "activity.waiting":
        if (tracker) {
          tracker.active = true;
          tracker.status = "waiting";
          tracker.activity = "waiting";
          tracker.toolFamily = null;
          tracker.waitingReason = event.waitingReason ?? "unknown";
        }
        break;
      case "activity.resumed":
        if (tracker) {
          tracker.active = true;
          tracker.status = "working";
          tracker.activity = "thinking";
          tracker.toolFamily = null;
          tracker.waitingReason = null;
        }
        break;
      case "tool.started":
        if (tracker) {
          tracker.active = true;
          tracker.status = "working";
          tracker.activity = "using-tool";
          tracker.toolFamily = event.toolFamily ?? "other";
          tracker.waitingReason = null;
        }
        break;
      case "tool.finished":
        if (tracker) {
          tracker.active = true;
          tracker.status = "working";
          tracker.activity = "thinking";
          tracker.toolFamily = null;
        }
        break;
      case "activity.completed":
      case "activity.interrupted":
      case "activity.failed":
      case "activity.settled":
        if (tracker) {
          tracker.active = false;
          tracker.toolFamily = null;
          tracker.waitingReason = null;
        }
        break;
      default:
        break;
    }

    return aggregateAgent(agent, event, presence, profileSessions);
  }
}

function aggregateAgent(
  agent: BridgeVisualAgent,
  event: SafeBridgeEvent,
  presence: BridgePresence,
  sessions: ReadonlyMap<string, SessionTracker>,
): BridgeVisualAgent {
  const active = [...sessions.values()].filter((session) => session.active);
  if (active.length > 0) {
    const dominant = active.reduce((selected, candidate) =>
      sessionPriority(candidate) > sessionPriority(selected) ? candidate : selected,
    );
    return {
      ...agent,
      status: dominant.status,
      activity: dominant.activity,
      destinationId: agent.workplaceId,
      animation: animationForTool(dominant),
      taskSummary: dominant.taskSummary,
      toolFamily: dominant.toolFamily,
      waitingReason: dominant.waitingReason,
      presence,
      activeSessionCount: active.length,
      dominantSessionId: dominant.sessionId,
      lastEventId: dominant.lastEventId,
      updatedAt: dominant.updatedAt,
    };
  }

  const terminalTask = event.sessionId ? sessions.get(event.sessionId)?.taskSummary ?? agent.taskSummary : agent.taskSummary;
  const base = {
    ...agent,
    presence,
    activeSessionCount: 0,
    dominantSessionId: null,
    lastEventId: event.eventId,
    updatedAt: event.occurredAt,
    toolFamily: null,
    waitingReason: null,
  };

  if (event.type === "activity.completed") {
    return terminal(base, "done", "completed", "celebrate", "completed", terminalTask);
  }
  if (event.type === "activity.interrupted") {
    return terminal(base, "interrupted", "interrupted", "confused", "interrupted", terminalTask);
  }
  if (event.type === "activity.failed") {
    return terminal(base, "error", "error", "error", "failed", terminalTask);
  }
  if (presence === "offline") {
    return {
      ...base,
      status: "offline",
      activity: "offline",
      destinationId: agent.homeId,
      animation: "sleep",
      taskSummary: null,
    };
  }
  if (event.type === "activity.settled" || event.type === "session.started" || event.type === "profile.online") {
    return {
      ...base,
      status: "idle",
      activity: "roaming",
      destinationId: "town",
      animation: "walk",
      taskSummary: null,
    };
  }
  return base;
}

function terminal(
  agent: BridgeVisualAgent,
  status: BridgeAgentStatus,
  activity: BridgeAgentActivity,
  animation: BridgeVisualAgent["animation"],
  lastOutcome: NonNullable<BridgeVisualAgent["lastOutcome"]>,
  taskSummary: string | null,
): BridgeVisualAgent {
  return {
    ...agent,
    status,
    activity,
    destinationId: agent.workplaceId,
    animation,
    taskSummary,
    lastOutcome,
    lastOutcomeAt: agent.updatedAt,
  };
}

function trackerFromAgent(sessionId: string, agent: BridgeVisualAgent): SessionTracker {
  return {
    sessionId,
    active: true,
    status: agent.status === "waiting" ? "waiting" : "working",
    activity:
      agent.status === "waiting" ? "waiting" : agent.activity === "using-tool" ? "using-tool" : "thinking",
    taskSummary: agent.taskSummary,
    toolFamily: agent.toolFamily,
    waitingReason: agent.waitingReason,
    updatedAt: agent.updatedAt,
    lastEventId: agent.lastEventId,
  };
}

function presenceAfterEvent(current: BridgePresence, event: SafeBridgeEvent): BridgePresence {
  if (event.type === "profile.offline") return "offline";
  if (event.type === "profile.unknown") return "unknown";
  if (event.source === "hermes-session-sqlite") return "degraded";
  if (event.source === "hermes-plugin") return "online";
  return current;
}

function animationForTool(session: SessionTracker): BridgeVisualAgent["animation"] {
  if (session.status === "waiting") return "waiting";
  if (session.activity !== "using-tool") return "thinking";
  switch (session.toolFamily) {
    case "files":
      return "reading";
    case "terminal":
    case "code":
      return "typing";
    case "browser":
      return "using-computer";
    case "research":
      return "thinking";
    case "communication":
      return "using-phone";
    case "crm":
      return "organizing";
    default:
      return "working";
  }
}

function sessionPriority(session: SessionTracker): string {
  const state = session.status === "waiting" ? "2" : "1";
  const when = String(timestamp(session.updatedAt)).padStart(20, "0");
  return `${state}:${when}:${session.sessionId}`;
}

function timestamp(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function remember(target: Set<string>, value: string): void {
  target.add(value);
  if (target.size <= 2048) return;
  const oldest = target.values().next().value as string | undefined;
  if (oldest) target.delete(oldest);
}

