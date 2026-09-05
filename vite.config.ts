import { defineConfig, PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

const plugins: PluginOption[] = [
  react(),
  tailwindcss(),
  tsconfigPaths(),
  VitePWA({
    registerType: "prompt", // Changed from "autoUpdate" to avoid force-loading stale content
    manifest: {
      name: "Cymatic Resonance",
      short_name: "Cymatic",
      theme_color: "#000000",
      icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,png,svg}"],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      // Skip waiting so new service workers activate immediately
      skipWaiting: true,
      clientsClaim: true,
      navigateFallback: null,
      navigateFallbackDenylist: [/^\/auth/],
      // Ensure the sw itself is not cached aggressively
      cleanupOutdatedCaches: true,
    },
  }),
];

export default defineConfig({
  base: "/",
  plugins,
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      external: ["node:async_hooks"],
      output: {
        // Force content hashing for all output files
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
