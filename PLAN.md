# Heroes of Might and Magic III — Web Runner

## Context

Play a local, legally-owned copy of **Heroes of Might and Magic III Complete** in a
browser. The user has the original install (Win32, 1999/2000) at
`Heroes of Might and Magic III Complete/`.

> **Superseded plan.** The first version of this document described running
> *Might and Magic III* (DOS, 1991) under js-dos/DOSBox. That does not apply:
> `Heroes III.exe` is a `PE32 executable for MS Windows 4.00 (GUI), Intel i386`,
> and DOSBox executes DOS programs only. No DOSBox configuration can run it.

## Approach: VCMI compiled to WebAssembly

[VCMI](https://github.com/vcmi/vcmi) is an open-source reimplementation of the
HoMM3 engine. It does not use the original executable at all — it reads the
original *data* files. A WebAssembly port exists and is maintained by *caiiiycuk*
(the author of js-dos):

- **Engine** — [`caiiiycuk/vcmi-wasm`](https://github.com/caiiiycuk/vcmi-wasm),
  with builds published to `caiiiycuk.github.io/vcmi-wasm/`.
- **Frontend** — [`caiiiycuk/vcmi-html5-launcher`](https://github.com/caiiiycuk/vcmi-html5-launcher)
  (GPL-2.0), vendored into `src/` here and adapted.

Mainline `vcmi/vcmi` has no Emscripten support; the fork is the only option.

### Why the engine is loaded from GitHub Pages

The launcher can also point at newer builds (1.6.7, 1.6.8) on `br.cdn.dos.zone`.
Those are unusable when self-hosting: the page must be **cross-origin isolated**
(`COOP: same-origin` + `COEP: require-corp`) so the threaded wasm build can use
`SharedArrayBuffer`, and under `require-corp` a cross-origin subresource must pass
a CORS check. `br.cdn.dos.zone` sends no `Access-Control-Allow-Origin`;
`caiiiycuk.github.io` sends `*`. So `src/util/store.ts` lists only the GitHub Pages
builds, defaulting to **1.6.5-wasm-2**.

## Structure

```
homm3-web/
├── index.html                  # Page shell
├── vite.config.ts              # COOP/COEP headers + game-data plugin
├── plugins/game-data.ts        # Serves the local install at /game/*
├── scripts/prepare-music.sh    # MP3/ -> .ogg transcode (ffmpeg)
├── src/                        # Vendored launcher (GPL-2.0), adapted
│   ├── util/local-data.ts      # Auto-loads game files from /game/*
│   ├── util/store.ts           # Client list, redux state
│   └── util/module.ts          # Emscripten module glue
├── .music/                     # Generated soundtrack (gitignored)
└── Heroes of Might and Magic III Complete/   # Original game (gitignored)
```

## Data flow

The engine needs exactly six files out of `Data/` (233 MB total):

| File | Size |
|---|---|
| `H3bitmap.lod` | 100.8 MB |
| `H3sprite.lod` | 62.0 MB |
| `H3ab_bmp.lod` | 42.0 MB |
| `Heroes3.snd` | 14.5 MB |
| `H3ab_spr.lod` | 11.4 MB |
| `H3ab_ahd.snd` | 1.4 MB |

Not required: `Heroes3/Heroes3.vid` (490 MB of cutscenes — the engine is started
with `--disable-video`), the 76 MB `MP3/` folder (used only as a transcode source
for the optional soundtrack), the map editors, and the PDFs.

Upstream makes the user pick those files by hand every time. Here,
`plugins/game-data.ts` serves them straight off disk and `src/util/local-data.ts`
pulls whatever is missing on first load, caching into IndexedDB so the 233 MB is
paid once. The manual file picker remains as a fallback.

Endpoints, all dev/preview-server only — nothing is copied into `dist/`:

- `GET /game/manifest.json` — which required files were found, and their sizes
- `GET /game/data/<basename>` — an original data file (allowlisted, case-insensitive)
- `GET /game/async/Mp3/<track>.ogg` — a transcoded soundtrack track

## Changes made to the vendored launcher

1. **Domain lock removed** — upstream `main.tsx` redirected any host that was not
   `dos.zone`/`localhost` to `sec.dos.zone`.
2. **dos.zone account integration removed** — the premium-key auth screen, cloud
   save upload/restore (`presign-put`, Yandex object storage), and the token
   plumbing in the redux store.
3. **Global leaderboard removed** — `loadHighscores` returned a table fetched from
   a dos.zone API; it now hands the engine an empty table so the screen works offline.
4. **Music made local** — tracks streamed from `cdn.dos.zone` by default; the base
   URL is now `VITE_MUSIC_BASE`, defaulting to the local `/game/async`.
   A failed track load is caught and logged rather than left to reject.
5. **Non-CORS clients removed** — see above.
6. **Analytics removed** — a Yandex Metrika tracking pixel in `index.html`.
7. **Auto-loading added** — `local-data.ts` plus the manifest-driven progress UI.
8. **Build fixed** — `tsconfig.node.json` was never actually type-checked upstream
   (`tsc` does not build project references without `-b`); it now covers
   `plugins/` and is checked by `npm run build`. Dev server moved off self-signed
   HTTPS, since `localhost` is already a secure context.

## Verification

Confirmed:

- `npm run build` — clean `tsc` (both configs), clean eslint, no unresolved assets.
- `/game/manifest.json` reports `complete: true` with all six files and `music: 57`.
- Data and music endpoints serve correct sizes and content types; the
  case-insensitive lookup handles `AITheme0` vs `AITHEME1` correctly.
- Path traversal on both endpoints returns 404 (raw and percent-encoded).
- Cross-origin isolation headers present on the document.
- Every 1.6.5 engine asset returns 200 with `Access-Control-Allow-Origin: *`.

Still needs a human at a browser:

- The game actually rendering, keyboard/mouse input, sound, and save/load.
