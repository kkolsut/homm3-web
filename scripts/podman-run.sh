#!/usr/bin/env bash
#
# Builds the image (if needed) and runs the launcher on http://127.0.0.1:3000.
#
# Usage: scripts/podman-run.sh [-b] [game-dir]
#   -b   rebuild the image even if it already exists
#
# Environment:
#   HOMM3_DIR        path to the Heroes III install (default: ./Heroes of Might and Magic III Complete)
#   HOMM3_MUSIC_DIR  path to transcoded .ogg tracks  (default: ./.music)
#   PORT             host port to publish            (default: 3000)
#   BIND             host address to publish on      (default: 127.0.0.1)
#   HOMM3_ALLOWED_HOSTS  public hostnames to accept, comma-separated, or "*"
#                        (only needed behind a reverse proxy)
#   IMAGE            image tag                       (default: homm3-web)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${IMAGE:-homm3-web}"
PORT="${PORT:-3000}"
BIND="${BIND:-127.0.0.1}"
CONTAINER="${CONTAINER:-homm3-web}"

REBUILD=0
if [ "${1:-}" = "-b" ]; then
    REBUILD=1
    shift
fi

GAME_DIR="${1:-${HOMM3_DIR:-$REPO_DIR/Heroes of Might and Magic III Complete}}"
MUSIC_DIR="${HOMM3_MUSIC_DIR:-$REPO_DIR/.music}"

if [ ! -d "$GAME_DIR/Data" ]; then
    echo "error: no Data directory under '$GAME_DIR'" >&2
    echo "       pass the install path as an argument or set HOMM3_DIR" >&2
    exit 1
fi

if [ "$REBUILD" = 1 ] || ! podman image exists "$IMAGE"; then
    echo "==> building $IMAGE"
    podman build -t "$IMAGE" "$REPO_DIR"
fi

# The mounts are :ro,z — read-only, with a shared SELinux relabel so the
# container can read them on Fedora without stripping access from anything else.
MOUNTS=(-v "$GAME_DIR:/data/homm3:ro,z")
if [ -d "$MUSIC_DIR" ]; then
    MOUNTS+=(-v "$MUSIC_DIR:/data/music:ro,z")
else
    echo "note: no music directory at '$MUSIC_DIR' — run 'npm run music' for the soundtrack"
fi

ENV_ARGS=()
if [ -n "${HOMM3_ALLOWED_HOSTS:-}" ]; then
    ENV_ARGS+=(-e "HOMM3_ALLOWED_HOSTS=$HOMM3_ALLOWED_HOSTS")
fi

podman rm -f "$CONTAINER" >/dev/null 2>&1 || true

echo "==> http://$BIND:$PORT   (ctrl-c to stop)"
if [ "$BIND" != "127.0.0.1" ] && [ "$BIND" != "localhost" ]; then
    echo "    note: browsers only expose SharedArrayBuffer on https:// or localhost," >&2
    echo "          so reach this through a TLS proxy or an ssh tunnel, not by IP." >&2
fi
exec podman run --rm --name "$CONTAINER" \
    -p "$BIND:$PORT:3000" \
    "${MOUNTS[@]}" \
    "${ENV_ARGS[@]}" \
    "$IMAGE"
