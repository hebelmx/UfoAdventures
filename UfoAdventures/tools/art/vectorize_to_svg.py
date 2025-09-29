#!/usr/bin/env python3
import argparse
import os
import sys
from pathlib import Path

import cv2
import numpy as np
import svgwrite


def list_images(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    exts = {'.png', '.jpg', '.jpeg'}
    return [p for p in path.rglob('*') if p.suffix.lower() in exts]


def ensure_dir(p: Path) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)


def alpha_aware_mask(image_bgra: np.ndarray, alpha_threshold: int) -> np.ndarray:
    if image_bgra.shape[2] == 4:
        alpha = image_bgra[:, :, 3]
        return (alpha >= alpha_threshold).astype(np.uint8) * 255
    gray = cv2.cvtColor(image_bgra, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
    return mask


def find_contours(mask: np.ndarray, threshold: int, epsilon: float, min_area: float) -> list[np.ndarray]:
    # Denoise slightly
    blur = cv2.GaussianBlur(mask, (3, 3), 0)
    # Edge map by threshold
    _, th = cv2.threshold(blur, threshold, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    approx_list: list[np.ndarray] = []
    for c in contours:
        if cv2.contourArea(c) < min_area:
            continue
        peri = cv2.arcLength(c, True)
        eps = (epsilon / 100.0) * peri if epsilon > 1.0 else epsilon
        approx = cv2.approxPolyDP(c, eps, True)
        approx_list.append(approx)
    return approx_list


def contour_to_svg_path(dwg: svgwrite.Drawing, contour: np.ndarray) -> svgwrite.path.Path:
    pts = contour.reshape(-1, 2)
    if len(pts) == 0:
        return dwg.path()
    d = [f"M {pts[0,0]} {pts[0,1]}"]
    for x, y in pts[1:]:
        d.append(f"L {x} {y}")
    d.append("Z")
    path = dwg.path(d=" ".join(d), fill='black', stroke='none')
    return path


def process_image(in_path: Path, out_path: Path, threshold: int, epsilon: float, min_area: float, alpha_threshold: int) -> None:
    img = cv2.imdecode(np.fromfile(str(in_path), dtype=np.uint8), cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"[warn] Failed to read {in_path}")
        return

    h, w = img.shape[:2]
    mask = alpha_aware_mask(img, alpha_threshold)
    contours = find_contours(mask, threshold=threshold, epsilon=epsilon, min_area=min_area)

    ensure_dir(out_path)
    dwg = svgwrite.Drawing(str(out_path), size=(w, h))
    for c in contours:
        dwg.add(contour_to_svg_path(dwg, c))
    dwg.save()
    print(f"[ok] {in_path} -> {out_path}")


def main() -> int:
    ap = argparse.ArgumentParser(description='Vectorize sprites to SVG via alpha-aware contour extraction.')
    ap.add_argument('--input', required=True, help='Input file or directory (PNG/JPG)')
    ap.add_argument('--output', required=True, help='Output SVG file or directory root')
    ap.add_argument('--threshold', type=int, default=200, help='Binary threshold for contour extraction (0-255)')
    ap.add_argument('--epsilon', type=float, default=2.0, help='Douglas-Peucker epsilon (pixels or percentage if >1.0 treated as % of perimeter)')
    ap.add_argument('--min-area', type=float, default=50.0, help='Minimum contour area to keep (in px^2)')
    ap.add_argument('--alpha-threshold', type=int, default=8, help='Alpha threshold for foreground (0-255)')
    args = ap.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)

    files = list_images(in_path)
    if not files:
        print('[error] No images found')
        return 1

    if in_path.is_file():
        # Output is a file path if user provided a file; otherwise, write parallel structure in a folder
        if out_path.suffix.lower() != '.svg':
            out_path = out_path.with_suffix('.svg')
        process_image(in_path, out_path, args.threshold, args.epsilon, args.min_area, args.alpha_threshold)
        return 0

    # Directory mode: mirror structure
    for f in files:
        rel = f.relative_to(in_path)
        out_file = out_path / rel
        out_file = out_file.with_suffix('.svg')
        process_image(f, out_file, args.threshold, args.epsilon, args.min_area, args.alpha_threshold)
    return 0


if __name__ == '__main__':
    sys.exit(main())
