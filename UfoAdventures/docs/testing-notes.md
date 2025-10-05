# Testing Notes

## Test Mode (`window.__E2E__`)
- When `window.__E2E__` is true we still run the full asset manifest through `ResourceManager`. Heavy resources are primed with lightweight placeholders so Playwright can enter the menu without waiting for real fetches.
- The asset loader logs when the manifest is skipped and when control passes to the main menu. If you see repeated skips without the "main menu scene loaded" log, check for errors in the console.

## Overlay Synchronisation
- `setOverlayVisible` now standardises `aria-hidden` and focus handling for every overlay (`loadingScreen`, `mainMenuOverlay`, pause/results/etc.).
- The E2E helpers wait for overlays to report `aria-hidden="false"` before continuing, so do not toggle overlays by hand-rolling `style.display` changes.

## Runtime Helpers
- `GameplayRuntime.getAbilitySnapshot()` and `getActiveCounts()` are exposed to Playwright for assertions. They return `null` until the runtime is fully ready, so always wait on the helper before making assertions.
- Background textures default to a 1×1 placeholder when the manifest supplies stubs (test mode). In normal runs assets supply real sizes via the loaded texture source.

## Loop Regression Checklist (Manual)
- Serve the client (`python -m http.server 5173` → `http://localhost:5173/src/`) and open DevTools CPU throttling at 4×. Confirm the gameplay stays responsive and the overlay’s `Frame Skips` line never exceeds `5` per frame.
- Toggle the performance overlay (`togglePerformanceOverlay`, default `F6`) and verify the new metrics — frame time, skip count, update/render averages, and top system timings — update every frame without console warnings.
- Pause and resume (game menu or focus change) while the overlay is visible; ensure accumulator resets cleanly and profiler values continue updating after resume.
- Document the run in release notes (FPS, frame skip observations) or flag issues in `docs/testing-notes.md` before sign-off.

## Scene Transition Checklist (Manual)
- Verify that scene transitions are working correctly.
- Test the `fade` transition between the main menu and other scenes.
- Test the `instant` transition for pause and inventory menus.
- Test that the game is still responsive during transitions.
- Check the console for any errors related to scene transitions.
