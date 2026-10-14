import { defineConfig } from "vite";

// base is "./" so the built site works from any sub-path (GitHub Pages, etc.).
export default defineConfig({
  base: "./",
  build: { outDir: "dist", target: "es2022" },
});
