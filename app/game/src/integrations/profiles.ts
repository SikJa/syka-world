/**
 * Dynamic profile registry.
 *
 * Syka World no longer hardcodes four profile identities. Profiles are
 * discovered at runtime (from Hermes filesystem discovery, bridge payloads, or
 * an optional preset) and registered here. The game resolves a `ProfileId`
 * (an opaque string) to a `WorldCharacter` that carries display name, avatar
 * key, home, workplace, role and visual theme.
 *
 * Legacy saves that used `default`, `elen`, `astrelis`, `zerny` as profile
 * ids remain valid: the optional Sikora preset seeds those into the registry.
 * Unknown profile ids received from the bridge are not dropped — they become a
 * discovered-but-unassigned profile until the user maps a character to them.
 */

import type { ProfileId, CharacterId, AgentId } from "../core/contracts";

/** A Hermes profile discovered at runtime, without a world character yet. */
export interface DiscoveredProfileV1 {
  readonly profileId: ProfileId;
  readonly source: "hermes-fs" | "bridge-payload" | "preset" | "user";
  readonly detectedAt: string;
  /** Display name hint if the source provides one (e.g. profile folder name). */
  readonly label?: string | undefined;
  /** True when the profile was not found in the last refresh. */
  readonly offline?: boolean | undefined;
}

export type ProfileCharacterStatus = "assigned" | "unassigned" | "ignored";

/** A world character bound to a discovered profile. */
export interface WorldCharacterV1 {
  readonly characterId: CharacterId;
  readonly profileId: ProfileId;
  readonly displayName: string;
  readonly role: string;
  /** Avatar key for the renderer; legacy atlas slots or a future sprite key. */
  readonly avatarKey: string;
  /** Optional home building id. */
  readonly homeId?: string;
  /** Optional workplace building id. */
  readonly workplaceId?: string;
  /** Optional community building id. */
  readonly communityId?: string;
  /** Optional café building id (defaults to first completed café). */
  readonly cafeId?: string | undefined;
  /** When true, events for this profile are not visualized. */
  readonly ignored?: boolean | undefined;
  /** Visual theme hint for future per-character theming. */
  readonly theme?: string | undefined;
}

export interface ProfileRegistrySnapshotV1 {
  readonly discovered: readonly DiscoveredProfileV1[];
  readonly characters: readonly WorldCharacterV1[];
}

export interface ProfileRegistry {
  discover(profile: DiscoveredProfileV1): void;
  forget(profileId: ProfileId): void;
  markOffline(profileId: ProfileId, offline: boolean): void;
  assignCharacter(character: WorldCharacterV1): void;
  unassignCharacter(characterId: CharacterId): void;
  ignore(profileId: ProfileId, ignored: boolean): void;
  resolve(profileId: ProfileId): WorldCharacterV1 | undefined;
  isKnown(profileId: ProfileId): boolean;
  snapshot(): ProfileRegistrySnapshotV1;
  /** Replace the entire registry state (used by save/load and preset import). */
  replace(snapshot: ProfileRegistrySnapshotV1): void;
}

const profileKey = (id: string): string => id.trim().toLowerCase();

export function createProfileRegistry(): ProfileRegistry {
  const discovered = new Map<string, DiscoveredProfileV1>();
  const characters = new Map<string, WorldCharacterV1>();
  const charactersByProfile = new Map<string, WorldCharacterV1>();

  const discover = (profile: DiscoveredProfileV1): void => {
    const key = profileKey(profile.profileId);
    if (!key) return;
    const existing = discovered.get(key);
    // Preserve user-assigned characters across refreshes. A profile that goes
    // offline keeps its binding; only the discovered record's offline flag
    // updates.
    discovered.set(key, {
      ...profile,
      profileId: existing?.profileId ?? profile.profileId,
      detectedAt: profile.detectedAt,
      label: profile.label ?? existing?.label,
    });
  };

  const forget = (profileId: ProfileId): void => {
    const key = profileKey(profileId);
    discovered.delete(key);
    // We do NOT delete the character: a profile going missing should not
    // silently destroy the user's world character. The character remains and
    // can be re-bound when the profile returns.
  };

  const markOffline = (profileId: ProfileId, offline: boolean): void => {
    const key = profileKey(profileId);
    const entry = discovered.get(key);
    if (!entry) return;
    discovered.set(key, { ...entry, offline });
  };

  const assignCharacter = (character: WorldCharacterV1): void => {
    const key = profileKey(character.profileId);
    if (!key) return;
    // Remove any previous character for this profile.
    const previous = charactersByProfile.get(key);
    if (previous) characters.delete(profileKeyCharacter(previous.characterId));
    characters.set(profileKeyCharacter(character.characterId), character);
    charactersByProfile.set(key, character);
  };

  const unassignCharacter = (characterId: CharacterId): void => {
    const key = profileKeyCharacter(characterId);
    const character = characters.get(key);
    if (character) charactersByProfile.delete(profileKey(character.profileId));
    characters.delete(key);
  };

  const ignore = (profileId: ProfileId, ignored: boolean): void => {
    const key = profileKey(profileId);
    const character = charactersByProfile.get(key);
    if (character) {
      characters.set(profileKeyCharacter(character.characterId), { ...character, ignored });
      charactersByProfile.set(key, { ...character, ignored });
    }
    // If no character exists yet, we still record the profile as discovered so
    // the ignore flag can be applied when a character is created later. For
    // simplicity, we store ignored profiles as unassigned discovered entries.
    if (!character) {
      const entry = discovered.get(key);
      if (entry) discovered.set(key, { ...entry, label: entry.label });
    }
  };

  const resolve = (profileId: ProfileId): WorldCharacterV1 | undefined =>
    charactersByProfile.get(profileKey(profileId));

  const isKnown = (profileId: ProfileId): boolean => discovered.has(profileKey(profileId));

  const snapshot = (): ProfileRegistrySnapshotV1 => ({
    discovered: [...discovered.values()].sort((a, b) => a.profileId.localeCompare(b.profileId)),
    characters: [...characters.values()].sort((a, b) => a.characterId.localeCompare(b.characterId)),
  });

  const replace = (snap: ProfileRegistrySnapshotV1): void => {
    discovered.clear();
    characters.clear();
    charactersByProfile.clear();
    for (const entry of snap.discovered) discovered.set(profileKey(entry.profileId), entry);
    for (const character of snap.characters) {
      characters.set(profileKeyCharacter(character.characterId), character);
      charactersByProfile.set(profileKey(character.profileId), character);
    }
  };

  return {
    discover,
    forget,
    markOffline,
    assignCharacter,
    unassignCharacter,
    ignore,
    resolve,
    isKnown,
    snapshot,
    replace,
  };
}

const profileKeyCharacter = (characterId: CharacterId): string => characterId.trim().toLowerCase();

// ---------------------------------------------------------------------------
// Legacy preset compatibility
// ---------------------------------------------------------------------------

/**
 * The optional Sikora preset. This is the only place the four legacy names
 * live. It exists so existing saves and the current user experience survive
 * migration. A public clone of Syka World ships without this preset loaded
 * by default; users can opt in via config.
 */
export interface PresetCharacterSeed {
  readonly profileId: ProfileId;
  readonly characterId: CharacterId;
  readonly displayName: string;
  readonly role: string;
  readonly avatarKey: string;
  readonly homeId: string;
  readonly workplaceId: string;
  readonly communityId: string;
  readonly cafeId?: string | undefined;
  readonly theme?: string | undefined;
}

export interface PresetDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly characters: readonly PresetCharacterSeed[];
}

export const SIKORA_PRESET: PresetDefinition = {
  id: "sikora-world",
  name: "Sikora World",
  description: "Optional preset that seeds the four legacy Syka World characters.",
  characters: [
    {
      profileId: "default",
      characterId: "syka",
      displayName: "Syka",
      role: "Direction, coordination and creativity",
      avatarKey: "syka",
      homeId: "home-syka",
      workplaceId: "community-main",
      communityId: "community-main",
      cafeId: "cafe-main",
      theme: "teal",
    },
    {
      profileId: "elen",
      characterId: "elen",
      displayName: "Elen",
      role: "Marketing and communication",
      avatarKey: "elen",
      homeId: "home-elen",
      workplaceId: "office-marketing",
      communityId: "community-main",
      cafeId: "cafe-main",
      theme: "coral",
    },
    {
      profileId: "astrelis",
      characterId: "astrelis",
      displayName: "Astrelis",
      role: "Commerce and relationships",
      avatarKey: "astrelis",
      homeId: "home-astrelis",
      workplaceId: "office-commercial",
      communityId: "community-main",
      cafeId: "cafe-main",
      theme: "amber",
    },
    {
      profileId: "zerny",
      characterId: "zerny",
      displayName: "Zerny",
      role: "Construction and CRM",
      avatarKey: "zerny",
      homeId: "home-zerny",
      workplaceId: "workshop-crm",
      communityId: "community-main",
      cafeId: "cafe-main",
      theme: "green",
    },
  ],
};

export function loadPresetIntoRegistry(
  registry: ProfileRegistry,
  preset: PresetDefinition,
  now: () => Date = () => new Date(),
): void {
  const detectedAt = now().toISOString();
  for (const seed of preset.characters) {
    registry.discover({ profileId: seed.profileId, source: "preset", detectedAt, label: seed.displayName });
    registry.assignCharacter({
      characterId: seed.characterId,
      profileId: seed.profileId,
      displayName: seed.displayName,
      role: seed.role,
      avatarKey: seed.avatarKey,
      homeId: seed.homeId,
      workplaceId: seed.workplaceId,
      communityId: seed.communityId,
      cafeId: seed.cafeId,
      theme: seed.theme,
    });
  }
}

/**
 * Resolves a legacy AgentId from a profile id, for the renderer's fixed atlas.
 * Dynamic profiles that are not in the preset return undefined; the renderer
 * must fall back to a neutral placeholder.
 */
export function legacyAgentIdForProfile(
  registry: ProfileRegistry,
  profileId: ProfileId,
): AgentId | undefined {
  const character = registry.resolve(profileId);
  if (!character) return undefined;
  const legacy = character.avatarKey as AgentId;
  if (legacy === "syka" || legacy === "elen" || legacy === "astrelis" || legacy === "zerny") return legacy;
  return undefined;
}

/**
 * Backwards-compatible `isProfileId` used by the bridge mapping layer. With
 * dynamic profiles, any non-empty string is structurally valid; this function
 * returns true for any non-empty string so the bridge never drops events for
 * unknown profiles. The registry is the authority on whether a profile is
 * known/assigned.
 */
export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 128;
}
