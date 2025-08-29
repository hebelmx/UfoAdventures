# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Game client (static site).
  - `index.html`: Main entry using PIXI via CDN.
  - `js/`: Engine (`engine/`), entities (`entities/`), UI, and game loop.
  - `css/`: Styles for HUD and screens.
  - `images/`: Sprites and statics used by the game.
- `docs/`: Design notes and gameplay docs.
- `images/`: Original art assets and tooling (source sprites; not loaded by the app).
- `resume.md`: Project overview note.

## Build, Test, and Development Commands
- Run locally (Python): `python -m http.server 5173` then open `http://localhost:5173/src/`.
- Run locally (Node): `npx serve src -l 5173` or `npx http-server src -p 5173`.
- Quick checks: open `src/test_pixi.html` (PIXI load) and `src/test_asset_loading.html` (asset paths).
- No build step required; assets load directly from `src/` and CDN.

## Coding Style & Naming Conventions
- JavaScript: 4‑space indent, single quotes, semicolons, `camelCase` for variables/functions, `PascalCase` for classes.
- Files: `.js` lower‑case with dashes where needed; images use descriptive names (e.g., `images/Sprites/1_Tarak.png`).
- Keep modules small: engine systems in `src/js/engine/`, game entities in `src/js/entities/`.
- Linting: no enforced config; keep style consistent with existing files.

## Testing Guidelines
- Framework: none yet. Prefer focused, manual checks in the browser.
- Naming: add ad‑hoc test pages in `src/` with `test_*.html` (example: `src/test_asset_loading.html`).
- Sanity: verify console has no errors; confirm controls (WASD/Arrow, J/K/L) and asset rendering.
- Optional: add lightweight unit tests only if introducing pure utility functions.

## Commit & Pull Request Guidelines
- Commits: small, descriptive messages (suggest Conventional Commits), e.g., `feat(engine): add collision system` or `fix(assets): correct background path`.
- Branches: `feature/<short-name>`, `fix/<issue-id>`, `chore/<task>`.
- PRs: include purpose, linked issue (if any), testing notes, and screenshots/GIFs of gameplay/UI. Mention any asset or docs changes.

## Security & Configuration Tips
- Serve over HTTP when testing; direct `file://` loads can break asset requests.
- Asset paths are case‑sensitive on many hosts; match `src/images/**` exactly.
- PIXI is loaded from CDN. If upgrading the version, validate asset loading and rendering via `test_pixi.html` before merging.

