import { useDispatch, useSelector } from "react-redux";
import { getClient, State, uiSlice, VCMI_GAME_FILES } from "../util/store";
import { useT } from "../i18n";
import { useEffect, useState } from "preact/hooks";
import { getGameDB } from "../util/db";
import { ClientSelect } from "./reusable";
import { GameFiles } from "./game-files";
import { fetchManifest, loadLocalGameFiles, Manifest } from "../util/local-data";

export function DataSelect() {
    const t = useT();
    const dispatch = useDispatch();
    const [dbReady, setDBReady] = useState<boolean>(false);
    const [manifest, setManifest] = useState<Manifest | null>(null);
    const [localFile, setLocalFile] = useState<string>("");
    const [localProgress, setLocalProgress] = useState<number>(0);
    const [localError, setLocalError] = useState<string | null>(null);
    const [shortLegal, setShortLegal] = useState<boolean>(true);
    const gameFilesReady = useSelector((state: State) => state.ui.vcmiGameFilesReady);
    const noData = getClient(useSelector((state: State) => state.ui.client)).noData === true;

    useEffect(() => {
        if (noData) {
            setDBReady(true);
            dispatch(uiSlice.actions.step("LOADING_DATA"));
            return;
        }

        (async () => {
            // Anything cached from a previous run comes back for free.
            try {
                const db = await getGameDB();
                await db.forEach((key, value) => {
                    key = key.substring(key.lastIndexOf("/") + 1).toLocaleLowerCase();
                    if (key in VCMI_GAME_FILES) {
                        VCMI_GAME_FILES[key].contents = value;
                    }
                });
            } catch (e) {
                console.error(e);
            }

            // Whatever is still missing comes from the local install, served by
            // the dev server. The file picker below stays as a fallback.
            const manifest = await fetchManifest();
            setManifest(manifest);
            if (manifest !== null) {
                try {
                    await loadLocalGameFiles(manifest, setLocalFile, setLocalProgress);
                } catch (e: any) {
                    console.error(e);
                    setLocalError(e.message ?? "unknown error");
                }
            }

            setDBReady(true);
            dispatch(uiSlice.actions.checkVcmiGameFilesReady());
        })().catch((e) => {
            console.error(e);
            setLocalError(e.message ?? "unknown error");
            setDBReady(true);
        });
    }, []);

    return <div class="flex flex-col">
        <article class="py-0" role="tabpanel">
            {!shortLegal &&
                <>
                    <h3 class="my-4">{t("about")}</h3>
                    <p>
                        {t("legal_text")}
                    </p>
                    <p class="mt-2">
                        [1] — <a href="https://github.com/vcmi/"
                            target="_blank">VCMI</a> ;
                        [2] — <a href="https://www.gog.com/en/game/heroes_of_might_and_magic_3_complete_edition"
                            target="_blank">HoMM3</a>
                    </p>
                </>
            }
            {shortLegal &&
                <>
                    <p>
                        {t("legal_text_short")}
                    </p>
                    <a href="#" class="absolute px-1 -bottom-2 right-4 bg-white" onClick={(e) => {
                        e.preventDefault();
                        setShortLegal(false);
                    }}>
                        {t("more")}
                    </a>
                </>
            }
        </article>
        <ClientSelect />
        {!dbReady && manifest !== null &&
            <fieldset>
                <legend>{t("local_install")}</legend>
                <div class="flex flex-row">
                    <progress class="w-full mr-2" max="100" value={localProgress}></progress>
                    <span>{localProgress}%</span>
                </div>
                <p class="text-gray-600">{localFile}</p>
            </fieldset>
        }
        {localError && <p class="text-red-500 font-bold">{localError}</p>}
        {dbReady && <GameFiles />}
        {dbReady &&
            <div class="flex flex-row gap-1">
                <button class="min-w-4" onClick={() => dispatch(uiSlice.actions.step("ABOUT"))}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                        stroke-width="1.5" stroke="currentColor" class="size-5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025
                            3.071-1.025 4.242 0 1.172 1.025 1.172 2.687
                            0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45
                            1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                    </svg>
                </button>
                <div class="flex-grow"></div>
                <button class="self-end"
                    onClick={() => {
                        dispatch(uiSlice.actions.step("LOADING_DATA"));
                    }}
                    disabled={!gameFilesReady}
                >
                    {t("next")}
                </button>
            </div>
        }
        {
            !dbReady && manifest === null &&
            <p class="self-end font-bold my-1 text-gray-400">{t("loading_db")}</p>
        }
    </div >;
}
