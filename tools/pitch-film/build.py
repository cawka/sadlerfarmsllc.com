#!/usr/bin/env python3
"""Build the 45-second developer pitch film.

Usage:  tools/pitch-film/build.py [out.mp4]      (default: $TMPDIR/sadler-media/pitch.mp4)

Footage comes from the raw drone clips (assets/videos/, gitignored); narration,
music and cards are in the repo:
  assets/audio/pitch/pitch.json   script, clip start times, music cut
  assets/audio/pitch/NN.flac      narration (Kokoro TTS am_onyx, speed 0.95)
  tools/pitch-film/*.png          map card, end card (rendered from the .html files)
The music bed and birdsong are cut from assets/audio/source/ (gitignored originals).
"""
import json
import os
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = ROOT / "tools" / "pitch-film"
SPEC = json.loads((ROOT / "assets/audio/pitch/pitch.json").read_text())
TMP = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / "sadler-media"
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else TMP / "pitch.mp4"
GRADE = "eq=contrast=1.06:saturation=1.12:gamma=0.98"
XF = 0.8  # crossfade between shots


def clip(n):
    return ROOT / f"assets/videos/SadlerFarms_083026_VideoClip ({n}).mp4"


def ff(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *map(str, args)], check=True)


def build_video(path):
    inputs, fc, i = [], [], 0
    for s in SPEC["shots"]:
        if "clip" in s:
            inputs += ["-ss", s["start"], "-t", s["dur"], "-i", clip(s["clip"])]
            fc.append(f"[{i}:v]fps=30,scale=1920:1080,{GRADE},setpts=PTS-STARTPTS,format=yuv420p[s{i}]")
        else:  # still card with a slow push-in
            frames = int(round(s["dur"] * 30))
            inputs += ["-loop", "1", "-t", s["dur"], "-i", HERE / s["card"]]
            fc.append(f"[{i}:v]scale=3840:2160,zoompan=z='1+0.04*on/{frames}':x='iw/2-(iw/zoom/2)':"
                      f"y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps=30,format=yuv420p,setpts=PTS-STARTPTS[s{i}]")
        i += 1
    prev, total = "s0", SPEC["shots"][0]["dur"]
    for j in range(1, i):
        fc.append(f"[{prev}][s{j}]xfade=transition=fade:duration={XF}:offset={total - XF:.3f}[x{j}]")
        prev, total = f"x{j}", total + SPEC["shots"][j]["dur"] - XF
    length = SPEC["seconds"]
    end = SPEC["end_card_at"]
    inputs += ["-loop", "1", "-t", length, "-i", HERE / "end-card.png"]
    fc.append(f"[{i}:v]format=rgba,fade=t=in:st={end}:d=1.2:alpha=1[ec]")
    fc.append(f"[{prev}][ec]overlay=0:0:shortest=1,trim=0:{length},"
              f"fade=t=in:st=0:d=1.2,fade=t=out:st={length - 1.5}:d=1.5[v]")
    ff(*inputs, "-filter_complex", ";".join(fc), "-map", "[v]", "-an",
       "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", path)


def build_audio(path):
    m = SPEC["music"]
    src = ROOT / "assets/audio/source" / m["file"]
    length = SPEC["seconds"]
    # Music: opening of the track crossfaded into its final section so the real
    # ending lands at the end; compressed to an even level, fixed under the voice,
    # lifted a little after the last line for the closing crescendo.
    inputs = ["-i", src, "-i", src, "-i", ROOT / "assets/audio/source" / SPEC["birds"]["file"]]
    fc = [f"[0]atrim=0:{m['head']},asetpts=N/SR/TB[h]",
          f"[1]atrim={m['tail_from']},asetpts=N/SR/TB[t]",
          f"[h][t]acrossfade=d={m['xfade']}:c1=tri:c2=tri,atrim=0:{length},aresample=48000,"
          f"acompressor=threshold=0.015:ratio=10:attack=300:release=3000:knee=6,"
          f"volume='{m['gain']}*if(gte(t,{m['lift_at']}),{m['lift']},1)':eval=frame,"
          f"afade=t=in:d=1,afade=t=out:st={length - 2}:d=2[mus]"]
    b = SPEC["birds"]
    fc.append(f"[2]atrim={b['from']}:{b['from'] + b['dur']},asetpts=N/SR/TB,aresample=48000,"
              f"pan=stereo|c0=c0|c1=c0,volume={b['gain']},afade=t=in:d=0.6,"
              f"afade=t=out:st={b['dur'] - 2}:d=2,apad=whole_dur={length}[birds]")
    labels = ""
    for k, c in enumerate(SPEC["clips"], start=3):
        inputs += ["-i", ROOT / "assets/audio/pitch" / c["file"]]
        ms = int(round(c["start"] * 1000))
        fc.append(f"[{k}]aresample=48000,adelay={ms}|{ms}[a{k}]")
        labels += f"[a{k}]"
    fc.append(f"{labels}amix=inputs={len(SPEC['clips'])}:normalize=0,pan=stereo|c0=c0|c1=c0,highpass=f=70,"
              f"acompressor=threshold=-18dB:ratio=3:attack=5:release=120,volume=1.6,apad=whole_dur={length}[vo]")
    fc.append(f"[mus][birds][vo]amix=inputs=3:normalize=0,alimiter=limit=0.95,atrim=0:{length}[out]")
    ff(*inputs, "-filter_complex", ";".join(fc), "-map", "[out]", "-c:a", "aac", "-b:a", "192k", path)


def main():
    TMP.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        v, a = pathlib.Path(d) / "v.mp4", pathlib.Path(d) / "a.m4a"
        build_video(v)
        build_audio(a)
        ff("-i", v, "-i", a, "-map", "0:v", "-map", "1:a", "-c", "copy", "-shortest", OUT)
    print(OUT)


if __name__ == "__main__":
    main()
