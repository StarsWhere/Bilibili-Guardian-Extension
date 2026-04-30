import { DEFAULT_CONFIG } from "@/shared/config";
import { createVideoAnalysisService } from "@/core/analysis";
import { createFetchHttpClient } from "@/core/http";
import type { AIProvider, ExtensionConfig } from "@/shared/types";
import type { HttpClient, HttpRequestOptions, HttpResponse } from "@/core/http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnvFile(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separatorIndex = normalizedLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = normalizedLine.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotEnvFile();

const env = {
  baseUrl: process.env.BILIBILI_GUARDIAN_REAL_LLM_BASE_URL?.trim() ?? "",
  apiKey: process.env.BILIBILI_GUARDIAN_REAL_LLM_API_KEY?.trim() ?? "",
  model: process.env.BILIBILI_GUARDIAN_REAL_LLM_MODEL?.trim() ?? "",
  provider: (process.env.BILIBILI_GUARDIAN_REAL_LLM_PROVIDER?.trim() ?? "custom") as AIProvider,
  timeoutMs: Number(process.env.BILIBILI_GUARDIAN_REAL_LLM_TIMEOUT_MS ?? "90000")
};

const hasRealLlmEnv = Boolean(env.baseUrl && env.apiKey && env.model);
const realIt = hasRealLlmEnv ? it : it.skip;

function createHybridClient(): HttpClient {
  const fetchClient = createFetchHttpClient();
  const cid = 1001;
  const xml = [
    "<i>",
    "<d p=\"1,1,25,16777215,0,0,0,0\">正片开始</d>",
    "<d p=\"16,1,25,16777215,0,0,0,0\">这里像广告</d>",
    "<d p=\"22,1,25,16777215,0,0,0,0\">感谢金主</d>",
    "<d p=\"31,1,25,16777215,0,0,0,0\">广告后回来</d>",
    "<d p=\"75,1,25,16777215,0,0,0,0\">后面是正片</d>",
    "</i>"
  ].join("");

  return {
    async requestJson<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
      if (url.includes("/x/web-interface/view")) {
        return {
          ok: true,
          status: 200,
          data: {
            code: 0,
            data: {
              cid
            }
          } as T
        };
      }

      return await fetchClient.requestJson<T>(url, options);
    },
    async requestText(url: string, options?: HttpRequestOptions): Promise<HttpResponse<string>> {
      if (url.includes(`comment.bilibili.com/${cid}.xml`)) {
        return {
          ok: true,
          status: 200,
          data: xml
        };
      }

      return await fetchClient.requestText(url, options);
    }
  };
}

function createRealLlmConfig(): ExtensionConfig {
  return {
    ...DEFAULT_CONFIG,
    video: {
      ...DEFAULT_CONFIG.video,
      subtitleAnalysisEnabled: false,
      danmakuAnalysisEnabled: true
    },
    ai: {
      ...DEFAULT_CONFIG.ai,
      provider: env.provider,
      baseUrl: env.baseUrl,
      apiKey: env.apiKey,
      model: env.model,
      requestTimeoutMs: Number.isFinite(env.timeoutMs) ? env.timeoutMs : 90000
    }
  };
}

describe("real llm integration", () => {
  realIt(
    "executes a real video analysis request when environment variables are provided",
    async () => {
      const service = createVideoAnalysisService(createHybridClient());
      const result = await service.analyzeVideo(
        {
          bvid: "BV1REALTEST",
          topComment: "首条评论：测试环境下的真实 LLM 请求",
          requestId: `real-llm-${Date.now()}`
        },
        createRealLlmConfig()
      );

      expect(result.source).toBe("live");
      expect(result.cacheHit).toBe(false);
      expect(result.danmakuCount).toBeGreaterThan(0);
      expect(result.finalProbability).toBeGreaterThanOrEqual(0);
      expect(result.finalProbability).toBeLessThanOrEqual(100);
      expect(typeof result.note).toBe("string");
      expect(result.note.length).toBeGreaterThan(0);
      expect(typeof result.rawResponse).toBe("string");
      expect(result.rawResponse?.trim().startsWith("{")).toBe(true);
      expect(result.rawResponse?.trim().endsWith("}")).toBe(true);

      if (result.start !== null) {
        expect(typeof result.start).toBe("string");
      }

      if (result.end !== null) {
        expect(typeof result.end).toBe("string");
      }
    },
    120000
  );
});
