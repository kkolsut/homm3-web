import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Connect, Plugin } from "vite";

// The six original files the VCMI wasm build needs, keyed by the lowercase
// basename that the launcher uses internally (see VCMI_GAME_FILES in store.ts).
export const REQUIRED_DATA_FILES = [
    "h3ab_ahd.snd",
    "h3ab_bmp.lod",
    "h3ab_spr.lod",
    "h3bitmap.lod",
    "h3sprite.lod",
    "heroes3.snd",
];

export const DEFAULT_GAME_DIR = "Heroes of Might and Magic III Complete";

// Resolves a case-insensitive filename inside a directory. The original install
// mixes cases freely (Heroes3.snd, H3ab_ahd.snd, AITHEME1.MP3), and we are on a
// case-sensitive filesystem, so every lookup has to go through here.
function resolveCaseInsensitive(dir: string, name: string): string | null {
    if (!existsSync(dir)) {
        return null;
    }
    const wanted = name.toLowerCase();
    for (const entry of readdirSync(dir)) {
        if (entry.toLowerCase() === wanted) {
            return join(dir, entry);
        }
    }
    return null;
}

function serveFile(res: Parameters<Connect.NextHandleFunction>[1], path: string, contentType: string) {
    const { size } = statSync(path);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", size);
    // The page runs under COEP: require-corp. These are same-origin, but being
    // explicit keeps them loadable if the launcher is ever embedded.
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Cache-Control", "no-cache");
    createReadStream(path).pipe(res);
}

// Serves the user's own Heroes III install straight off disk at /game/*, so the
// 233 MB of .lod/.snd data is never copied into public/ or into dist/.
//
//   /game/manifest.json      which required files were actually found
//   /game/data/<basename>    an original data file
//   /game/async/Mp3/<x>.ogg  a transcoded soundtrack track (see scripts/prepare-music.sh)
export function gameData(options: { gameDir?: string; musicDir?: string } = {}): Plugin {
    const gameDir = options.gameDir ?? process.env.HOMM3_DIR ?? DEFAULT_GAME_DIR;
    const musicDir = options.musicDir ?? process.env.HOMM3_MUSIC_DIR ?? ".music";
    const dataDir = join(gameDir, "Data");

    const middleware: Connect.NextHandleFunction = (req, res, next) => {
        const url = (req.url ?? "").split("?")[0];

        if (url === "/game/manifest.json") {
            const found: Record<string, number> = {};
            for (const name of REQUIRED_DATA_FILES) {
                const path = resolveCaseInsensitive(dataDir, name);
                if (path !== null) {
                    found[name] = statSync(path).size;
                }
            }
            const body = JSON.stringify({
                gameDir,
                dataDir,
                files: found,
                complete: REQUIRED_DATA_FILES.every((name) => name in found),
                music: existsSync(musicDir) ?
                    readdirSync(musicDir).filter((f) => f.endsWith(".ogg")).length : 0,
            });
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-cache");
            res.end(body);
            return;
        }

        if (url.startsWith("/game/data/")) {
            const name = decodeURIComponent(url.substring("/game/data/".length));
            if (!REQUIRED_DATA_FILES.includes(name.toLowerCase())) {
                res.statusCode = 404;
                res.end("not a required data file");
                return;
            }
            const path = resolveCaseInsensitive(dataDir, name);
            if (path === null) {
                res.statusCode = 404;
                res.end("not found in " + dataDir);
                return;
            }
            serveFile(res, path, "application/octet-stream");
            return;
        }

        if (url.startsWith("/game/async/Mp3/")) {
            const name = decodeURIComponent(url.substring("/game/async/Mp3/".length));
            if (name.includes("/") || !name.endsWith(".ogg")) {
                res.statusCode = 404;
                res.end("bad track");
                return;
            }
            const path = resolveCaseInsensitive(musicDir, name);
            if (path === null) {
                res.statusCode = 404;
                res.end("track not prepared");
                return;
            }
            serveFile(res, path, "audio/ogg");
            return;
        }

        next();
    };

    return {
        name: "homm3-game-data",
        configureServer(server) {
            server.middlewares.use(middleware);
        },
        configurePreviewServer(server) {
            server.middlewares.use(middleware);
        },
    };
}
