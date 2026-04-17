import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";
import { resolve } from "node:path";

export default mergeConfig(
  baseConfig,
  defineConfig({
    build: {
      emptyOutDir: true,
      outDir: "dist",
      sourcemap: true,
      rollupOptions: {
        input: resolve(__dirname, "src/content/index.ts"),
        output: {
          entryFileNames: "content.js",
          format: "iife",
          inlineDynamicImports: true
        }
      }
    }
  })
);
