#!/usr/bin/env bash
''':'
# Re-run this file with the narration venv's Python (created by setup.sh).
exec "$(dirname "$0")/.venv/bin/python" "$0" "$@"
'''
"""Generate one narration clip with the AI voice and trim its built-in silence.

Usage:
  tools/narration/say.py "Text to speak." out.wav [--voice am_onyx] [--speed 0.86]
  tools/narration/say.py --voices          # list available voices

Kokoro pads every clip with ~0.7 s of trailing silence; it's trimmed here so
clips can be placed back to back with natural breaths (see narration.json).
Tips that worked for this film:
  - generate one sentence (or one short paragraph) per clip
  - avoid strings of fragments ("Hidden coves. Quiet meadows.") - each full stop
    becomes a long pause
  - very short phrases sound stilted; cut them from a longer take instead
"""
import argparse
import pathlib

import numpy as np
import soundfile as sf
from kokoro_onnx import EspeakConfig, Kokoro

HERE = pathlib.Path(__file__).resolve().parent
ESPEAK = EspeakConfig(lib_path="/opt/homebrew/lib/libespeak-ng.dylib",
                      data_path="/opt/homebrew/share/espeak-ng-data")


def load():
    return Kokoro(str(HERE / "models/kokoro-v1.0.onnx"), str(HERE / "models/voices-v1.0.bin"),
                  espeak_config=ESPEAK)


def trim(a, sr, threshold=0.01, head=0.03, tail=0.08):
    idx = np.nonzero(np.abs(a) > threshold)[0]
    if len(idx) == 0:
        return a
    return a[max(idx[0] - int(head * sr), 0):min(idx[-1] + int(tail * sr), len(a))]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("text", nargs="?")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--voice", default="am_onyx")
    ap.add_argument("--speed", type=float, default=0.86)
    ap.add_argument("--voices", action="store_true", help="list voices and exit")
    args = ap.parse_args()

    k = load()
    if args.voices:
        print("\n".join(k.get_voices()))
        return
    if not args.text or not args.out:
        ap.error("text and out are required")
    a, sr = k.create(args.text, voice=args.voice, speed=args.speed, lang="en-us")
    a = trim(np.asarray(a), sr)
    sf.write(args.out, a, sr)
    print(f"{args.out}: {len(a) / sr:.2f} s")


if __name__ == "__main__":
    main()
