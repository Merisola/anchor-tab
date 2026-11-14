import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    open: "/newtab.html",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome114",
    rollupOptions: {
      input: {
        newtab: resolve(root, "newtab.html"),
        settings: resolve(root, "settings.html"),
        launchpad: resolve(root, "launchpad.html"),
        fieldManager: resolve(root, "field-manager.html"),
        background: resolve(root, "src/background.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});