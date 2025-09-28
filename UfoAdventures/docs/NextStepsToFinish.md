# Next Steps To Finish

## 1. Infrastructure & Persistence
- Gap: The design mandates a dedicated `SaveService` with IndexedDB support (`docs/UfoGameDesign_Architecture.md:1034`), yet the runtime only registers event, config, resource, scene, input, and game services (`src/js/game-application.js:15-20`).
  - [ ] Implement `SaveService` matching the spec (async `save/load/delete` APIs) and register it in `GameApplication`.
  - [ ] Persist player progress, mission outcomes, and settings when `GameplayScene` dispatches results.
  - [ ] Backfill load flows in bootstrap/main menu to hydrate state before scenes activate.
- Gap: Audio hooks referenced in the architecture (`docs/UfoGameDesign_Architecture.md:825`) are missing; there is no audio service or event wiring.
  - [ ] Create an `AudioService` to manage BGM/SFX, expose `playSound`/`playMusic`, and register it with the service locator.
  - [ ] Emit gameplay/event bus cues (e.g., ability triggers, boss phases, results) to drive audio playback.
  - [ ] Extend config to define audio assets alongside sprites for consistent loading.

## 2. Scene & Mode Coverage
- Gap: The scene map includes Arcade, Training, Options, Credits, and Leaderboard states (`docs/UfoGameDesign_Architecture.md:61-70`), but only bootstrap, asset-loading, main-menu, gameplay, pause, inventory, and results are implemented (`src/js/game-application.js:65-71`).
  - [ ] Add scene classes for options, credits, leaderboard, and training/arcade gameplay wrappers.
  - [ ] Update main menu buttons to navigate to the new scenes/modes and ensure stack transitions behave per design.
  - [ ] Expand `GameplayRuntime` to support additional mode presets (arcade scoring, training sandbox) and expose mode-specific HUD toggles.

## 3. Gameplay Systems & AI
- Gap: Enemy templates are expected to drive behavior trees and difficulty modifiers (`docs/UfoGameDesign_Architecture.md:256-274`), yet the runtime relies on fixed pattern enums without state machines (`src/js/engine/systems.js:205-365`).
  - [ ] Introduce a lightweight behavior-tree runner and extend templates to include node graphs/difficulty data.
  - [ ] Implement per-wave modifiers (speed, health, spawn weight) and integrate them into the spawning system.
- Gap: Weapon registry and spellcasting features (laser, missiles, spell inventory) are called out in the component spec (`docs/UfoGameDesign_Architecture.md:185-352`), but only a single bullet weapon exists (`src/js/engine/systems.js:433-482`).
  - [ ] Build a weapon factory that reads weapon configs, supports multiple projectile patterns, and allows enemies/bosses to select weapons.
  - [ ] Flesh out the player spell/ability system beyond combo breaker + teleport (e.g., shields, crowd control) and surface cooldown visuals in the HUD.
- Gap: The boss fight requires multi-phase behaviors with limb control and summons (`docs/SpiritsDesign.md:1-88`), while the current boss just patrols and fires simple spreads (`src/js/engine/systems.js:545-621`).
  - [ ] Implement phase scripts for Tarak (telegraphs, summons, special attacks) tied to health thresholds and the behavior tree system.
  - [ ] Add event hooks for minion spawns and vulnerability windows so UI/audio can react.

## 4. Progression & Meta Systems
- Gap: Design references campaign/mission objectives, results breakdowns, and leaderboard persistence (`docs/UfoGameDesign_Architecture.md:61-70`, `docs/UfoGameDesign_Roadmap.md:69-108`), but gameplay immediately returns to a simple results scene without meta tracking (`src/js/scenes/gameplay-scene.js:200-257`).
  - [ ] Define a mission progression model (objectives, scoring, rewards) stored via the new `SaveService`.
  - [ ] Expand the results scene to show stats, rewards, and leaderboard submission flows.
  - [ ] Wire main menu/leaderboard scenes to render stored runs and manage resets.

## 5. Performance & Tooling
- Gap: The architecture emphasizes pooling, spatial partitioning, and FPS profiling (`docs/UfoGameDesign_Architecture.md:1063-1105`), yet entities are created/destroyed each frame and there is no diagnostics overlay (`src/js/engine/systems.js:433-621`, `src/js/game.js:138-204`).
  - [ ] Introduce object pools for bullets, enemies, and effects to reduce GC churn.
  - [ ] Implement a simple spatial grid or quad tree for collision queries and update the collision system accordingly.
  - [ ] Add a performance HUD (FPS, frame time, entity counts) leveraging the fixed timestep loop in `GameApplication`.

## 6. Art, Animation & Assets
- Gap: Sprite doc specifies full animation sets for Tarak, minions, and cyborg enemies (`docs/SpiritsDesign.md:1-190`), but the config only loads four static SVGs (`src/config/game-config.json:11-23`).
  - [ ] Produce/import the required sprite sheets (idle, attacks, VFX) and register them in the asset manifest.
  - [ ] Update entity factories to use animated sprites (Pixi `AnimatedSprite`) with state-driven clips.
  - [ ] Author ability/boss VFX (teleport trails, combo breaker burst, Taraka beam) aligned with design callouts.

## 7. QA & Tooling Support
- Gap: The roadmap expects automated tests and manual smoke probes (`docs/UfoGameDesign_Roadmap.md:109-150`), but the repo still lacks scripted coverage and relies on manual playtests.
  - [ ] Stand up a lightweight test harness (Vitest/Playwright) for critical systems (input, scene transitions, spawning math).
  - [ ] Create `src/test_*.html` probes for new subsystems (audio, pooling, behavior trees) to accelerate manual verification.
  - [ ] Document checklists in `docs/` so designers can validate features per milestone.
