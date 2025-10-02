# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

```bash
# Development Server (choose one)
python -m http.server 5173        # Python server
npx serve src -l 5173            # Node server with hot reload
npx http-server src -p 5173      # Alternative Node server

# Testing
npm run test                     # Run all unit tests
npm run test:unit:watch         # Watch mode for unit tests
npm run test:e2e                # Run E2E tests
npm run test:e2e:ui             # E2E tests with UI
npm run test:all                # Run both unit and E2E tests
```

## Architecture Overview

UFO Adventures is a browser-based 2D space shooter using PixiJS 7 with a custom Entity-Component-System (ECS) architecture. The game uses a Service Locator pattern for dependency injection and is designed as a static site with no build process.

### Core Architecture Patterns

1. **ECS (Entity-Component-System)**: Core game architecture where entities are collections of components, and systems process entities with specific components.

2. **Service Locator**: All services are registered globally via `ServiceLocator.register()` and retrieved via `ServiceLocator.get()`.

3. **Scene Management**: Game flow is managed through scenes (bootstrap → asset-loading → main-menu → gameplay → results).

4. **Event-Driven**: Communication between systems via EventBus for loose coupling.

### Key Services

- **ConfigService**: Loads and manages game-config.json and audio-config.json
- **ResourceManager**: Handles asset loading from CDN and local files
- **SceneManager**: Manages scene transitions and lifecycle
- **InputService**: Maps keyboard/mouse/gamepad inputs to game actions
- **AudioService**: Manages audio playback with WebAudio API
- **SaveService**: Persistence using IndexedDB
- **MissionService**: Tracks objectives and mission progress
- **WeaponService**: Manages weapon systems and upgrades
- **PerformanceProfiler**: Performance monitoring (F6/F7 hotkeys)

### Important Files

- `src/config/game-config.json`: Main game configuration (assets, missions, weapons, enemies, input mappings)
- `src/js/game.js`: Core game loop and system management
- `src/js/engine/service-locator.js`: Dependency injection container
- `src/js/engine/scene-manager.js`: Scene lifecycle management
- `src/js/scenes/gameplay-scene.js`: Main gameplay implementation

### Code Conventions

- ES6+ JavaScript with no build/transpilation
- 4-space indentation, single quotes, semicolons
- `camelCase` for functions/variables, `PascalCase` for classes
- File names: lowercase with dashes (`audio-service.js`)
- Minimal comments - code should be self-documenting

### Testing Approach

- **Unit Tests**: Vitest in `tests/unit/` - test services and systems in isolation
- **E2E Tests**: Playwright in `tests/e2e/` - test full game flow
- **Manual Testing**: Use test HTML files (`src/test_*.html`) for subsystem testing

### Common Development Tasks

When adding new features:
1. Check existing patterns in similar files
2. Register new services in bootstrap scene
3. Add configuration to game-config.json if needed
4. Create test HTML file for complex subsystems
5. Add unit tests for services, E2E tests for gameplay

When debugging:
1. Use Performance HUD (F6/F7 in-game)
2. Check browser console for errors
3. Use test HTML files to isolate issues
4. Verify asset paths are case-sensitive

### Asset Management

- Runtime assets in `src/images/`
- Sprites use texture atlases with JSON metadata
- All paths in game-config.json are relative to `src/`
- Case-sensitive paths required for cross-platform compatibility

### Important Notes

- Always serve via HTTP server, not file:// (CORS restrictions)
- PixiJS loaded via CDN (7.3.0) - no local installation needed
- No build process - edit files directly in `src/`
- IndexedDB used for saves - check browser dev tools for debugging