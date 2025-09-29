# Art Asset Specification

This document enumerates the exact files, formats, and animation breakdowns required to integrate the planned UFO Adventures artwork.

## 1. File Structure & Naming
Place delivered assets under `src/images/Sprites/<category>/` as shown below. Each atlas consists of a PNG for texture data and a JSON file following the PixiJS spritesheet schema (TexturePacker compatible).

```
src/images/Sprites/
  Hero/
    player-atlas.png
    player-atlas.json
  Enemies/
    Blade/blade-atlas.png
    Blade/blade-atlas.json
    Amidogus/amidogus-atlas.png
    Amidogus/amidogus-atlas.json
    Cyborg/cyborg-atlas.png        # new enemy type
    Cyborg/cyborg-atlas.json
  Boss/
    tarak-atlas.png
    tarak-atlas.json
  VFX/
    vfx-atlas.png
    vfx-atlas.json
```

### Naming Conventions
- Atlas filenames use the alias from `src/config/game-config.json` (`player-atlas`, `blade-atlas`, etc.).
- Frame names are lowercase with hyphens (`idle-01`), matching the animation keys listed below.
- Include `meta` information with `frame` width/height, `anchor` values (default `[0.5, 0.5]`), and optional custom data (e.g., `colliderRadius`).

## 2. Player Atlas (`player-atlas`)
| Animation Key    | Frames | Description                                 | Notes                          |
|------------------|--------|---------------------------------------------|--------------------------------|
| `idle`           | >=8    | Hover/breathe loop                          | Looping, gentle sway           |
| `thrust`         | >=8    | Movement/flight cycle                       | Used when player moving        |
| `comboBreaker`   | >=10   | Charged stance + discharge effect           | Triggered during ability       |
| `teleport`       | >=6    | Dissolve arrow transition                   | Used for teleport ability      |
| `hit`            | >=6    | Damage flash                                | Optional, for future use       |
| `death`          | >=8    | Life loss sequence                          | Optional                       |

- Native frame size: 256x256 (centered). Runtime scales to 50x50 currently; include consistent margins so scaling is clean.
- Provide secondary emission textures (e.g., glow strip) if needed; they can live in the VFX atlas instead.

## 3. Enemy Atlases
### 3.1 Blade Scout (`blade-atlas`)
| Key          | Frames | Description              |
|--------------|--------|--------------------------|
| `idle`       | >=4    | Hovering animation       |
| `strafe`     | >=6    | Lateral movement loop    |
| `hit`        | >=4    | Damage flash (optional)  |
| `death`      | >=6    | Explosion/disintegrate   |

- Frame size: 256x256; maintain a 20px buffer for collider radius (~20).

### 3.2 Amidogus Fighter (`amidogus-atlas`)
| Key          | Frames | Description                          |
|--------------|--------|--------------------------------------|
| `idle`       | >=4    | Hover                                 |
| `dive`       | >=8    | Swooping dive                         |
| `attack`     | >=6    | Claw swipe / projectile               |
| `hit`        | >=4    | Damage reaction                       |
| `death`      | >=8    | Break apart per concept illustration  |

- Include beam/eye-laser frames if provided in concept sketches.

### 3.3 Pet Cyborg (`cyborg-atlas`) � NEW
| Key            | Frames | Description                               |
|----------------|--------|-------------------------------------------|
| `idle`         | >=6    | Robotic twitch                            |
| `spawn`        | >=4    | Duplicate/replication animation           |
| `crawl`        | >=6    | Ground movement (per design sheet)        |
| `attack`       | >=6    | Projectile/wave attack                    |
| `death`        | >=8    | Explosion with debris                     |

- Frame size: 256x256; neon accents to stand out from background.

## 4. Boss Tarak (`tarak-atlas`)
Frame resolution: 512x512 as per design doc. Provide layered animations for each phase.

| Phase | Animation Key      | Frames | Description                              |
|-------|--------------------|--------|------------------------------------------|
| 1     | `idle_phase1`      | >=8    | Calm hover                               |
| 1     | `tail_sweep`       | >=6    | Tail attack                              |
| 2     | `idle_phase2`      | >=8    | Enraged aura overlay                     |
| 2     | `wing_attack`      | >=6    | Wide wing slash                          |
| 2     | `staff_charge`     | >=8    | Weapon charging (Taraka staff)           |
| 3     | `idle_phase3`      | >=8    | Damaged form with brighter flames        |
| 3     | `beam_attack`      | >=4    | Vertical plasma beam                     |
| All   | `summon`           | >=6    | Puppet/string whip telegraph             |
| All   | `death`            | >=10   | Collapse sequence                        |

Additional sprites (can share `tarak-atlas` or `vfx-atlas`):
- Beam telegraph glyphs
- Summon glyph/puppet strings
- Tail/wing shockwave frames

## 5. VFX Atlas (`vfx-atlas`)
| Key                 | Frames | Description                     |
|---------------------|--------|---------------------------------|
| `teleport-trail`    | >=12   | Ribbon trail leaving origin     |
| `teleport-arrive`   | >=8    | Arrival flare                   |
| `comboBreaker`      | >=10   | Radial burst, lingering embers  |
| `bullet-impact`     | >=6    | Small flash for hits            |
| `boss-summon`       | >=8    | Glyph swirl                     |
| `ability-ready`     | >=4    | Optional HUD flourish           |

Frame size: 128x128 recommended for performance; use transparent backgrounds.

## 6. Data & Integration Requirements
1. **Manifest updates**: ensure every atlas has an entry in `src/config/game-config.json`:
   ```json
   {
     "alias": "player-atlas",
     "src": "images/Sprites/Hero/player-atlas.png",
     "type": "spritesheet",
     "json": "images/Sprites/Hero/player-atlas.json",
     "animations": {
       "idle": ["idle-01", "idle-02", "idle-03"],
       "comboBreaker": ["combo-01", "combo-02", "combo-03"],
       "teleport": ["tele-01", "tele-02", "tele-03"]
     }
   }
   ```
   (Our loader can infer frames from the JSON file; include animation arrays in config if JSON doesn�t specify named animations.)

2. **Collider metadata**: if available, include custom properties like `colliderRadius`, `spriteWidth`, `spriteHeight`, `speed` inside the atlas JSON so gameplay can read them directly.

3. **Color palette**: match concept art (SpiritsDesign doc) � Tarak�s palette (charcoal, crimson, ember orange), hero�s neon accents, etc.

4. **Testing**: once assets land, run:
   - `src/test_ability_system.html` to preview ability animations and VFX.
   - `npm run test:unit` (abilities still covered in Vitest sandbox).
   - Manual gameplay session focusing on adventure & boss modes (observe HUD overlay stats, ensure pool counts stay bounded).

## 7. Delivery Checklist for Art Team
- [ ] Provide PNG spritesheets and matching JSON metadata for each alias above.
- [ ] Confirm frame names line up with animation keys listed.
- [ ] Supply any required blend modes or shader notes (e.g., additive VFX) in the JSON `meta` block.
- [ ] Include scale/anchor adjustments if sprites need custom presentation.
- [ ] Optional: deliver preview GIFs for documentation.

Once the assets are ready, we can update `game-config.json` animation pointers, adjust effect parameters, and expose new animations through the ability & enemy systems immediately.

## 8. Current Asset Inventory (scan-based)
This section reflects what currently exists under `images/` (source art) and `src/images/` (runtime client). It is intended to guide exporting atlases and updating the manifest.

- Player
  - Found: `src/images/Sprites/Hero/idle_01.png`, `src/images/Sprites/Hero/idle_01.svg`
  - Status: single frame present; no `player-atlas.png|json` yet
  - Action: export `player-atlas` (PNG+JSON) with `idle`, `thrust`, `comboBreaker`, `teleport` keys

- Blade Scout
  - Found: `src/images/Sprites/Enemies/Blade/idle_01.png|svg`, plus multiple raw cutouts in `images/Sprites/*Blade*_bkremoved.png`
  - Status: single frame present; no `blade-atlas.png|json` yet
  - Action: compile Blade frames into `blade-atlas` with `idle`, `strafe`, `hit`, `death`

- Amidogus Fighter
  - Found: `src/images/Sprites/Enemies/Amidogus/idle_01.png|svg`, `src/images/Sprites/02_Amidogus.png`, raw cutouts in `images/Sprites/*Amidogus*_bkremoved.png`
  - Status: single frame + concept exports; no `amidogus-atlas.png|json`
  - Action: compile Amidogus frames into `amidogus-atlas` with `idle`, `dive`, `attack`, `hit`, `death`

- Pet Cyborg (cyborg)
  - Found: raw sources in `images/Sprites/output_Droide*.png`, `images/Sprites/Pet0*.png`
  - Status: no runtime sprites in `src/images/Sprites/Enemies/Cyborg/` and no `cyborg-atlas`
  - Action: export `cyborg-atlas` with `idle`, `spawn`, `crawl`, `attack`, `death`

- Boss Tarak
  - Found: `src/images/Sprites/1_Tarak.png`, concept/cutouts in `images/Sprites/*Tarak*_bkremoved.png`
  - Status: no `tarak-atlas.png|json`
  - Action: export `tarak-atlas` (512x512 frames) with phase keys described in section 4

- Wimidir (optional/minion)
  - Found: `images/Sprites/Wimdir01_bkremoved.png`
  - Status: source-only; decide target category (`Enemies` or `Objects`) if used

- Backgrounds
  - Found: `src/images/Backgrounds/space_01.jpg|svg`, plus background cutout in `images/Sprites/*BackGround*_bkremoved.png`
  - Status: static textures OK; not part of an atlas

- VFX
  - Found: none yet
  - Action: create `vfx-atlas` with keys in section 5 when assets are ready

## 9. Gap Checklist & Required Exports
For each atlas below, deliver `.png` + `.json` (TexturePacker/PIXI format) under `src/images/Sprites/<Category>/` with lowercase, hyphenated frame names:

- `player-atlas` → `src/images/Sprites/Hero/player-atlas.png|json`
- `blade-atlas` → `src/images/Sprites/Enemies/Blade/blade-atlas.png|json`
- `amidogus-atlas` → `src/images/Sprites/Enemies/Amidogus/amidogus-atlas.png|json`
- `cyborg-atlas` → `src/images/Sprites/Enemies/Cyborg/cyborg-atlas.png|json`
- `tarak-atlas` → `src/images/Sprites/Boss/tarak-atlas.png|json`
- `vfx-atlas` → `src/images/Sprites/VFX/vfx-atlas.png|json`

Include in each JSON:
- `meta` block with `size`, optional `anchor` default `[0.5, 0.5]`, and gameplay metadata like `colliderRadius`, `spriteWidth`, `spriteHeight`, `speed` when applicable.
- Named `animations` or consistent frame naming (e.g., `idle-01..08`) so the loader can infer sequences.

## 10. Recommended File Organization (no functional change)
Keep source art in `images/` (not shipped) and place runtime-ready atlases in `src/images/`:

```
images/                     # source/reference art, WIP, cutouts
  Sprites/
    Pet01_bkremoved.png
    Droide01_bkremoved.png
    ...
src/images/                 # shipped runtime assets
  Sprites/
    Hero/player-atlas.png|json
    Enemies/Blade/blade-atlas.png|json
    Enemies/Amidogus/amidogus-atlas.png|json
    Enemies/Cyborg/cyborg-atlas.png|json
    Boss/tarak-atlas.png|json
    VFX/vfx-atlas.png|json
  Backgrounds/space_01.jpg|svg
```

## 11. Manifest Stubs (to add in `src/config/game-config.json`)
These examples illustrate the expected structure; adjust animation arrays to match your exported frame names when the JSON doesn't include named animations.

```json
{
  "alias": "player-atlas",
  "src": "images/Sprites/Hero/player-atlas.png",
  "type": "spritesheet",
  "json": "images/Sprites/Hero/player-atlas.json",
  "animations": {
    "idle": ["idle-01", "idle-02", "idle-03", "idle-04", "idle-05", "idle-06"],
    "thrust": ["thrust-01", "thrust-02", "thrust-03", "thrust-04", "thrust-05", "thrust-06", "thrust-07", "thrust-08"],
    "comboBreaker": ["combo-01", "combo-02", "combo-03", "combo-04", "combo-05", "combo-06", "combo-07", "combo-08", "combo-09", "combo-10"],
    "teleport": ["tele-01", "tele-02", "tele-03", "tele-04", "tele-05", "tele-06"]
  }
}
```

```json
{
  "alias": "blade-atlas",
  "src": "images/Sprites/Enemies/Blade/blade-atlas.png",
  "type": "spritesheet",
  "json": "images/Sprites/Enemies/Blade/blade-atlas.json"
}
```

Repeat for `amidogus-atlas`, `cyborg-atlas`, `tarak-atlas`, and `vfx-atlas`.