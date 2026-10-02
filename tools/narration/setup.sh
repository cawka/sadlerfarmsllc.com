#!/usr/bin/env bash
# One-time setup for the narration voice generator (Kokoro TTS, runs locally).
# Creates tools/narration/.venv and downloads the model into tools/narration/models
# (both gitignored, ~350 MB). Needs Homebrew's espeak-ng for pronunciation.
set -euo pipefail
cd "$(dirname "$0")"

if ! brew list espeak-ng >/dev/null 2>&1; then
  echo "Installing espeak-ng (Homebrew)…"
  brew install espeak-ng
fi

if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q kokoro-onnx soundfile numpy

mkdir -p models
base=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  [[ -s models/$f ]] || curl -fL --progress-bar -o "models/$f" "$base/$f"
done

echo "Ready. Try: tools/narration/say.py \"Hello from Lake Wheeler.\" /tmp/test.wav && afplay /tmp/test.wav"
