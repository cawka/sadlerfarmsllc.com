#!/usr/bin/env python3
"""Mix the narration clips over a music bed into a film soundtrack.

Usage:
  tools/narration/mix.py            # rebuild all soundtracks
  tools/narration/mix.py bama       # rebuild one
  tools/build-media.sh film         # then repackage the film for the site

Inputs (all in assets/audio/):
  narration/narration.json  clip files, start times (s), gains; music beds and levels
  narration/NN.flac         the voice clips
  beds/<id>.m4a             78 s music beds (song cut so its real ending lands at the end)
Output:
  soundtracks/<id>.m4a      what build-media.sh packages as switchable audio

The music is compressed to an even level and sits at a fixed volume under the
voice: no ducking, so it never swells up between lines.
"""
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
AUDIO = ROOT / "assets" / "audio"
SPEC = json.loads((AUDIO / "narration" / "narration.json").read_text())


def mix(bed_id):
    bed = SPEC["beds"][bed_id]
    clips = SPEC["clips"]
    total = SPEC["film_seconds"]
    inputs = ["-i", str(AUDIO / "beds" / bed["file"])]
    parts, labels = [], ""
    for i, c in enumerate(clips, start=1):
        inputs += ["-i", str(AUDIO / "narration" / c["file"])]
        ms = int(round(c["start"] * 1000))
        parts.append(f"[{i}]aresample=48000,volume={c['gain']},adelay={ms}|{ms}[a{i}]")
        labels += f"[a{i}]"
    fc = (";".join(parts) + ";" + labels +
          f"amix=inputs={len(clips)}:normalize=0,pan=stereo|c0=c0|c1=c0,highpass=f=70,"
          f"acompressor=threshold=-18dB:ratio=3:attack=5:release=120,volume=1.6,apad=whole_dur={total}[vo];"
          f"[0]acompressor=threshold=0.015:ratio=10:attack=300:release=3000:knee=6,"
          f"volume={bed['gain']},afade=t=out:st={bed['fade_start']}:d={bed['fade']}[mus];"
          f"[mus][vo]amix=inputs=2:normalize=0,alimiter=limit=0.95,atrim=0:{total}[out]")
    out = AUDIO / "soundtracks" / f"{bed_id}.m4a"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", fc,
                    "-map", "[out]", "-c:a", "aac", "-b:a", "192k", str(out)], check=True)
    print(out.relative_to(ROOT))


if __name__ == "__main__":
    for b in (sys.argv[1:] or SPEC["beds"]):
        mix(b)
