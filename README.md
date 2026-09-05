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

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `HOMM3_DIR` | `Heroes of Might and Magic III Complete` | Path to the game install |
| `HOMM3_MUSIC_DIR` | `.music` | Where transcoded `.ogg` tracks live |
| `VITE_MUSIC_BASE` | `/game/async` | Music source; set to `https://cdn.dos.zone/custom/vcmi/async` to stream from upstream and skip `npm run music` |

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
