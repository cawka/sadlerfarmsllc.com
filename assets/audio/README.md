# Film soundtrack

`film.m4a` is the audio track muxed into the hero film by `tools/build-media.sh`.

Current track: the opening (0:00–1:18) of **Edvard Grieg, "Morning Mood"** from
*Peer Gynt Suite No. 1, Op. 46*, performed by the **Musopen Symphony**.
The recording is public domain; no attribution is required, but we credit it in the footer anyway.
Source: <https://commons.wikimedia.org/wiki/File:Grieg_-_Peer_Gynt_Suite_No._1,_Op._46_-_I._Morning_Mood_(Musopen_Symphony).flac>

To regenerate from the original FLAC (kept locally in `source/`, gitignored):

    ffmpeg -i source/grieg-morning-mood-musopen.flac -t 78 \
      -af "afade=t=in:d=0.5,afade=t=out:st=75:d=3" -ac 2 -ar 48000 -c:a aac -b:a 192k film.m4a

When the narration is recorded, mix it over the music (duck the music under the
voice) and replace `film.m4a`, then run `tools/build-media.sh film`.
