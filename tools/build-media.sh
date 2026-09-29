#!/usr/bin/env bash
# Builds web-sized media from the raw drone deliverables (which are gitignored):
#   assets/photos/*.jpg  -> assets/media/photos/<n>-{800,1600}.webp
#   assets/videos/*.mp4  -> assets/media/video/<name>/ (HLS ladder + poster)
#
# Usage: tools/build-media.sh [photos|concepts|film|loops|all]
#
# Sizes are deliberately small while we're on GitHub Pages. To raise the
# ceiling later, add rungs to LADDER (e.g. "1080 1920 5000k").
set -euo pipefail
cd "$(dirname "$0")/.."

SRC_PHOTOS=assets/photos
SRC_VIDEOS=assets/videos
OUT=assets/media
TMP=${TMPDIR:-/tmp}/sadler-media
mkdir -p "$TMP"

# height width video-bitrate
LADDER=(
  "360 640 700k"
  "540 960 1400k"
  "720 1280 2600k"
)

# Mild grade: the footage is flat/hazy straight out of the drone.
GRADE="eq=contrast=1.06:saturation=1.12:gamma=0.98"

clip() { echo "$SRC_VIDEOS/SadlerFarms_083026_VideoClip ($1).mp4"; }

# check_range <clip> <start> <duration>: fail loudly if the cut runs past the end
check_range() {
  local len
  len=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$(clip "$1")")
  if (( $(echo "$2 + $3 > $len" | bc) )); then
    echo "clip $1 is ${len}s; can't cut $3s from $2s" >&2; exit 1
  fi
}

# ---------------------------------------------------------------- photos
PHOTOS=(41 42 43 5 7 12 13 22 25 27 28 30 44 48 53 56 59 61 62)

build_photos() {
  mkdir -p "$OUT/photos"
  for n in "${PHOTOS[@]}"; do
    src="$SRC_PHOTOS/SadlerFarms_083026_AerialPhoto ($n).jpg"
    for w in 800 1600; do
      magick "$src" -auto-orient -resize "${w}x" -strip -quality 72 "$OUT/photos/$n-$w.webp"
    done
  done
  # Social/OG image (JPEG for crawler compatibility)
  magick "$SRC_PHOTOS/SadlerFarms_083026_AerialPhoto (41).jpg" -resize 1600x -strip -quality 78 assets/img/hero.jpg
}

# ---------------------------------------------------------------- concepts
# Artist's-concept images (made in ChatGPT from our photos 41, 42, 62, 22).
# Sources live in assets/concepts/ (committed, excluded from the site build).
build_concepts() {
  mkdir -p "$OUT/concepts"
  for src in assets/concepts/*.png; do
    n=$(basename "$src" .png)
    magick "$src" -resize 800x -strip -quality 74 "$OUT/concepts/$n-800.webp"
    magick "$src" -strip -quality 74 "$OUT/concepts/$n-1440.webp"
  done
}

# ---------------------------------------------------------------- HLS
# hls <input.mp4> <outdir> <with-audio:0|1>
hls() {
  local in=$1 dir=$2 audio=$3
  rm -rf "$dir"; mkdir -p "$dir"
  local n=${#LADDER[@]}
  local split="[0:v]split=$n" maps=() vsm=() i=0
  for i in $(seq 0 $((n - 1))); do split+="[v$i]"; done
  local fc="$split"
  for i in $(seq 0 $((n - 1))); do
    read -r h w br <<<"${LADDER[$i]}"
    fc+=";[v$i]scale=$w:$h:flags=lanczos[o$i]"
    maps+=(-map "[o$i]" -c:v:$i libx264 -profile:v:$i high -preset:v:$i slow
           -b:v:$i "$br" -maxrate:v:$i "$br" -bufsize:v:$i "$br")
    if [[ $audio == 1 ]]; then
      maps+=(-map 0:a); vsm+=("v:$i,a:$i,name:${h}p")
    else
      vsm+=("v:$i,name:${h}p")
    fi
  done
  local aopts=(-an)
  [[ $audio == 1 ]] && aopts=(-c:a aac -b:a 96k -ac 2)
  ffmpeg -v error -y -i "$in" -filter_complex "$fc" "${maps[@]}" "${aopts[@]}" \
    -r 30 -g 60 -keyint_min 60 -sc_threshold 0 -pix_fmt yuv420p \
    -f hls -hls_time 4 -hls_playlist_type vod -hls_segment_type mpegts \
    -hls_segment_filename "$dir/%v/seg%03d.ts" -master_pl_name master.m3u8 \
    -var_stream_map "${vsm[*]}" "$dir/%v/index.m3u8"
  ffmpeg -v error -y -ss 1 -i "$in" -frames:v 1 -vf scale=1280:-2 -q:v 4 "$dir/poster.jpg"
}

# ---------------------------------------------------------------- film
# Montage: clip, start (s), duration (s). Consecutive shots crossfade by XF.
FILM=(
  "8 4 7"
  "10 8 7"
  "2 6 7"
  "4 8 7"
  "12 4 7"
  "15 7 7"
  "14 6 7"
  "13 6 7"
  "19 8 7"
  "21 15 7"
  "3 40 8"
  "9 72 11"
)
XF=1

build_film() {
  local inputs=() fc="" i=0 prev="" offset=0
  for s in "${FILM[@]}"; do
    read -r c st d <<<"$s"
    check_range "$c" "$st" "$d"
    inputs+=(-ss "$st" -t "$d" -i "$(clip "$c")")
    fc+="[$i:v]fps=30,scale=1920:1080,$GRADE,setpts=PTS-STARTPTS,format=yuv420p[s$i];"
    i=$((i + 1))
  done
  local total=0
  for j in $(seq 0 $((i - 1))); do
    read -r _ _ d <<<"${FILM[$j]}"
    if [[ $j == 0 ]]; then prev="s0"; total=$d; continue; fi
    offset=$((total - XF))
    fc+="[$prev][s$j]xfade=transition=fade:duration=$XF:offset=$offset[x$j];"
    prev="x$j"; total=$((total + d - XF))
  done
  fc+="[$prev]fade=t=in:st=0:d=1.5,fade=t=out:st=$((total - 2)):d=2[vout]"

  # Video only; the soundtracks are separate, switchable HLS audio renditions.
  ffmpeg -v error -y "${inputs[@]}" -filter_complex "$fc" -map "[vout]" -an \
    -c:v libx264 -crf 16 -preset slow "$TMP/film.mp4"
  hls_alt_audio "$TMP/film.mp4" "$OUT/video/film" "$total"
}

# Film soundtracks: narration mixed over a music bed (see assets/audio/README.md).
# id|label; the first one is the default. Files: assets/audio/soundtracks/<id>.m4a
SOUNDTRACKS=(
  "mood|Morning Mood"
  "fireflies|Fireflies and Stardust"
  "bama|Bama Country"
  "cattails|Cattails"
)

# hls_alt_audio <video.mp4> <outdir> <seconds>: the LADDER video renditions plus
# one audio rendition per soundtrack, all in a single audio group, so players
# can switch soundtracks without reloading video.
hls_alt_audio() {
  local in=$1 dir=$2 total=$3
  rm -rf "$dir"; mkdir -p "$dir"
  local n=${#LADDER[@]} ins=(-i "$in") fc maps=() vsm=() i k=1
  fc="[0:v]split=$n"
  for i in $(seq 0 $((n - 1))); do fc+="[v$i]"; done
  for i in $(seq 0 $((n - 1))); do
    read -r h w br <<<"${LADDER[$i]}"
    fc+=";[v$i]scale=$w:$h:flags=lanczos[o$i]"
    maps+=(-map "[o$i]" -c:v:$i libx264 -profile:v:$i high -preset:v:$i slow
           -b:v:$i "$br" -maxrate:v:$i "$br" -bufsize:v:$i "$br")
    vsm+=("v:$i,agroup:aud,name:${h}p")
  done
  for i in "${!SOUNDTRACKS[@]}"; do
    local id=${SOUNDTRACKS[$i]%%|*}
    ins+=(-i "assets/audio/soundtracks/$id.m4a")
    fc+=";[$k:a]atrim=0:$total,loudnorm=I=-18:linear=true,aresample=48000[a$i]"
    maps+=(-map "[a$i]")
    local def=""; [[ $i == 0 ]] && def=",default:yes"
    vsm+=("a:$i,agroup:aud,name:$id,language:en$def")
    k=$((k + 1))
  done
  ffmpeg -v error -y "${ins[@]}" -filter_complex "$fc" "${maps[@]}" \
    -c:a aac -b:a 128k -ac 2 \
    -r 30 -g 60 -keyint_min 60 -sc_threshold 0 -pix_fmt yuv420p \
    -f hls -hls_time 4 -hls_playlist_type vod -hls_segment_type mpegts \
    -hls_segment_filename "$dir/%v/seg%03d.ts" -master_pl_name master.m3u8 \
    -var_stream_map "${vsm[*]}" "$dir/%v/index.m3u8"
  ffmpeg -v error -y -ss 1 -i "$in" -frames:v 1 -vf scale=1280:-2 -q:v 4 "$dir/poster.jpg"
}

# ---------------------------------------------------------------- loops
# name clip start duration   (silent background loops)
LOOPS=(
  "waterfront 10 12 10"
  "cove 14 12 10"
  "meadow 15 4 10"
  "land 1 20 10"
)

build_loops() {
  for s in "${LOOPS[@]}"; do
    read -r name c st d <<<"$s"
    check_range "$c" "$st" "$d"
    ffmpeg -v error -y -ss "$st" -t "$d" -i "$(clip "$c")" -an \
      -vf "fps=30,scale=1920:1080,$GRADE,format=yuv420p" \
      -c:v libx264 -crf 16 -preset slow "$TMP/$name.mp4"
    hls "$TMP/$name.mp4" "$OUT/video/$name" 0
  done
}

case ${1:-all} in
  photos) build_photos ;;
  concepts) build_concepts ;;
  film)   build_film ;;
  loops)  build_loops ;;
  all)    build_photos; build_concepts; build_film; build_loops ;;
  *) echo "usage: $0 [photos|concepts|film|loops|all]" >&2; exit 1 ;;
esac
du -sh "$OUT"
