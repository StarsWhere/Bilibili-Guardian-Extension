import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";
import { resolve } from "node:path";

export default mergeConfig(
  baseConfig,
  defineConfig({
    publicDir: false,
    build: {
      emptyOutDir: false,
      outDir: "dist",
      sourcemap: true,
      rollupOptions: {
        input: resolve(__dirname, "src/background/index.ts"),
        output: {
          entryFileNames: "background.js",
          format: "es",
          inlineDynamicImports: true
        }
      }
    }
  })
);
