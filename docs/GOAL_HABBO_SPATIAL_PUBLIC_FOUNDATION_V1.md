# Syka World — Habbo-Style Spatial Runtime & Public Foundation v1

Status: ready for execution after the Hermes executor profile and exact API model ID are confirmed.

Prepared: 2026-07-18.

Target execution window: 6 hours, with a hard stop at 7 hours.

Target executor: the user-selected Kimi-family model connected through Hermes Desktop. This plan does not assume a specific provider model ID; verify the exact API identifier and context/tool limits before starting.

## 1. Purpose of this document

This is the standalone implementation brief for the next major Syka World pass. The executor must be able to understand the project without reading the conversation that produced this document.

The goal is to evolve the current playable alpha into a stronger game foundation with four connected outcomes:

1. a Habbo-inspired isometric spatial runtime for interiors and exteriors;
2. dynamic discovery and onboarding of arbitrary Hermes profiles instead of four compile-time identities;
3. a professional, game-first UI suitable for a public English-language repository;
4. a verified integrated vertical slice that preserves the approved visual direction while replacing fragile spatial shortcuts.

This is not a request to imitate Habbo's copyrighted assets, UI, characters, branding, room designs, or networking protocol. Habbo is a mechanical and technical reference for tile occupancy, height, sprite depth, furniture interaction, placement, and readable social spaces.

The executor should implement as much of the integrated target as can be completed honestly within the time window. Work must be phased internally, but the result should feel like one coherent pass rather than a collection of disconnected experiments.

## 2. Product vision

Syka World is a long-term hobby game: a cozy, fixed-camera, isometric 2.5D town in which Hermes AI profiles become visible inhabitants.

When a Hermes profile is idle, its world character follows deterministic local routines without consuming LLM tokens. When that profile receives real work through Hermes, the bridge passively reflects a privacy-safe activity state and the character visibly transitions into thinking, travelling, working, waiting, completing, or error states.

The game also has its own local layer:

- town construction and growth;
- Lumen currency and progression;
- houses, workplaces, shops, a community building, and a detailed café;
- local NPCs and ambient wildlife;
- click-to-move and optional direct possession with keyboard controls;
- contextual object interactions;
- furnished interiors that can later be customized;
- day, twilight, and night;
- save/load;
- a future path toward starting explicitly authorized Hermes work from inside the world.

Hermes remains the source of truth for real agent activity. The game may visualize real work but must never invent, alter, or silently start it.

## 3. Approved experience and visual direction

The visual identity must remain Syka World's own:

- crisp, high-detail pixel-art-flavored isometric presentation;
- fixed world orientation; the camera pans and zooms but does not rotate;
- warm, dense interiors inspired by the detail and atmosphere of Whisper of the House;
- cozy exterior lighting, vegetation, streets, windows, and twilight mood;
- readable silhouettes and floor contact;
- no generic empty tileset look;
- no replacement with plain 3D, low-detail primitives, or a visual downgrade;
- interiors open as isolated close-up scenes rather than removing a roof from the exterior map.

Habbo informs the spatial mechanics underneath the art:

- tile-based room coordinates;
- explicit elevation/height;
- furniture as entities, not pixels baked irreversibly into a room screenshot;
- separate movement footprint and render depth;
- front/body/back sprite parts where needed;
- interaction points and poses;
- contextual click interactions;
- furniture placement, rotation, stacking rules, and occupancy;
- characters correctly appearing in front of or behind furniture.

MiniTown remains an experience reference for observing a growing town. Claw3D remains a technical reference for adapter boundaries, agent state normalization, and navigation discipline. Neither should replace Syka World's visual identity.

## 4. Current verified state

Canonical repository root:

```text
F:\Coding Proyects\Syka World Game
```

The repository currently has no baseline commit and the worktree is entirely untracked. Existing files belong to the user. Preserve them and do not treat the absence of Git history as permission to rewrite or delete broadly.

The playable client is in `app/game` and currently uses:

- Phaser 4.2.1;
- TypeScript;
- Vite;
- WebGL through `Phaser.AUTO`;
- a fixed isometric camera with pan and 100/150/200% zoom;
- a local deterministic game simulation;
- a passive GET-only Hermes bridge client.

Current verified functionality includes:

- sample-town and progressive new-game modes;
- six constructible building families and nine sample buildings;
- building placement, staged construction, acceleration, upgrades, road connectors, and sector unlocking;
- Lumen economy and idempotent completion rewards;
- nine persistent exterior object types;
- day/twilight/night lighting;
- an isolated Café Biblioteca interior;
- four current Hermes-linked placeholder characters;
- five local café NPCs with deterministic routines;
- click movement, possession, WASD, `E` interactions, and `F` portals;
- shared typed spatial contracts for scenes, entities, footprints, walk grids, anchors, interactions, portals, occupancy, reservations, and depth metadata;
- save/load;
- local QA mode separated from Hermes;
- bridge modes online/simulated/degraded/offline;
- responsive layouts and extensive existing tests and reports.

Current recorded baseline:

- frontend unit/integration: 225/225 passing;
- Python bridge/simulation: 39/39 passing;
- typecheck and production build: passing;
- physical Interior Entity & Possession E2E: 14/14 passing;
- same-runtime café enter/exit/re-enter regression: passing;
- bridge audit: GET-only, no request bodies, no real Hermes tasks;
- current measured performance: approximately 53.99 FPS in the city and 56.89 FPS in the café on the user's machine;
- known Vite warning: main chunk over 500 kB.

The executor must rerun the relevant baseline and report the real results. Historical reports are evidence, not a substitute for current verification.

## 5. Confirmed problems and architectural gaps

### 5.1 The café is still fundamentally raster-backed

The café looks strong because it uses an approved, dense room raster. Spatial entities and several foreground crops were later authored over it. This improved the result, but important furniture is still visually flattened into one image.

Consequences:

- collision footprints and visual silhouettes do not always align;
- a valid logical path may still look as if it intersects a painted object;
- foreground crops are manual rectangles/regions rather than a general compositing system;
- new furniture cannot naturally be moved, rotated, stacked, or re-layered;
- every new flattened interior would repeat the same authoring problem.

### 5.2 Profiles are conceptually generic but implemented as four fixed identities

The bridge event contract uses `profile_id`, but the current product still hardcodes:

- `ProfileId = "default" | "elen" | "astrelis" | "zerny"`;
- Syka, Elen, Astrelis, and Zerny in a fixed JSON registry;
- their names, homes, workplaces, and several simulation fixtures;
- frontend type guards that reject unknown profiles.

This conflicts with the intended public product: a user should clone or install Syka World, connect it to Hermes, discover zero, one, four, or many profiles, and create inhabitants for them.

### 5.3 UI is functional but still alpha-oriented

The current shell exposes many systems, but it does not yet feel like a polished public game. Construction, agent status, bridge status, object inspection, profile onboarding, interior actions, and responsive behavior need a unified interaction language.

### 5.4 Existing tests can pass while visual relationships remain wrong

Logical walkability does not prove that an avatar's painted silhouette is visually behind a table, correctly seated, or touching the floor. The next pass needs both state-based tests and pixel/physical visual evidence.

## 6. Non-negotiable architecture boundaries

1. Hermes is the source of truth for real work.
2. Bridge, simulation, and renderer remain decoupled.
3. The browser client remains GET-only toward the current bridge in this pass.
4. Do not start real Hermes tasks during implementation or QA.
5. Do not expose prompts, reasoning traces, tool arguments, private messages, or full results.
6. Local ambient life must not require LLM calls.
7. QA shortcuts must never reach Hermes.
8. Existing saves must migrate explicitly or fail safely; never silently corrupt them.
9. Do not introduce a heavy ECS or 3D physics engine unless concrete evidence proves the existing typed architecture cannot support the target.
10. Do not copy assets or code with incompatible licenses.
11. Do not commit, push, deploy, publish, or create external resources without separate explicit authorization.
12. Do not delete historical assets, reports, or user work merely to simplify the new implementation.

## 7. Target architecture: Habbo-style spatial runtime

The core correction is separation of responsibilities. A furniture footprint does not need to be pixel-perfect. It defines movement and occupancy. Visual overlap is handled by sprite composition and depth.

### 7.1 Scene model

Each interior or exterior scene should declare:

- stable scene ID and schema version;
- isometric grid dimensions and projection;
- valid floor cells;
- tile elevation or a height map;
- structural back layer: floor, walls, windows, fixed background detail;
- spatial entities;
- portals;
- semantic interaction anchors;
- actor spawn/entry/exit anchors;
- lighting bindings;
- asset manifests and provenance;
- editor/placement constraints where relevant.

### 7.2 Spatial entity model

An entity may declare:

- `id`, `kind`, and visual variant;
- grid origin and orientation;
- movement footprint;
- occupied and optionally walkable offsets;
- base elevation and per-tile height where needed;
- stackability and placement surface rules;
- interaction anchors;
- supported actions;
- required actor orientation and pose;
- reservation capacity;
- render pivot at the object's floor contact point;
- render parts such as `back`, `body`, `front`, `overlay`, and `shadow`;
- relative depth per part;
- optional alpha hit mask for clicking;
- local state and animations;
- persistence and ownership rules;
- accessible label and inspector metadata.

An item becomes a full entity when it blocks movement, can occlude an actor, can be occluded, supports an interaction, reserves a position, is movable/purchasable, can hold another object, or acts as a portal.

Tiny decorative details may remain baked into a parent layer. Do not turn every cup or book into simulation state.

### 7.3 Actor model

All controllable agents and local NPCs must use the same fundamental actor runtime:

- current scene, grid cell, sub-cell interpolation, and elevation;
- species/character visual scale and common foot pivot;
- facing direction and animation state;
- path and destination;
- occupancy reservation;
- active interaction and target anchor;
- local/manual/bridge control priority;
- render depth derived from floor contact, not bounding-box top or arbitrary DOM order.

Human actors and pets may use different silhouettes and sizes, but their feet/paws must align with the same world coordinates.

### 7.4 Navigation and occupancy

Click movement, WASD, local routines, bridge-driven travel, and NPC routines must query one authoritative spatial index.

Required behavior:

- cardinal grid movement unless a tested alternative is deliberately introduced;
- no direct tween to a target through blockers;
- no fallback to a raw target when pathfinding fails;
- actors stop and report unreachable state if no valid route exists;
- actors cannot finish on the same cell or exclusive anchor;
- reservations expire or release safely;
- no permanent deadlock at doors, café seats, or workstations;
- dynamic placed objects update navigation atomically;
- multi-tile and elevated objects validate all affected cells.

### 7.5 Depth and occlusion

Implement a deterministic isometric compositor:

- calculate primary depth from the entity/actor floor-contact position and elevation;
- use stable tie-breakers;
- allow multi-part sprites with relative depth;
- render an actor behind a counter's front layer while keeping the actor in front of the counter's rear/background layer;
- support stairs and raised platforms through elevation;
- support objects placed on valid elevated surfaces;
- use alpha masks only for precise hit testing or exceptional visual edges, not as the primary world model;
- include a development overlay showing cell coordinates, elevation, footprints, pivots, anchors, reservations, and computed depth.

The renderer should achieve the relationship visible in Habbo-like rooms:

```text
background -> actor behind counter -> counter front
background -> counter -> actor in front
```

### 7.6 Interactions

Objects define actions. Actors navigate to an available anchor, face correctly, adopt a pose, perform the action, and release or retain the reservation according to the action.

Minimum integrated actions:

- sit on a chair or sofa;
- work at a desk/computer;
- serve or request coffee at the café counter;
- use a coffee machine;
- read at a bookshelf/table;
- use a door/portal;
- wait at a queue or service point.

The system must support future actions such as sleep, call, cook, organize, research, and socialize without hardcoding each action into the renderer.

### 7.7 Placement and editing

Keep buildings and interiors furnished by default. Customization is optional, not a mandatory furnishing chore.

Implement or establish a working vertical slice for:

- selecting an owned/placeable item;
- ghost preview on the isometric grid;
- valid/invalid placement feedback;
- rotation only when a matching visual orientation exists;
- collision and surface validation;
- height/stacking validation;
- preserving required access paths and portals;
- moving, storing, or removing an item;
- persistence through save/load.

Interior placement should use the same entity contract as exterior trees, lamps, benches, fences, and buildings.

## 8. Café migration strategy

It is acceptable to rebuild the café interior if necessary. Visual fidelity is a requirement; preserving the old implementation is not.

The approved café image is an art-direction target, not an untouchable runtime format.

### 8.1 Preferred approach

Reconstruct the café as a layered modular scene:

- floor and structural walls as back layers;
- windows and city/time view;
- counter split into rear/body/front layers;
- kitchen blockers;
- tables and chairs as separate entities;
- sofas and fireplace/library composition;
- large plants as entities;
- small detail baked into logical parent sprites where appropriate;
- doors and portals;
- service, seating, reading, and waiting anchors.

Assets may be extracted, redrawn, or regenerated only if provenance is preserved and the result remains cohesive. Generated concept art should not be assumed to be production-ready transparent sprites without cleanup and alignment.

### 8.2 Migration gate

Before replacing the production café:

1. build a development scene or feature-flagged version;
2. implement the entrance, counter, one table, two chairs, one plant, one human actor, one pet actor, and one NPC;
3. demonstrate click movement and WASD around blockers;
4. demonstrate front/behind relationships at the counter and table;
5. demonstrate at least sitting and coffee service;
6. compare at 1008×548 and 1440×900 with the approved café;
7. perform at most two focused asset/pipeline correction cycles before deciding whether full migration is safe.

Do not replace the current café with a visually inferior modular room just to claim architectural success. If the full visual gate cannot pass in the time window, preserve a working modular vertical slice behind a flag, integrate only proven contracts, and report the remaining art work honestly.

## 9. Exterior adoption

The same spatial system must support the city, with different content rules:

- buildings are large multi-tile entities with entrances and access paths;
- trees, lamps, benches, fences, flowers, vehicles, signs, stairs, bridges, and awnings are entities where relevant;
- an actor can pass behind a tree, sign, awning, arch, or other foreground element and be occluded correctly;
- building footprints block exterior movement, so most buildings can sort from a stable ground pivot without excessive sprite splitting;
- overhangs, balconies, gates, bridges, and arches may need front/back parts;
- road connectors and construction clearance continue to use the authoritative spatial model;
- placed exterior objects cannot overlap actors, buildings, roads, required entrances, or incompatible surfaces.

Do not attempt to rebuild the entire town art library during this pass. Prove that the entity/depth system works for a representative building, tree, bench/lamp, and one overhang or foreground element, then migrate additional objects if time permits.

## 10. Dynamic Hermes profile foundation

The public version must not require the names Syka, Elen, Astrelis, or Zerny.

### 10.1 Separation of identities

Use two layers:

```text
Hermes profile discovered at runtime
                 ↓
Persistent configurable world-character binding
```

`profile_id` is an external Hermes identity and should be represented as a validated string, not a four-value TypeScript union.

`character_id` is a stable Syka World identity. It remains stable if a profile is temporarily offline and can hold world-specific customization such as display name, avatar, home, workplace, role, and visual theme.

### 10.2 Discovery

Prefer official Hermes profile surfaces when available. Use filesystem discovery as a tested fallback:

- resolve `HERMES_HOME` safely;
- include the default profile;
- enumerate additional profile homes under `profiles/*`;
- do not use gateway ports as identity;
- validate profile names and paths;
- detect additions/removals on refresh or restart;
- preserve offline bindings rather than deleting characters;
- never read secrets or private message content for discovery.

### 10.3 Onboarding

On first run, the game should be able to present discovered profiles and allow the user to:

- create a world character for each profile;
- choose or accept a generated display name;
- select a starter avatar/pet placeholder;
- select a role or generic role;
- assign a home and workplace later;
- initially use a shared arrival home/community office if no dedicated building exists;
- ignore a profile without losing its events permanently;
- revisit mappings in settings.

Installing or updating the live observer in Hermes profiles is a separate, explicit setup action. Discovery may be automatic; modifying a Hermes profile silently is not allowed.

### 10.4 Presets and compatibility

Move the current cast into an optional preset/configuration, for example:

```text
config/presets/sikora-world.json
```

Existing local saves and the current user experience should preserve Syka, Elen, Astrelis, and Zerny through migration.

Unknown profile events must not be dropped or attributed to Syka. They should become an unassigned/discovered profile state until mapping is available.

### 10.5 Tests

Cover at least:

- zero additional profiles plus default;
- one profile;
- the current four-profile preset;
- more profiles than available dedicated homes;
- profile added after first run;
- profile temporarily missing/offline;
- unknown profile event before onboarding;
- renamed display character without changing `profile_id`;
- no hardcoded local path or port required.

## 11. Bridge behavior in the game

Keep the current passive boundary. When real activity is observed:

1. resolve `profile_id` to a world character;
2. release conflicting local possession safely;
3. show a privacy-safe short task summary if available;
4. select the bound workplace or a generic shared workplace;
5. navigate using the same spatial runtime as manual movement;
6. reserve a compatible workstation;
7. map normalized tool families to local interactions/animations;
8. show waiting, blocked, error, degraded, and completion states clearly;
9. grant any local completion reward idempotently;
10. return to the local routine when the real session settles.

The game must not claim an agent entered an office interior that does not exist. Use a truthful exterior/access/shared-workspace representation until the relevant interior is implemented.

## 12. Professional UI target

The UI must be redesigned as a coherent game interface, not a collection of debug panels. Preserve functionality, but simplify presentation.

### 12.1 Principles

- game world remains visually dominant;
- contextual controls instead of permanently open sidebars;
- clear hierarchy and consistent spacing/type/color;
- readable pixel-art-compatible presentation without forcing every UI element to be pixel art;
- panels must not stretch or deform the game canvas;
- no giant white rectangles over interiors;
- all interaction states work with mouse and keyboard;
- responsive behavior at 640×720, 1008×548, 1440×900, and 2560×1080;
- UI copy and public documentation in English;
- architecture should permit localization later rather than scattering hardcoded strings.

### 12.2 Required surfaces

- compact top status: time, speed, currency, level, bridge mode;
- contextual build/catalog dock;
- object inspector/editor;
- selected-character card with state, destination, activity reason, and possession control;
- unobtrusive interaction prompt for `E` and portal prompt for `F`;
- dynamic profile onboarding/settings surface;
- clear Real / Simulated / Degraded / Offline bridge indicator;
- pause/settings/help controls;
- development overlays available only in QA/development mode.

### 12.3 Interaction map to preserve

| Input | Action |
|---|---|
| Click actor | Select actor |
| Click valid ground | Pathfind to destination when not possessed |
| Click object | Inspect/select object, not ground |
| `P` or button | Possess/release selected eligible actor |
| `W/A/S/D` | Move to a valid cardinal isometric neighbor while possessed |
| `E` | Use nearest valid contextual interaction |
| `F` | Use a valid adjacent portal |
| `Esc` | Release possession first; then close/cancel/exit contextually |
| `B` | Open/close build mode in the city |

Game keys must be ignored when typing in an editable field.

## 13. Public repository foundation

Prepare the project so it can later be published safely, but do not publish it in this execution.

Required improvements where time allows:

- English root README with product explanation, screenshots placeholder, architecture, requirements, setup, bridge privacy model, controls, and development commands;
- portable paths; no dependency on `F:\` or the current Windows username;
- `.env.example` or equivalent only if needed, containing no secrets;
- local user/world configuration ignored by Git;
- clear separation of sample preset from private user data;
- licenses and provenance for code and generated/source assets;
- audit for tokens, private sessions, absolute attachment paths, local logs, and personal data;
- reproducible install/build/test commands;
- Windows-first instructions plus honest notes for other platforms;
- bridge setup that detects profiles rather than documenting four fixed ones;
- no committed Hermes auth, state databases, message history, checkpoints, or event spool.

Public readiness is not the same as publication. Report remaining blockers.

## 14. Execution strategy for a 7-hour hard limit

The token budget is large, but wall-clock time is the limiting resource. Use tokens for code understanding, implementation, tests, reviews, and concrete QA—not repeated summaries or artificial consumption.

Target finish: 6 hours to leave recovery margin. Hard stop: 7 hours.

### T+00:00–00:30 — Preflight and baseline

- confirm repository root and preserve the untracked worktree;
- read this document completely;
- read `CURRENT_PROJECT_STATE.md`, `README.md`, `TASKS.md`, `docs/DECISIONS.md`, `docs/BRIDGE_V0_3.md`, `docs/VISUAL_STYLE_GUIDE.md`, and the previous interior goal/report;
- identify relevant source modules with targeted search;
- run baseline tests/build and record actual results;
- confirm no active goal or other process is editing the same tree;
- inspect running dev servers before starting new ones.

### T+00:30–01:10 — Contracts and migration design

- write a concise implementation map or ADR;
- extend/refine scene, entity, height, render-part, interaction, and placement contracts;
- define save migration;
- define dynamic profile catalog and binding contracts;
- add focused pure tests before broad renderer edits.

### T+01:10–03:10 — Habbo-style runtime and café vertical slice

- implement the shared spatial index, elevation, deterministic depth, and render parts;
- add development overlays;
- create the café modular gate scene;
- integrate actor movement, occupancy, and key interactions;
- iterate assets/pivots at most twice;
- decide whether full production café migration is safe.

### T+03:10–04:10 — Integrated interaction/placement/exterior proof

- integrate the proven café path into production if the gate passes;
- implement representative placement/editing behavior;
- apply the compositor to representative exterior entities;
- ensure click, WASD, routines, NPCs, and bridge-driven travel share navigation.

### T+04:10–05:00 — Dynamic profiles and bridge integration

- remove compile-time four-profile assumptions from core paths;
- implement discovery, binding, optional current-user preset, and unknown-profile handling;
- preserve current saves through migration;
- verify bridge remains GET-only and privacy-safe.

### T+05:00–05:40 — UI integration

- implement the game-first shell and contextual surfaces;
- add bridge state and dynamic profile onboarding/settings;
- make public-facing copy English;
- validate responsive layouts early.

### T+05:40 — Feature freeze

No new feature families after this point. Finish incomplete integrated work, remove dead experimental wiring, and begin verification.

### T+05:40–06:35 — QA and correction

- run unit, typecheck, build, Python, and targeted E2E suites;
- physically test click, WASD, interactions, portals, placement, dynamic profiles, save/reload, and re-entry;
- inspect original-resolution screenshots;
- measure city/café performance;
- audit bridge network behavior;
- fix blockers and rerun the exact failing scenario.

### T+06:35–07:00 — Documentation and cleanup

- update state/tasks/decisions honestly;
- write a final report split into verified, provisional, incomplete, and risks;
- record commands and evidence paths;
- close only servers/processes started by this execution;
- confirm no secrets or private Hermes data were added;
- stop at the hard limit even if optional work remains.

If the executor supports subagents, parallelize bounded read-only audits, asset analysis, UI review, and independent QA. Assign one owner per edited subsystem and avoid concurrent writes to the same files. The principal executor remains responsible for integration and truthfulness.

## 15. Priority order

### P0 — required for a successful pass

1. Preserve baseline integrity and existing game loop.
2. Establish a real entity/height/render-part compositor.
3. Prove correct front/behind behavior with café furniture and actors.
4. Use one authoritative navigation/occupancy system.
5. Preserve click, possession/WASD, `E`, `F`, NPC routines, save/load, and café re-entry.
6. Generalize profile identity and handle unknown/discovered profiles safely.
7. Preserve the GET-only bridge and privacy boundary.
8. Provide coherent English UI for the affected flows.
9. Add tests and physical visual evidence.
10. Update documentation honestly.

### P1 — complete if P0 is stable

- migrate the full café to modular assets;
- basic interior furniture editing/placement;
- representative exterior depth adoption;
- full profile onboarding/settings UX;
- broader UI polish and responsive refinement;
- performance/bundle optimization;
- clean short video demonstrating the integrated result.

### P2 — do not threaten P0/P1 for these

- interiors for every house and office;
- final character/pet art;
- multiplayer or social chat;
- bidirectional task creation from the game;
- relationships, needs, missions, or advanced economy;
- huge furniture catalog;
- full localization system;
- desktop packaging or Windows autostart;
- GitHub publication.

## 16. Mandatory tests and evidence

### 16.1 Pure/unit tests

- footprint and blocked-cell compilation;
- elevation and stacking validation;
- deterministic depth ordering and tie-breaking;
- actor behind/in front of multi-part furniture;
- pathfinding around blockers and unreachable destination behavior;
- occupancy and reservation release;
- multiple actors cannot occupy one exclusive anchor;
- interaction anchor selection and facing;
- placement validation and persistence;
- keyboard-to-isometric-neighbor mapping;
- save migration;
- dynamic profile discovery/binding/unknown/offline cases;
- existing cast preset compatibility;
- bridge completion reward remains idempotent.

### 16.2 Physical browser flow

1. open the sample town;
2. select an actor and click a valid exterior destination;
3. reject an invalid building/tree destination;
4. possess the actor and move around a blocker with WASD;
5. enter the café through the valid portal;
6. walk around the counter, tables, chairs, sofas, and plants;
7. visibly pass behind and in front of the counter/table;
8. sit using `E` at the correct anchor;
9. perform a coffee interaction;
10. show a service NPC and at least two actors without overlap;
11. exit and re-enter in the same `Phaser.Game`;
12. place or move one supported object if the placement slice is integrated;
13. save/reload and verify spatial integrity;
14. type in an input without game controls firing;
15. verify a simulated/discovered unknown profile does not become Syka;
16. verify bridge traffic is GET-only with no body and no real task created;
17. verify no unexpected page, console, HTTP, or asset errors.

### 16.3 Visual QA

Capture and inspect at original resolution:

- 640×720;
- 1008×548;
- 1440×900;
- 2560×1080.

Required visual checks:

- no stretched or blurred world canvas;
- consistent human scale and deliberate pet scale;
- feet/paws and shadows on the correct floor position;
- correct counter/table/sofa depth relationships;
- no giant hotspot rectangles;
- no actor drawn above every object;
- café retains warm dense detail;
- UI does not cover important world space;
- bridge mode and selected-agent state are understandable;
- placement preview is readable and aligned;
- day/night remains coherent.

### 16.4 Performance and cleanup

- measure city and café FPS with actors/NPCs active;
- target approximately 55–60 FPS on the current machine;
- report regressions rather than hiding them;
- preserve or improve current bundle warning status;
- close temporary servers and confirm ports;
- do not terminate unrelated pre-existing user processes.

### 16.5 Evidence package

Create a new explicit directory under `reports/` containing:

- baseline and final command results;
- requirements-to-evidence matrix;
- screenshots;
- physical E2E JSON/Markdown;
- network/privacy audit;
- performance data;
- final report;
- a short video if the integrated result is stable enough to demonstrate honestly.

## 17. Definition of done

Mark this goal complete only if all of the following are true:

1. the game starts through documented portable commands;
2. relevant historical suites still pass or every expected change is justified;
3. café actors no longer rely on only rectangular raster crops for core depth behavior;
4. at least counter and table relationships use real entity render parts and deterministic depth;
5. click, WASD, routines, NPCs, and bridge-driven travel share spatial truth;
6. actors cannot cross blocking furniture or fall back to direct through-wall movement;
7. seating and coffee interactions use real anchors and reservations;
8. same-runtime café re-entry remains correct;
9. placement/editing has at least one honest integrated vertical slice or is explicitly reported incomplete without fake UI;
10. core product code accepts runtime profile IDs rather than only four compile-time values;
11. current Syka/Elen/Astrelis/Zerny behavior survives through an optional preset/migration;
12. unknown and offline profiles are handled safely;
13. the UI affected by this pass is coherent, responsive, and in English;
14. bridge remains GET-only and no real Hermes tasks were started;
15. saves are migrated or rejected safely;
16. physical browser and visual QA evidence exists;
17. performance and known regressions are documented;
18. `CURRENT_PROJECT_STATE.md`, `TASKS.md`, `docs/DECISIONS.md`, README/runbook, and final report match reality;
19. no secrets, private Hermes data, commits, pushes, deployments, or publications were created;
20. all temporary processes started by the executor are closed.

Do not mark the goal complete because the token budget or wall-clock budget ended. If important criteria remain incomplete at the hard stop, report partial completion precisely and leave the repository in a runnable state.

## 18. Required final report format

The executor's final report must contain:

1. **Outcome** — what the user can now see and do.
2. **Architecture changed** — contracts and systems introduced or replaced.
3. **Visual preservation** — how the approved style was maintained and where it differs.
4. **Dynamic profile status** — what is truly generic and what remains preset-specific.
5. **UI status** — implemented surfaces and remaining rough edges.
6. **Verification** — exact test counts, commands, screenshots, video, performance, and network results.
7. **Incomplete** — every unmet criterion without euphemism.
8. **Risks and next steps** — prioritized, not a generic backlog dump.
9. **Files changed** — grouped by subsystem.
10. **Safety** — confirmation of no tasks, secrets, publication, or unrelated process termination.

## 19. Hermes launch preflight

Before launching this goal in Hermes Desktop, confirm:

- the exact Hermes profile that will run the task;
- the exact provider and API model ID for the selected Kimi model;
- API authentication is already configured inside that profile without placing credentials in this repository;
- the model supports the required tool calls and context length;
- the provider's 7-hour/token allowance is active;
- no other goal or coding process is modifying this repository;
- the task starts with the repository root as its working directory.

If the model name in the UI differs from the provider API ID, record both in the execution report. Do not guess the model identifier.

## 20. Compact prompt to start from Hermes

```text
/goal Work autonomously in the current Syka World repository for a target of 6 hours and a hard maximum of 7 hours. Read docs/GOAL_HABBO_SPATIAL_PUBLIC_FOUNDATION_V1.md completely, then execute it as the authoritative plan. Evolve the existing alpha into a Habbo-inspired entity/height/depth/interaction runtime while preserving Syka World's approved detailed visual style; generalize Hermes profiles for a public reusable repository; redesign the affected game UI in English; preserve click, possession/WASD, E/F, NPCs, saves, bridge privacy, and current gameplay. Use the existing implementation where proven, rebuild the café if necessary, and prioritize an integrated verified result over disconnected prototypes. Keep the bridge GET-only, start no real Hermes tasks, expose no private data, and do not commit, push, publish, deploy, or delete unrelated user work. Freeze features by T+5h40, perform physical browser and visual QA, update project state/docs, close temporary processes, and report any incomplete criteria honestly.
```

## 21. First files to read

Read these completely before implementation:

1. `docs/GOAL_HABBO_SPATIAL_PUBLIC_FOUNDATION_V1.md`
2. `CURRENT_PROJECT_STATE.md`
3. `README.md`
4. `TASKS.md`
5. `docs/DECISIONS.md`
6. `docs/VISION.md`
7. `docs/VISUAL_STYLE_GUIDE.md`
8. `docs/BRIDGE_V0_3.md`
9. `docs/BRIDGE_ARCHITECTURE.md`
10. `docs/GOAL_INTERIOR_ENTITY_AND_POSSESSION_PASS_V1.md`
11. `reports/interior-entity-possession-v1/FINAL_REPORT.md`
12. `reports/cafe-runtime-regression/CAFE_REENTRY_FIX_REPORT.md`

Then use targeted code search to locate current spatial contracts, café scene composition, actor rendering, bridge profile types, save schema, UI shell, and E2E helpers. Do not read generated binaries or every historical report indiscriminately.

