# Testing Guide

## Prerequisites
- Install dependencies: `npm install`
- (First run only) install Playwright browsers: `npx playwright install`

## Unit Tests (Vitest)
- Run once: `npm run test:unit`
- Watch mode: `npm run test:unit:watch`

## End-to-End Tests (Playwright)
- Run E2E suite: `npm run test:e2e`
- Open Playwright UI: `npm run test:e2e:ui`

The E2E runner auto-starts `http-server` against `src/` on port 5173 using the configuration in `playwright.config.js` and exercises scenarios in `tests/e2e/`.

## Manual Probes
- Performance HUD: load `src/index.html` (or run the dev server) to see the top-left overlay with FPS, grid cells, and pool usage in real time. Press F1 to toggle visibility.

- Ability System: open `src/test_ability_system.html` in the browser to interactively trigger combo breaker / teleport, inspect cooldown HUD updates, and verify EventBus messages without running the full game loop.
- Audio Harness: open `src/test_audio_testbed.html` to drive the future `AudioService` contract (play/stop BGM, ability/boss SFX) while logging expected calls.
