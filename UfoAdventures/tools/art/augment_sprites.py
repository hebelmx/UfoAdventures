#!/usr/bin/env python3
import argparse
import json
import math
import os
from pathlib import Path
from typing import Callable, Dict, List

import numpy as np
from PIL import Image, ImageEnhance


Transform = Callable[[Image.Image, float, dict], Image.Image]


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def list_images(path: Path) -> List[Path]:
    if path.is_file():
        return [path]
    exts = {'.png', '.jpg', '.jpeg'}
    return [p for p in path.rglob('*') if p.suffix.lower() in exts]


# --------- basic transforms ---------

def t_rotate(img: Image.Image, t: float, params: dict) -> Image.Image:
    max_deg = float(params.get('max_deg', 10.0))
    angle = (2.0 * t - 1.0) * max_deg
    return img.rotate(angle, resample=Image.BICUBIC, expand=True)


def t_translate(img: Image.Image, t: float, params: dict) -> Image.Image:
    max_dx = float(params.get('max_dx', 4.0))
    max_dy = float(params.get('max_dy', 2.0))
    dx = (2.0 * t - 1.0) * max_dx
    dy = (2.0 * math.sin(math.pi * t)) * max_dy
    canvas = Image.new('RGBA', (img.width + int(abs(dx)) + 4, img.height + int(abs(dy)) + 4), (0, 0, 0, 0))
    ox = (canvas.width - img.width) // 2 + int(dx)
    oy = (canvas.height - img.height) // 2 + int(dy)
    canvas.paste(img, (ox, oy), img)
    return canvas


def t_scale(img: Image.Image, t: float, params: dict) -> Image.Image:
    min_s = float(params.get('min_scale', 0.95))
    max_s = float(params.get('max_scale', 1.05))
    s = min_s + (max_s - min_s) * (0.5 * (1 - math.cos(2 * math.pi * t)))
    new_w = max(1, int(img.width * s))
    new_h = max(1, int(img.height * s))
    scaled = img.resize((new_w, new_h), resample=Image.BICUBIC)
    canvas = Image.new('RGBA', (max(img.width, new_w) + 4, max(img.height, new_h) + 4), (0, 0, 0, 0))
    ox = (canvas.width - scaled.width) // 2
    oy = (canvas.height - scaled.height) // 2
    canvas.paste(scaled, (ox, oy), scaled)
    return canvas


def t_brightness(img: Image.Image, t: float, params: dict) -> Image.Image:
    min_b = float(params.get('min', 0.9))
    max_b = float(params.get('max', 1.1))
    b = min_b + (max_b - min_b) * (0.5 * (1 - math.cos(2 * math.pi * t)))
    return ImageEnhance.Brightness(img).enhance(b)


TRANSFORMS: Dict[str, Transform] = {
    'rotate': t_rotate,
    'translate': t_translate,
    'scale': t_scale,
    'brightness': t_brightness,
}


def apply_recipe(img: Image.Image, t: float, recipe: List[dict]) -> Image.Image:
    out = img
    for step in recipe:
        name = step.get('name')
        if name not in TRANSFORMS:
            continue
        out = TRANSFORMS[name](out, t, step.get('params', {}))
    return out


def generate_sequence(base_img: Image.Image, frames: int, recipe: List[dict]) -> List[Image.Image]:
    imgs: List[Image.Image] = []
    for i in range(frames):
        # t in [0,1)
        t = i / frames
        imgs.append(apply_recipe(base_img, t, recipe))
    return imgs


def load_config(path: Path) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def seq_output_dir(out_dir: Path, sequence_name: str) -> Path:
    p = out_dir / sequence_name
    ensure_dir(p)
    return p


def save_frames(frames: List[Image.Image], out_dir: Path, prefix: str) -> None:
    for idx, im in enumerate(frames, start=1):
        name = f"{prefix}-{idx:02d}.png"
        target = out_dir / name
        im.save(target)


def main() -> int:
    ap = argparse.ArgumentParser(description='Synthesize animation frames via parameterized transforms.')
    ap.add_argument('--input', required=True, help='Input PNG or directory')
    ap.add_argument('--config', required=True, help='JSON config with sequences and transform recipes')
    ap.add_argument('--out-dir', required=True, help='Output directory for generated frames')
    ap.add_argument('--sequence', default='', help='Optional: only generate a specific sequence name')
    args = ap.parse_args()

    cfg = load_config(Path(args.config))
    sequences = cfg.get('sequences', {})
    if args.sequence:
        sequences = {args.sequence: sequences.get(args.sequence, {})}

    in_path = Path(args.input)
    out_root = Path(args.out_dir)
    ensure_dir(out_root)

    files = list_images(in_path)
    if not files:
        print('[error] No images found')
        return 1

    for f in files:
        base = Image.open(f).convert('RGBA')
        for seq_name, seq_cfg in sequences.items():
            frames = int(seq_cfg.get('frames', 8))
            recipe = seq_cfg.get('recipe', [])
            imgs = generate_sequence(base, frames, recipe)
            out_dir = seq_output_dir(out_root / f.stem, seq_name)
            save_frames(imgs, out_dir, prefix=seq_name)
            print(f"[ok] {f.name} -> {seq_name} ({frames} frames)")

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
