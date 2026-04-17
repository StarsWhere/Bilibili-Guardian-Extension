import { defineConfig } from "vite";
import { resolve } from "node:path";

export const alias = {
  "@": resolve(__dirname, "src")
};

export default defineConfig({
  resolve: {
    alias
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts"]
  }
});
