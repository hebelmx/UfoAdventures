# UFO Adventures Release Checklist

## Environment Prerequisites
- Node.js 20.19+ (`nvm use 20` if using nvm; the project was verified with v20.19.5).
- Browsers for Playwright: `npx playwright install`.
- Host packages for Playwright (Chromium/WebKit/Firefox). On Debian/Ubuntu run `sudo npx playwright install-deps` or install `libnspr4 libnss3 libgbm1 libasound2t64` equivalents.

## Automated Verification
1. Static analysis
   ```bash
   npx tsc --noEmit
   ```
2. Production build
   ```bash
   npm run build
   ```
3. Unit regression (runtime pooling)
   ```bash
   npx vitest run tests/unit/pooling.spec.ts
   ```
4. End-to-end smoke suite (requires Playwright deps)
   ```bash
   npx playwright test
   ```
   > If the run fails with missing system libraries, install the dependencies listed above and rerun.

## Manual Smoke Tests
- Launch dev server (`npm run dev`) and verify:
  - Main menu mission cards render descriptions, rewards, and leaderboard data.
  - Starting a mission transitions to gameplay; WASD/Space firing, O shield, P stasis behave.
  - Pause menu (Escape) resumes/end mission buttons work and return to results.
  - Results screen shows mission summary, allows retry and leaderboard submission.
- Open options and inventory overlays from the main menu/pause menu, confirm close buttons restore the previous scene.
- Execute `src/test_asset_loading.html` and `src/test_pixi.html` to ensure CDN assets still load.

## Runtime Observability
- `window.gameApp` and `window.gameplayRuntime` are available in dev/Playwright for debugging (`gameApp.getSceneManager()`, `gameplayRuntime.getActiveCounts()`).
- Use `runtime.getAbilitySnapshot()` during tests to assert shield/stasis states.

## Reporting
- Attach the latest `npm run build` output and test results to the release notes.
- Document any skipped tests (e.g., Playwright blocked by missing system deps) and mitigation steps.

