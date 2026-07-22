import {
  BRIDGE_SIGNAL_SCHEMA,
  type AgentActivity,
  type GameStateV1,
  type BridgeSignalKind,
  type BridgeSignalV1,
} from "../core/contracts";
import { reconcileAgentObservation } from "../core/agents";
import type { BridgeAgentActivity, BridgeVisualSnapshot, SafeBridgeEvent } from "./types";

/**
 * Converts the privacy-minimized transport event into renderer-agnostic core
 * signals. Presence is emitted first, so the activity event remains the final
 * cursor and completion rewards are still applied exactly once by consumers.
 */
export function toCoreBridgeSignals(event: SafeBridgeEvent): readonly BridgeSignalV1[] {
  if (!event.profileId || !event.occurredAt) return [];
  const sessionId = event.sessionId ?? "profile";
  const result: BridgeSignalV1[] = [];
  const explicitPresence = explicitPresenceKind(event);
  const sourcePresence = sourcePresenceKind(event);
  const presence = explicitPresence ?? sourcePresence;
  if (presence) {
    result.push({
      schema: BRIDGE_SIGNAL_SCHEMA,
      eventId: `${event.eventId}:presence`,
      kind: presence,
      profileId: event.profileId,
      sessionId,
      occurredAt: event.occurredAt,
    });
  }

  const activityKind = activitySignalKind(event);
  if (activityKind) {
    result.push({
      schema: BRIDGE_SIGNAL_SCHEMA,
      eventId: event.eventId,
      kind: activityKind,
      profileId: event.profileId,
      sessionId,
      occurredAt: event.occurredAt,
      ...(event.taskSummary ? { taskSummary: event.taskSummary } : {}),
      ...(event.toolFamily ? { toolFamily: event.toolFamily } : {}),
    });
  }
  return result;
}

export function toCoreBridgeSignalBatch(events: readonly SafeBridgeEvent[]): readonly BridgeSignalV1[] {
  return events.flatMap(toCoreBridgeSignals);
}

export function reconcileCoreWithBridgeSnapshot(
  state: GameStateV1,
  snapshot: BridgeVisualSnapshot,
): GameStateV1 {
  return snapshot.agents.reduce(
    (current, agent) => reconcileAgentObservation(current, {
      profileId: agent.profileId,
      presence: agent.presence,
      activity: coreActivity(agent.activity),
      activeSessionCount: agent.activeSessionCount,
      ...(agent.dominantSessionId ? { dominantSessionId: agent.dominantSessionId } : {}),
      ...(agent.taskSummary ? { taskSummary: agent.taskSummary } : {}),
      ...(agent.toolFamily ? { toolFamily: agent.toolFamily } : {}),
      observedAt: agent.updatedAt ?? snapshot.generatedAt,
    }),
    state,
  );
}

function coreActivity(activity: BridgeAgentActivity): AgentActivity {
  if (activity === "roaming") return "idle";
  if (activity === "completed") return "done";
  return activity;
}

function explicitPresenceKind(event: SafeBridgeEvent): BridgeSignalKind | null {
  if (event.type === "profile.online") return "presence.online";
  if (event.type === "profile.offline") return "presence.offline";
  return null;
}

function sourcePresenceKind(event: SafeBridgeEvent): BridgeSignalKind | null {
  if (event.source === "hermes-plugin") return "presence.online";
  if (event.source === "hermes-session-sqlite") return "presence.degraded";
  return null;
}

function activitySignalKind(event: SafeBridgeEvent): BridgeSignalKind | null {
  switch (event.type) {
    case "activity.started":
    case "activity.waiting":
    case "activity.resumed":
    case "tool.started":
    case "tool.finished":
    case "activity.completed":
    case "activity.interrupted":
    case "activity.failed":
    case "activity.settled":
      return event.type;
    default:
      return null;
  }
}
