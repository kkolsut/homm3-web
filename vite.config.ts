import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { gameData } from "./plugins/game-data";

// COOP/COEP are required: the VCMI wasm build uses threads, so it needs
// SharedArrayBuffer, which is only exposed to cross-origin-isolated pages.
const crossOriginIsolation = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
};

// Vite rejects requests whose Host header is a domain name it was not told
// about, which is what a reverse proxy in front of a remote install sends. List
// the public hostnames in HOMM3_ALLOWED_HOSTS (comma-separated), or "*" to turn
// the check off. Localhost and bare IPs are always accepted, so the local
// workflow needs none of this.
function allowedHosts(): string[] | true | undefined {
    const value = (process.env.HOMM3_ALLOWED_HOSTS ?? "").trim();
    if (value === "*") {
        return true;
    }
    const hosts = value.split(",").map((host) => host.trim()).filter((host) => host !== "");
    return hosts.length > 0 ? hosts : undefined;
}

export default defineConfig({
    plugins: [preact(), gameData()],
    server: {
        port: 3000,
        host: "127.0.0.1",
        headers: crossOriginIsolation,
        allowedHosts: allowedHosts(),
    },
    preview: {
        port: 3000,
        host: "127.0.0.1",
        headers: crossOriginIsolation,
        allowedHosts: allowedHosts(),
    },
});
