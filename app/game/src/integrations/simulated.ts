import { PROFILE_IDS, FRONTEND_BRIDGE_SCHEMA, type BridgeVisualSnapshot } from "./types";
import { createUnknownAgent } from "./mapping";

export function createSimulatedSnapshot(now: Date = new Date()): BridgeVisualSnapshot {
  return {
    schema: FRONTEND_BRIDGE_SCHEMA,
    source: "simulation",
    mode: "simulated",
    generatedAt: now.toISOString(),
    lastEventId: null,
    agents: PROFILE_IDS.map((profileId) => createUnknownAgent(profileId)),
  };
}

export function createOfflineSnapshot(
  previous: BridgeVisualSnapshot,
  now: Date = new Date(),
): BridgeVisualSnapshot {
  return {
    ...previous,
    mode: "offline",
    generatedAt: now.toISOString(),
  };
}

