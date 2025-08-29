"""
Sprite Generator (img2img/inpaint) — one-shot, resumable, observable

Features
- Uses Diffusers AutoPipelines (image-to-image or inpainting) with a configurable HF model.
- Processes a directory of sample images; optional masks for inpainting.
- Writes a manifest.jsonl and run_state.json (args, env, timing) for resuming/debugging.
- Uses HF token from environment (HUGGINGFACE_HUB_TOKEN or HF_TOKEN).
- Supports CPU or CUDA automatically.

Run with uv (recommended):
  uv run \
    --with diffusers==0.30.3 \
    --with huggingface_hub==0.24.6 \
    --with accelerate==0.33.0 \
    --with torch \
    --with pillow \
    scripts/generate_sprites.py \
      --model stabilityai/sd-turbo \
      --mode img2img \
      --input-dir images/Sprites \
      --output-dir out/sprites \
      --prompt "game sprite, clean outline, flat colors, transparent background"

Notes
- If you want GPU wheels for torch, preinstall torch with your CUDA index on the server, then omit `--with torch` above.
- For SDXL or specific inpainting models, set `--model` accordingly. This script selects the correct AutoPipeline based on --mode.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, Iterable, Optional, Tuple

from PIL import Image

try:
    # Optional: background removal at the start of the pipeline
    from rembg import remove as rembg_remove  # type: ignore
    _REMBG_AVAILABLE = True
except Exception:  # pragma: no cover
    rembg_remove = None
    _REMBG_AVAILABLE = False


def setup_logging(log_file: Path) -> None:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    fmt = "%(asctime)s [%(levelname)s] %(message)s"
    logging.basicConfig(level=logging.INFO, format=fmt, handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8"),
    ])


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


@dataclass
class Args:
    model: str
    mode: str
    input_dir: Path
    output_dir: Path
    prompt: str
    negative_prompt: Optional[str]
    steps: int
    guidance: float
    strength: float
    width: int
    height: int
    batch_size: int
    num_images: int
    seed: Optional[int]
    cache_dir: Optional[Path]
    overwrite: bool
    resume: bool
    mask_suffix: str
    pre_bg_remove: bool
    post_bg_remove: bool


def parse_args() -> Args:
    p = argparse.ArgumentParser(description="Generate sprites from samples with Diffusers")
    p.add_argument("--model", default="stabilityai/sd-turbo", help="HF model id to use")
    p.add_argument("--mode", choices=["img2img", "inpaint"], default="img2img")
    p.add_argument("--input-dir", type=Path, required=True, help="Folder with input images (.png/.jpg)")
    p.add_argument("--output-dir", type=Path, required=True, help="Folder to write results and logs")
    p.add_argument("--prompt", default="game sprite, clean outline, flat colors, centered, high-contrast",
                   help="Positive prompt")
    p.add_argument("--negative-prompt", dest="negative_prompt", default="blurry, noisy, watermark, text, background",
                   help="Negative prompt")
    p.add_argument("--steps", type=int, default=20)
    p.add_argument("--guidance", type=float, default=1.5)
    p.add_argument("--strength", type=float, default=0.7, help="Img2img strength (0-1); lower preserves more input")
    p.add_argument("--width", type=int, default=256)
    p.add_argument("--height", type=int, default=256)
    p.add_argument("--batch-size", type=int, default=1)
    p.add_argument("--num-images", type=int, default=1, help="Images to generate per input")
    p.add_argument("--seed", type=int)
    p.add_argument("--cache-dir", type=Path, help="HF cache directory for models")
    p.add_argument("--overwrite", action="store_true", help="Regenerate even if output exists in manifest")
    p.add_argument("--resume", action="store_true", help="Skip inputs already present in manifest")
    p.add_argument("--mask-suffix", default="_mask", help="For inpaint: filename suffix for mask next to input")
    p.add_argument("--pre-bg-remove", dest="pre_bg_remove", action="store_true", default=True,
                   help="Run background removal on inputs first (default: on)")
    p.add_argument("--no-pre-bg-remove", dest="pre_bg_remove", action="store_false")
    p.add_argument("--post-bg-remove", dest="post_bg_remove", action="store_true", default=False,
                   help="Also remove background on generated outputs (default: off)")
    a = p.parse_args()
    return Args(**vars(a))


def resolve_device() -> str:
    try:
        import torch  # noqa: F401
        import torch.cuda as cuda
        if cuda.is_available():
            return "cuda"
    except Exception:
        pass
    return "cpu"


def load_pipeline(args: Args, device: str):
    from diffusers import (
        AutoPipelineForImage2Image,
        AutoPipelineForInpainting,
    )
    from huggingface_hub import login

    token = os.getenv("HUGGINGFACE_HUB_TOKEN") or os.getenv("HF_TOKEN")
    if token:
        try:
            login(token=token, add_to_git_credential=False)
            logging.info("Authenticated to Hugging Face Hub via token env var")
        except Exception as e:
            logging.warning("HF login failed (continuing): %s", e)

    kwargs = {}
    if args.cache_dir:
        kwargs["cache_dir"] = str(args.cache_dir)

    if args.mode == "img2img":
        pipe = AutoPipelineForImage2Image.from_pretrained(args.model, **kwargs)
    else:
        pipe = AutoPipelineForInpainting.from_pretrained(args.model, **kwargs)

    pipe = pipe.to(device)
    try:
        pipe.enable_attention_slicing()
    except Exception:
        pass
    return pipe


def ensure_transparent_foreground(img: Image.Image, target_size: Tuple[int, int], *, enable: bool) -> Tuple[Image.Image, bool]:
    """Return an image with alpha background removed if enabled and rembg is available.

    - Resizes to target_size before removal to speed up processing and match generation size.
    - If rembg is unavailable or disabled, returns the original (possibly resized) RGB image and False.
    """
    resized = img.convert("RGBA").resize(target_size, Image.LANCZOS) if target_size else img.convert("RGBA")
    if not enable:
        return resized, False
    if not _REMBG_AVAILABLE:
        logging.warning("pre-bg-remove requested but rembg is not installed; continuing without it")
        return resized, False
    try:
        out = rembg_remove(resized)
        # Ensure mode RGBA
        if out.mode != "RGBA":
            out = out.convert("RGBA")
        return out, True
    except Exception as e:  # pragma: no cover
        logging.warning("rembg failed: %s; continuing without removal", e)
        return resized, False


def enumerate_inputs(input_dir: Path) -> Iterable[Path]:
    exts = {".png", ".jpg", ".jpeg"}
    for p in sorted(input_dir.glob("**/*")):
        if p.is_file() and p.suffix.lower() in exts:
            yield p


def load_manifest(manifest_path: Path) -> Dict[str, dict]:
    if not manifest_path.exists():
        return {}
    result = {}
    with manifest_path.open("r", encoding="utf-8") as f:
        for line in f:
            try:
                row = json.loads(line)
                result[row["input_sha256"]] = row
            except Exception:
                continue
    return result


def write_manifest_row(manifest_path: Path, row: dict) -> None:
    with manifest_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def pil_load(path: Path, size: Tuple[int, int]) -> Image.Image:
    img = Image.open(path).convert("RGB")
    if size:
        img = img.resize(size, Image.LANCZOS)
    return img


def main() -> int:
    args = parse_args()

    run_dir = args.output_dir / time.strftime("run_%Y%m%d_%H%M%S")
    img_dir = run_dir / "images"
    log_dir = run_dir / "logs"
    run_dir.mkdir(parents=True, exist_ok=True)
    img_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)
    pre_dir = run_dir / "preprocessed"
    pre_dir.mkdir(parents=True, exist_ok=True)

    setup_logging(log_dir / "run.log")

    device = resolve_device()
    logging.info("Device: %s", device)
    logging.info("Model: %s | Mode: %s", args.model, args.mode)

    manifest_path = run_dir / "manifest.jsonl"
    seen = load_manifest(manifest_path) if args.resume else {}

    # Save run state
    run_state = {
        "args": asdict(args),
        "device": device,
        "env": {k: os.getenv(k) for k in ["HUGGINGFACE_HUB_TOKEN", "HF_TOKEN"] if os.getenv(k)},
        "start_time": time.time(),
        "version": 1,
    }
    (run_dir / "run_state.json").write_text(json.dumps(run_state, indent=2), encoding="utf-8")

    try:
        pipe = load_pipeline(args, device)
    except Exception as e:
        logging.exception("Failed to load pipeline: %s", e)
        return 2

    # Optional seeding
    generator = None
    if args.seed is not None:
        try:
            import torch

            generator = torch.Generator(device=device).manual_seed(args.seed)
        except Exception:
            logging.warning("Seeding requested but torch generator not available")

    inputs = list(enumerate_inputs(args.input_dir))
    if not inputs:
        logging.error("No input images found in %s", args.input_dir)
        return 3

    total = 0
    for src in inputs:
        ihash = sha256_file(src)
        if args.resume and ihash in seen and not args.overwrite:
            logging.info("Skip (resume): %s", src)
            continue

        try:
            base = src.stem
            size = (args.width, args.height)
            raw_in = pil_load(src, size)
            init_image, pre_removed = ensure_transparent_foreground(raw_in, size, enable=args.pre_bg_remove)
            # Save preprocessed input for observability
            pre_path = pre_dir / f"{base}_pre.png"
            init_image.save(pre_path)

            images = []
            if args.mode == "img2img":
                images = pipe(
                    prompt=args.prompt,
                    negative_prompt=args.negative_prompt,
                    image=init_image,
                    guidance_scale=args.guidance,
                    strength=args.strength,
                    num_inference_steps=args.steps,
                    num_images_per_prompt=args.num_images,
                    generator=generator,
                ).images
            else:
                mask_path = src.with_name(base + args.mask_suffix + src.suffix)
                if not mask_path.exists():
                    logging.warning("Inpaint mode but mask not found for %s (expected %s). Skipping.", src, mask_path)
                    continue
                mask_image = pil_load(mask_path, size)
                images = pipe(
                    prompt=args.prompt,
                    negative_prompt=args.negative_prompt,
                    image=init_image,
                    mask_image=mask_image,
                    guidance_scale=args.guidance,
                    strength=args.strength,
                    num_inference_steps=args.steps,
                    num_images_per_prompt=args.num_images,
                    generator=generator,
                ).images

            for idx, out in enumerate(images):
                out_name = f"{base}_gen_{idx:02d}.png"
                out_path = img_dir / out_name
                if args.post_bg_remove and _REMBG_AVAILABLE:
                    try:
                        out_rgba = rembg_remove(out.convert("RGBA"))
                        out = out_rgba
                    except Exception as e:
                        logging.warning("post rembg failed for %s: %s", out_name, e)
                out.save(out_path)

                row = {
                    "input": str(src),
                    "input_sha256": ihash,
                    "output": str(out_path),
                    "mode": args.mode,
                    "model": args.model,
                    "prompt": args.prompt,
                    "negative_prompt": args.negative_prompt,
                    "steps": args.steps,
                    "guidance": args.guidance,
                    "strength": args.strength,
                    "seed": args.seed,
                    "width": args.width,
                    "height": args.height,
                    "ts": time.time(),
                    "pre_bg_removed": pre_removed,
                    "post_bg_removed": bool(args.post_bg_remove and _REMBG_AVAILABLE),
                }
                write_manifest_row(manifest_path, row)
                total += 1
                logging.info("Wrote %s", out_path)
        except KeyboardInterrupt:
            logging.warning("Interrupted by user")
            break
        except Exception as e:
            logging.exception("Failed processing %s: %s", src, e)
            continue

    logging.info("Done. Generated %d images. Output: %s", total, img_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
