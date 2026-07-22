import { BridgeEventReducer } from "./eventReducer";
import { mapBridgeEventsPayload, mapBridgeStatePayload } from "./mapping";
import { createOfflineSnapshot, createSimulatedSnapshot } from "./simulated";
import type {
  BridgeBackoffOptions,
  BridgeClientOptions,
  BridgeEventListener,
  BridgeSnapshotListener,
  BridgeVisualSnapshot,
  SafeBridgeEvent,
} from "./types";

const DEFAULT_BASE_URL = "/bridge";
const DEFAULT_LONG_POLL_SECONDS = 15;

interface NormalizedBackoff {
  readonly initialMs: number;
  readonly maximumMs: number;
  readonly multiplier: number;
  readonly jitterRatio: number;
}

/**
 * Read-only client for Syka World Bridge v0.3. Its only network operation is
 * GET against the state and event endpoints; it has no command/task surface.
 */
export class BridgeClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly longPollSeconds: number;
  private readonly backoff: NormalizedBackoff;
  private readonly now: () => Date;
  private readonly random: () => number;
  private readonly delayFn: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  private readonly simulatedSnapshotFactory: () => BridgeVisualSnapshot;
  private readonly listeners = new Set<BridgeSnapshotListener>();
  private readonly eventListeners = new Set<BridgeEventListener>();
  private readonly deliveredEventIds = new Set<string>();

  private fallbackEnabled: boolean;
  private snapshot: BridgeVisualSnapshot;
  private reducer: BridgeEventReducer;
  private controller: AbortController | null = null;
  private loopPromise: Promise<void> | null = null;
  private readyPromise: Promise<BridgeVisualSnapshot> | null = null;
  private resolveReady: ((snapshot: BridgeVisualSnapshot) => void) | null = null;

  constructor(options: BridgeClientOptions = {}) {
    this.baseUrl = normalizeBridgeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.longPollSeconds = clamp(options.longPollSeconds ?? DEFAULT_LONG_POLL_SECONDS, 0, 20);
    this.backoff = normalizeBackoff(options.backoff);
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.delayFn = options.delay ?? abortableDelay;
    this.fallbackEnabled = options.fallbackEnabled ?? true;
    this.simulatedSnapshotFactory =
      options.simulatedSnapshotFactory ?? (() => createSimulatedSnapshot(this.now()));
    this.snapshot = this.fallbackEnabled
      ? this.safeSimulatedSnapshot()
      : createOfflineSnapshot(createSimulatedSnapshot(this.now()), this.now());
    this.reducer = new BridgeEventReducer(this.snapshot);
  }

  getState(): BridgeVisualSnapshot {
    return this.snapshot;
  }

  isRunning(): boolean {
    return this.controller !== null && !this.controller.signal.aborted;
  }

  subscribe(listener: BridgeSnapshotListener, emitCurrent = true): () => void {
    this.listeners.add(listener);
    if (emitCurrent) listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  subscribeEvents(listener: BridgeEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
    if (!enabled && this.snapshot.mode === "simulated") {
      this.publish(createOfflineSnapshot(this.snapshot, this.now()));
    } else if (enabled && this.snapshot.source === "simulation" && this.snapshot.mode === "offline") {
      this.publish(this.safeSimulatedSnapshot());
    }
  }

  start(): Promise<BridgeVisualSnapshot> {
    if (this.readyPromise) return this.readyPromise;

    this.controller = new AbortController();
    this.readyPromise = new Promise<BridgeVisualSnapshot>((resolve) => {
      this.resolveReady = resolve;
    });
    const signal = this.controller.signal;
    this.loopPromise = this.run(signal).finally(() => {
      if (this.controller?.signal === signal) this.controller = null;
      this.resolveIfNeeded(this.snapshot);
    });
    return this.readyPromise;
  }

  async stop(): Promise<void> {
    const controller = this.controller;
    const loop = this.loopPromise;
    this.controller = null;
    this.loopPromise = null;
    this.readyPromise = null;
    this.resolveIfNeeded(this.snapshot);
    controller?.abort();
    if (loop) await loop;
  }

  private async run(signal: AbortSignal): Promise<void> {
    let attempt = 0;
    while (!signal.aborted) {
      try {
        await this.synchronize(signal);
        attempt = 0;
        await this.poll(signal);
      } catch (error) {
        if (signal.aborted || isAbortError(error)) return;
        attempt += 1;
        this.publishUnavailable();
        this.resolveIfNeeded(this.snapshot);
        try {
          await this.delayFn(backoffMilliseconds(this.backoff, attempt, this.random), signal);
        } catch (delayError) {
          if (signal.aborted || isAbortError(delayError)) return;
          throw delayError;
        }
      }
    }
  }

  private async synchronize(signal: AbortSignal): Promise<void> {
    const initialPayload = await this.getJson("/api/world/state", signal);
    const initialSnapshot = mapBridgeStatePayload(initialPayload, this.now);
    this.reducer = new BridgeEventReducer(initialSnapshot);
    this.publish(initialSnapshot);
    this.resolveIfNeeded(initialSnapshot);

    // Establish a tail cursor without replaying history over the authoritative
    // snapshot. A second snapshot closes the race between these two GETs.
    const bootstrapPayload = await this.getJson("/api/world/events?wait=0", signal);
    const bootstrapEvents = mapBridgeEventsPayload(bootstrapPayload);
    const tail = lastEventId(bootstrapEvents) ?? initialSnapshot.lastEventId;

    const reconciledPayload = await this.getJson("/api/world/state", signal);
    const reconciledSnapshot = mapBridgeStatePayload(reconciledPayload, this.now, tail);
    this.reducer = new BridgeEventReducer(reconciledSnapshot);
    this.publish(reconciledSnapshot);
  }

  private async poll(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const cursor = this.reducer.getSnapshot().lastEventId;
      const query = new URLSearchParams();
      if (cursor) query.set("after", cursor);
      query.set("wait", String(this.longPollSeconds));
      const payload = await this.getJson(`/api/world/events?${query.toString()}`, signal);
      const events = mapBridgeEventsPayload(payload);
      if (events.length === 0) continue;
      const next = this.reducer.apply(events, this.now());
      this.publish(next);
      const freshEvents = events.filter((event) => rememberDelivered(this.deliveredEventIds, event.eventId));
      if (freshEvents.length > 0) this.publishEvents(freshEvents, next);
    }
  }

  private async getJson(path: string, signal: AbortSignal): Promise<unknown> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal,
    });
    if (!response.ok) throw new BridgeTransportError(response.status);
    return response.json() as Promise<unknown>;
  }

  private publishUnavailable(): void {
    if (this.fallbackEnabled) {
      this.reducer = new BridgeEventReducer(this.safeSimulatedSnapshot());
      this.publish(this.reducer.getSnapshot());
      return;
    }
    const offline = createOfflineSnapshot(this.snapshot, this.now());
    this.reducer = new BridgeEventReducer(offline);
    this.publish(offline);
  }

  private safeSimulatedSnapshot(): BridgeVisualSnapshot {
    const candidate = this.simulatedSnapshotFactory();
    return {
      ...candidate,
      source: "simulation",
      mode: "simulated",
      generatedAt: this.now().toISOString(),
      lastEventId: null,
    };
  }

  private publish(snapshot: BridgeVisualSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // A view subscriber must not stop bridge reconnection.
      }
    }
  }

  private publishEvents(events: readonly SafeBridgeEvent[], snapshot: BridgeVisualSnapshot): void {
    for (const listener of this.eventListeners) {
      try {
        listener(events, snapshot);
      } catch {
        // Core/presentation consumers are isolated from transport recovery.
      }
    }
  }

  private resolveIfNeeded(snapshot: BridgeVisualSnapshot): void {
    const resolve = this.resolveReady;
    if (!resolve) return;
    this.resolveReady = null;
    resolve(snapshot);
  }
}

export class BridgeTransportError extends Error {
  readonly code = "bridge-unavailable";

  constructor(readonly status: number) {
    super("The local Syka World bridge is unavailable.");
    this.name = "BridgeTransportError";
  }
}

export function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(createAbortError());
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(done, Math.max(0, milliseconds));
    signal.addEventListener("abort", aborted, { once: true });

    function done(): void {
      signal.removeEventListener("abort", aborted);
      resolve();
    }

    function aborted(): void {
      clearTimeout(timeout);
      reject(createAbortError());
    }
  });
}

export function normalizeBridgeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed || DEFAULT_BASE_URL;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new TypeError("Bridge base URL must be same-origin or loopback HTTP.");
  }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  if (!loopback || (url.protocol !== "http:" && url.protocol !== "https:")) {
    throw new TypeError("Bridge base URL must be same-origin or loopback HTTP.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("Bridge base URL cannot contain credentials, a query, or a fragment.");
  }
  return url.toString().replace(/\/+$/, "");
}

function normalizeBackoff(value: BridgeBackoffOptions | undefined): NormalizedBackoff {
  const initialMs = clamp(value?.initialMs ?? 500, 10, 60_000);
  const maximumMs = clamp(value?.maximumMs ?? 15_000, initialMs, 120_000);
  return {
    initialMs,
    maximumMs,
    multiplier: clamp(value?.multiplier ?? 1.8, 1, 10),
    jitterRatio: clamp(value?.jitterRatio ?? 0.2, 0, 1),
  };
}

function backoffMilliseconds(backoff: NormalizedBackoff, attempt: number, random: () => number): number {
  const base = Math.min(backoff.maximumMs, backoff.initialMs * backoff.multiplier ** Math.max(0, attempt - 1));
  const jitter = base * backoff.jitterRatio * (clamp(random(), 0, 1) * 2 - 1);
  return Math.round(Math.max(0, base + jitter));
}

function lastEventId(events: readonly SafeBridgeEvent[]): string | null {
  return events.at(-1)?.eventId ?? null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, value));
}

function createAbortError(): Error {
  if (typeof DOMException !== "undefined") return new DOMException("Aborted", "AbortError");
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function rememberDelivered(target: Set<string>, eventId: string): boolean {
  if (target.has(eventId)) return false;
  target.add(eventId);
  if (target.size > 5000) {
    const oldest = target.values().next().value as string | undefined;
    if (oldest) target.delete(oldest);
  }
  return true;
}
