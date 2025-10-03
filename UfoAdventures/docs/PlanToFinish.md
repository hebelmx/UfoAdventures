# Plan To Finish

## Epic 1: Architecture & Runtime Loop

### Story 1.1: Introduce a System Manager with Instrumented Updates
**Narrative:** As an engine maintainer, I need a `SystemManager` that owns system registration, update ordering, and per-system metrics so that the runtime matches the architecture spec (§1–3) and exposes timing data for profiling.
**Context & Constraints:** Refactor `GameplayRuntime` to register systems through the manager rather than pushing into `this.systems`. Instrument execution with `PerformanceProfiler` samples.

**Acceptance Criteria**
- Given the game boots, when `GameplayRuntime.start` executes, then systems are registered through `SystemManager` (new module under `src/js/engine/`).
- Given a frame executes, when the manager updates systems, then per-system elapsed time is captured and available to the performance overlay API.
- Given a system throws, when `SystemManager` handles updates, then the error is surfaced without breaking the loop and the frame metrics still record failure state.

**Definition of Done**
- [ ] `SystemManager` module created with register/unregister/update methods and tests.
- [ ] `GameplayRuntime` delegates system lifecycle to the manager.
- [ ] Performance metrics captured per system and exposed via existing overlay/dev handles.
- [ ] Vitest coverage for manager ordering and error handling ≥80%.
- [ ] Lint passes; no regressions in Playwright smoke.

### Story 1.2: Add an Entity Manager Abstraction
**Narrative:** As gameplay engineers, we need an `EntityManager` that encapsulates pooling, lookup, and lifecycle so features can query components cleanly.

**Acceptance Criteria**
- Given systems request entities by component signature, when they call the manager, then matching entities are returned without manual array iteration.
- Given entities are removed, when `EntityManager.remove` runs, then pooled entities return to their pools and are not left in `GameplayRuntime.entities`.
- Given unit tests run, when querying via manager, then results match current gameplay scenarios (player, enemies, effects).

**Definition of Done**
- [ ] `EntityManager` added under `src/js/engine/` with query helpers and integration tests.
- [ ] `GameplayRuntime` uses manager for add/release/lookups.
- [ ] Pools remain functional (bullets/effects) verified via unit tests.
- [ ] Documentation comment summarising usage and migration steps.
- [ ] No console errors during dev server smoke run.

### Story 1.3: Upgrade Game Loop with Frame Skip, Interpolation, and Metrics
**Narrative:** As QA, I need deterministic loop behaviour matching the spec so performance data is accurate and gameplay remains smooth under lag.

**Acceptance Criteria**
- Given the ticker runs, when frames exceed the fixed timestep, then a `MAX_FRAME_SKIP` guard prevents more than five updates per render.
- Given an `interpolation` factor is required, when render callbacks run, then interpolation is calculated and passed to systems.
- Given performance overlay is open, when frames render, then metrics (FPS, frame time, per-system data) show live values derived from `PerformanceProfiler`.

**Definition of Done**
- [ ] `_onTick` logic updated with accumulator clamp and interpolation.
- [ ] `PerformanceProfiler` invoked each frame; overlay displays values.
- [ ] Regression tests / snapshots updated.
- [ ] Manual test: throttle browser to 4× CPU slowdown, verify skip guard triggers without stalling.
- [ ] Docs (`docs/audit.md` follow-up note) updated summarising loop parity.

### Story 1.4: Register a UI Service for HUD and Overlay Control
**Narrative:** As UI engineers, we need a service to orchestrate HUD state per the architecture (`UISvc`) so scenes access UI via the locator.

**Acceptance Criteria**
- Given scenes request `uiService`, when they resolve it from the service locator, then they get an object exposing HUD/overlay APIs (health, combo, messages).
- Given UI initialises, when the service boots, then DOM hooks are attached once and reused across scenes.
- Given tests run, when mocking UI service, then HUD updates still occur via service API.

**Definition of Done**
- [ ] `UiService` created and registered during boot.
- [ ] Existing `src/js/ui.ts` refactored into service method(s).
- [ ] Scene classes updated to depend on service rather than direct imports.
- [ ] Unit tests for service API (happy-dom) ensure DOM updates fire.
- [ ] Documentation snippet added to README or docs describing usage.

## Epic 2: Scene Flow & States

### Story 2.1: Implement Typed Scene Transitions
**Narrative:** As designers, we need named transitions (fade, swipe, instant) tied to `SceneManager` so we can script scene flow per §2.

**Acceptance Criteria**
- Given a scene change request includes a transition ID, when `SceneManager.replace` executes, then it triggers the matching transition strategy.
- Given no transition is specified, when change executes, then the default fade occurs.
- Given invalid transition ID, when called, then a warning is logged and the scene change proceeds with fallback.

**Definition of Done**
- [ ] `ISceneTransition` map implemented; transitions defined in new module.
- [ ] `SceneTransitions` refactored to dispatch named strategies.
- [ ] Unit tests cover valid/invalid transitions.
- [ ] Scenes updated to pass transition IDs where required (menu, gameplay, results).
- [ ] QA checklist updated noting supported transitions.

### Story 2.2: Add Victory, Defeat, and Inventory Scenes
**Narrative:** As players, we expect dedicated scenes for victory, defeat, and inventory to mirror spec diagrams.

**Acceptance Criteria**
- Given the player wins, when boss defeat triggers, then the `victory` scene loads with summary stats.
- Given the player loses all lives, when defeat event fires, then the `defeat` scene loads with retry options.
- Given the user opens inventory, when toggled, then the inventory scene overlays with items and closes returning to gameplay.

**Definition of Done**
- [ ] New scene files added under `src/js/scenes/` with tests.
- [ ] Routing logic updated in `GameplayScene._showResults` and pause handling.
- [ ] UI overlays created/updated in HTML & CSS for new scenes.
- [ ] Playwright tests cover victory/defeat flows.
- [ ] Accessibility audit run for new overlays (aria attributes).

### Story 2.3: Audit Overlays and DOM Structure
**Narrative:** As QA automation, we need consistent overlay IDs/classes so tests can block until overlays appear.

**Acceptance Criteria**
- Given each overlay exists, when `setOverlayVisible` toggles, then `aria-hidden` and focus behaviour matches docs/testing-notes.
- Given DOM is inspected, when overlays open, then focus moves to the expected primary control per spec.

**Definition of Done**
- [ ] HTML templates updated with accessible attributes.
- [ ] Integration test verifies focus handling on key overlays (pause, options, inventory).
- [ ] Testing notes updated with overlay ID list.
- [ ] Manual QA checklist executed for keyboard navigation.

## Epic 3: Gameplay Systems

### Story 3.1: Implement AI State Machine Layer
**Narrative:** As AI developers, we need `IAIBrain` with state-machine support to model patrol/chase/attack states per §5.1.

**Acceptance Criteria**
- Given an enemy template enables AI states, when spawned, then it transitions between states according to definitions (patrol→chase→attack).
- Given behaviour tree actions run, when AI state changes, then blackboard data updates accordingly.
- Given unit tests run, when state transitions execute, then timers/conditions behave as configured.

**Definition of Done**
- [ ] `IAIBrain` component and state machine utility implemented.
- [ ] Enemy templates updated with state definitions.
- [ ] Systems integrate state machine with behaviour tree results.
- [ ] Unit tests cover transitions and state persistence.
- [ ] Debug logging toggled via config for QA verification.

### Story 3.2: Enrich Enemy Templates with Difficulty Modifiers
**Narrative:** As balance designers, we need enemy templates to include spawn weights and difficulty modifiers reflecting §5.2.

**Acceptance Criteria**
- Given difficulty settings (easy/normal/hard), when waves load, then template stats adjust per modifier values.
- Given spawn tables, when RNG selects entries, then weighted probabilities align with configured `spawnWeight`.

**Definition of Done**
- [ ] `game-config.json` updated with modifiers and weights.
- [ ] Spawning system applies modifiers based on selected difficulty.
- [ ] Unit tests verify scaling for representative templates (blade, amidogus, cyborg).
- [ ] Gameplay smoke test run on easy & hard to validate behaviour.

### Story 3.3: Build Pet Cyborg Arena Encounter
**Narrative:** As narrative designers, we need the Pet Cyborg arena with detachable limbs, arena hazards, and boss logic per §6.3.

**Acceptance Criteria**
- Given the level loads, when the cyborg boss spawns, then limbs attach/detach according to health thresholds and attack patterns.
- Given arena timers tick, when spike hazards trigger, then warning indicators spawn before damage.
- Given the boss is defeated, when limbs destroyed, then victory conditions trigger and Reward events fire.

**Definition of Done**
- [ ] Components `CyborgCore`, `CyborgLimb` implemented with animations.
- [ ] Arena environment system spawns hazards and warning effects.
- [ ] Tests simulate limb detachment and hazard sequencing.
- [ ] Assets referenced (cyborg-atlas) verified and animated.
- [ ] Playthrough recorded for QA evidence.

### Story 3.4: Create Dimensional Portal Escape Scene
**Narrative:** As campaign players, we need the portal escape finale with key collection and bonuses per §6.4.

**Acceptance Criteria**
- Given the escape scene loads, when the player collects keys and bonuses, then portal progress updates and bonuses apply to score.
- Given timer expires, when portal inactive, then defeat outcome triggers.
- Given all objectives completed, when portal reached, then results screen shows appropriate achievements.

**Definition of Done**
- [ ] New scene module implementing portal mechanics, collectibles, and UI.
- [ ] Event handlers for key/time ball collisions created.
- [ ] Unit/integration tests cover win/lose conditions.
- [ ] HUD updates verified (bonus messages, timers).
- [ ] Gameplay video captured for documentation.

### Story 3.5: Add Missile Guidance and Seeker Systems
**Narrative:** As combat programmers, we need guidance/seeker interfaces to drive advanced missiles per §7.1.

**Acceptance Criteria**
- Given missile templates specify guidance type, when missiles update, then trajectories follow PN or specified guidance algorithms.
- Given countermeasures are triggered (future work), when guidance susceptible, then missile reacts per configuration (stub for now documented).

**Definition of Done**
- [ ] `IGuidanceSystem`, implementations (PN) added.
- [ ] Weapon/missile templates updated with guidance references.
- [ ] Unit tests verify guidance maths with deterministic targets.
- [ ] Rendering confirmed (trail effects intact).

### Story 3.6: Expand Tarak Boss Behaviours
**Narrative:** As boss designers, we need Tarak-specific attacks (beam, shockwaves, summons) matching §7.3.

**Acceptance Criteria**
- Given boss phases progress, when thresholds reached, then boss switches attacks and telegraphs per config.
- Given `executeTarakaBeam` runs, when telegraph finishes, then beam entity spawns with shockwave pattern.
- Given Playwright battle test runs, when Tarak hits phase gamma, then telegraphs and summons spawn according to config.

**Definition of Done**
- [ ] Boss AI updated with Tarak-specific behaviours and telegraphs.
- [ ] VFX hooks (beam, summon) wired to `vfx-atlas` frames.
- [ ] Unit tests validate phase transitions and event emissions.
- [ ] Manual boss run recorded verifying behaviour.

## Epic 4: Weapons & Magic

### Story 4.1: Upgrade Weapon Service to Factory-Based API
**Narrative:** As combat engineers, we need extensible weapon registration with heat/accuracy handling per §6.1.

**Acceptance Criteria**
- Given a weapon type registers via factory, when fetched, then its instance exposes fire/canFire/update methods.
- Given cooldown/heat thresholds, when weapon fired repeatedly, then restrictions apply and are observable in tests.

**Definition of Done**
- [ ] `WeaponService` redesigned with registerWeaponType & WeaponBase classes.
- [ ] `ShootingSystem` refactored to call new API.
- [ ] Unit tests mimic spec’s sample tests (fire when ready, block on cooldown).
- [ ] Docs updated in code comments for extension pattern.

### Story 4.2: Implement Spell Inventory and Casting Flow
**Narrative:** As ability designers, we need `IMagicInventory`, spell definitions, and casting life cycle to deliver shield/stasis combos per §6.2.

**Acceptance Criteria**
- Given player activates shield, when ability triggers, then spell enters cast → execute, spawning shield entity with timer.
- Given mana depleted, when spell attempted, then ability denies cast and UI reflects cooldown/mana shortage.
- Given tests run, when spells executed, then cooldowns and mana adjustments validated.

**Definition of Done**
- [ ] `IMagicInventory` component implemented with mana tracking.
- [ ] Spell classes (shield, stasis, future) defined with interface.
- [ ] Ability system integrates spells and updates UI/audio.
- [ ] Unit tests cover casting, cancellation, cooldown reset.

### Story 4.3: Wire Animations and VFX to Abilities
**Narrative:** As VFX artists, we need ability triggers to play the correct sprite animations and effects (`comboBreaker`, `teleport`, shield) per art docs.

**Acceptance Criteria**
- Given combo breaker triggers, when executed, then hero sprite plays `comboBreaker` animation and VFX spawns `vfx-atlas` combo burst.
- Given teleport completes, when arrival occurs, then teleport trail/arrival VFX play in sync.

**Definition of Done**
- [ ] Animation mappings configured in player entity initialization.
- [ ] Ability system spawns VFX via resource manager.
- [ ] Playwright visual assertions or screenshot diffs validated.
- [ ] Manual verification recorded (GIF or video).

## Epic 5: Data & Persistence

### Story 5.1: Add Config Schema Validation and Watchers
**Narrative:** As tools engineers, we need `ConfigService` to validate JSON against schemas and emit change events per §8.1.

**Acceptance Criteria**
- Given configs load, when `load` finishes, then JSON schema validation occurs and errors surface with file/field context.
- Given dev mode reloads, when config file changes, then service emits change events for listeners.

**Definition of Done**
- [ ] JSON schemas created for assets, enemies, weapons, missions.
- [ ] `ConfigService` integrates ajv or similar validator.
- [ ] Unit tests cover success/failure and watcher callbacks.
- [ ] Dev tooling documentation updated with hot reload usage.

### Story 5.2: Extend Save Service with Migration & Checksums
**Narrative:** As persistence engineers, we need versioned saves with checksum verification per §8.2.

**Acceptance Criteria**
- Given save version increments, when loading old data, then migrations upgrade records automatically.
- Given save corruption, when checksum fails, then service returns an error and writes fallback copy.

**Definition of Done**
- [ ] `SaveService` gains `migrate` method and checksum validation.
- [ ] Migration script(s) for existing keys implemented.
- [ ] Unit tests covering upgrade path and checksum failures.
- [ ] Manual test: tamper with IndexedDB/localStorage entry, ensure service detects.

### Story 5.3: Integrate Spatial Grid into Collision System
**Narrative:** As performance engineers, we need spatial partitioning active so collision checks scale per §9.2.

**Acceptance Criteria**
- Given high entity counts, when collisions run, then grid queries limit checks to relevant cells (validated via metrics).
- Given profiler overlay, when open, then grid cell/entity counts display live to match spec.

**Definition of Done**
- [ ] `SpatialGrid` instantiated within collision/broad-phase system.
- [ ] Metrics piped into performance overlay.
- [ ] Unit tests compare naive vs grid results for correctness.
- [ ] Performance benchmark documented in audit follow-up.

## Epic 6: Art Pipeline & Assets

### Story 6.1: Deliver Consolidated Tarak Atlas
**Narrative:** As art integration, we need `tarak-atlas.png|json` (512×512 frames) with all phase animations, replacing legacy stub entries.

**Acceptance Criteria**
- Given the manifest loads, when Tarak assets requested, then `tarak-atlas` spritesheet provides idle, tail, wing, beam, summon, death sequences.
- Given boss fights run, when animations triggered, then correct frames play.

**Definition of Done**
- [ ] New atlas generated and added under `src/images/Sprites/Boss/`.
- [ ] `game-config.json` updated to point to consolidated atlas.
- [ ] Old `1_Tarak.png` references removed.
- [ ] Asset loading test page passes without missing frames.

### Story 6.2: Trim Atlases and Embed Collider Metadata
**Narrative:** As engine integrators, we need hero/enemy atlases trimmed to 256×256 (hero/exceptions noted) with metadata for colliders per art spec.

**Acceptance Criteria**
- Given trimmed assets provided, when textures load, then bounding boxes reduce to target sizes (validated via inspect).
- Given JSON includes `colliderRadius`, when runtime loads, then collider component uses metadata rather than hard-coded values.

**Definition of Done**
- [ ] Atlases regenerated with trim/padding settings documented.
- [ ] JSON metadata includes collider/sprite size/anchor entries.
- [ ] Runtime updates to read metadata for collider setup.
- [ ] Visual regression checks ensure no cropping.

### Story 6.3: Document/Automate Atlas Export Pipeline
**Narrative:** As art ops, we need repeatable export scripts or detailed instructions to regenerate atlases per `docs/art-pipeline.md`.

**Acceptance Criteria**
- Given a new asset set, when script/instructions followed, then output files land in correct directories with naming conventions enforced.
- Given README/instructions consulted, when run, then pipeline prerequisites and commands are clear.

**Definition of Done**
- [ ] Node/Python script or documented TexturePacker profile committed.
- [ ] Docs updated with step-by-step export workflow.
- [ ] Sample run included in repo (`tools/` or docs) showing command usage.
- [ ] QA verifies by regenerating one atlas and diffing output.

## Epic 7: Testing & Tooling

### Story 7.1: Add Unit Tests for New Systems
**Narrative:** As QA, we need targeted Vitest coverage for weapon factories, AI state machine, save migrations, and config validation.

**Acceptance Criteria**
- Given tests run, when `npm run test:unit` executes, then suites cover new modules with >80% branch coverage.
- Given CI fails, when coverage drops below threshold, then pipeline blocks merge.

**Definition of Done**
- [ ] New test files under `tests/unit/` for each system.
- [ ] Coverage thresholds updated if needed.
- [ ] Docs/testing-notes mention new suites.

### Story 7.2: Expand Playwright Scenarios for Key Encounters
**Narrative:** As QA automation, we need E2E tests that cover Pet Cyborg arena, portal escape, missile guidance, and Tarak phases.

**Acceptance Criteria**
- Given `npm run test:e2e` runs, when scenarios execute, then each new encounter test validates expected events (limb detach, portal open, beam telegraph).
- Given tests run in headless mode, when asset placeholders enable, then runs succeed without manual input.

**Definition of Done**
- [ ] Playwright spec files added with helper utilities.
- [ ] Screenshot or log artifacts captured on failure.
- [ ] CI pipeline updated to run new tests nightly.

### Story 7.3: Integrate Performance Profiler into Dev Tools
**Narrative:** As performance analysts, we need profiler data accessible via overlay and console API.

**Acceptance Criteria**
- Given profiler enabled, when toggling overlay, then metrics come from `PerformanceProfiler` summary (average/min/max).
- Given console usage, when calling `window.__devHandles.getPerformanceSummary()`, then latest summary returns.

**Definition of Done**
- [ ] Overlay uses profiler summary lines.
- [ ] Dev handle exposes getter documented in testing notes.
- [ ] Manual verification recorded (screenshot or JSON output).

## Epic 8: Build & Release

### Story 8.1: Align Build Pipeline with Spec (or Update Spec)
**Narrative:** As release engineers, we need clarity between Vite and documented webpack pipeline. Either adopt webpack with compression or update docs to reflect Vite.

**Acceptance Criteria**
- Given decision recorded, when release checklist read, then build instructions match actual scripts.
- Given build runs, when `npm run build` executes, then output includes hashed assets and compression per chosen pipeline.

**Definition of Done**
- [ ] Either add `webpack.config.js` + updated scripts or revise docs to endorse Vite with equivalent optimisations (e.g., Rollup compression plugin).
- [ ] Dist output verified (hashed filenames, compressed assets).
- [ ] Release checklist updated accordingly.

### Story 8.2: Implement Asset Pipeline Automation
**Narrative:** As tooling engineers, we need `AssetPipeline.optimizeTextures/generateSpritesheets/compressAudio` or functional equivalents to automate asset optimisation per §11.2.

**Acceptance Criteria**
- Given pipeline command runs, when executed, then textures convert to WebP (where applicable), spritesheets pack, and audio compresses with logs.
- Given docs instruct usage, when followed, then output directories match spec.

**Definition of Done**
- [ ] Scripts/tools added (Node or Python) invoking sharp/texture packer/audio encoder.
- [ ] README/docs updated with command usage.
- [ ] Sample run results archived under `test-results/` or equivalent.

### Story 8.3: Enhance Release Automation & QA Sign-off
**Narrative:** As project leads, we need release automation that archives builds with commit SHAs, verifies CDN uploads, and enforces QA sign-off.

**Acceptance Criteria**
- Given release script runs, when invoked, then it zips `dist/` with SHA and updates changelog.
- Given QA checklist executed, when release prepared, then sign-offs recorded in docs.

**Definition of Done**
- [ ] Release script (`npm run release` or `scripts/release.ts`) created.
- [ ] Docs updated with sign-off steps and evidence requirements.
- [ ] Change log template maintained with latest entries.

## Epic 9: Documentation & Knowledge Base

### Story 9.1: Synchronise Design Docs After Implementation
**Narrative:** As documentation owners, we need to update design docs (architecture, art spec) once new systems land so future audits remain accurate.

**Acceptance Criteria**
- Given features delivered, when docs audited, then sections 5–7 reflect implemented behaviours, assets, and tooling.
- Given doc diff reviewed, when merged, then outdated placeholder text removed or annotated.

**Definition of Done**
- [ ] Relevant docs updated with final behaviour descriptions.
- [ ] Audit log appended noting doc sync date.
- [ ] Stakeholder review sign-off recorded.

### Story 9.2: Maintain Plan Tracking
**Narrative:** As leads, we need `PlanToFinish.md` kept up to date with story status so the release checklist can rely on it.

**Acceptance Criteria**
- Given a story completes, when plan updated, then status/notes reflect completion.
- Given release checklist references plan, when QA reviews, then outstanding items obvious.

**Definition of Done**
- [ ] Establish update cadence (per sprint or milestone) documented.
- [ ] Checklist item in release process ensures plan refreshed before sign-off.
- [ ] Version control history shows updates aligned with deliverables.
