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
