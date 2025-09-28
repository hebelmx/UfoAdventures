# Repository Guidelines

## Project Structure & Module Organization
- `src/` hosts the playable client; load `src/index.html` for the PIXI entry point.
- Engine systems sit under `src/js/engine/`, gameplay actors under `src/js/entities/`, UI helpers, loops, and utilities share `src/js/`.
- HUD styles live in `src/css/`; runtime sprites and effects in `src/images/`.
- `docs/` stores design notes and balance ideas, while root-level `images/` keeps source artwork not shipped with the client.
- Keep new modules focused and place files beside related systems to ease discovery.

## Build, Test, and Development Commands
- `python -m http.server 5173` (then visit `http://localhost:5173/src/`) spins up a quick local server.
- `npx serve src -l 5173` or `npx http-server src -p 5173` provide Node-powered options with hot reload convenience.
- Open `src/test_pixi.html` to confirm the CDN PIXI build, and `src/test_asset_loading.html` to verify sprite paths.

## Coding Style & Naming Conventions
- JavaScript uses 4-space indentation, single quotes, and semicolons; names follow `camelCase` for functions/values and `PascalCase` for classes.
- File names stay lowercase with dashes when needed (e.g., `game-loop.js`); asset names must retain original casing.
- Add comments sparingly, prioritizing complex logic or data flow notes.

## Testing Guidelines
- No automated suite yet; rely on targeted browser tests with the dev server running.
- Create ad-hoc probes as `src/test_*.html` when validating new subsystems or assets.
- During manual passes, watch the console, ensure WASD/Arrow movement and J/K/L combat inputs, and confirm sprites render cleanly.

## Commit & Pull Request Guidelines
- Use Conventional Commit prefixes such as `feat(engine): add collision system` or `fix(assets): correct background path`.
- Keep PRs scoped; include purpose, testing steps, linked issues, and screenshots or GIFs for visible changes.
- Call out asset or documentation updates in descriptions so reviewers can focus checks.

## Security & Configuration Tips
- Always serve over HTTP rather than `file://` to avoid blocked requests.
- Match case-sensitive paths under `src/images/**`; confirm additions load through the test pages.
- If bumping the PIXI CDN version, rerun both test HTML pages before merging.
