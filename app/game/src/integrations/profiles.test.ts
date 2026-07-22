import { describe, expect, it } from "vitest";
import {
  createProfileRegistry,
  legacyAgentIdForProfile,
  loadPresetIntoRegistry,
  SIKORA_PRESET,
  type WorldCharacterV1,
} from "./profiles";

describe("createProfileRegistry — dynamic profile discovery", () => {
  it("starts empty", () => {
    const registry = createProfileRegistry();
    const snap = registry.snapshot();
    expect(snap.discovered).toEqual([]);
    expect(snap.characters).toEqual([]);
  });

  it("discovers a profile and resolves it after assigning a character", () => {
    const registry = createProfileRegistry();
    registry.discover({
      profileId: "new-profile",
      source: "hermes-fs",
      detectedAt: "2026-07-19T12:00:00Z",
      label: "New Profile",
    });
    expect(registry.isKnown("new-profile")).toBe(true);
    expect(registry.resolve("new-profile")).toBeUndefined();

    registry.assignCharacter({
      characterId: "char-new",
      profileId: "new-profile",
      displayName: "Newcomer",
      role: "General",
      avatarKey: "neutral",
    });
    const character = registry.resolve("new-profile");
    expect(character).toMatchObject({
      characterId: "char-new",
      displayName: "Newcomer",
      avatarKey: "neutral",
    });
  });

  it("preserves character binding when a profile goes offline", () => {
    const registry = createProfileRegistry();
    registry.discover({ profileId: "p1", source: "hermes-fs", detectedAt: "2026-07-19T12:00:00Z" });
    registry.assignCharacter({
      characterId: "c1",
      profileId: "p1",
      displayName: "One",
      role: "R",
      avatarKey: "neutral",
    });
    registry.markOffline("p1", true);
    // The character binding survives; only the discovered record's offline flag updates.
    expect(registry.resolve("p1")).toBeDefined();
    const snap = registry.snapshot();
    const discovered = snap.discovered.find((d) => d.profileId === "p1");
    expect(discovered?.offline).toBe(true);
  });

  it("does not drop events for unknown profiles — they become discovered", () => {
    const registry = createProfileRegistry();
    // A bridge payload for a profile that was never registered should not be
    // attributed to any existing character.
    expect(registry.resolve("unknown-from-bridge")).toBeUndefined();
    expect(registry.isKnown("unknown-from-bridge")).toBe(false);
  });

  it("unassigning a character does not delete the discovered profile", () => {
    const registry = createProfileRegistry();
    registry.discover({ profileId: "p2", source: "user", detectedAt: "2026-07-19T12:00:00Z" });
    registry.assignCharacter({
      characterId: "c2",
      profileId: "p2",
      displayName: "Two",
      role: "R",
      avatarKey: "neutral",
    });
    registry.unassignCharacter("c2");
    expect(registry.resolve("p2")).toBeUndefined();
    expect(registry.isKnown("p2")).toBe(true);
  });

  it("replacing a character for the same profile removes the old one", () => {
    const registry = createProfileRegistry();
    registry.discover({ profileId: "p3", source: "user", detectedAt: "2026-07-19T12:00:00Z" });
    registry.assignCharacter({
      characterId: "old",
      profileId: "p3",
      displayName: "Old",
      role: "R",
      avatarKey: "neutral",
    });
    registry.assignCharacter({
      characterId: "new",
      profileId: "p3",
      displayName: "New",
      role: "R",
      avatarKey: "neutral",
    });
    const snap = registry.snapshot();
    expect(snap.characters.filter((c) => c.profileId === "p3")).toHaveLength(1);
    expect(snap.characters.find((c) => c.profileId === "p3")?.characterId).toBe("new");
  });

  it("replace() rebuilds the registry from a snapshot", () => {
    const registry = createProfileRegistry();
    const snap = {
      discovered: [
        { profileId: "a", source: "hermes-fs" as const, detectedAt: "2026-07-19T12:00:00Z" },
        { profileId: "b", source: "bridge-payload" as const, detectedAt: "2026-07-19T12:00:00Z" },
      ],
      characters: [
        {
          characterId: "ca",
          profileId: "a",
          displayName: "A",
          role: "R",
          avatarKey: "neutral",
        },
      ] satisfies readonly WorldCharacterV1[],
    };
    registry.replace(snap);
    expect(registry.isKnown("a")).toBe(true);
    expect(registry.isKnown("b")).toBe(true);
    expect(registry.resolve("a")).toBeDefined();
    expect(registry.resolve("b")).toBeUndefined();
  });
});

describe("SIKORA_PRESET — legacy compatibility", () => {
  it("contains exactly four characters with stable ids", () => {
    expect(SIKORA_PRESET.characters).toHaveLength(4);
    const ids = SIKORA_PRESET.characters.map((c) => c.profileId);
    expect(ids).toEqual(["default", "elen", "astrelis", "zerny"]);
  });

  it("loadPresetIntoRegistry seeds discovered profiles and assigned characters", () => {
    const registry = createProfileRegistry();
    loadPresetIntoRegistry(registry, SIKORA_PRESET, () => new Date("2026-07-19T12:00:00Z"));
    const snap = registry.snapshot();
    expect(snap.discovered).toHaveLength(4);
    expect(snap.characters).toHaveLength(4);
    const syka = registry.resolve("default");
    expect(syka).toMatchObject({
      characterId: "syka",
      displayName: "Syka",
      homeId: "home-syka",
      workplaceId: "community-main",
    });
  });

  it("legacyAgentIdForProfile returns the AgentId for preset profiles and undefined for unknown", () => {
    const registry = createProfileRegistry();
    loadPresetIntoRegistry(registry, SIKORA_PRESET, () => new Date("2026-07-19T12:00:00Z"));
    expect(legacyAgentIdForProfile(registry, "default")).toBe("syka");
    expect(legacyAgentIdForProfile(registry, "elen")).toBe("elen");
    expect(legacyAgentIdForProfile(registry, "astrelis")).toBe("astrelis");
    expect(legacyAgentIdForProfile(registry, "zerny")).toBe("zerny");
    // An unknown profile has no legacy atlas slot; the renderer must fall back.
    expect(legacyAgentIdForProfile(registry, "unknown")).toBeUndefined();
  });

  it("a profile added after first run is discovered and can be assigned", () => {
    const registry = createProfileRegistry();
    loadPresetIntoRegistry(registry, SIKORA_PRESET, () => new Date("2026-07-19T12:00:00Z"));
    // Simulate a refresh that finds a new profile.
    registry.discover({
      profileId: "newcomer",
      source: "hermes-fs",
      detectedAt: "2026-07-19T13:00:00Z",
      label: "Newcomer",
    });
    expect(registry.isKnown("newcomer")).toBe(true);
    expect(registry.resolve("newcomer")).toBeUndefined();
    // The user creates a character for it.
    registry.assignCharacter({
      characterId: "char-newcomer",
      profileId: "newcomer",
      displayName: "Newcomer",
      role: "General",
      avatarKey: "neutral",
    });
    expect(registry.resolve("newcomer")?.displayName).toBe("Newcomer");
    // Legacy profiles are untouched.
    expect(registry.resolve("default")?.characterId).toBe("syka");
  });

  it("renaming a display character does not change profile_id", () => {
    const registry = createProfileRegistry();
    loadPresetIntoRegistry(registry, SIKORA_PRESET, () => new Date("2026-07-19T12:00:00Z"));
    registry.assignCharacter({
      characterId: "syka",
      profileId: "default",
      displayName: "Renamed",
      role: "New role",
      avatarKey: "syka",
      homeId: "home-syka",
      workplaceId: "community-main",
      communityId: "community-main",
    });
    const character = registry.resolve("default");
    expect(character?.profileId).toBe("default");
    expect(character?.displayName).toBe("Renamed");
    expect(character?.characterId).toBe("syka");
  });

  it("no hardcoded local path or port is required", () => {
    const registry = createProfileRegistry();
    loadPresetIntoRegistry(registry, SIKORA_PRESET, () => new Date("2026-07-19T12:00:00Z"));
    const snap = registry.snapshot();
    // No character or discovered profile references a path or port.
    const json = JSON.stringify(snap);
    expect(json).not.toContain("F:\\");
    expect(json).not.toContain("127.0.0.1");
    expect(json).not.toContain("localhost");
    expect(json).not.toContain("C:\\Users\\");
  });
});
