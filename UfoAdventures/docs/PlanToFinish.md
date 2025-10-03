# Plan To Finish

## Epic 1: Architecture & Runtime Loop

### Story 1.1: Introduce a System Manager with Instrumented Updates
**Narrative:** As an engine maintainer, I need a `SystemManager` that owns system registration, update ordering, and per-system metrics so that the runtime matches the architecture spec (§1–3) and exposes timing data for profiling.
**Context & Constraints:** Refactor `GameplayRuntime` to register systems through the manager rather than pushing into `this.systems`. Instrument execution with `PerformanceProfiler` samples.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] `SystemManager` module created with register/unregister/update methods and tests.
- [ ] `GameplayRuntime` delegates system lifecycle to the manager.
- [ ] Performance metrics captured per system and exposed via existing overlay/dev handles.
- [ ] Vitest coverage for manager ordering and error handling ≥80%.
- [ ] Lint passes; no regressions in Playwright smoke.

### Story 1.2: Add an Entity Manager Abstraction
**Narrative:** As gameplay engineers, we need an `EntityManager` that encapsulates pooling, lookup, and lifecycle so features can query components cleanly.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] `EntityManager` added under `src/js/engine/` with query helpers and integration tests.
- [ ] `GameplayRuntime` uses manager for add/release/lookups.
- [ ] Pools remain functional (bullets/effects) verified via unit tests.
- [ ] Documentation comment summarising usage and migration steps.
- [ ] No console errors during dev server smoke run.

### Story 1.3.1: Reinforce Fixed-Step Accumulator Guard
**Narrative:** As a runtime engineer, I need the fixed-step ticker to enforce the architecture guard so late frames do not spiral and gameplay stays deterministic.
**Context & Constraints:** Update `_onTick` in `src/js/game-application.ts` to clamp accumulated delta, respect `MAX_FRAME_SKIP = 5`, and ensure pause/resume clears the accumulator per docs/UfoGameDesign_Architecture.md Section 2.3.
**Status:** In progress — code and automated coverage landed; manual throttle checks still pending.

**Acceptance Criteria**
- Given the runtime receives a delta larger than the fixed timestep, when `_onTick` processes the frame, then at most five fixed-step updates execute before a render.
- Given the app regains focus after the ticker is paused, when the next frame runs, then the accumulator is reset so no backlog of updates executes in one frame.
- Given long delta bursts, when `_onTick` exits for the frame, then the accumulator keeps the remaining fractional time for the next tick.

**Definition of Done**
- [x] `src/js/game-application.ts` introduces an explicit `MAX_FRAME_SKIP` constant and guards the fixed-step loop.
- [x] Pause/resume and visibility handlers clear the accumulator to avoid catch-up spikes.
- [x] Unit coverage in `tests/unit/` verifies the guard and accumulator retention logic.
- [ ] Manual CPU throttle (4x slowdown) confirms updates cap at five and gameplay stays responsive. _(Pending manual check.)_
- [ ] No regressions observed in ticker consumers (pause menu, dev overlay toggles). _(Requires manual QA pass.)_

### Story 1.3.2: Introduce Render Interpolation Pipeline
**Narrative:** As a gameplay engineer, I need runtime render callbacks to receive interpolation factors so animations stay smooth during catch-up frames.
**Context & Constraints:** Extend `GameplayRuntime` update/render signatures to accept interpolation and propagate it to renderable systems per the interpolation pseudocode in docs/UfoGameDesign_Architecture.md.
**Status:** In progress — runtime now forwards interpolation; manual validation and HUD surfacing still pending.

**Acceptance Criteria**
- Given `_onTick` finishes fixed-step updates, when it calls the render pipeline, then it calculates interpolation as accumulator divided by the fixed timestep.
- Given a system implements `render(interpolation)`, when the runtime ticks, then the system receives the computed interpolation argument.
- Given interpolation is monitored, when the dev overlay is open, then the reported interpolation stays within the `[0,1)` range.

**Definition of Done**
- [x] `GameApplication._onTick` computes interpolation and forwards it to `GameplayRuntime.render`.
- [x] `GameplayRuntime` passes interpolation to renderable systems and preserves existing update order.
- [x] Tests cover interpolation bounds and propagation to at least one render system.
- [ ] Manual throttle run shows smoother motion without stepping artifacts.
- [ ] docs/audit.md notes for interpolation updated or cleared.

### Story 1.3.3: Instrument Loop Metrics with Performance Profiler
**Narrative:** As a diagnostics engineer, I need per-frame metrics recorded so QA can verify timing budgets and frame skips in the overlay.
**Context & Constraints:** Wrap update and render segments with `PerformanceProfiler` spans, expose frame data through `GameplayRuntime.getPerformanceSummary()`, and surface it in the dev HUD.

**Acceptance Criteria**
- Given `_onTick` executes, when a frame completes, then the profiler records update duration, render duration, and frame skip count.
- Given the developer overlay is toggled, when frames render, then it displays the new timing metrics without delays.
- Given tooling requests metrics, when `getPerformanceSummary()` is called after a frame, then it returns the latest profiler sample.

**Definition of Done**
- [ ] `PerformanceProfiler` instrumentation wraps both update and render paths in `GameApplication`/`GameplayRuntime`.
- [ ] Dev overlay panels render frame time, update count, interpolation, and per-system timings.
- [ ] Automated coverage validates profiler buffers and summary accessors.
- [ ] Manual smoke with overlay enabled shows live data and no console warnings.
- [ ] docs/audit.md entry on missing metrics marked resolved with implementation notes.

### Story 1.3.4: Finalise Loop Regression Coverage and Documentation
**Narrative:** As QA leads, we need the upgraded loop validated across tests and documentation so the release meets the runtime spec.
**Context & Constraints:** Execute unit suites, refresh manual checklists, and synchronise architecture docs and audit trail after loop changes are merged.

**Acceptance Criteria**
- Given the loop changes land, when `npm run test:unit` executes, then it passes locally and on CI.
- Given the manual runtime checklist runs, when CPU throttle, pause/resume, and overlay toggles are exercised, then no regressions surface.
- Given architecture docs are reviewed, when the audit is updated, then it reflects the final loop behaviour.

**Definition of Done**
- [ ] Vitest suite and lint checks run clean with the new loop code.
- [ ] Manual QA checklist updated in `docs/testing-notes.md` with loop scenarios.
- [ ] docs/UfoGameDesign_Architecture.md and docs/audit.md refreshed to match implementation.
- [ ] PlanToFinish story statuses updated to reflect completion order.
- [ ] Release checklist annotated with loop verification evidence.
### Story 1.4: Register a UI Service for HUD and Overlay Control
**Narrative:** As UI engineers, we need a service to orchestrate HUD state per the architecture (`UISvc`) so scenes access UI via the locator.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] `UiService` created and registered during boot.
- [ ] Existing `src/js/ui.ts` refactored into service method(s).
- [ ] Scene classes updated to depend on service rather than direct imports.
- [ ] Unit tests for service API (happy-dom) ensure DOM updates fire.
- [ ] Documentation snippet added to README or docs describing usage.

## Epic 2: Scene Flow & States

### Story 2.1: Implement Typed Scene Transitions
**Narrative:** As designers, we need named transitions (fade, swipe, instant) tied to `SceneManager` so we can script scene flow per §2.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] `ISceneTransition` map implemented; transitions defined in new module.
- [ ] `SceneTransitions` refactored to dispatch named strategies.
- [ ] Unit tests cover valid/invalid transitions.
- [ ] Scenes updated to pass transition IDs where required (menu, gameplay, results).
- [ ] QA checklist updated noting supported transitions.

### Story 2.2: Add Victory, Defeat, and Inventory Scenes
**Narrative:** As players, we expect dedicated scenes for victory, defeat, and inventory to mirror spec diagrams.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] New scene files added under `src/js/scenes/` with tests.
- [ ] Routing logic updated in `GameplayScene._showResults` and pause handling.
- [ ] UI overlays created/updated in HTML & CSS for new scenes.
- [ ] Playwright tests cover victory/defeat flows.
- [ ] Accessibility audit run for new overlays (aria attributes).

### Story 2.3: Audit Overlays and DOM Structure
**Narrative:** As QA automation, we need consistent overlay IDs/classes so tests can block until overlays appear.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] HTML templates updated with accessible attributes.
- [ ] Integration test verifies focus handling on key overlays (pause, options, inventory).
- [ ] Testing notes updated with overlay ID list.
- [ ] Manual QA checklist executed for keyboard navigation.

## Epic 3: Gameplay Systems

### Story 3.1: Implement AI State Machine Layer
**Narrative:** As AI developers, we need `IAIBrain` with state-machine support to model patrol/chase/attack states per §5.1.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] `IAIBrain` component and state machine utility implemented.
- [ ] Enemy templates updated with state definitions.
- [ ] Systems integrate state machine with behaviour tree results.
- [ ] Unit tests cover transitions and state persistence.
- [ ] Debug logging toggled via config for QA verification.

### Story 3.2: Enrich Enemy Templates with Difficulty Modifiers
**Narrative:** As balance designers, we need enemy templates to include spawn weights and difficulty modifiers reflecting §5.2.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] `game-config.json` updated with modifiers and weights.
- [ ] Spawning system applies modifiers based on selected difficulty.
- [ ] Unit tests verify scaling for representative templates (blade, amidogus, cyborg).
- [ ] Gameplay smoke test run on easy & hard to validate behaviour.

### Story 3.3: Build Pet Cyborg Arena Encounter
**Narrative:** As narrative designers, we need the Pet Cyborg arena with detachable limbs, arena hazards, and boss logic per §6.3.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] Components `CyborgCore`, `CyborgLimb` implemented with animations.
- [ ] Arena environment system spawns hazards and warning effects.
- [ ] Tests simulate limb detachment and hazard sequencing.
- [ ] Assets referenced (cyborg-atlas) verified and animated.
- [ ] Playthrough recorded for QA evidence.

### Story 3.4: Create Dimensional Portal Escape Scene
**Narrative:** As campaign players, we need the portal escape finale with key collection and bonuses per §6.4.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] New scene module implementing portal mechanics, collectibles, and UI.
- [ ] Event handlers for key/time ball collisions created.
- [ ] Unit/integration tests cover win/lose conditions.
- [ ] HUD updates verified (bonus messages, timers).
- [ ] Gameplay video captured for documentation.

### Story 3.5: Add Missile Guidance and Seeker Systems
**Narrative:** As combat programmers, we need guidance/seeker interfaces to drive advanced missiles per §7.1.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] `IGuidanceSystem`, implementations (PN) added.
- [ ] Weapon/missile templates updated with guidance references.
- [ ] Unit tests verify guidance maths with deterministic targets.
- [ ] Rendering confirmed (trail effects intact).

### Story 3.6: Expand Tarak Boss Behaviours
**Narrative:** As boss designers, we need Tarak-specific attacks (beam, shockwaves, summons) matching §7.3.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] Boss AI updated with Tarak-specific behaviours and telegraphs.
- [ ] VFX hooks (beam, summon) wired to `vfx-atlas` frames.
- [ ] Unit tests validate phase transitions and event emissions.
- [ ] Manual boss run recorded verifying behaviour.

## Epic 4: Weapons & Magic

### Story 4.1: Upgrade Weapon Service to Factory-Based API
**Narrative:** As combat engineers, we need extensible weapon registration with heat/accuracy handling per §6.1.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] `WeaponService` redesigned with registerWeaponType & WeaponBase classes.
- [ ] `ShootingSystem` refactored to call new API.
- [ ] Unit tests mimic spec’s sample tests (fire when ready, block on cooldown).
- [ ] Docs updated in code comments for extension pattern.

### Story 4.2: Implement Spell Inventory and Casting Flow
**Narrative:** As ability designers, we need `IMagicInventory`, spell definitions, and casting life cycle to deliver shield/stasis combos per §6.2.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] `IMagicInventory` component implemented with mana tracking.
- [ ] Spell classes (shield, stasis, future) defined with interface.
- [ ] Ability system integrates spells and updates UI/audio.
- [ ] Unit tests cover casting, cancellation, cooldown reset.

### Story 4.3: Wire Animations and VFX to Abilities
**Narrative:** As VFX artists, we need ability triggers to play the correct sprite animations and effects (`comboBreaker`, `teleport`, shield) per art docs.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] Animation mappings configured in player entity initialization.
- [ ] Ability system spawns VFX via resource manager.
- [ ] Playwright visual assertions or screenshot diffs validated.
- [ ] Manual verification recorded (GIF or video).

## Epic 5: Data & Persistence

### Story 5.1: Add Config Schema Validation and Watchers
**Narrative:** As tools engineers, we need `ConfigService` to validate JSON against schemas and emit change events per §8.1.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] JSON schemas created for assets, enemies, weapons, missions.
- [ ] `ConfigService` integrates ajv or similar validator.
- [ ] Unit tests cover success/failure and watcher callbacks.
- [ ] Dev tooling documentation updated with hot reload usage.

### Story 5.2: Extend Save Service with Migration & Checksums
**Narrative:** As persistence engineers, we need versioned saves with checksum verification per §8.2.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] `SaveService` gains `migrate` method and checksum validation.
- [ ] Migration script(s) for existing keys implemented.
- [ ] Unit tests covering upgrade path and checksum failures.
- [ ] Manual test: tamper with IndexedDB/localStorage entry, ensure service detects.

### Story 5.3: Integrate Spatial Grid into Collision System
**Narrative:** As performance engineers, we need spatial partitioning active so collision checks scale per §9.2.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] `SpatialGrid` instantiated within collision/broad-phase system.
- [ ] Metrics piped into performance overlay.
- [ ] Unit tests compare naive vs grid results for correctness.
- [ ] Performance benchmark documented in audit follow-up.

## Epic 6: Art Pipeline & Assets

### Story 6.1: Deliver Consolidated Tarak Atlas
**Narrative:** As art integration, we need `tarak-atlas.png|json` (512×512 frames) with all phase animations, replacing legacy stub entries.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] New atlas generated and added under `src/images/Sprites/Boss/`.
- [ ] `game-config.json` updated to point to consolidated atlas.
- [ ] Old `1_Tarak.png` references removed.
- [ ] Asset loading test page passes without missing frames.

### Story 6.2: Trim Atlases and Embed Collider Metadata
**Narrative:** As engine integrators, we need hero/enemy atlases trimmed to 256×256 (hero/exceptions noted) with metadata for colliders per art spec.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] Atlases regenerated with trim/padding settings documented.
- [ ] JSON metadata includes collider/sprite size/anchor entries.
- [ ] Runtime updates to read metadata for collider setup.
- [ ] Visual regression checks ensure no cropping.

### Story 6.3: Document/Automate Atlas Export Pipeline
**Narrative:** As art ops, we need repeatable export scripts or detailed instructions to regenerate atlases per `docs/art-pipeline.md`.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] Node/Python script or documented TexturePacker profile committed.
- [ ] Docs updated with step-by-step export workflow.
- [ ] Sample run included in repo (`tools/` or docs) showing command usage.
- [ ] QA verifies by regenerating one atlas and diffing output.

## Epic 7: Testing & Tooling

### Story 7.1: Add Unit Tests for New Systems
**Narrative:** As QA, we need targeted Vitest coverage for weapon factories, AI state machine, save migrations, and config validation.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] New test files under `tests/unit/` for each system.
- [ ] Coverage thresholds updated if needed.
- [ ] Docs/testing-notes mention new suites.

### Story 7.2: Expand Playwright Scenarios for Key Encounters
**Narrative:** As QA automation, we need E2E tests that cover Pet Cyborg arena, portal escape, missile guidance, and Tarak phases.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] Playwright spec files added with helper utilities.
- [ ] Screenshot or log artifacts captured on failure.
- [ ] CI pipeline updated to run new tests nightly.

### Story 7.3: Integrate Performance Profiler into Dev Tools
**Narrative:** As performance analysts, we need profiler data accessible via overlay and console API.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] Overlay uses profiler summary lines.
- [ ] Dev handle exposes getter documented in testing notes.
- [ ] Manual verification recorded (screenshot or JSON output).

## Epic 8: Build & Release

### Story 8.1: Align Build Pipeline with Spec (or Update Spec)
**Narrative:** As release engineers, we need clarity between Vite and documented webpack pipeline. Either adopt webpack with compression or update docs to reflect Vite.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] Either add `webpack.config.js` + updated scripts or revise docs to endorse Vite with equivalent optimisations (e.g., Rollup compression plugin).
- [ ] Dist output verified (hashed filenames, compressed assets).
- [ ] Release checklist updated accordingly.

### Story 8.2: Implement Asset Pipeline Automation
**Narrative:** As tooling engineers, we need `AssetPipeline.optimizeTextures/generateSpritesheets/compressAudio` or functional equivalents to automate asset optimisation per §11.2.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] Scripts/tools added (Node or Python) invoking sharp/texture packer/audio encoder.
- [ ] README/docs updated with command usage.
- [ ] Sample run results archived under `test-results/` or equivalent.

### Story 8.3: Enhance Release Automation & QA Sign-off
**Narrative:** As project leads, we need release automation that archives builds with commit SHAs, verifies CDN uploads, and enforces QA sign-off.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] Release script (`npm run release` or `scripts/release.ts`) created.
- [ ] Docs updated with sign-off steps and evidence requirements.
- [ ] Change log template maintained with latest entries.

## Epic 9: Documentation & Knowledge Base

### Story 9.1: Synchronise Design Docs After Implementation
**Narrative:** As documentation owners, we need to update design docs (architecture, art spec) once new systems land so future audits remain accurate.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] Relevant docs updated with final behaviour descriptions.
- [ ] Audit log appended noting doc sync date.
- [ ] Stakeholder review sign-off recorded.

### Story 9.2: Maintain Plan Tracking
**Narrative:** As leads, we need `PlanToFinish.md` kept up to date with story status so the release checklist can rely on it.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a MAX_FRAME_SKIP guard prevents more than five updates per render.
- Given an interpolation factor is required, when render callbacks run, then systems receive interpolation leveraging accumulator state.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation; interpolation value passed to runtime rendering.
- [ ] `PerformanceProfiler` invoked each frame; overlay/dev handles display new metrics.
- [ ] Runtime update method adjusted to accept interpolation and propagate to systems needing it.
- [ ] Vitest suite passes (`npm run test:unit`).
- [ ] Manual sanity check: throttle browser to 4× CPU slowdown, verify skip guard triggers without runtime stall.

- [ ] Establish update cadence (per sprint or milestone) documented.
- [ ] Checklist item in release process ensures plan refreshed before sign-off.
- [ ] Version control history shows updates aligned with deliverables.


