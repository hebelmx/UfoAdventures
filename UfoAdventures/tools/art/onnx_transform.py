#!/usr/bin/env python3
import argparse
from pathlib import Path
from typing import Tuple

import numpy as np
from PIL import Image

try:
    import onnxruntime as ort
except Exception as e:
    ort = None


def to_tensor(img: Image.Image, size: Tuple[int, int] | None) -> np.ndarray:
    if size:
        img = img.resize(size, Image.BICUBIC)
    arr = np.asarray(img.convert('RGB'), dtype=np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)[None, ...]  # NCHW
    return arr


def to_image(tensor: np.ndarray) -> Image.Image:
    out = np.clip(tensor.squeeze(0).transpose(1, 2, 0), 0.0, 1.0)
    out = (out * 255.0).astype(np.uint8)
    return Image.fromarray(out)


def run_model(sess: 'ort.InferenceSession', arr: np.ndarray, input_name: str, output_name: str) -> np.ndarray:
    outputs = sess.run([output_name], {input_name: arr})
    return outputs[0]


def process_path(sess, input_name, output_name, inp: Path, out_dir: Path, size):
    if inp.is_dir():
        for p in sorted(inp.rglob('*.png')):
            out_sub = out_dir / p.relative_to(inp)
            out_sub.parent.mkdir(parents=True, exist_ok=True)
            img = Image.open(p).convert('RGB')
            arr = to_tensor(img, size)
            out = run_model(sess, arr, input_name, output_name)
            to_image(out).save(out_sub)
            print(f"[ok] {p} -> {out_sub}")
    else:
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / inp.name
        img = Image.open(inp).convert('RGB')
        arr = to_tensor(img, size)
        out = run_model(sess, arr, input_name, output_name)
        to_image(out).save(out_file)
        print(f"[ok] {inp} -> {out_file}")


def main() -> int:
    ap = argparse.ArgumentParser(description='Run an ONNX image model (e.g., style/super-res) on frames or folders.')
    ap.add_argument('--model-path', required=True)
    ap.add_argument('--input', required=True)
    ap.add_argument('--output', required=True)
    ap.add_argument('--input-name', default='input')
    ap.add_argument('--output-name', default='output')
    ap.add_argument('--size', default='', help='e.g. 256x256; empty keeps original size')
    args = ap.parse_args()

    if ort is None:
        raise SystemExit('onnxruntime not installed. See tools/art/requirements.txt')

    size = None
    if args.size:
        w, h = args.size.lower().split('x')
        size = (int(w), int(h))

    sess = ort.InferenceSession(args.model_path, providers=['CPUExecutionProvider'])

    process_path(sess, args.input_name, args.output_name, Path(args.input), Path(args.output), size)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
