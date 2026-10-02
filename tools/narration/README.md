# Film narration: voice generator and mixer

The hero film's narration is an AI voice ("am_onyx", Kokoro TTS v1.0,
Apache-2.0) that runs locally on this Mac. Everything needed to change a line,
re-time it, or re-mix it over different music is in the repo.

## Where things are

| What | Where | In git? |
|------|-------|---------|
| Voice generator | `tools/narration/say.py` | yes |
| Mixer (voice + music → soundtrack) | `tools/narration/mix.py` | yes |
| One-time setup | `tools/narration/setup.sh` | yes |
| Python env + model files (~350 MB) | `tools/narration/.venv/`, `tools/narration/models/` | **no** (gitignored; `setup.sh` recreates them) |
| Script, timing, levels | `assets/audio/narration/narration.json` | yes |
| Approved voice clips | `assets/audio/narration/01.flac` … `11.flac` | yes |
| Music beds (78 s, cut to end on the song's real ending) | `assets/audio/beds/<id>.m4a` | yes |
| Finished soundtracks | `assets/audio/soundtracks/<id>.m4a` | yes |
| Original music downloads | `assets/audio/source/` | no (gitignored) |

`assets/audio/` is excluded from the website build; the site only gets the
packaged film from `tools/build-media.sh film`.

## Setup (once per machine)

    tools/narration/setup.sh

Installs Homebrew `espeak-ng` if missing (pronunciation), creates the venv and
downloads the model. Already done on this Mac.

## Change a line

1. Generate the new clip (voice and speed as listed for that clip in `narration.json`):

        tools/narration/say.py "Here, the fields roll gently down to the water." /tmp/03.wav --speed 0.86
        afplay /tmp/03.wav

2. Save it over the old clip: `ffmpeg -y -i /tmp/03.wav assets/audio/narration/03.flac`
3. Update that clip's `text` in `narration.json`. If it got longer or shorter, shift
   the `start` times of the following clips so the gaps stay ~0.7 s.
   Each clip's length: `ffprobe -v error -show_entries format=duration -of csv=p=0 assets/audio/narration/03.flac`
4. Rebuild the soundtracks and the film:

        tools/narration/mix.py            # all four soundtracks
        tools/build-media.sh film         # repackage the film for the site

5. Make a phone-size preview with sound to listen to (pick any soundtrack):

        ffmpeg -i "${TMPDIR:-/tmp}/sadler-media/film.mp4" -i assets/audio/soundtracks/mood.m4a \
          -map 0:v -map 1:a -vf scale=960:-2 -c:v libx264 -crf 26 -c:a aac -b:a 128k -shortest /tmp/film-preview.mp4

## What worked (lessons from getting the current take approved)

- One sentence or short paragraph per clip; place clips with **~0.7 s** breaths
  (a little longer, ~1.2 s, before the poem and before the closing line).
- Kokoro adds ~0.7 s of silence to the end of every clip; `say.py` trims it.
  Without trimming, gaps came out ~2 s and sounded broken.
- Avoid strings of fragments ("Hidden coves. Quiet meadows.") — every full stop
  becomes a long pause.
- Very short phrases ("Sadler Farms.") sound stilted on their own. Generate the
  full sentence and cut the phrase out of it (clip 09 was done this way).
- Emphasis: Kokoro can't stress a word. "Come home" (clip 10) is slower
  (speed 0.80) and 1.3× louder instead.
- Music sits at a **fixed** level under the voice (compressed first so quiet
  passages don't drop out). Sidechain ducking was tried and rejected: the music
  surged up in every gap.
- The closing line ends at ~1:15.6, as the music and picture fade.

## Voices

`tools/narration/say.py --voices` lists them. US male voices: `am_adam`,
`am_echo`, `am_eric`, `am_fenrir`, `am_liam`, `am_michael`, `am_onyx` (chosen),
`am_puck`, `am_santa`. None has a Southern accent; for that, a voice-cloning tool
with a consenting speaker would be needed (see the notes in the session history:
debpalash/VoiceStudio with OmniVoice — check the model-weights license before
commercial use).

## Music beds

| id | Music | License |
|----|-------|---------|
| `mood` | Grieg, "Morning Mood", Musopen Symphony | Public domain |
| `fireflies` | "Fireflies and Stardust", Kevin MacLeod (incompetech.com) | CC BY 4.0 (credit required) |
| `bama` | "Bama Country", Kevin MacLeod | CC BY 4.0 (credit required) |
| `cattails` | "Cattails", Kevin MacLeod | CC BY 4.0 (credit required) |

A Kevin MacLeod bed is the song's first 56 s crossfaded (2 s) into its last
26 s, so the real ending lands at the end of the film:

    d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "assets/audio/source/Cattails.mp3")
    ffmpeg -i "assets/audio/source/Cattails.mp3" -i "assets/audio/source/Cattails.mp3" -filter_complex \
      "[0]atrim=0:56,asetpts=N/SR/TB[h];[1]atrim=$(echo "$d - 26" | bc),asetpts=N/SR/TB[t];[h][t]acrossfade=d=2:c1=tri:c2=tri,atrim=0:78,aresample=48000" \
      -ac 2 -c:a aac -b:a 192k assets/audio/beds/cattails.m4a

Adding a new soundtrack: put its bed in `beds/`, add it to `beds` in
`narration.json` (gain ≈ 3 puts the compressed bed at about −29 dB), to
`SOUNDTRACKS` in `tools/build-media.sh`, and to the `#soundtracks` list (with its
credit) in `index.html`. Then `mix.py <id>` and `build-media.sh film`.
