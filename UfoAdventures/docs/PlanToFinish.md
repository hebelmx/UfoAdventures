### Status Update (2025-10-01)
- Main menu overlay now toggles symmetrically using typed `SceneTransitions`, clearing the overlay polish TODO.
- Legacy UI helpers (`src/js/ui.ts`, `src/js/ui/scene-transitions.ts`) converted to typed modules with the `@ts-nocheck` directives removed.
- Duplicate overlay button styles trimmed from `src/css/style.css` and the stray EOF marker eliminated, resolving the minifier warning.
- `npm run build` passes after the clean-up; upcoming focus stays on adding automated coverage for menu overlays, runtime pooling, and `AudioService.configure` asset wiring.
- Entity pooling, spatial grid, profiler, and placeholder utils now typed; remaining `@ts-nocheck` work focuses on `systems.ts` and gameplay runtime wiring.

# UFO Adventures Delivery Plan

## Phase 1 - Modularise the Gameplay Runtime
### Objectives
- Convert the legacy prototype scripts into first-class ES modules/TypeScript so the modern architecture can import them directly.
- Eliminate reliance on `window` globals for the core game loop, components, systems, and HUD utilities.

### Tasks & Implementation Notes
The remaining runtime migration is now tracked across focused sub-phases:

#### Phase 1.1 - Core Type Foundations
- Finalise shared typings (entity augmentation, vector helpers, scene/service interfaces) and stabilise `tsconfig` for strict builds.
- Type remaining engine utilities and services that still leak `any` usage (`audio-service.ts`, `resource-manager.ts`, `save-service.ts`, `progression-service.ts`).
- Establish ambient declarations for PIXI attachment points and bridge helpers used by multiple systems.
- Exit Criteria: `npm run build` stays green and `npx tsc --noEmit` reports issues only inside `systems.ts`/`gameplay-runtime.ts`.

#### Phase 1.2 - Engine Systems (Core Loop)
- Port `RenderSystem`, `PlayerInputSystem`, `MovementSystem`, `AbilitySystem`, `UISystem`, `BoundaryCleanupSystem`, and `CleanupSystem` to strict TypeScript.
- Introduce typed component accessors/utilities to eliminate repeated null checks.
- Exit Criteria: Systems compiled without `any`, HUD and movement flows work in manual smoke tests.

#### Phase 1.3 - Engine Systems (Combat & AI)
- Type behaviour and combat-heavy systems: `BehaviorTreeSystem`, `EnemyBehaviorSystem`, `EnemySpawningSystem`, `ShootingSystem`, `CollisionSystem`, `BossAISystem`, `BossShootingSystem`.
- Model mission/enemy templates and spawn contexts so behaviour trees reference strongly typed payloads.
- Exit Criteria: TSC clean for `systems.ts`, runtime smoke confirms enemy/boss loops still execute.

#### Phase 1.4 - Gameplay Runtime Integration
- Convert `gameplay-runtime.ts` to strict TypeScript and wire pools/grids/profiler using the new typings.
- Type `entities/player.ts` and other actor constructors relied upon by the runtime.
- Exit Criteria: `npm run build` and `npx tsc --noEmit` pass without suppressions; runtime pools behave during manual smoke tests.

#### Phase 1.5 - Scene & Test Alignment
- Update scenes to consume new typed services (mission/results/options/main-menu) and clean stray optional DOM lookups.
- Refresh Playwright/unit tests to stop reaching for removed globals; expose dev-only handles via typed windows when necessary.
- Exit Criteria: E2E smoke succeeds locally, no residual `@ts-nocheck` across `src/`.

#### Phase 1.6 - Cleanup & Regression Guardrail
- Remove temporary flags (e.g. `skipLibCheck`), re-run full TypeScript build, and capture any missing ambient typings.
- Add targeted unit coverage for pooling, behaviour tree state transitions, and HUD toggles.
- Deliver final documentation update summarising Phase 1 completion.

Legacy guidance below remains for historical context but the checklists above supersede the implementation order.\n\n### Sample Code
```ts
// Example: src/js/engine/entity.ts
export class Entity {
    private readonly components = new Map<Function, Component>();

    addComponent<T extends Component>(component: T): T {
        this.components.set(component.constructor, component);
        component.entity = this;
        return component;
    }

    getComponent<T extends Component>(ctor: new (...args: any[]) => T): T | undefined {
        return this.components.get(ctor) as T | undefined;
    }
}
```

### Code Style & Review Notes
- Honour repo conventions: 4-space indentation, single quotes, semicolons, 80–100 column awareness.
- Introduce TypeScript interfaces for shared contracts (e.g. `IRenderSystem`, `IWeaponService`) where appropriate.
- Add concise comments for complex behaviours (pooling, behaviour tree execution) to aid reviewers transitioning from the prototype.

### Testing & Validation
- `npm run build` must succeed without injecting globals.
- Extend `tests/unit` with coverage for converted modules (entity/component lifecycle, system execution, pooling, behaviour trees).
- Manual smoke: run `npm run dev`, load the game, and verify no `ReferenceError` for previously global symbols.

### Deliverables
- New/updated module files under `src/js/**` (prefer `.ts` extensions) with appropriate exports.
- Scene files updated to import modules directly, no remaining `declare const` stubs.
- Deleted deprecated artifacts (`*.corrupted`, unused `.js` once `.ts` introduced).

### Quality Gates & Acceptance Criteria
- TypeScript compilation passes with strict mode (`npm run build`).
- ESLint/Prettier (if configured) report no violations for new files.
- Manual gameplay shows HUD integration (health/combo updates) still functioning using module imports.

---

## Phase 2 – Rehydrate the Boot Path & UI Scaffolding
### Objectives
- Restore the DOM structure expected by the modularised scenes so `GameApplication` can boot cleanly.
- Surface the PIXI canvas, loading overlays, and HUD panels required for menus, pause, inventory, and results flows.

### Tasks & Implementation Notes
- Port essential layout from `src/complete_game_setup.html` into `src/index.html`, including `#gameCanvas`, `#loadingScreen`, `#missionLaunchButton`, `#pauseOverlay`, `#inventoryOverlay`, `#resultsOverlay`, HUD bars, ability indicators, and damage log containers referenced throughout `src/js/scenes/*`.
- Organise markup semantically (sections for HUD, overlays, menu lists) and ensure elements support keyboard navigation (tabindex, ARIA labels where needed).
- Update `src/css/style.css` as necessary to style new overlays while keeping consistent theming.
- Adjust `src/js/main.ts` to instantiate `GameApplication` after the DOM is ready; expose `window.gameApp` in development for Playwright compatibility and debugging.

### Sample Code
```html
<body>
  <div id="loadingScreen" class="loading-screen">
    <span class="loading-text">Loading assets...</span>
  </div>
  <div class="game-container">
    <canvas id="gameCanvas" width="800" height="600"></canvas>
    <div class="ui-overlay">
      <div class="health-bar"><div id="healthFill" class="health-fill"></div></div>
      <!-- additional HUD panels here -->
    </div>
  </div>
  <!-- overlays for pause/results/options/inventory -->
</body>
```

### Code Style & Review Notes
- Keep IDs lowercase with dashes to match existing selectors in scenes/tests.
- Use BEM-like class naming already present in `style.css` to maintain readability.
- Document major structural sections with short comments for future contributors.

### Testing & Validation
- Manual: `npm run dev` → `http://localhost:5173/src/index.html`; confirm loading screen, main menu, and gameplay HUD render without console errors.
- Playwright: `npm run test:e2e` should pass since selectors like `#missionLaunchButton` and `#pauseOverlay` now exist.
- Accessibility smoke: keyboard navigation through menu overlays; focus returns to gameplay canvas after closing overlays.

### Deliverables
- Updated `src/index.html` and `src/css/style.css` reflecting the complete HUD/overlay structure.
- `src/js/main.ts` initialisation guarding against missing DOM nodes.

### Quality Gates & Acceptance Criteria
- `GameApplication.boot()` completes, and scenes transition correctly (`bootstrap` → `asset-loading` → `main-menu`).
- Playwright smoke tests reach gameplay without timing out.
- HUD elements respond to runtime updates (health bar animates, damage log entries appear).

---

## Phase 3 – UI Scene Integration & Input Flow
### Objectives
- Finalise functional flows for menu navigation, pause, inventory, options, leaderboard, and results scenes using the new DOM scaffolding.
- Ensure `InputService` and button handlers operate consistently across keyboard/mouse, with proper focus management.

### Tasks & Implementation Notes
- Populate mission cards dynamically in `MainMenuScene`, wiring click handlers and default selection states; ensure `MissionService` data drives descriptions/objectives.
- Implement button bindings (pause, inventory, options) ensuring they connect to `SceneManager.push/pop` flows without race conditions.
- Provide limited public accessors on `GameApplication` (e.g. `getSceneManager()`) so Playwright can introspect without touching private fields.
- Add HUD update hooks for combo, abilities, damage logs; ensure they call the modular `ui` exports.

### Sample Code
```ts
public getSceneManager(): SceneManager | null {
    return this._sceneManager;
}
```

### Code Style & Review Notes
- Keep event subscription lifecycle clean: register in `onEnter`, deregister in `onExit`.
- For DOM manipulation, guard against null elements and log descriptive warnings if elements are missing.
- Maintain TypeScript typing (`HTMLElement | null`, specific event payload interfaces).

### Testing & Validation
- Playwright regression: verify pause toggles, inventory overlay, ability activation flows, and results submission.
- Manual: ensure focus moves back to the canvas when overlays close; confirm controller inputs (WASD, J/K/L, Escape) trigger expected actions.

### Deliverables
- Updated scene files (`main-menu-scene.ts`, `gameplay-scene.ts`, `pause-scene.ts`, etc.) fully functional with the modular runtime.
- Public helpers on `GameApplication` for tests and debugging.
- Documented the E2E overlay/runtime expectations in  `docs/testing-notes.md`. 

### Quality Gates & Acceptance Criteria
- No runtime warnings about missing DOM nodes during typical play.
- E2E tests cover menu launch, gameplay, pause, and results flows without flakiness.
- QA checklist confirms HUD/overlay behaviour matches design expectations.

---

## Phase 4 – Content & Configuration Alignment
### Objectives
- Synchronise `src/config/game-config.json` with the refactored runtime and design specifications.
- Integrate remaining entities (e.g. Pet Cyborg), behaviour trees, mission goals, and boss phases described in `docs/`.

### Tasks & Implementation Notes
- Consolidate atlas references (one PNG/JSON per character/effect) and adjust asset loader expectations.
- Implement behaviour tree definitions in `BehaviorTreeService` for all `behaviorTreeId` values used in enemy templates.
- Validate mission definitions (waves, boss phases) against runtime; adjust spawn parameters for balanced gameplay.
- Update documentation (`docs/art-asset-spec.md`, `docs/UfoGameDesign_Architecture.md`) to reflect implemented content.

### Sample Code
```ts
behaviorTreeService.register('pet-cyborg-core', {
    type: 'sequence',
    loop: true,
    children: [
        { type: 'action', name: 'launch-limb', duration: 0.6 },
        { type: 'wait', duration: 0.4 }
    ]
});
```

### Code Style & Review Notes
- Keep configuration JSON formatted with two-space indentation and consistent key ordering.
- Document complex behaviours with inline comments or separate markdown in `docs/`.

### Testing & Validation
- Unit tests covering new behaviour trees, mission scoring, and enemy spawn templates.
- Manual play sessions verifying wave sequencing, boss telegraphs, and mission objectives.

### Deliverables
- Updated `game-config.json` and supporting docs.
- Behaviour tree/service implementations aligned with mission data.

### Quality Gates & Acceptance Criteria
- Resource manager loads the entire manifest without logging missing assets.
- Gameplay loop spawns enemies/boss phases per design, confirmed via QA run.
- Mission results capture correct telemetry and scoring metrics.

---

## Phase 5 – Asset & Audio Pipeline Finalisation
### Objectives
- Optimise texture atlases (trimmed frames, ≤4096px, accurate anchors) and update manifests accordingly.
- Replace silent audio placeholders with production-ready cues, ensuring `AudioService` wiring is complete.

### Tasks & Implementation Notes
- Re-export atlases using the repo tools (`tools/art/pack_spritesheet.py`, etc.) or TexturePacker, embedding metadata for anchors and animations.
- Update `game-config.json` asset entries with final atlas filenames and animation arrays.
- Generate/import audio cues into `src/audio/`, update `audio-config.json` with actual file paths (WAV/OGG/MP3), and verify they load via `AudioService.configure`.
- Balance volumes; ensure options menu toggles (music/sfx) apply immediately.

### Sample Code
```json
{
  "alias": "vfx-atlas",
  "src": "images/Sprites/VFX/vfx-atlas.png",
  "json": "images/Sprites/VFX/vfx-atlas.json",
  "type": "spritesheet",
  "animations": {
    "teleport-trail": ["teleport-trail-01", "teleport-trail-02", "teleport-trail-03"]
  }
}
```

### Code Style & Review Notes
- Maintain consistent casing between filesystem and manifest (case-sensitive in production environments).
- Add notes in `docs/art-pipeline.md` describing export settings for reproducibility.

### Testing & Validation
- Run `src/test_asset_loading.html` and a fresh dev build to confirm all textures load quickly without placeholders.
- Manual audio QA during gameplay; ensure cues fire for abilities, boss phases, and results scenes.
- Capture performance metrics (GPU memory usage, load times) before/after optimisation.

### Deliverables
- Updated atlases and audio files stored under `src/images/` and `src/audio/` respectively.
- Revised manifests (`game-config.json`, `audio-config.json`) and pipeline documentation.

### Quality Gates & Acceptance Criteria
- Asset loading logs show no missing entries and improved load times.
- Audio toggles respect user settings and cues trigger appropriately.
- GPU memory footprint reduced compared to initial oversized textures.

---

## Phase 6 – QA, Optimisation, and Release Prep
### Objectives
- Validate the complete game loop across all modes and finalise release documentation and automation.
- Ensure performance, persistence, and UX meet shipping expectations.

### Tasks & Implementation Notes
- Expand automated tests: add Vitest suites for mission scoring, save persistence, and behaviour tree transitions; extend Playwright for leaderboard submissions and options toggles.
- Use `PerformanceProfiler` hooks to monitor FPS and identify bottlenecks (particle effects, pooling).
- Document release steps, QA checklist, and player instructions in `docs/`.
- Prepare production build (`npm run build`), verify asset hashes, and package `dist/` for deployment.

### Sample Code
```ts
it('persists progression runs via SaveService', async () => {
    await progressionService.ready();
    const summary = buildMockRunSummary();
    progressionService.recordRun(summary);
    const runs = progressionService.getRuns(summary.missionId);
    expect(runs[0].id).toBe(summary.id);
});
```

### Code Style & Review Notes
- Keep tests deterministic; seed RNG for enemy spawn simulations where necessary.
- Update documentation alongside code to maintain single source of truth.

### Testing & Validation
- Full automated suite: `npm run test:unit`, `npm run test:e2e`, and manual multi-browser smoke tests.
- Persistence checks across reloads (IndexedDB/LocalStorage) and incognito sessions.
- Accessibility spot checks (screen readers, high contrast).

### Deliverables
- Comprehensive automated test coverage with reports (`npm run test:unit -- --coverage`).
- `docs/ReleaseChecklist.md` (or similar) capturing final validation steps and sign-off requirements.
- Production-ready build artefact.

### Quality Gates & Acceptance Criteria
- Automated tests pass reliably in CI.
- Performance profiler averages ≥55–60 FPS during peak VFX scenarios on target hardware.
- QA checklist signed off; release notes published alongside build artefact.

---

## Cross-Phase Dependencies & Coordination
- Completing Phase 1 is prerequisite for all later phases; it unlocks clean imports for scenes and systems.
- Phase 2 relies on modular runtime to avoid reintroducing globals; coordinate closely with art/UX when rebuilding HUD.
- Asset/audio optimisation (Phase 5) hinges on Phase 4 locking alias/schema naming; collaborate with art/audio contributors early.
- QA/release prep (Phase 6) requires artefacts from every phase—maintain a running changelog or summary to streamline hand-offs.

## Recommended Workflow Practices
- Work in focused branches per phase or sub-phase, using conventional commits (`feat(engine): ...`, `refactor(runtime): ...`).
- Run manual smoke tests before opening PRs; reference acceptance criteria in descriptions.
- Keep documentation up to date with each change so future onboarding is straightforward.




