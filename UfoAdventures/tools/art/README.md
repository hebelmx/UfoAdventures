# Art Tools (Python)

A lightweight, local toolchain to vectorize source sprites, synthesize missing animation frames via parameterized transforms, and pack frames into TexturePacker-style spritesheets (PNG+JSON) ready for the PIXI loader.

## Setup

```bash
python -m venv .venv
. .venv/Scripts/Activate.ps1   # PowerShell on Windows
pip install -r tools/art/requirements.txt
```

## 1) Vectorize raster sprites to SVG
Extract contours from PNGs (alpha-aware) and write SVG paths.

```bash
python tools/art/vectorize_to_svg.py \
  --input images/Sprites \
  --output images/SVG \
  --threshold 200 --epsilon 2.0 --min-area 50
```

- Input may be a file or directory. All `*.png|*.jpg|*.jpeg` are processed.
- Output mirrors input structure under the target folder.

## 2) Generate animation frames via transforms
Create missing frames like `idle-01..08`, `thrust-01..08`, etc., from a base cutout using deterministic transforms.

```bash
python tools/art/augment_sprites.py \
  --input images/Sprites/output_01\ Blade_bkremoved.png \
  --config tools/art/config/enemy_sequences.json \
  --out-dir tmp/generated/Blade
```

- Config describes sequences, frame counts, and transform recipes.
- Works for a single file or an input directory.

## 3) Pack frames into a spritesheet (PNG + JSON)
Shelf-packs frames into a power-of-two atlas and writes PIXI-compatible JSON.

```bash
python tools/art/pack_spritesheet.py \
  --frames-dir tmp/generated/Blade/idle \
  --out-png src/images/Sprites/Enemies/Blade/blade-atlas.png \
  --out-json src/images/Sprites/Enemies/Blade/blade-atlas.json \
  --alias blade-atlas --max-size 2048
```

Repeat per sequence or point `--frames-dir` to a parent folder containing all sequences; file names become frame names.

## 4) Optional small model transform (ONNX)
Run an ONNX image model (e.g., super-resolution, style transfer) to enhance or stylize frames.

```bash
python tools/art/onnx_transform.py \
  --model-path models/fast_style.onnx \
  --input tmp/generated/Blade/idle \
  --output tmp/model_out/Blade/idle
```

Notes:
- Bring your own ONNX model. This script assumes a single 3-channel float32 input `NCHW` and single output of same shape. Use `--input-name`/`--output-name`/`--size` to adapt.
- To export a small style model: PyTorch fast-neural-style examples → ONNX.

## Suggested workflow
1. Cutouts live under `images/Sprites/...` (source, not shipped).
2. (Optional) `vectorize_to_svg.py` to produce SVG references.
3. `augment_sprites.py` to synthesize missing frames per config.
4. `pack_spritesheet.py` to generate `*-atlas.png|json` under `src/images/Sprites/...`.
5. Update `src/config/game-config.json` with atlas entries if needed, then test with `src/test_asset_loading.html`.

## Config examples
- `tools/art/config/player_sequences.json` – generates `idle`, `thrust`, `comboBreaker`, `teleport` scaffolds.
- `tools/art/config/enemy_sequences.json` – generates `idle`, `strafe`, `hit`, `death` scaffolds for Blade/Amidogus.

> These are deterministic placeholders to unblock integration/testing. Replace with hand-drawn frames as they arrive; packing script and names remain the same.
