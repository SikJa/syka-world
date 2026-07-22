import { describe, expect, it } from "vitest";
import { BridgeEventReducer } from "./eventReducer";
import { toCoreBridgeSignals } from "./coreAdapter";
import {
  BridgePayloadError,
  mapBridgeEventsPayload,
  mapBridgeStatePayload,
} from "./mapping";
import { sanitizeTaskSummary } from "./sanitization";

describe("bridge payload hardening", () => {
  it("sanitizes summaries again before they reach presentation", () => {
    const result = sanitizeTaskSummary(
      "\u202e<script>alert(1)</script> abrir https://example.com token=supersecretvalue y sk-1234567890",
    );

    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain("https://example.com");
    expect(result).not.toContain("supersecretvalue");
    expect(result).not.toContain("sk-1234567890");
    expect(result).toContain("[link]");
    expect(result).toContain("[redacted]");
  });

  it("does not coerce objects into task text and limits unicode by code point", () => {
    expect(sanitizeTaskSummary({ prompt: "private" })).toBeNull();
    const result = sanitizeTaskSummary("🙂".repeat(200));
    expect(Array.from(result ?? "")).toHaveLength(140);
    expect(result?.endsWith("…")).toBe(true);
  });

  it("maps the four legacy profiles with pinned identity and surfaces unknown profiles as unassigned", () => {
    const snapshot = mapBridgeStatePayload(
      statePayload([
        bridgeCharacter("elen", {
          character_id: "spoofed",
          display_name: "Not Elen",
          home: "outside",
          workplace: "outside",
          status: "working",
          activity: "thinking",
          destination: "outside",
          task_summary: " Preparar   campaña ",
          active_session_count: 2,
          dominant_session_id: "session-b",
          presence: "online",
        }),
        bridgeCharacter("unknown-profile", { status: "working" }),
      ]),
    );

    // Legacy preset profiles are always present (seeded as unknown) plus the
    // unknown profile is surfaced as a discovered-but-unassigned entry. It must
    // never be attributed to Syka.
    const legacyAgents = snapshot.agents.filter((agent) =>
      ["default", "elen", "astrelis", "zerny"].includes(agent.profileId),
    );
    expect(legacyAgents).toHaveLength(4);
    const elen = snapshot.agents.find((agent) => agent.profileId === "elen");
    expect(elen).toMatchObject({
      characterId: "elen",
      displayName: "Elen",
      homeId: "home-elen",
      workplaceId: "office-marketing",
      destinationId: "office-marketing",
      taskSummary: "Preparar campaña",
      activeSessionCount: 2,
      dominantSessionId: "session-b",
    });
    const unknown = snapshot.agents.find((agent) => agent.profileId === "unknown-profile");
    expect(unknown).toBeDefined();
    expect(unknown?.characterId).not.toBe("syka");
    expect(unknown?.characterId).not.toBe("elen");
    expect(snapshot.mode).toBe("online");
  });

  it("hides stale summaries while idle and treats an answered unknown bridge as degraded", () => {
    const snapshot = mapBridgeStatePayload(
      statePayload([
        bridgeCharacter("default", {
          status: "idle",
          task_summary: "must not leak",
          presence: "unknown",
        }),
      ]),
    );

    expect(snapshot.agents[0]?.taskSummary).toBeNull();
    expect(snapshot.mode).toBe("degraded");
  });

  it("rejects unsupported state and event envelopes", () => {
    expect(() => mapBridgeStatePayload({ schema: "future", characters: [] })).toThrow(
      BridgePayloadError,
    );
    expect(() => mapBridgeEventsPayload({ schema: "future", events: [] })).toThrow(
      BridgePayloadError,
    );
  });

  it("maps events without forwarding metadata, preserving unknown profile ids as unassigned", () => {
    const [event] = mapBridgeEventsPayload({
      schema: "syka.world.events.v1",
      events: [
        bridgeEvent("evt-1", "not-a-profile", "activity.started", {
          task_summary: "secret=abcdefghijk https://example.com",
          metadata: { reason: "approval", prompt: "private prompt" },
        }),
      ],
    });

    expect(event).toEqual({
      eventId: "evt-1",
      occurredAt: "2026-07-16T12:00:01.000Z",
      // Unknown profile ids are preserved (not dropped) so the UI can surface
      // them for onboarding. They are never attributed to a legacy character.
      profileId: "not-a-profile",
      sessionId: "session-a",
      type: "activity.started",
      source: "hermes-plugin",
      activity: "thinking",
      taskSummary: "[redacted] [link]",
      toolFamily: null,
      waitingReason: "approval",
    });
    expect(event).not.toHaveProperty("metadata");
  });

  it("adapts safe tool events to core signals without losing presence or tool family", () => {
    const [event] = mapBridgeEventsPayload({
      schema: "syka.world.events.v1",
      events: [
        bridgeEvent("evt-tool", "zerny", "tool.started", {
          source: "hermes-session-sqlite",
          tool_family: "crm",
        }),
      ],
    });
    expect(event).toBeDefined();
    expect(toCoreBridgeSignals(event!)).toEqual([
      {
        schema: "syka.world.bridge-signal.v1",
        eventId: "evt-tool:presence",
        kind: "presence.degraded",
        profileId: "zerny",
        sessionId: "session-a",
        occurredAt: "2026-07-16T12:00:01.000Z",
      },
      {
        schema: "syka.world.bridge-signal.v1",
        eventId: "evt-tool",
        kind: "tool.started",
        profileId: "zerny",
        sessionId: "session-a",
        occurredAt: "2026-07-16T12:00:01.000Z",
        toolFamily: "crm",
      },
    ]);
  });
});

describe("incremental bridge projection", () => {
  it("preserves concurrent work when the dominant session finishes", () => {
    const initial = mapBridgeStatePayload(
      statePayload([
        bridgeCharacter("elen", {
          status: "waiting",
          activity: "waiting",
          animation: "waiting",
          task_summary: "Esperando aprobación",
          waiting_reason: "approval",
          presence: "online",
          active_session_count: 2,
          dominant_session_id: "session-b",
          session_id: "session-b",
          last_event_id: "evt-before",
          updated_at: "2026-07-16T12:00:00Z",
        }),
      ], "2026-07-16T12:00:00Z"),
    );
    const reducer = new BridgeEventReducer(initial);

    const first = reducer.apply(
      mapBridgeEventsPayload({
        schema: "syka.world.events.v1",
        events: [bridgeEvent("evt-done-b", "elen", "activity.completed", { session_id: "session-b" })],
      }),
      new Date("2026-07-16T12:00:02Z"),
    );
    const afterFirst = first.agents.find((agent) => agent.profileId === "elen");
    expect(afterFirst).toMatchObject({
      status: "working",
      activeSessionCount: 1,
    });
    expect(afterFirst?.dominantSessionId).toMatch(/^snapshot:elen:/);

    const second = reducer.apply(
      mapBridgeEventsPayload({
        schema: "syka.world.events.v1",
        events: [
          bridgeEvent("evt-done-a", "elen", "activity.completed", {
            session_id: "session-a",
            occurred_at: "2026-07-16T12:00:03Z",
          }),
        ],
      }),
      new Date("2026-07-16T12:00:03Z"),
    );
    expect(second.agents.find((agent) => agent.profileId === "elen")).toMatchObject({
      status: "done",
      activeSessionCount: 0,
      dominantSessionId: null,
      lastOutcome: "completed",
    });
  });

  it("ignores historical event state while still advancing its cursor", () => {
    const initial = mapBridgeStatePayload(
      statePayload([
        bridgeCharacter("zerny", {
          status: "idle",
          presence: "online",
          updated_at: "2026-07-16T12:00:04Z",
        }),
      ], "2026-07-16T12:00:05Z"),
    );
    const reducer = new BridgeEventReducer(initial);
    const next = reducer.apply(
      mapBridgeEventsPayload({
        schema: "syka.world.events.v1",
        events: [
          bridgeEvent("old-event", "zerny", "activity.started", {
            occurred_at: "2026-07-16T12:00:01Z",
            task_summary: "Old task",
          }),
        ],
      }),
    );

    expect(next.lastEventId).toBe("old-event");
    expect(next.agents.find((agent) => agent.profileId === "zerny")?.status).toBe("idle");
  });
});

function statePayload(characters: unknown[], generatedAt = "2026-07-16T12:00:00Z") {
  return {
    schema: "syka.world.state.v1",
    generated_at: generatedAt,
    characters,
  };
}

function bridgeCharacter(profileId: string, overrides: Record<string, unknown> = {}) {
  return {
    character_id: profileId,
    display_name: profileId,
    profile_id: profileId,
    home: `${profileId}-home`,
    workplace: `${profileId}-workplace`,
    status: "idle",
    activity: "roaming",
    destination: "town",
    animation: "walk",
    task_summary: null,
    presence: "unknown",
    active_session_count: 0,
    updated_at: "2026-07-16T11:59:59Z",
    ...overrides,
  };
}

function bridgeEvent(
  eventId: string,
  profileId: string,
  type: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    schema: "syka.world.event.v1",
    event_id: eventId,
    occurred_at: "2026-07-16T12:00:01Z",
    profile_id: profileId,
    session_id: "session-a",
    type,
    source: "hermes-plugin",
    activity: "thinking",
    ...overrides,
  };
}
