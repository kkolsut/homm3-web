# homm3-web

Play your own copy of **Heroes of Might and Magic III Complete** in a browser,
using the [VCMI](https://github.com/vcmi/vcmi) engine compiled to WebAssembly.

The original `Heroes III.exe` is never run — VCMI is a reimplementation of the
engine that reads the original data files. See [PLAN.md](PLAN.md) for the design.

## Requirements

- Node 20+
- Your own Heroes III install (this repo expects it at
  `Heroes of Might and Magic III Complete/`, overridable with `HOMM3_DIR`)
- `ffmpeg`, only for the optional soundtrack step
- A browser with `SharedArrayBuffer`: current Chrome, Firefox, Edge, or Safari

## Run

```bash
npm install
npm run music     # optional: transcode MP3/ -> .music/*.ogg (~1 min)
npm run dev
```

Then open the URL it prints (http://127.0.0.1:3000, or the next free port).

On first load the page pulls the six required data files (233 MB) from your local
install and caches them in IndexedDB, so subsequent loads are fast. Pick a
resolution, press **Start the game**.

The engine itself (~2.4 MB wasm + data packages) is fetched from
`caiiiycuk.github.io/vcmi-wasm`, so the first run needs a network connection.
Everything after that is local, including music.

## Run in a container (podman)

```bash
scripts/podman-run.sh          # builds the image on first run, then serves :3000
scripts/podman-run.sh -b       # force a rebuild after changing the sources
```

The image contains only the built launcher and the vite preview server that
applies the COOP/COEP headers. The game install and the soundtrack stay on the
host and are bind-mounted read-only:

| Host | Container | Env in the image |
|---|---|---|
| `Heroes of Might and Magic III Complete/` | `/data/homm3` | `HOMM3_DIR` |
| `.music/` | `/data/music` | `HOMM3_MUSIC_DIR` |

Override with `HOMM3_DIR`, `HOMM3_MUSIC_DIR`, `PORT`, or by passing the install
path as an argument:

```bash
HOMM3_DIR=/games/heroes3 PORT=8080 scripts/podman-run.sh
```

The raw equivalent, if you would rather not use the script:

```bash
podman build -t homm3-web .
podman run --rm -p 127.0.0.1:3000:3000 \
    -v "$PWD/Heroes of Might and Magic III Complete:/data/homm3:ro,z" \
    -v "$PWD/.music:/data/music:ro,z" \
    homm3-web
```

Notes:

- `z` on the mounts is the SELinux shared relabel; without it Fedora denies the
  container read access to the install.
- `VITE_MUSIC_BASE` is baked in at build time, so switching to the upstream CDN
  is a build argument: `podman build --build-arg
  VITE_MUSIC_BASE=https://cdn.dos.zone/custom/vcmi/async -t homm3-web .`
- Saves live in the browser's IndexedDB, not in the container, so rebuilding or
  removing the image never touches them — as long as you keep the same origin
  (host and port).
- If the account running podman has no `/etc/subuid` range (common with
  LDAP/SSSD logins), image extraction fails with *"potentially insufficient UIDs
  or GIDs available in user namespace"*. Either give it a range
  (`sudo usermod --add-subuids 100000-165535 --add-subgids 100000-165535 $USER`
  then `podman system migrate`), or keep the single-UID workaround in
  `~/.config/containers/storage.conf`:

  ```toml
  [storage.options.overlay]
  ignore_chown_errors = "true"
  ```

## Run on a remote podman host

Two things do not travel with the image: the game data (bind-mounted, never baked
in) and cross-origin isolation (browsers only expose `SharedArrayBuffer` on
`https://` or `localhost`, so plain `http://server-ip:3000` fails with the
`SharedArrayBuffer` error the launcher shows).

**1. Ship the image**

```bash
podman save homm3-web | zstd | ssh user@server 'zstd -d | podman load'
```

Or `podman image scp localhost/homm3-web user@server::` if podman is set up on
both ends, or just clone the repo on the server and `podman build -t homm3-web .`
there.

**2. Ship the data.** Only `Data/` is read, so the 490 MB `Heroes3.vid` and the
manuals can stay home:

```bash
rsync -a --info=progress2 \
    "Heroes of Might and Magic III Complete/Data" user@server:/srv/homm3/game/
rsync -a .music/ user@server:/srv/homm3/music/          # optional, 73 MB
```

**3. Reach it over HTTPS.** Pick one:

*SSH tunnel* — nothing to configure, and `localhost` counts as a secure context:

```bash
# on the server
HOMM3_DIR=/srv/homm3/game HOMM3_MUSIC_DIR=/srv/homm3/music scripts/podman-run.sh
# on your machine
ssh -N -L 3000:127.0.0.1:3000 user@server   # then open http://127.0.0.1:3000
```

*TLS reverse proxy* — for a server with a real domain. Keep the container on
loopback and let the proxy own the certificate:

```bash
HOMM3_DIR=/srv/homm3/game HOMM3_MUSIC_DIR=/srv/homm3/music \
    HOMM3_ALLOWED_HOSTS=heroes.example.com scripts/podman-run.sh
```

```caddyfile
heroes.example.com {
    # basic_auth is worth it: the launcher has no auth of its own, and /game/data
    # hands out your install to anyone who can reach it.
    reverse_proxy 127.0.0.1:3000
}
```

`HOMM3_ALLOWED_HOSTS` is required here — vite refuses requests whose `Host`
header is an unknown domain name (bare IPs and localhost are always allowed).
Comma-separate several, or set `*` to disable the check. The proxy must pass
`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` through
untouched; Caddy and nginx both do by default.

`BIND=0.0.0.0 scripts/podman-run.sh` exposes the port on all interfaces if the
proxy runs elsewhere — but that origin still needs to be HTTPS to work.

**Keeping it up.** For an always-on server, a Quadlet unit at
`~/.config/containers/systemd/homm3-web.container` beats a shell script:

```ini
[Container]
Image=localhost/homm3-web
PublishPort=127.0.0.1:3000:3000
Volume=/srv/homm3/game:/data/homm3:ro,z
Volume=/srv/homm3/music:/data/music:ro,z
Environment=HOMM3_ALLOWED_HOSTS=heroes.example.com

[Service]
Restart=always

[Install]
WantedBy=default.target
```

Then `systemctl --user daemon-reload && systemctl --user start homm3-web`
(`loginctl enable-linger $USER` to keep it running after you log out).

**Saves.** IndexedDB is per-origin, so moving from `localhost` to a domain starts
you with an empty save list. Export first with *Download saves* on the launch
screen, then re-import the zip with *Install DLC (ZIP)* on the new origin.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `HOMM3_DIR` | `Heroes of Might and Magic III Complete` | Path to the game install |
| `HOMM3_MUSIC_DIR` | `.music` | Where transcoded `.ogg` tracks live |
| `VITE_MUSIC_BASE` | `/game/async` | Music source; set to `https://cdn.dos.zone/custom/vcmi/async` to stream from upstream and skip `npm run music` |
| `HOMM3_ALLOWED_HOSTS` | unset | Comma-separated public hostnames the server may be reached under, or `*`. Only needed behind a reverse proxy |

Example:

```bash
HOMM3_DIR=/games/heroes3 npm run dev
```

## Notes

- Saves live in IndexedDB. **Start the game** screen has a *Download saves*
  button that exports them as a zip; *Install DLC (ZIP)* imports a zip back into
  the virtual filesystem — that is also how you add extra maps (`Maps/*.h3m`).
- Cutscenes are disabled (`--disable-video`); the 490 MB `Heroes3.vid` is unused.
- The page must be cross-origin isolated. `npm run dev` and `npm run preview` set
  `COOP: same-origin` and `COEP: require-corp`; any other host must do the same
  or the wasm build will fail with a `SharedArrayBuffer` error.
- Multiplayer defaults to upstream's `netherlands.dos.zone` lobby; edit the
  config JSON on the launch screen to change it.

## Licensing

The launcher UI under `src/` is vendored from
[vcmi-html5-launcher](https://github.com/caiiiycuk/vcmi-html5-launcher) and is
**GPL-2.0** (see `LICENSE`). VCMI itself is GPL-2.0.

The game data is not included and is not redistributable — `.gitignore` keeps the
install and the transcoded soundtrack out of the repository. You need your own copy.
