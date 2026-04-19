import { defineConfig, mergeConfig } from "vite";
import fs from "node:fs";
import { resolve } from "node:path";
import baseConfig from "./vite.config";

const packageJson = JSON.parse(fs.readFileSync(resolve(__dirname, "package.json"), "utf8")) as { version: string };
const USERSCRIPT_ICON_URL = "https://raw.githubusercontent.com/StarsWhere/Bilibili-Guardian-Extension/main/public/icon.png";
const USERSCRIPT_CONNECT_DOMAINS = [
  "api.bilibili.com",
  "comment.bilibili.com",
  "api.openai.com",
  "api.deepseek.com",
  "generativelanguage.googleapis.com",
  "api.anthropic.com",
  "*"
];

const banner = `// ==UserScript==
// @name         Bilibili Guardian
// @namespace    https://github.com/StarsWhere/Bilibili-Guardian-Extension
// @version      ${packageJson.version}
// @description  在 Bilibili 页面提供推荐流过滤、视频 AI 广告检测与自动跳过控制台。
// @icon         ${USERSCRIPT_ICON_URL}
// @match        https://www.bilibili.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
${USERSCRIPT_CONNECT_DOMAINS.map((domain) => `// @connect      ${domain}`).join("\n")}
// ==/UserScript==`;

function userscriptMetadataPlugin() {
  return {
    name: "userscript-metadata",
    generateBundle(_options: unknown, bundle: Record<string, { type: string; code?: string }>) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && typeof chunk.code === "string") {
          chunk.code = `${banner}\n${chunk.code}`;
        }
      }
    }
  };
}

export default mergeConfig(
  baseConfig,
  defineConfig({
    publicDir: false,
    plugins: [userscriptMetadataPlugin()],
    build: {
      emptyOutDir: false,
      minify: false,
      outDir: "dist",
      sourcemap: true,
      rollupOptions: {
        input: resolve(__dirname, "src/userscript/index.ts"),
        output: {
          entryFileNames: "bilibili-guardian.user.js",
          format: "iife",
          inlineDynamicImports: true
        }
      }
    }
  })
);
