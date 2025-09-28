# UFO Space Adventure - Roadmap & Audit (v1.1)

> Sections 12-15 from the original design doc covering roadmap, audit, and delivery planning.

---

## 12) Future Roadmap

### Phase 1 (Current)
- ✅ Core ECS architecture
- ✅ Basic gameplay systems
- ✅ Level 1 implementation

### Phase 2 (Next)
- 🔄 Level 2: Missile Rain with WebGL acceleration
- 🔄 Advanced AI behaviors and boss fights
- 🔄 Enhanced UI/UX with accessibility features

### Phase 3 (Future)
- ⏳ Multiplayer support (WebRTC)
- ⏳ Level editor and mod support
- ⏳ Mobile platform optimization
- ⏳ Progressive Web App features

**Ready for implementation with modern architecture patterns and best practices.**

## 13) Current Implementation Audit

- **Architecture & Services** — Not started: design calls for a service locator hosting config, resource, scene, audio, input, event bus, save, and UI services (docs/UfoGameDesing.md:7-50), yet runtime is a single `Game` class instantiating PIXI, arrays, and systems (src/js/game.js:1-87) atop a minimal ECS (src/js/engine/core.js:1-28).
- **Scene Management** — Missing: roadmap expects Bootstrap → AssetLoading → MainMenu plus gameplay scenes with stack transitions (docs/UfoGameDesing.md:54-96). Current flow toggles three modes via buttons and rebuilds entities directly (src/js/game.js:44-149) with no scene classes, transitions, or menus.
- **Game Loop & Performance** — Missing: required fixed timestep, FPS tracking, and profiling (docs/UfoGameDesing.md:100-119) are absent; loop is PIXI ticker without metrics (src/js/game.js:165-169).
- **Component Model** — Partial: spec lists rich component interfaces (docs/UfoGameDesing.md:146-199). Implemented components cover only position, sprite, motion, collider, health, weapon, enemy tags, bullets, boss (src/js/engine/components.js:1-71) without acceleration, layers, metadata, or magic inventory.
- **Enemy & Boss Systems** — Barebones: AI state machines, behavior trees, and templates (docs/UfoGameDesing.md:203-281) are unimplemented. Enemies spawn randomly with fixed motion (src/js/engine/systems.js:85-112); boss is a simple reskinned sprite with horizontal patrol (src/js/game.js:105-133) and straight shots (src/js/engine/systems.js:255-308).
- **Weapons & Magic** — Not started: weapon registry, missiles, and spellcasting (docs/UfoGameDesing.md:282-640) are absent. Shooting is a single white bullet tied to `Space` (src/js/engine/systems.js:115-146); combo and magic inputs aren’t implemented despite UI copy.
- **Level Content & Progression** — Not started: multi-phase campaigns, results, leaderboard (docs/UfoGameDesing.md:54-69, 639-923) plus boss phases (docs/SpiritsDesign.md:1-99) are missing. Modes never progress or end.
- **Data, Persistence, Config** — Missing: JSON-driven templates and IndexedDB saves (docs/UfoGameDesing.md:981-1040) are not present; values are hardcoded in JS.
- **Performance Optimisations** — Missing: object pooling, spatial partitioning, profiling hooks (docs/UfoGameDesing.md:1059-1139) are absent; entities are created/discarded every spawn.
- **Testing & Tooling** — Missing: no unit test harness or performance tests (docs/UfoGameDesing.md:1140-1214); repo relies on manual HTML probes only.
- **Deployment & Stack Alignment** — Off-track: design targets TypeScript + Webpack with hashed bundles (docs/UfoGameDesing.md:1215-1290), but repo is plain ES modules via script tags (src/index.html:41-55).
- **Art & Assets** — Early concept only: boss spec demands multi-animation Tarak sprites (docs/SpiritsDesign.md:1-99), yet gameplay loads placeholder Amidogus/Blade textures and a single background (src/js/game.js:21-33, 112-121).

## 14) Completion Plan

1. **Phase 0 — Foundation** (Week 1)
   - Init npm workspace (Vite/Webpack, ESLint, Prettier, Jest/Vitest).
   - Port runtime to TypeScript modules; introduce `ServiceLocator`, `EventBus`, and `ConfigSvc` scaffolding.
   - Define JSON schemas for entities, weapons, and levels; wire build/test scripts.

2. **Phase 1 — Core Loop & Scenes** (Weeks 2-3)
   - Implement `SceneManager` with Bootstrap → AssetLoading → MainMenu → Adventure/Arcade/Training plus pause/inventory/results states.
   - Refactor game loop to fixed timestep with profiler overlay; add object pooling.
   - Expand components (motion acceleration, collider layers, weapon metadata, magic inventory placeholders).

3. **Phase 2 — Gameplay Systems** (Weeks 4-5)
   - Build AI state machine + behavior tree runner; author enemy templates with difficulty modifiers.
   - Deliver weapon registry (laser, missile, melee) and spell system (combo breaker, shield); refactor input via command pattern.
   - Script Tarak multi-phase fight with telegraphs, minion summons, and boss UI integration.

4. **Phase 3 — Progression, Persistence, Performance** (Week 6)
   - Integrate IndexedDB `SaveSvc`, campaign progression, and settings persistence.
   - Add spatial partitioning, pooling refinements, accessibility polish, curated sprite atlases.
   - Tune colliders, effects, and audio hooks; ensure stable 60 FPS under target loads.

5. **Phase 4 — QA & Release Prep** (Week 7)
   - Author automated tests, manual checklists, performance benchmarks.
   - Update documentation (`docs/`, `AGENTS.md`), configure CI for lint/test/build, prepare deployment (Netlify/GitHub Pages).

6. **Phase 5 — Stretch & Future** (Week 8+)
   - Tackle design roadmap extras: Level 2 Missile Rain, advanced accessibility, multiplayer exploration, editor/PWA work.

## 15) Roadmap Overview

- **Scope**: 6–8 weeks with 1–2 contributors; adjust for team size.
- **Phase 0 (Week 1)**: Tooling + TypeScript/Service foundations.
- **Phase 1 (Weeks 2-3)**: Scene/state management, deterministic loop, component expansion.
- **Phase 2 (Weeks 4-5)**: AI systems, weapon/magic features, Tarak boss phases.
- **Phase 3 (Week 6)**: Persistence, performance optimizations, art polish.
- **Phase 4 (Week 7)**: QA, docs, CI/CD, release packaging.
- **Phase 5 (Week 8+)**: Stretch goals from design §12 once MVP ships.

- **Immediate Next Steps**: choose tooling stack, create backlog/board mapping tasks to phases, and align art production with Phase 2 milestones.
