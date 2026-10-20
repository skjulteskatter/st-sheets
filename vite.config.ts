import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        // Precaches the app shell so it starts without network. API responses
        // are cached by the app itself (services/offline), not the service worker.
        VitePWA({
            registerType: "autoUpdate",
            // public/manifest.json is linked from index.html
            manifest: false,
            includeAssets: ["manifest.json", "st.ico", "img/*.svg", "icons/*.png"],
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,svg,png}"],
                // Firebase auth handler pages must always hit the network
                navigateFallbackDenylist: [/^\/__\//],
            },
        }),
    ],
    server: {
        port: 3000,
    },
});
