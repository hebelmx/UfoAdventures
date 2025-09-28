# UFO Space Adventure - Missing Systems Plan

Generated after splitting the design docs to map the highest-impact gaps between the spec and the current prototype.

## Guiding Principles
- Build iteratively so the playable slice stays functional after each milestone.
- Prioritise systems that unblock multiple downstream features (scene flow, combat, UI).
- Re-use the existing ECS/service scaffolding to avoid further rewrites mid-stream.

## Milestone Roadmap

### Milestone 1 - Scene Flow Foundations (complete)
- Expand `SceneManager` with `push`, `pop`, and `replace` to support a stack of scenes.
- Add pause, inventory, and results scenes with minimal UI so the flow stays testable.
- Route pause/inventory requests from the input bindings via the EventBus and ensure gameplay resumes cleanly.
- Manual check: bootstrap -> gameplay -> pause/inventory -> resume -> results transitions.
- Status: Delivered. Scene stack sequencing, pause/inventory overlays, and results flow verified in the current build.

### Milestone 2 - Combat Core Reliability (complete)
- Update `CollisionSystem` to include bosses and enemy projectiles in overlap checks.
- Emit `combat:damage` events and surface UI feedback; ensure bullets/enemies clean up off-screen.
- Manual check: boss takes damage and dies, player defeat path triggers results scene.
- Status: Delivered. Collision + cleanup now handle bosses, enemy fire, and feed the damage HUD/event bus.

### Milestone 3 - Ability Systems & Input Commands (in progress)
- Introduce a `PlayerAbilities` component with cooldown tracking for combo breaker and teleport.
- Wire configured keys through the EventBus, update HUD (combo/lives) when abilities trigger.
- Manual check: ability keys fire, respect cooldowns, and reflect in UI messaging.
- Progress: Components, HUD widgets, input bindings, and the `AbilitySystem` logic exist. Remaining tasks: attach the system to the gameplay runtime, finalise combo breaker effects/VFX, and tune teleport distance/cooldowns.

### Milestone 4 - Enemy & Boss Behaviours (in validation)
- Define enemy archetypes and movement/attack patterns in config instead of RNG.
- Add adventure wave scripting plus a multi-phase boss controller keyed to health thresholds.
- Manual check: waves progress, boss phases change behaviour, victory/end screens show.
- Progress: Behaviour system with sine/swoop/strafe patterns is live; boss AI + shooting phases and config-driven templates/waves are authored. TODO: pull mission config into gameplay scene, tune timings, and capture telemetry for difficulty adjustments.

### Milestone 5 - Data & Progression (not started)
- Externalise enemies/weapons to JSON, load through `ConfigService`, and add a lightweight `SaveService` (localStorage).
- Track mission objectives, player progress, and display them in the results scene.
- Manual check: run two sessions with saved settings/progress restored.
- Progress: Enemy/boss definitions already live in `config/game-config.json`, but save/loading hooks and mission progress tracking are pending.

### Milestone 6 - Performance & Tooling (not started)
- Implement fixed timestep + FPS overlay, add bullet/enemy pooling and a spatial bucket for collisions.
- Create `src/test_*.html` probes and a manual smoke checklist for regressions.
- Manual check: stress spawn scenario remains at target FPS with overlay data visible.

## Current Focus
- Wire the `AbilitySystem` into the active systems list, validate cooldown HUD updates, and capture tuning notes (Milestone 3).
- Pass configured enemy waves and boss phases from the config service into gameplay scenes, then collect balance feedback (Milestone 4).
- Outline the `SaveService` contract so persistence work can start once combat/ability tuning stabilises (Milestone 5).

## Dependencies & Notes
- Confirm art aliases exist before enabling new enemy templates.
- Coordinate ability design with UI so bars/buttons display correctly.
- Revisit the roadmap doc after each milestone to keep designers synced.


