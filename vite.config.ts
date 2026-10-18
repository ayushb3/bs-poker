import { defineConfig } from "vite";

// Served from https://ayushb3.github.io/bs-poker/, so assets resolve under /bs-poker/.
export default defineConfig({
  base: "/bs-poker/",
  build: { outDir: "dist", target: "es2022" },
});
