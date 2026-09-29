# Film soundtrack

The film's soundtracks live in `soundtracks/<id>.m4a`: the same narration
(`narration.txt`) mixed over different music. `tools/build-media.sh film`
packages them as alternate HLS audio renditions of one video (order and labels
in `SOUNDTRACKS` there), so the site can switch music without reloading video.
The first one is the default.

On the site, a hidden picker switches soundtracks: tap the logo mark 5 times,
or open the page with `?soundtrack=<id>`. The footer credit follows the choice
(the list and credits are in the `#soundtracks` JSON in `index.html`).

| id | Music | License |
|----|-------|---------|
| `mood` | Grieg, "Morning Mood", Musopen Symphony | Public domain |
| `fireflies` | "Fireflies and Stardust", Kevin MacLeod (incompetech.com) | CC BY 4.0 (credit required) |
| `bama` | "Bama Country", Kevin MacLeod (incompetech.com) | CC BY 4.0 (credit required) |
| `cattails` | "Cattails", Kevin MacLeod (incompetech.com) | CC BY 4.0 (credit required) |

The Kevin MacLeod beds are the track's first 56 s crossfaded (2 s) into its
last 26 s, so the real ending lands as the film fades out. Music sources are
kept locally in `source/` (gitignored).

## Morning Mood bed (`music.m4a`)

The opening (0:00–1:18) of **Edvard Grieg, "Morning Mood"** from
*Peer Gynt Suite No. 1, Op. 46*, performed by the **Musopen Symphony**.
The recording is public domain; no attribution is required, but we credit it in the footer anyway.
Source: <https://commons.wikimedia.org/wiki/File:Grieg_-_Peer_Gynt_Suite_No._1,_Op._46_-_I._Morning_Mood_(Musopen_Symphony).flac>

To regenerate `music.m4a` from the original FLAC (kept locally in `source/`, gitignored):

    ffmpeg -i source/grieg-morning-mood-musopen.flac -t 78 \
      -af "afade=t=in:d=0.5,afade=t=out:st=75:d=3" -ac 2 -ar 48000 -c:a aac -b:a 192k music.m4a

## Narration

The narration is an AI voice ("am_onyx" from Kokoro TTS v1.0, an open-source,
Apache-2.0 model). `narration.txt` has the lines and their start times. For a
human voice-over, record the same lines, then mix them over the music:

    ffmpeg -i music.m4a -i vo0.wav ... -i voN.wav -filter_complex "
      [1]aresample=48000,adelay=1200|1200[a1]; ... (one adelay per line, in ms) ...
      [a1]...[aN]amix=inputs=N:normalize=0,pan=stereo|c0=c0|c1=c0,highpass=f=70,
        acompressor=threshold=-18dB:ratio=3,volume=1.6,apad=whole_dur=78[vo];
      [0]acompressor=threshold=0.015:ratio=10:attack=300:release=3000:knee=6,
        volume=3.2,afade=t=out:st=75:d=3[mus];
      [mus][vo]amix=inputs=2:normalize=0,alimiter=limit=0.95,atrim=0:78" \
      -c:a aac -b:a 192k film.m4a

then run `tools/build-media.sh film`.
