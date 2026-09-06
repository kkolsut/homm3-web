# Builds the launcher and serves it with the same middleware `npm run dev` uses:
# vite's preview server, which applies the COOP/COEP headers the wasm build needs
# and mounts plugins/game-data.ts at /game/*.
#
# The game itself is never baked into the image — it is bind-mounted at runtime:
#   /data/homm3  your Heroes III install (read-only)
#   /data/music  the transcoded soundtrack from `npm run music` (read-only, optional)
#
# See scripts/podman-run.sh for the invocation.

FROM docker.io/library/node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Baked in at build time (import.meta.env). Point it at
# https://cdn.dos.zone/custom/vcmi/async to stream music from upstream instead of
# from the mounted .music directory.
ARG VITE_MUSIC_BASE=/game/async
ENV VITE_MUSIC_BASE=$VITE_MUSIC_BASE
RUN npm run build


FROM docker.io/library/node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOMM3_DIR=/data/homm3 \
    HOMM3_MUSIC_DIR=/data/music

# vite (a devDependency) is what serves the build, so the whole tree comes along.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/plugins ./plugins
COPY --from=build /app/vite.config.ts /app/package.json ./

EXPOSE 3000

CMD ["node_modules/.bin/vite", "preview", "--host", "0.0.0.0", "--port", "3000"]
