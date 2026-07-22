import { describe, expect, it, vi } from "vitest";
import { abortableDelay, BridgeClient, normalizeBridgeBaseUrl } from "./bridgeClient";

describe("BridgeClient", () => {
  it("loads a snapshot, tails events after the cursor, and only issues GET requests", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let pollAborted = false;
    const responses: unknown[] = [
      statePayload("idle", 0, null),
      eventsPayload([eventPayload("evt-tail", "activity.settled", "2026-07-16T11:59:59Z")]),
      statePayload("idle", 0, null),
      eventsPayload([eventPayload("evt-new", "activity.started", "2026-07-16T12:00:02Z")]),
    ];
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), ...(init ? { init } : {}) });
      const next = responses.shift();
      if (next !== undefined) return jsonResponse(next);
      return pendingResponse(init?.signal, () => {
        pollAborted = true;
      });
    }) as unknown as typeof fetch;

    const client = new BridgeClient({
      fetchFn,
      now: sequenceClock([
        "2026-07-16T12:00:00Z",
        "2026-07-16T12:00:00Z",
        "2026-07-16T12:00:01Z",
        "2026-07-16T12:00:03Z",
      ]),
      backoff: { jitterRatio: 0 },
    });
    const delivered: string[] = [];
    client.subscribeEvents((events) => delivered.push(...events.map((event) => event.eventId)));
    await client.start();
    await waitUntil(() => client.getState().agents[0]?.status === "working");

    expect(client.getState()).toMatchObject({ source: "bridge", mode: "online", lastEventId: "evt-new" });
    expect(client.getState().agents[0]).toMatchObject({
      profileId: "default",
      status: "working",
      taskSummary: "Nueva tarea",
      activeSessionCount: 1,
    });
    expect(calls.some((call) => call.url.includes("after=evt-tail"))).toBe(true);
    expect(delivered).toEqual(["evt-new"]);
    expect(calls.every((call) => call.init?.method === "GET" && call.init.body === undefined)).toBe(true);

    await client.stop();
    expect(pollAborted).toBe(true);
  });

  it("enters controllable simulation fallback when the bridge is unavailable", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("connection refused");
    }) as unknown as typeof fetch;
    const client = new BridgeClient({ fetchFn, backoff: { initialMs: 10, jitterRatio: 0 } });

    await client.start();
    expect(client.getState()).toMatchObject({ source: "simulation", mode: "simulated" });
    expect(client.getState().agents).toHaveLength(4);

    client.setFallbackEnabled(false);
    expect(client.getState().mode).toBe("offline");
    client.setFallbackEnabled(true);
    expect(client.getState().mode).toBe("simulated");
    await client.stop();
  });

  it("reports offline instead of simulation when fallback is disabled", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("connection refused");
    }) as unknown as typeof fetch;
    const client = new BridgeClient({
      fetchFn,
      fallbackEnabled: false,
      backoff: { initialMs: 10, jitterRatio: 0 },
    });

    await client.start();
    expect(client.getState().mode).toBe("offline");
    await client.stop();
  });

  it("cancels an in-flight long poll on stop", async () => {
    let aborted = false;
    let callCount = 0;
    const responses: unknown[] = [statePayload("idle", 0, null)];
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      callCount += 1;
      const next = responses.shift();
      if (next !== undefined) return jsonResponse(next);
      return pendingResponse(init?.signal, () => {
        aborted = true;
      });
    }) as unknown as typeof fetch;
    const client = new BridgeClient({ fetchFn });

    await client.start();
    await waitUntil(() => callCount >= 2);
    await client.stop();

    expect(aborted).toBe(true);
    expect(client.isRunning()).toBe(false);
  });
});

describe("bridge transport safety", () => {
  it("restricts absolute bridge URLs to loopback", () => {
    expect(normalizeBridgeBaseUrl("/bridge/")).toBe("/bridge");
    expect(normalizeBridgeBaseUrl("http://127.0.0.1:8765/")).toBe("http://127.0.0.1:8765");
    expect(() => normalizeBridgeBaseUrl("https://example.com/bridge")).toThrow(TypeError);
    expect(() => normalizeBridgeBaseUrl("http://user:pass@127.0.0.1:8765")).toThrow(TypeError);
  });

  it("makes retry delays abortable", async () => {
    const controller = new AbortController();
    const waiting = abortableDelay(60_000, controller.signal);
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ name: "AbortError" });
  });
});

function statePayload(status: string, count: number, dominant: string | null) {
  return {
    schema: "syka.world.state.v1",
    generated_at: "2026-07-16T12:00:00Z",
    characters: [
      {
        profile_id: "default",
        character_id: "syka",
        display_name: "Syka",
        home: "syka-home",
        workplace: "central-office",
        status,
        activity: status === "working" ? "thinking" : "roaming",
        destination: status === "working" ? "central-office" : "town",
        animation: status === "working" ? "thinking" : "walk",
        task_summary: null,
        presence: "online",
        active_session_count: count,
        dominant_session_id: dominant,
        last_event_id: null,
        updated_at: "2026-07-16T12:00:00Z",
      },
    ],
  };
}

function eventsPayload(events: unknown[]) {
  return { schema: "syka.world.events.v1", events };
}

function eventPayload(eventId: string, type: string, occurredAt: string) {
  return {
    schema: "syka.world.event.v1",
    event_id: eventId,
    occurred_at: occurredAt,
    profile_id: "default",
    session_id: "session-new",
    type,
    source: "hermes-plugin",
    activity: "thinking",
    task_summary: type === "activity.started" ? "Nueva tarea" : null,
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function pendingResponse(signal: AbortSignal | null | undefined, onAbort: () => void): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const abort = () => {
      onAbort();
      const error = new Error("Aborted");
      error.name = "AbortError";
      reject(error);
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

function sequenceClock(values: string[]): () => Date {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)] ?? "2026-07-16T12:00:00Z");
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Condition was not reached");
}
