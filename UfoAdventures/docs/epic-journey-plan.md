# Epic Journey Plan (Reverse Order Crusade)

## Epic 1: QA Vanguard (Starting at the Finish Line)
**Goal**: Establish confidence tooling before touching gameplay.
- Story 1.1: Stand up automated test harness (Vitest + Playwright) for critical ECS/services.
- Story 1.2: Author `src/test_*.html` probes covering audio hooks, pooling, and AI behaviour trees.
- Story 1.3: Document manual smoke checklist and test matrix for designers.
- Story 1.4: Wire tests into npm scripts and CI placeholder.

## Epic 2: Art & Asset Reforging
**Goal**: Replace placeholder art with the concept sheet’s animated sprites and VFX.
- Story 2.1: Produce/import Tarak multi-phase sprite sheets + minion/ cyborg sets.
- Story 2.2: Register animated atlases in `game-config.json`; expand loader to support spritesheet metadata.
- Story 2.3: Update entities to use `PIXI.AnimatedSprite` with state transitions and VFX overlays.
- Story 2.4: Create ability/boss particle effects (teleport trail, combo breaker burst, Taraka beam).

## Epic 3: Performance & Toolsmithing
**Goal**: Optimise runtime before adding new behaviours.
- Story 3.1: Implement object pools for bullets, enemies, effects; refactor systems to recycle entities.
- Story 3.2: Add spatial partitioning (grid/quad tree) to collision detection.
- Story 3.3: Layer in diagnostics HUD (FPS, frame time, counts) hooked into fixed timestep loop.
- Story 3.4: Profile and benchmark stress scenarios, logging baseline metrics for future QA.

## Epic 4: Progression & Meta Weave
**Goal**: Build campaign/leaderboard scaffolding to capture future content.
- Story 4.1: Define mission structure (objectives, rewards, scoring) with schema.
- Story 4.2: Extend results scene for post-run stats, rewards, and leaderboard submission.
- Story 4.3: Implement leaderboard + run history scenes reading from persistence.
- Story 4.4: Integrate mission tracking into gameplay, including failure/success flows.

## Epic 5: Gameplay Systems Resurgence
**Goal**: Enrich AI, weapons, and boss logic in line with design docs.
- Story 5.1: Build behaviour-tree runner & data format; adapt enemy templates to consume it.
- Story 5.2: Create weapon registry supporting multiple projectile profiles and combos.
- Story 5.3: Expand player ability suite (shields, CC, mobility) with HUD cues.
- Story 5.4: Script Tarak multi-phase encounter (telegraphs, summons, vulnerability windows).

## Epic 6: Scene & Mode Convergence
**Goal**: Deliver complete scene stack envisioned in the design map.
- Story 6.1: Implement Options, Credits, Training, Arcade, and Leaderboard scenes.
- Story 6.2: Update Main Menu UI and routing to expose new scenes with stack-safe transitions.
- Story 6.3: Extend `GameplayRuntime` with arcade/training presets and HUD adjustments.
- Story 6.4: Add transition animations/effects for scene stack interactions.

## Epic 7: Infrastructure & Persistence Foundations
**Goal**: Build base services last, locking the support structure into place.
- Story 7.1: Implement `SaveService` (IndexedDB) and integrate with service locator.
- Story 7.2: Wire persistence flows for settings, mission progress, leaderboard entries.
- Story 7.3: Create `AudioService` managing BGM/SFX playlists with config-driven assets.
- Story 7.4: Emit audio cues from EventBus (abilities, boss states, scene transitions).

## Rolling Milestones & Rituals
- **Sprint cadence**: 1-week sprints tackling one epic slice at a time (QA → Art → ... → Infrastructure).
- **Demo checkpoints**: End of each epic with in-browser walkthrough + updated documentation.
- **Retrospectives**: Post-epic review to capture learnings before descending to the next layer.
- **Risk watch**: Art production and AI complexity flagged as high risk; maintain parallel communication with art/design teams.
