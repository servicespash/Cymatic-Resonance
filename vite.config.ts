import { defineConfig, PluginOption } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";
import { cloudflare } from "@cloudflare/vite-plugin";

const plugins: PluginOption[] = [
  tanstackStart(),
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
      navigateFallback: null,
      navigateFallbackDenylist: [/^\/auth/],
    },
  }),
];

// Cloudflare plugin disabled as per user request to test cookie persistence
// if (process.env.ENABLE_CLOUDFLARE_PLUGIN === "true") {
//   plugins.unshift(cloudflare({ viteEnvironment: { name: "ssr" } }));
// }

export default defineConfig({
  plugins,
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      external: ["node:async_hooks"],
    },
  },
});
