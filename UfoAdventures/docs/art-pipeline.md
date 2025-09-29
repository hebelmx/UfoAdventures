# Art & Animation Pipeline Notes

## Current Runtime Expectations
- The manifest supports both static textures and `.png` spritesheets with frame metadata (`src/config/game-config.json`).
- Gameplay runtime builds display objects via `_buildDisplayObject`, preferring spritesheets when available; animated sprites play automatically if multiple frames exist.
- Enemy spawner and boss loader now read `template.spritesheet` metadata so we can drop in animation atlases without extra code.
- Pools exist for bullets, effects, and enemy bodies; VFX atlases can reuse the effect pool once provided.

## Atlas Deliverables (from design docs)
### Player Hero (`docs/SpiritsDesign.md:114-148`)
- Resolution: 256�256 frame target (base concept shows stick-figure sized character; upscale to 256 for clarity, scale down in engine).
- Animations:
  - `idle` (6+ frames) � breathing hover.
  - `thrust` / movement (8 frames) � neutral flight with directional sway.
  - `comboBreaker` (10 frames) � charged stance + burst VFX; include additive glow strip for reuse by HUD.
  - `teleport` (6 frames) � dissolve into arrow icon per design; provide trailing particles for effect pool.
  - `hit` / `eliminated` (6 frames) � used when losing a life.
- Export as TexturePacker-style JSON (`player-atlas.json` + `.png`). Frame names should match animation keys above.

### Enemy Atlases (`docs/SpiritsDesign.md:119-148`)
- **Blade Scout** (`blade-atlas`): idle hover (4 frames), strafe loop (6), hit/explode (6). Include collider radius in JSON metadata if possible.
- **Amidogus Fighter** (`amidogus-atlas`): idle (4), swoop dive (8), claw swipe (6), break-apart death (8). Provide punch FX sprites referenced in concept.
- **Pet Cyborg** (`cyborg-atlas`) � new alias to add:
  - idle servo twitch (6), duplicate spawn (4), explosion (8). Colors per concept (steel + neon eyes).
- Frame size guideline: 256�256 (enemy) to maintain consistency, shrink via runtime `width/height` if needed.

### Boss Tarak (`docs/SpiritsDesign.md:1-94`)
- Base frame 512�512 as specified; include three phase layers:
  - Phase 1 idle + tail swipe (8/5 frames).
  - Phase 2 enraged aura overlays; wing attack + charged staff (6/8 frames).
  - Phase 3 chaos: cracked armor, beam attack (4 frames), death collapse (10).
- Provide auxiliary sprites for: wing shockwave, tail-sweep trail, beam telegraph glyph.
- Atlas alias: `tarak-atlas` (already seeded). Animation keys: `idle_phase1`, `attack_tail`, `attack_beam`, `death` etc.

### VFX Pack
- Teleport trail: 12-frame ribbon (used by effect pool).
- Combo breaker burst: radial flare + lingering embers (8 frames, loopable tail).
- Bullet impact (player/enemy): small 4-frame flash.
- Summon glyph for boss minions.
- Export under new alias `vfx-atlas`; pool will spawn `effect` entities with frame names supplied.

### HUD / UI Elements
- Optional animated HUD assets (ability bars, combo pulses) can ship via `ui-atlas`; manifest currently uses DOM/CSS but accepts sprites for future iteration.

## File & Naming Expectations
- Place production atlases under `src/images/Sprites/<family>/<atlas>.png|json` (matching alias casing in manifest).
- Frame names should be lowercase with hyphens (`idle-01`), matching animation keys in config.
- Include metadata (frame w/h, anchor) in atlas JSON for automatic scaling.
- Keep texture dimensions power-of-two when possible for WebGL batching.

## Integration Checklist
1. Drop atlas `.png` + `.json` files into the `src/images/Sprites/...` directory tree.
2. Update `src/config/game-config.json` entries:
   - Set `spritesheet.alias`, `animation`, `speed`, and explicit `spriteWidth/Height` if scaling differs.
   - Add new aliases (`cyborg-atlas`, `vfx-atlas`, etc.) to the `assets` array.
3. Map animation keys to gameplay triggers:
   - Player ability system -> `comboBreaker`, `teleport` animations.
   - Enemy behavior system -> `idle`, `attack`, `hit` loops per template.
   - Boss phases -> animation names referenced in phase config.
4. Hook effect pool spawns to VFX atlas frames (e.g., `spawnEffect({ animation: 'comboBurst' })`).
5. Smoke test via:
   - Ability probe (`src/test_ability_system.html`) for combo/teleport visuals.
   - In-game adventure & boss modes, verifying cell counts and pooling remain healthy (watch HUD overlay).
6. Capture before/after screenshots or GIFs for documentation.

## Coordination Notes
- Work with audio team to align VFX events (combo, teleport, boss phases) with new SFX assets.
- Provide sprite export scripts so future revisions remain deterministic.
 - Keep placeholder palettes in git history for quick fallback during integration.

## Practical Next Steps Based on Current Assets
This plan aligns the pipeline with what is already present under `images/` and `src/images/`.

1) Export Runtime Atlases (PNG+JSON)
- Player → `src/images/Sprites/Hero/player-atlas.png|json`
- Blade → `src/images/Sprites/Enemies/Blade/blade-atlas.png|json`
- Amidogus → `src/images/Sprites/Enemies/Amidogus/amidogus-atlas.png|json`
- Pet Cyborg → `src/images/Sprites/Enemies/Cyborg/cyborg-atlas.png|json`
- Boss Tarak → `src/images/Sprites/Boss/tarak-atlas.png|json`
- VFX → `src/images/Sprites/VFX/vfx-atlas.png|json`

2) Frame Naming & Metadata
- Use lowercase hyphen frames (e.g., `idle-01`).
- Include `meta.anchor` `[0.5, 0.5]` and gameplay hints like `colliderRadius` where helpful.
- If JSON lacks `animations`, ensure frame names map 1:1 to keys in config.

3) Manifest Updates (`src/config/game-config.json`)
- Add assets entries for each new atlas (see spec section 11 stubs).
- Ensure `type: 'spritesheet'`, correct PNG path, matching JSON path.
- Add animation arrays for keys not encoded in JSON `animations`.

4) File Moves & Organization
- Keep WIP and reference cuts in `images/`.
- Place only runtime-ready `.png|json` under `src/images/` in the tree above.

5) Smoke Tests
- Open `src/test_asset_loading.html` to verify manifest paths (no 404s, animations advance).
- Use `src/test_ability_system.html` to preview `comboBreaker` and `teleport` once player atlas is in.
- Run the dev server and check gameplay scenes for pooling health and correct sprite scales.

6) Boss & VFX Sequencing
- After `tarak-atlas` lands, bind boss phase configs to: `idle_phase1/2/3`, `wing_attack`, `tail_sweep`, `staff_charge`, `beam_attack`, `death`.
- After `vfx-atlas` lands, hook effect spawns to `teleport-trail`, `comboBreaker`, `bullet-impact`, `boss-summon`.

7) Acceptance Checklist
- All atlas files exist with valid JSON.
- Animations play in test pages; no missing frames.
- Collider metadata present where needed; scales look correct.
- `game-config.json` updated with aliases matching filenames.

