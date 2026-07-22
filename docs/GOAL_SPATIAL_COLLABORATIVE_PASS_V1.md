# Syka World — Spatial Collaborative Pass v1

Status: ready to execute from the permanent Hermes profile `syka-world`.

This is the immediate execution brief. The larger document
`docs/GOAL_HABBO_SPATIAL_PUBLIC_FOUNDATION_V1.md` remains a product roadmap and
technical reference; it is **not** a mandate to implement the whole roadmap now.

## Intent

Deliver one focused, reviewable improvement to the existing game. Do not rebuild
Syka World, do not consume time artificially, and do not keep working merely to
fill a provider allowance. Finish as soon as the acceptance criteria are proven.

Expected duration: roughly 90–150 minutes. This is an estimate, not a quota.
Hard safety stop: 3 hours. If blocked or if a decision would materially alter the
approved visual direction, preserve the runnable game, report the decision, and
return control to the user.

The user, Codex, and the Hermes executor will continue polishing the project
together after this pass. Prefer a small integrated result over a broad rewrite.

## Product context

Syka World is a fixed-camera isometric 2.5D town where Hermes profiles appear as
inhabitants. The approved art direction is detailed, warm pixel art. Habbo is a
mechanical reference for grid occupancy, elevation, object interaction, and
correct front/behind ordering; do not copy Habbo assets, branding, UI, rooms, or
networking.

The current alpha already has a town, café interior, agents/NPCs, click movement,
possession/WASD controls, construction, routines, saves, and a passive Hermes
bridge. Preserve working behavior and assets unless a change is required by this
goal.

## Scope for this pass

### Priority 1 — Make the café spatially correct

Establish one shared spatial model for the café:

- walkable tiles and blocked tiles;
- object footprints and occupancy;
- elevation/standing height where required;
- actor position and destination;
- deterministic depth ordering;
- multi-part objects or occlusion anchors only where needed for convincing
  front/behind rendering;
- portals and valid spawn/exit tiles;
- seats or one representative interaction anchor.

Characters must not walk through the bar, tables, walls, or inaccessible décor.
They must render behind and in front of representative furniture correctly. Do
not solve this with arbitrary per-character offsets or a new set of fragile image
hotspots.

Keep the approved café image and visual quality. Rebuilding the entire interior
art library is out of scope. If the background must be decomposed, do the minimum
representative decomposition needed to prove the runtime cleanly.

### Priority 2 — Unify movement on that model

Click-to-move, possession/WASD, NPC routines, and agent destinations must consult
the same navigation and occupancy data. Preserve the existing control concepts:

- click: request movement;
- possession: explicit player-control mode;
- WASD: move while possessed;
- `E`: contextual interaction;
- `F`: enter/exit through a valid portal.

Movement must fail clearly when a destination is unreachable. Remove visual
teleporting, invalid spawns, and paths crossing blocked geometry in the café.

### Priority 3 — Prove dynamic Hermes identity at the boundary

Remove hard-coded four-profile assumptions only from the bridge/profile catalog
boundary touched by this pass. Runtime data must accept arbitrary stable profile
IDs and map known display metadata optionally. Preserve the current Syka, Elen,
Astrelis, and Zerny preset as sample data, not as the core schema.

Do not redesign the entire bridge. It remains passive and GET-only. Do not start
real Hermes tasks, expose session content, or add private profile data to Git.

### Priority 4 — Minimal supporting UI only

Change UI only where necessary to make this pass understandable:

- selected/possessed actor;
- current destination or unreachable state;
- available contextual action;
- bridge connected/disconnected/demo state if already present.

A complete UI redesign, construction-menu redesign, economy pass, and public-site
polish are explicitly deferred for collaborative follow-up.

## Execution order

1. Read this file completely, then inspect the current state and relevant code.
2. Run the existing baseline tests/build. Do not rewrite working systems blindly.
3. Write a short implementation map naming the authoritative spatial data and the
   systems that will consume it.
4. Implement the café vertical slice and shared movement integration.
5. Apply the smallest safe dynamic-profile boundary improvement.
6. Test physically in the browser at the user's normal viewport.
7. Fix failures found by the test; do not add new feature families.
8. Update project state and leave a short evidence-backed report.

## Acceptance criteria

The pass is complete only when all of these are true:

1. The project still builds and launches.
2. At least two actors can enter, coexist in, move through, and exit the café.
3. Click and possession/WASD use the same walkability rules.
4. Actors cannot cross the representative bar, table, wall, or blocked décor.
5. An actor visibly passes behind and in front of representative furniture with
   correct scale, anchor, and depth.
6. Café entry, exit, and same-runtime re-entry work without duplicated or broken
   scene layers.
7. One representative interaction using `E` works from a valid adjacent/anchor
   position.
8. Existing saves either load or migrate safely; no silent reset.
9. The bridge remains passive, GET-only, and accepts a runtime profile ID without
   requiring it to be one of the four presets.
10. Automated checks plus a physical browser walkthrough are reported honestly.

If an acceptance criterion cannot be completed safely, report it as incomplete.
Do not hide it behind a mock, screenshot, or hard-coded demo path.

## Explicit non-goals

- rebuilding the entire game or every interior;
- migrating every exterior object;
- generating a complete new asset library;
- full professional UI redesign;
- economy, progression, relationships, or needs expansion;
- multiplayer or Habbo protocol emulation;
- completing all GitHub/public-release work;
- commits, pushes, publication, deployment, or destructive cleanup;
- running or installing a `syka-world` Gateway.

## Safety and collaboration rules

- Work only in the existing repository root.
- Preserve unrelated and uncommitted user work.
- Do not create a second project root.
- Do not expose credentials, Hermes histories, prompts, or private task content.
- Do not run `hermes -p syka-world gateway install` or `gateway start`.
- Start no real agent task through the bridge.
- Stop early and report if an art-direction decision needs the user's judgment.
- Duration is not a success metric. Verified behavior is.

## Required final report

Keep it concise:

1. what visibly works now;
2. architecture changed;
3. exact verification performed and evidence paths;
4. incomplete items or risks;
5. the best 3–5 collaborative next steps.

## Prompt to launch in Hermes Desktop

```text
/goal Work in the current Syka World repository and read docs/GOAL_SPATIAL_COLLABORATIVE_PASS_V1.md completely. Execute only that focused pass. Do not treat time or tokens as a quota: finish as soon as its acceptance criteria are genuinely verified, targeting roughly 90–150 minutes and stopping by 3 hours. Prioritize a spatially correct café vertical slice, unified click/WASD/NPC navigation, deterministic front/behind rendering, and the smallest safe dynamic Hermes-profile boundary improvement. Preserve the approved detailed pixel-art visual, existing gameplay, saves, and private passive GET-only bridge. Do not rebuild the whole game, perform a full UI redesign, start real Hermes tasks or a Gateway, expose private data, commit, push, publish, deploy, or modify unrelated work. Physically test the result, report incomplete criteria honestly, and return control for collaborative review.
```
