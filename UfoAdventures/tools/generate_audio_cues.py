#!/usr/bin/env python3
"""Generate simple audio cues using a tiny character-based regression model.

This script avoids heavy dependencies so it can run inside the repo without any
additional installs.  A single hidden-layer neural network (implemented with
pure Python lists) is trained with gradient descent to map character bag-of-word
vectors for event names to synthesis parameters.  Those parameters drive a
minimal procedural synthesiser that renders 16-bit mono WAV files.

Usage:

    python3 tools/generate_audio_cues.py --outdir src/audio/generated \
        ability_shield ability_stasis boss_phase_transition

If no events are supplied, a default set of combat-related cues is generated.
"""

from __future__ import annotations

import argparse
import math
import os
import random
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple


# ---------------------------------------------------------------------------
# Training data and feature extraction

TRAINING_TARGETS: Dict[str, List[float]] = {
    # event_name: [frequency_multiplier, envelope_factor, waveform_mix]
    'ability_combo_breaker': [0.65, 0.35, 0.15],
    'ability_teleport': [0.82, 0.22, 0.75],
    'ability_shield': [0.48, 0.55, 0.35],
    'ability_stasis': [0.30, 0.72, 0.60],
    'boss_phase_transition': [0.25, 0.80, 0.85],
    'boss_telegraph': [0.40, 0.65, 0.55],
    'boss_beam': [0.15, 0.55, 0.90],
    'combat_hit_player': [0.55, 0.20, 0.40],
    'combat_hit_enemy': [0.75, 0.18, 0.20],
}

ALPHABET = 'abcdefghijklmnopqrstuvwxyz_'


def normalise_name(name: str) -> str:
    return name.strip().lower()


def vectorise(name: str) -> List[float]:
    vec = [0.0] * len(ALPHABET)
    normed = normalise_name(name)
    for ch in normed:
        idx = ALPHABET.find(ch)
        if idx >= 0:
            vec[idx] += 1.0

    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


def build_dataset(targets: Dict[str, List[float]]) -> Tuple[List[List[float]], List[List[float]]]:
    xs, ys = [], []
    for name, target in targets.items():
        xs.append(vectorise(name))
        ys.append(list(target))
    return xs, ys


# ---------------------------------------------------------------------------
# Tiny neural net (hand-written, one hidden layer, ReLU)


def zeros(shape: Tuple[int, int]) -> List[List[float]]:
    return [[0.0 for _ in range(shape[1])] for _ in range(shape[0])]


def random_matrix(rows: int, cols: int, scale: float = 0.3) -> List[List[float]]:
    return [[random.gauss(0.0, scale) for _ in range(cols)] for _ in range(rows)]


def matvec(W: List[List[float]], x: List[float]) -> List[float]:
    return [sum(w * xi for w, xi in zip(row, x)) for row in W]


def vec_add(a: List[float], b: List[float]) -> List[float]:
    return [i + j for i, j in zip(a, b)]


def relu(v: List[float]) -> List[float]:
    return [max(0.0, x) for x in v]


def relu_grad(v: List[float]) -> List[float]:
    return [1.0 if x > 0 else 0.0 for x in v]


def outer(a: List[float], b: List[float]) -> List[List[float]]:
    return [[ai * bj for bj in b] for ai in a]


def dot(a: List[float], b: List[float]) -> float:
    return sum(i * j for i, j in zip(a, b))


def sub(a: List[float], b: List[float]) -> List[float]:
    return [i - j for i, j in zip(a, b)]


def scalar_mul(v: List[float], scalar: float) -> List[float]:
    return [scalar * x for x in v]


def clamp01(v: List[float]) -> List[float]:
    return [min(1.0, max(0.0, x)) for x in v]


@dataclass
class TinyNet:
    input_dim: int
    hidden_dim: int = 32
    output_dim: int = 3

    def __post_init__(self):
        random.seed(42)
        self.W1 = random_matrix(self.hidden_dim, self.input_dim)
        self.b1 = [0.0 for _ in range(self.hidden_dim)]
        self.W2 = random_matrix(self.output_dim, self.hidden_dim)
        self.b2 = [0.0 for _ in range(self.output_dim)]

    def forward(self, x: List[float]) -> Tuple[List[float], List[float], List[float]]:
        # z1 = W1 * x + b1 (W1 shaped hidden x input)
        z1 = [dot(row, x) + b for row, b in zip(self.W1, self.b1)]
        h1 = relu(z1)
        z2 = [dot(row, h1) + b for row, b in zip(self.W2, self.b2)]
        return z2, h1, z1

    def backward(self, x: List[float], h1: List[float], z1: List[float], grad_out: List[float], lr: float) -> None:
        # Gradients for output layer
        grad_W2 = outer(grad_out, h1)
        grad_b2 = grad_out

        # Backprop through ReLU
        relu_mask = relu_grad(z1)
        grad_h1 = [dot([grad_out[row] for row in range(self.output_dim)], [self.W2[row][col] for row in range(self.output_dim)])
                   for col in range(self.hidden_dim)]
        grad_z1 = [gh * relu_mask[i] for i, gh in enumerate(grad_h1)]

        grad_W1 = outer(grad_z1, x)
        grad_b1 = grad_z1

        # Update weights
        for i in range(self.output_dim):
            for j in range(self.hidden_dim):
                self.W2[i][j] -= lr * grad_W2[i][j]
            self.b2[i] -= lr * grad_b2[i]

        for i in range(self.hidden_dim):
            for j in range(self.input_dim):
                self.W1[i][j] -= lr * grad_W1[i][j]
            self.b1[i] -= lr * grad_b1[i]


def train(model: TinyNet, xs: List[List[float]], ys: List[List[float]], epochs: int = 600, lr: float = 0.03) -> None:
    for epoch in range(epochs):
        total_loss = 0.0
        for x, target in zip(xs, ys):
            pred, h1, z1 = model.forward(x)
            diff = sub(pred, target)
            loss = 0.5 * dot(diff, diff)
            total_loss += loss
            model.backward(x, h1, z1, diff, lr)

        if epoch % 200 == 0:
            lr *= 0.6  # simple annealing to help convergence


# ---------------------------------------------------------------------------
# Audio synthesis helpers


def envelope(duration: float, sample_rate: int, attack: float = 0.02, release: float = 0.15) -> List[float]:
    count = max(1, int(sample_rate * duration))
    env = [1.0] * count
    attack_samples = int(min(duration, attack) * sample_rate)
    release_samples = int(min(duration, release) * sample_rate)
    for i in range(attack_samples):
        env[i] = i / max(1, attack_samples)
    for i in range(release_samples):
        env[count - 1 - i] = i / max(1, release_samples)
    return env


def synthesize_tone(freq: float, duration: float, mix: float, sample_rate: int = 44100) -> List[float]:
    total = max(1, int(sample_rate * duration))
    samples = []
    for n in range(total):
        t = n / sample_rate
        sine = math.sin(2 * math.pi * freq * t)
        square = 1.0 if sine >= 0 else -1.0
        # simple triangle
        tri = 2.0 * abs(2.0 * ((freq * t) - math.floor(freq * t + 0.5))) - 1.0
        blend = max(0.0, min(1.0, mix))
        wave = (1 - blend) * sine + blend * (0.5 * square + 0.5 * tri)
        samples.append(wave)

    env = envelope(duration, sample_rate)
    return [s * e for s, e in zip(samples, env)]


def mix_signals(signals: Sequence[List[float]]) -> List[float]:
    return [sum(values) for values in zip(*signals)]


def clamp_signal(signal: List[float]) -> List[int]:
    result = []
    for s in signal:
        s = max(-1.0, min(1.0, s))
        result.append(int(s * 32767))
    return result


def write_wav(path: Path, samples: List[int], sample_rate: int = 44100) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        data = bytearray()
        for sample in samples:
            data.extend(sample.to_bytes(2, byteorder='little', signed=True))
        wf.writeframes(data)


# ---------------------------------------------------------------------------
# Prediction and CLI


def predict_parameters(model: TinyNet, name: str) -> Dict[str, float]:
    raw, _, _ = model.forward(vectorise(name))
    raw = clamp01(raw)
    return {
        'frequency': 200.0 + raw[0] * 520.0,
        'duration': 0.18 + raw[1] * 0.55,
        'mix': raw[2]
    }


def generate_cue(model: TinyNet, name: str, outdir: Path) -> Dict[str, float]:
    params = predict_parameters(model, name)
    base = synthesize_tone(params['frequency'], params['duration'], params['mix'])
    shimmer = synthesize_tone(params['frequency'] * 1.5, params['duration'], min(1.0, params['mix'] * 0.7))
    audio = [0.75 * b + 0.25 * s for b, s in zip(base, shimmer)]
    write_wav(outdir / f"{normalise_name(name).replace(' ', '_')}.wav", clamp_signal(audio))
    return params


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate lightweight audio cues without external dependencies.')
    parser.add_argument('events', nargs='*', help='Event identifiers to render.')
    parser.add_argument('--outdir', default='src/audio/generated', help='Directory for generated WAV files.')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    xs, ys = build_dataset(TRAINING_TARGETS)
    model = TinyNet(input_dim=len(xs[0]))
    train(model, xs, ys)

    events = args.events or [
        'ability_shield',
        'ability_stasis',
        'ability_combo_breaker',
        'ability_teleport',
        'boss_phase_transition',
        'boss_telegraph'
    ]

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    print('Generated cues:')
    for event in events:
        params = generate_cue(model, event, outdir)
        print(f"  {event:>24s} -> freq={params['frequency']:.1f}Hz duration={params['duration']:.2f}s mix={params['mix']:.2f}")


if __name__ == '__main__':
    main()
