## UFO Adventures - Audit and Remediation Plan (2025-10-06)

### Features Summary (from docs/UfoGameDesign_Architecture.md)
- Core architecture: ECS, Service Locator, EventBus, data-driven configs, performance focus
- UI service abstraction (`UiService`) decouples DOM from systems/scenes
- Scenes & transitions: bootstrap, asset loading, main menu; campaign/arcade/training/options/credits; results/leaderboard; instant/fade transitions
- Game loop: fixed timestep (MAX_FRAME_SKIP), interpolation, performance metrics/overlay
- Components: Transform, Motion, Collider, Weapon, Health, AI state machine; spec also mentions Magic inventory
- Enemies: AI state machine layer; enemy templates with difficulty modifiers
- Weapons & Magic: factory-based weapon API (registerWeaponType/WeaponBase), heat/accuracy; magic inventory and spell casting lifecycle (shield, stasis, etc.)
- Pet Cyborg Arena: detachable limbs; arena hazards/warnings; limb behaviors
- Portal Escape: key collection, time bonuses, floating platforms; portal opens with required keys; bonus scoring
- Missile Guidance: Guidance interface; Proportional Navigation (PN); seeker systems; effects
- GPU Acceleration: custom WebGL renderer/shaders (trails, glow, heat distortion)
- Tarak Boss: multi-phase with telegraphs and special attacks (Taraka beam, shockwaves, summons)
- Data & Persistence: config schema validation/watchers; save migrations + checksum
- Performance: object pooling; spatial grid
- Testing: unit tests and profiling
- Build/DevOps: webpack or equivalent with compression; asset pipeline (textures/audio/spritesheets)

### Implementation Status
- Architecture, ECS, Service Locator, EventBus: Implemented
- UI service: Implemented and in use across systems/scenes
- Scenes & transitions: Implemented (`SceneManager`, `SceneTransitions`); unit tests present
- Game loop + profiler: Implemented with tests; overlay shows metrics
- Components: Transform/Motion/Collider/Weapon/Health/AI present; Magic inventory not implemented
- Enemy systems: BehaviorTreeSystem + AI states implemented; telegraph/summon/fireWeapon supported
- Weapon redesign (factory API, heat/accuracy): Missing (current `WeaponService` is static)
- Magic system (IMagicInventory, spells): Missing (only `PlayerAbilities` timers)
- Pet Cyborg Arena: 
  - Cyborg components present
  - CyborgLimbSystem implemented (detachment + effect)
  - ArenaEnvironmentSystem implemented (basic hazard effect)
  - Full boss logic/animations/templates: Partial/Missing
- Portal Escape: 
  - `PortalEscapeScene` implemented (key collection via `collectible:key`, HUD updates, emits `portal:open`)
  - Time balls/platforms/portal mechanics/scoring: Missing
- Missile guidance: PN guidance + MissileGuidanceSystem implemented; seeker/warhead abstractions missing
- GPU acceleration/shaders: Missing (using Pixi defaults)
- Tarak boss advanced attacks: Partial (telegraph/events supported; specific attacks not implemented)
- Config schema/watchers: Missing
- Save migrations/checksum: Missing
- Spatial grid: Module present; not integrated into collision
- Testing: Strong; new tests for guidance, cyborg limbs, arena hazards, portal scene; all green (59/59)
- Build pipeline: Vite in use; webpack/explicit compression not configured

### Remediation Roadmap (Prioritized)
1) Implement Weapon Factory API (Spec §6.1)
   - Add `WeaponBase`, register API in `WeaponService` (registerWeaponType, createById)
   - Port key weapons (player-blaster, enemy-burst, boss-beam) to classes; add heat/accuracy fields
   - Update `ShootingSystem` to delegate to factory where applicable
   - Tests: firing when ready; cooldown/heat behavior; accuracy spread

2) Magic Inventory and Spells (Spec §6.2)
   - Add `IMagicInventory` component; implement `ShieldSpell`, `StasisSpell`
   - Extend ability system or add `AbilitySystem` hooks to consume spells; HUD updates & audio hooks
   - Tests: cast success, cooldowns, shield absorption, stasis pause/resume

3) Pet Cyborg Arena Enhancements (Spec §6.3)
   - Extend `CyborgLimbSystem` with reattach cooldown, autonomous detached behaviors
   - Boss core vulnerability windows; enrage threshold; limb attack patterns
   - Arena hazards: warning telegraphs before damage; pattern variations
   - Tests: limb detach/reattach flows; warnings → spikes timing; vulnerability window scoring

4) Portal Escape Mechanics (Spec §6.4)
   - Add time balls, floating platforms; portal activation progress and size
   - Scoring bonuses (time remaining, enemies cleared, bonuses collected)
   - Tests: key threshold opens portal; time ball adds time; win condition when entering active portal

5) Spatial Grid Integration (Spec §9.2)
   - Instantiate `SpatialGrid` in collision system; bucket entities; compare correctness vs naive
   - Surface grid metrics to overlay
   - Tests: naive vs grid collisions equivalence on small scenes

6) Config Schema & Watchers (Spec §8.1)
   - Integrate JSON schema validation (e.g., ajv); watch config files in dev
   - Tests: valid/invalid configs; live updates callback

7) Save Migrations & Checksums (Spec §8.2)
   - Add `migrate(from, to)` and checksum to `SaveService`
   - Tests: migration path; checksum mismatch detection

8) Tarak Boss Behaviors (Spec §7.3)
   - Implement Taraka beam, shockwave patterns, summons with telegraphs
   - Tests: phase transitions; event emissions; telegraph-to-attack timing

9) Build Pipeline Alignment (Spec §11)
   - Either adopt webpack config with compression or configure Vite rollup plugins for compression and hashed assets
   - Verify dist output, update release checklist

10) GPU Acceleration & Shaders (Spec §7.2) [Later]
   - Prototype shader-based trails and glow; evaluate ROI post-core features

### Acceptance & Quality Gates
- Unit tests added for each remediation item; suite remains green
- No console warnings in dev server smoke run
- Manual validations for Epic 1 loop (CPU throttle/overlay) remain clean
- Update docs: PlanToFinish and Architecture to reflect new implementations

---

## Next Session Plan (to continue tomorrow)

1) Stabilize MagicSystem
   - Fix export/re-export: add `MagicSystem` to `engine/systems.ts` re-exports or import directly in `gameplay-runtime.ts` from `magic-system.ts`.
   - Re-run tests; ensure shield casting test passes; add stasis pause/resume test.
   - Wire stasis to temporarily pause enemies (`_stasisPaused` flag) and auto-clear.

2) Weapon Factory Adoption
   - Migrate `player-blaster` config to include `volley`/`accuracyDegrees` in `game-config.json`.
   - Add `BossBeamStrategy` (basic) and register; optional config migration.
   - Add unit tests for BossBeamStrategy firing.

3) Portal Escape Enhancements
   - Add time balls and floating platforms; simple kinematics + collisions.
   - Track portal activation progress; winning condition when entering active portal.
   - Tests for time add and win condition.

4) Cyborg Arena Improvements
   - Reattach cooldown, detached limb behaviors; vulnerability window in boss core.
   - Arena warnings before spikes (delay/telegraph → damage).
   - Unit tests covering detach/reattach and warning timing.

5) Spatial Grid Integration
   - Instantiate `SpatialGrid` in CollisionSystem; compare naive vs grid results.
   - Overlay metrics for cells/occupants.

6) Config Schema & Save Migrations
   - Integrate ajv validation + watchers in `ConfigService`.
   - Add checksum + `migrate` to `SaveService`; tests for tamper detection.

7) Docs & Build
   - Update `PlanToFinish.md` statuses and `UfoGameDesign_Architecture.md` notes.
   - Add Vite compression plugin (or document webpack alternative) and verify dist.



