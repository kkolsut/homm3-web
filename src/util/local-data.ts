import { getGameDB } from "./db";
import { loadResource } from "./resource";
import { VCMI_GAME_FILES } from "./store";

export interface Manifest {
    dataDir: string;
    files: { [name: string]: number };
    complete: boolean;
    music: number;
}

export async function fetchManifest(): Promise<Manifest | null> {
    try {
        const response = await fetch("/game/manifest.json", { cache: "no-cache" });
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch (e) {
        return null;
    }
}

// Pulls whichever required files are missing straight from the dev server, which
// reads them out of the local Heroes III install (see plugins/game-data.ts).
// Everything fetched is cached in IndexedDB, so this only pays the 233 MB cost
// on the first run.
//
// Returns the number of files loaded. Anything it cannot supply is left null for
// the manual file picker to handle.
export async function loadLocalGameFiles(
    manifest: Manifest,
    onFile: (name: string) => void,
    onProgress: (percent: number) => void,
): Promise<number> {
    const missing = Object.keys(VCMI_GAME_FILES)
        .filter((key) => VCMI_GAME_FILES[key].contents === null && key in manifest.files);

    if (missing.length === 0) {
        return 0;
    }

    const db = await getGameDB();
    let loaded = 0;

    for (const key of missing) {
        onFile(key);
        onProgress(0);
        const contents = new Uint8Array(await loadResource(
            "/game/data/" + key, "arraybuffer", onProgress, manifest.files[key],
        ) as ArrayBuffer);
        VCMI_GAME_FILES[key].contents = contents;
        await db.put(key, contents);
        loaded++;
    }

    return loaded;
}
