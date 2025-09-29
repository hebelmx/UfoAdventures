#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image


class Node:
    def __init__(self, x: int, y: int, w: int, h: int):
        self.x = x
        self.y = y
        self.w = w
        self.h = h
        self.used = False
        self.down = None
        self.right = None

    def insert(self, w: int, h: int):
        if self.used:
            return self.right.insert(w, h) or self.down.insert(w, h)
        if w <= self.w and h <= self.h:
            self.used = True
            self.down = Node(self.x, self.y + h, self.w, self.h - h)
            self.right = Node(self.x + w, self.y, self.w - w, h)
            return self
        return None


def shelf_pack(rects: List[Tuple[int, int, Path]], max_size: int) -> Tuple[int, int, Dict[Path, Tuple[int, int]]]:
    # Start with minimal size and grow
    size = 64
    while size <= max_size:
        root = Node(0, 0, size, size)
        positions: Dict[Path, Tuple[int, int]] = {}
        ok = True
        for w, h, p in rects:
            node = root.insert(w, h)
            if not node:
                ok = False
                break
            positions[p] = (node.x, node.y)
        if ok:
            return size, size, positions
        size *= 2
    raise RuntimeError('Could not pack within max_size')


def list_frames(frames_dir: Path) -> List[Path]:
    return sorted([p for p in frames_dir.rglob('*.png')])


def make_frame_name(base_dir: Path, file: Path) -> str:
    rel = file.relative_to(base_dir).as_posix()
    name = rel.rsplit('.', 1)[0]
    return name


def build_atlas(frames_dir: Path, out_png: Path, out_json: Path, alias: str, max_size: int) -> None:
    files = list_frames(frames_dir)
    if not files:
        raise SystemExit('No frames found')

    images = {f: Image.open(f).convert('RGBA') for f in files}
    rects = [(im.width, im.height, f) for f, im in images.items()]

    W, H, pos = shelf_pack(rects, max_size=max_size)
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    frames_json = {}
    for f, im in images.items():
        x, y = pos[f]
        atlas.paste(im, (x, y), im)
        frame_name = make_frame_name(frames_dir, f)
        frames_json[frame_name] = {
            'frame': {'x': x, 'y': y, 'w': im.width, 'h': im.height},
            'rotated': False,
            'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': im.width, 'h': im.height},
            'sourceSize': {'w': im.width, 'h': im.height},
        }

    out_png.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(out_png)

    data = {
        'frames': frames_json,
        'meta': {
            'app': 'ufo-tools-pack',
            'version': '1.0',
            'image': out_png.name,
            'size': {'w': W, 'h': H},
            'scale': '1',
            'alias': alias,
        }
    }
    out_json.parent.mkdir(parents=True, exist_ok=True)
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

    print(f"[ok] Wrote {out_png} and {out_json} ({len(files)} frames)")


def main() -> int:
    ap = argparse.ArgumentParser(description='Pack frames into a spritesheet with TexturePacker-like JSON.')
    ap.add_argument('--frames-dir', required=True)
    ap.add_argument('--out-png', required=True)
    ap.add_argument('--out-json', required=True)
    ap.add_argument('--alias', required=True)
    ap.add_argument('--max-size', type=int, default=2048)
    args = ap.parse_args()

    build_atlas(Path(args.frames_dir), Path(args.out_png), Path(args.out_json), args.alias, args.max_size)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
