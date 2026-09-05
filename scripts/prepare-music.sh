#!/usr/bin/env bash
#
# Transcodes the original soundtrack (MP3/*.mp3) to the .ogg files the VCMI wasm
# build streams at runtime. Optional — without it the game runs silent unless you
# point VITE_MUSIC_BASE at the upstream CDN.
#
# Usage: scripts/prepare-music.sh [game-dir]

set -euo pipefail

GAME_DIR="${1:-${HOMM3_DIR:-Heroes of Might and Magic III Complete}}"
SRC_DIR="$GAME_DIR/MP3"
OUT_DIR="${HOMM3_MUSIC_DIR:-.music}"

if [ ! -d "$SRC_DIR" ]; then
    echo "error: no MP3 directory at '$SRC_DIR'" >&2
    exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "error: ffmpeg is required" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"

converted=0
skipped=0
for src in "$SRC_DIR"/*; do
    [ -f "$src" ] || continue
    base="$(basename "$src")"
    case "${base,,}" in
        *.mp3) ;;
        *) continue ;;
    esac
    # The engine asks for the basename with an .ogg extension, keeping the
    # original casing (AITheme0.ogg, AITHEME1.ogg), so preserve it exactly.
    out="$OUT_DIR/${base%.*}.ogg"
    if [ -f "$out" ]; then
        skipped=$((skipped + 1))
        continue
    fi
    echo "  $base -> $(basename "$out")"
    ffmpeg -loglevel error -y -i "$src" -vn -c:a libvorbis -q:a 4 "$out"
    converted=$((converted + 1))
done

echo "done: $converted converted, $skipped already present, in '$OUT_DIR'"
