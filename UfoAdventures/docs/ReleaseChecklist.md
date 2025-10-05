# UFO Adventures Release Checklist

## Pre-Flight
- Review `docs/PlanToFinish.md` for outstanding cross-phase dependencies.
- Confirm `package.json` version bump and changelog entries are prepared.
- Verify environment variables/secrets for deployment target are in place.

## Test Matrix
- `npm run test:unit` (vitest) and review coverage report in `coverage/index.html`.
- `npm run test:e2e` (Playwright) across Chromium + WebKit.
- Manual browser smoke on Chrome, Firefox, and Edge at 1920x1080 + 1280x720.
- Accessibility spot checks: keyboard-only navigation, high-contrast mode, screen-reader labels for HUD buttons.

## Content & Audio Validation
- Serve via `npm run dev` and play through Operation First Contact and Tarak boss modes.
- Confirm cyborg drone/sentinel waves, boss telegraphs, and ability VFX play with correct atlases.
- Run `src/test_asset_loading.html` and `src/test_pixi.html` to ensure no missing textures.
- Audit audio toggles: flip music/SFX in options menu, ensure immediate effect; verify all runtime cues fire (combo breaker, teleport, boss phase, results).

## Performance & Telemetry
- Enable performance overlay (`F6`) during peak combat (boss phase gamma) and capture FPS >55.
- Record profiler overlay snapshot showing frame skips ≤5, update/render averages, and top system timings for the release archive. (Loop verification evidence)
- Record load times (first paint <3s on target hardware) and GPU memory usage after asset consolidation.
- Validate persistence: complete a run, reload, confirm `ProgressionService` shows recorded summary.

## Build & Packaging
- `npm run build` and archive the `dist/` folder with commit SHA in filename.
- Spot-check production build locally via `python -m http.server 5173` -> `http://localhost:5173/dist/`.
- Upload build artefact to staging CDN or release bucket; update integrity hashes if CDN caching is used.

## Documentation & Sign-Off
- Update `docs/changelog.md` (or project log) with highlights, known issues, and testing summary.
- Attach gameplay footage (GIF/video) for QA evidence in release notes.
- Collect sign-off from engineering, art, audio, and QA leads.
- Tag release in git and draft store/portal submission package.
