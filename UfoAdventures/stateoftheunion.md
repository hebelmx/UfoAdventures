# State of the Union — UFO Adventures

## Overview
UFO Adventures is a browser-based 2D shooter using PixiJS 7 and a lightweight ECS (Entity–Component–System). It runs as a static site (no bundler) served from `src/`. Core gameplay, asset loading, and UI overlays are present and playable via a simple HTTP server.

## Current Technical Status
- Runtime: `src/index.html` loads Pixi via CDN and scripts under `src/js/` (engine, systems, entities, UI, game loop).
- ECS: Implemented components (Transform, Sprite, Motion, Weapon, Collider, Health, Enemy, Boss, Bullet, EnemyBullet) and systems (Input, Movement, Shooting, Collision, Boss AI/Shooting, Render, Cleanup, UI).
- Modes: `adventure`, `boss`, `enemyDemo` toggled in `game.js`.
- Testing: Manual pages (`src/test_pixi.html`, `src/test_asset_loading.html`); Pixi versions differ across pages (7.2.4 vs 7.3.0).
- Legacy code: `src/js/entities/{enemies,boss}.js` reference a different API (`Game.instance`, `Vector2`, `.addTag`) and are not used by the current ECS.

## Sprites & Art Pipeline (Primary Priority)
- Repository assets:
  - Source art and tooling live at `images/` (large set of PNG/JPGs, many variants).
  - Runtime assets live at `src/images/` (subset used by the game).
- Utilities present: `images/Sprites/background_remover.py` with `README.md` and `requirements.txt` (supports `rembg` + OpenCV + color fallback). Output pattern: `{name}_bkremoved.png`.
- Current usage in code: `src/js/game.js` loads `src/images/Sprites/1_Tarak.png`, statics for enemies, and background JPG.
- Gaps:
  - No canonical list of “shipping” sprites vs. source art; duplication across `images/` and `src/images/`.
  - No atlas/spritesheet; assets are individual textures (OK for now but not optimal).
  - Inconsistent naming/casing between top-level `images` and `src/images` which may break on case‑sensitive hosts.

## Risks
- Confusion from legacy entity files and duplicate assets may slow iteration.
- UI lists controls (J/K/L) that are not implemented, creating expectation gaps.
- CDN version skew can cause subtle runtime behavior differences in tests.

## Recommendations (Sprite‑Focused First)
1. Define a canonical runtime set under `src/images/` only; treat top-level `images/` as source art/workbench.
2. Adopt naming: `src/images/Sprites/<Category>/<Name>.png` (lower_snake for files or consistent Title_Case as used now, but be consistent across code and disk).
3. Use `background_remover.py` to produce transparent PNGs; only commit `_bkremoved.png` (or drop suffix after review) into `src/images/`.
4. Establish target scales (e.g., player 50×50, enemies 80–120px) and verify in-game sizing; document in `docs/`.
5. Optional next step: generate a Pixi spritesheet (TexturePacker or equivalent) and switch to `PIXI.Spritesheet` for batching.
6. Normalize Pixi to 7.3.0 across all HTML pages.
7. Remove or rewrite legacy `entities/{enemies,boss}.js` to match the current ECS or exclude from `index.html` if unused.

## Immediate Next Actions
- Curate and copy only approved, transparent sprites into `src/images/`.
- Update asset paths and casing in `game.js` to match final names.
- Add a short `docs/art-pipeline.md` once names and scales are finalized.

## Update: Canonical Runtime Sprite Set Applied
- Created canonical paths (kept existing aliases in code):
  - Player: `src/images/Sprites/Hero/idle_01.png` → alias `player`.
  - Enemy (Amidogus): `src/images/Sprites/Enemies/Amidogus/idle_01.png` → alias `amidogus`.
  - Enemy (Blade): `src/images/Sprites/Enemies/Blade/idle_01.png` → alias `blade`.
  - Background: `src/images/Backgrounds/space_01.jpg` → alias `background`.
- Updated `src/js/game.js` to load from the new paths.
- Note: Some extensionless files existed under `src/images/Sprites/` (e.g., `player`, `blade`); to avoid name collisions on Windows, used `Hero` and `Backgrounds` directories.

## Update: Boss Bar Wiring and Legacy Cleanup
- Boss health bar now auto-displays when a Boss entity exists; updates with current/max health.
- Set `Health.max` for boss in `setupBossMode()`.
- Removed legacy files referencing a different ECS API and their script tags:
  - Deleted: `src/js/entities/enemies.js`, `src/js/entities/boss.js`.
  - Updated: `src/index.html` to stop loading them.

## Update: Sprite Generation Pipeline (Server, uv, No-Background First)
- Added `scripts/generate_sprites.py` — one-shot, resumable, observable.
- Canonical first step: background removal happens before generation (uses `rembg` if installed). Saves preprocessed inputs to `run/.../preprocessed/`.
- Supports `img2img` and `inpaint` via Diffusers AutoPipelines; uses HF token from env.
- Manifest (`manifest.jsonl`) logs per-output metadata; `run_state.json` captures args/device/env.

Example (uv + img2img):
```
uv run \
  --with diffusers==0.30.3 --with huggingface_hub==0.24.6 \
  --with accelerate==0.33.0 --with torch --with pillow --with rembg \
  scripts/generate_sprites.py \
    --model stabilityai/sd-turbo \
    --mode img2img \
    --input-dir images/Sprites \
    --output-dir out/sprites \
    --prompt "game sprite, clean outline, flat colors, transparent background" \
    --steps 20 --strength 0.7 --guidance 1.5 --num-images 2 --resume
```
- To also clean backgrounds on outputs (optional): add `--post-bg-remove`.

## Next: Server Migration
- Artifacts to sync:
  - `scripts/generate_sprites.py`, `AGENTS.md`, `stateoftheunion.md`.
  - Input pool: `images/Sprites/` (source art to transform).
  - Runtime set (optional for reference): `src/images/Sprites/**`, `src/images/Backgrounds/**`.
- Environment setup (on server):
  - Ensure HF token env var is set: `HUGGINGFACE_HUB_TOKEN` (or `HF_TOKEN`).
  - Install uv; preinstall CUDA‑matching `torch` if using GPU.
- Run (img2img with pre‑BG removal):
  - `uv run --with diffusers==0.30.3 --with huggingface_hub==0.24.6 --with accelerate==0.33.0 --with torch --with pillow --with rembg scripts/generate_sprites.py --model stabilityai/sd-turbo --mode img2img --input-dir images/Sprites --output-dir out/sprites --prompt "game sprite, clean outline, flat colors, transparent background" --steps 20 --strength 0.7 --guidance 1.5 --num-images 2 --resume`
- Observability & resume:
  - Check `out/sprites/run_*/logs/run.log`, `manifest.jsonl`, `run_state.json`.
  - Re‑run with `--resume` to skip done files; add `--overwrite` to force.
- Integration after run:
  - Curate outputs from `out/sprites/run_*/images/` into `src/images/Sprites/<Unit>/` and update sizes/aliases in code if names change.

## Sprite Analysis (Deeper Dive)

### Current Inventory
- Runtime assets in use (code aliases):
  - Player: `src/images/Sprites/1_Tarak.png` (alias `player`).
  - Enemies: `src/images/Statics/02_Amidogus.png` (alias `amidogus`), `src/images/Statics/01_Blade.png` (alias `blade`).
  - Background: `src/images/aliendescending.jpg` (alias `background`).
- Source art pool: extensive set under `images/Sprites/` (many `_bkremoved.png`), plus static variants.

### Concepts & Priorities
1) Player (humanoid): idle, move, shoot; target 1–2 frames per action initially.
2) Enemies:
   - Amidogus (octopus-like): drift + collide.
   - Blade (flying blade): vertical fall + collide.
   - Wimidir/Pet (optional next wave): simple patterns.
3) Boss: Tarak (Gothic Dragon King): patrol + periodic shots.
4) Effects: player bullet, enemy bullet, hit flash.

### Naming & Organization (Proposed)
- Foldering: `src/images/Sprites/<Unit>/<action>_<index>.png`.
  - Examples: `src/images/Sprites/Player/idle_01.png`, `.../Amidogus/move_01.png`, `.../Blade/idle_01.png`.
- If keeping current Title_Case names, ensure exact casing in both files and code.
- Consider atlas later: `src/images/atlases/core.json` + `core.png`.

### Resolution & Scale Targets
- Base viewport: 800×600.
- Sizes at 1× scale (can adjust in code):
  - Player: 48–56 px square (currently set to 50×50 in code).
  - Enemy (Amidogus/Blade): 72–100 px longest side (collider ~20–24).
  - Boss: 160–220 px longest side (collider ~50; health 300–500 for demo).
  - Bullets: 6×10 (player), 10×10 (enemy boss).
  - Keep anchors centered (0.5) and trim transparent padding.

### Pipeline
1. Concept → pick final silhouette per unit.
2. Produce clean PNG with transparent BG (export or run remover):
   - `python images/Sprites/background_remover.py -a 80 images/Sprites`
3. Normalize canvas (tight trim), ensure consistent orientation and anchor.
4. Copy only shipping assets into `src/images/Sprites/<Unit>/`.
5. Update `PIXI.Assets.load` entries and in-game sizing.

### Integration Checklist
- File present under `src/images/**` with final name/case.
- `PIXI.Assets.load` alias added/updated; `Sprite` instantiated with correct size.
- Collider radius tuned to visual bounds; test collisions.
- Visual pass at 1×, 1.25× speeds; verify readability on 1080p.
- Boss bar visibility and `updateBossHealthDisplay` wired.

### Acceptance Criteria
- Silhouette readable on 800×600; no muddy edges.
- Anchor roughly center; collision area matches sprite body.
- Consistent style across units (palette/line weight).
- No 404s in console; stable 60 FPS with 10–15 enemies onscreen.

### Risks & Mitigations
- Case sensitivity: enforce consistent casing; lint paths in PRs.
- Duplicate assets in `images/` vs `src/images/`: curate to runtime-only in `src/images/`.
- Memory bloat: trim images; avoid giant originals in runtime.

### Sprite Sprint Plan (Proposed)
Day 1: Lock player sprite; process Amidogus + Blade; integrate and tune colliders/sizes.
Day 2: Boss Tarak placeholder finalization; bullets/effects; wire boss health bar; remove legacy entity files or update to ECS.
