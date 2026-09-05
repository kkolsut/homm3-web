import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { gameData } from "./plugins/game-data";

// COOP/COEP are required: the VCMI wasm build uses threads, so it needs
// SharedArrayBuffer, which is only exposed to cross-origin-isolated pages.
const crossOriginIsolation = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
    plugins: [preact(), gameData()],
    server: {
        port: 3000,
        host: "127.0.0.1",
        headers: crossOriginIsolation,
    },
    preview: {
        port: 3000,
        host: "127.0.0.1",
        headers: crossOriginIsolation,
    },
});
