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
    registerType: "autoUpdate",
    manifest: {
      name: "Cymatic Resonance",
      short_name: "Cymatic",
      theme_color: "#000000",
      icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,png,svg}"],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      skipWaiting: true,
      clientsClaim: true,
      navigateFallback: null,
      navigateFallbackDenylist: [/^\/auth/],
      // Ensure the sw itself is not cached aggressively
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/(tile\.openstreetmap\.org|server\.arcgisonline\.com)\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "map-tiles-cache",
            expiration: {
              maxEntries: 500,
              maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
      ],
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
