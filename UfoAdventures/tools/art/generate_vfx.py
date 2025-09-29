#!/usr/bin/env python3
import argparse
import math
from pathlib import Path
from typing import Tuple

from PIL import Image, ImageDraw


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def draw_teleport_trail(size: Tuple[int, int], frames: int, out_dir: Path):
    w, h = size
    cx, cy = w // 2, h // 2
    for i in range(frames):
        t = i / (frames - 1)
        img = Image.new('RGBA', size, (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        steps = 12
        for s in range(steps):
            st = s / (steps - 1)
            x = cx + int(lerp(-w * 0.25, w * 0.25, st) * (0.5 + 0.5 * t))
            y = cy + int(math.sin(st * math.pi * 2.0 + t * math.pi) * (h * 0.15))
            radius = int(lerp(18, 6, st))
            alpha = int(lerp(20, 160, st) * (0.7 + 0.3 * (1 - t)))
            d.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(80, 200, 255, alpha))
        img.save(out_dir / f"teleport-trail-{i+1:02d}.png")


def draw_teleport_arrive(size: Tuple[int, int], frames: int, out_dir: Path):
    w, h = size
    cx, cy = w // 2, h // 2
    for i in range(frames):
        t = i / (frames - 1)
        img = Image.new('RGBA', size, (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        r = int(lerp(6, min(w, h) * 0.35, t))
        a = int(lerp(220, 20, t))
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(80, 200, 255, a), width=4)
        d.ellipse((cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2), outline=(255, 255, 255, a), width=2)
        img.save(out_dir / f"teleport-arrive-{i+1:02d}.png")


def draw_combo_burst(size: Tuple[int, int], frames: int, out_dir: Path):
    w, h = size
    cx, cy = w // 2, h // 2
    spokes = 16
    for i in range(frames):
        t = i / (frames - 1)
        img = Image.new('RGBA', size, (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        for k in range(spokes):
            ang = (k / spokes) * 2.0 * math.pi
            L = lerp(10, min(w, h) * 0.45, t)
            x = cx + int(math.cos(ang) * L)
            y = cy + int(math.sin(ang) * L)
            a = int(lerp(240, 40, t))
            d.line((cx, cy, x, y), fill=(255, 200, 30, a), width=3)
        img.save(out_dir / f"comboBreaker-{i+1:02d}.png")


def draw_bullet_impact(size: Tuple[int, int], frames: int, out_dir: Path):
    w, h = size
    cx, cy = w // 2, h // 2
    arms = 8
    for i in range(frames):
        t = i / (frames - 1)
        img = Image.new('RGBA', size, (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        R = int(lerp(4, 20, t))
        a = int(lerp(255, 60, t))
        for k in range(arms):
            ang = (k / arms) * 2.0 * math.pi
            x = cx + int(math.cos(ang) * R)
            y = cy + int(math.sin(ang) * R)
            d.line((cx, cy, x, y), fill=(255, 255, 255, a), width=2)
        img.save(out_dir / f"bullet-impact-{i+1:02d}.png")


def draw_boss_summon(size: Tuple[int, int], frames: int, out_dir: Path):
    w, h = size
    cx, cy = w // 2, h // 2
    for i in range(frames):
        t = i / (frames - 1)
        img = Image.new('RGBA', size, (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        R = int(lerp(20, min(w, h) * 0.45, t))
        a = int(lerp(60, 200, t))
        d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=(180, 120, 255, a), width=3)
        arc_len = 60
        start = int(lerp(0, 360, t))
        d.arc((cx - R + 6, cy - R + 6, cx + R - 6, cy + R - 6), start=start, end=start + arc_len, fill=(120, 220, 255, a), width=3)
        d.arc((cx - R + 12, cy - R + 12, cx + R - 12, cy + R - 12), start=start + 90, end=start + 90 + arc_len, fill=(255, 200, 30, a), width=3)
        img.save(out_dir / f"boss-summon-{i+1:02d}.png")


def draw_beam_attack(size: Tuple[int, int], frames: int, out_dir: Path):
    w, h = size
    cx = w // 2
    for i in range(frames):
        t = i / (frames - 1)
        img = Image.new('RGBA', size, (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        # vertical beam that grows in thickness and fades
        thickness = int(lerp(8, 28, t))
        a_core = int(lerp(220, 120, t))
        a_glow = int(lerp(140, 40, t))
        # glow
        d.rectangle((cx - thickness*2, 0, cx + thickness*2, h), fill=(255, 60, 60, a_glow))
        d.rectangle((cx - thickness, 0, cx + thickness, h), fill=(255, 240, 120, a_core))
        img.save(out_dir / f"beam_attack-{i+1:02d}.png")


def main() -> int:
    ap = argparse.ArgumentParser(description='Generate procedural VFX frames for multiple animations.')
    ap.add_argument('--out-dir', required=True, help='Output directory, frames will be under this root')
    ap.add_argument('--size', default='128x128', help='Frame size WxH, default 128x128')
    args = ap.parse_args()

    w, h = (int(s) for s in args.size.lower().split('x'))
    root = Path(args.out_dir)

    tele_trail = root / 'teleport-trail'
    tele_arrive = root / 'teleport-arrive'
    combo = root / 'comboBreaker'
    impact = root / 'bullet-impact'
    summon = root / 'boss-summon'
    beam = root / 'beam_attack'

    for d in [tele_trail, tele_arrive, combo, impact, summon, beam]:
        ensure_dir(d)

    draw_teleport_trail((w, h), frames=12, out_dir=tele_trail)
    draw_teleport_arrive((w, h), frames=8, out_dir=tele_arrive)
    draw_combo_burst((w, h), frames=10, out_dir=combo)
    draw_bullet_impact((w, h), frames=6, out_dir=impact)
    draw_boss_summon((w, h), frames=8, out_dir=summon)
    draw_beam_attack((w, h), frames=6, out_dir=beam)

    print('[ok] VFX frames generated at', root)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
