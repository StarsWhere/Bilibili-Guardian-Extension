import { fetchCidByBvid, fetchDanmakuXml, parseDanmakuXml } from "./bilibili";
import { ensureCustomOriginPermission, getProviderBaseUrl } from "./providers";
import { getCustomBaseUrlValidationError } from "@/shared/config";
import { clamp, normalizeAdRange, secondsToTimeString, timeStringToSeconds } from "@/shared/time";
import type { BackgroundAnalyzeVideoPayload, ExtensionConfig, VideoAnalysisResult } from "@/shared/types";

const activeControllers = new Map<string, AbortController>();
const SIMPLE_AD_KEYWORDS = ["广告", "推广", "赞助", "恰饭", "感谢金主", "商务合作"];

interface AiResultShape {
  probability?: number;
  start?: string | null;
  end?: string | null;
  note?: string;
}

function createController(requestId: string): AbortSignal {
  const controller = new AbortController();
  activeControllers.set(requestId, controller);
  return controller.signal;
}

export function cancelAnalysisRequest(requestId: string): boolean {
  const controller = activeControllers.get(requestId);
  if (!controller) {
    return false;
  }

  controller.abort();
  activeControllers.delete(requestId);
  return true;
}

function cleanupRequest(requestId: string): void {
  activeControllers.delete(requestId);
}

function sanitizeList(input: string[]): string[] {
  return input.map((item) => item.trim()).filter(Boolean);
}

function matchesPattern(text: string, patterns: string[], useRegex: boolean): boolean {
  const normalizedText = text.toLowerCase();
  return patterns.some((pattern) => {
    if (!useRegex) {
      return normalizedText.includes(pattern.toLowerCase());
    }

    try {
      return new RegExp(pattern, "i").test(text);
    } catch {
      return normalizedText.includes(pattern.toLowerCase());
    }
  });
}

function filterDanmakuText(xml: string, config: ExtensionConfig): { text: string; count: number } {
  const parsed = parseDanmakuXml(xml);
  let filtered = parsed;

  const blacklist = sanitizeList(config.ai.blacklist);
  if (config.ai.blacklistEnabled && blacklist.length > 0) {
    filtered = filtered.filter((entry) => !matchesPattern(entry.text, blacklist, config.ai.blacklistRegex));
  }

  const whitelist = sanitizeList(config.ai.whitelist);
  if (config.ai.whitelistEnabled && whitelist.length > 0) {
    filtered = filtered.filter((entry) => matchesPattern(entry.text, whitelist, config.ai.whitelistRegex));
  }

  if (
    filtered.length < config.video.minDanmakuForAnalysis &&
    !filtered.some((entry) => SIMPLE_AD_KEYWORDS.some((keyword) => entry.text.includes(keyword)))
  ) {
    return { text: "", count: filtered.length };
  }

  if (filtered.length > config.video.maxDanmakuCount) {
    filtered = filtered.slice(0, config.video.maxDanmakuCount);
  }

  return {
    text: filtered
      .sort((left, right) => left.time - right.time)
      .map((entry) => `${secondsToTimeString(entry.time)} ${entry.text}`)
      .join("\n"),
    count: filtered.length
  };
}

function extractJsonBlock(input: string): string {
  const firstBrace = input.indexOf("{");
  const lastBrace = input.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    throw new Error("AI 返回中没有可解析的 JSON");
  }

  return input.slice(firstBrace, lastBrace + 1);
}

function parseAiJson(raw: string): AiResultShape {
  const normalized = extractJsonBlock(raw);
  return JSON.parse(normalized) as AiResultShape;
}

function calculateFinalProbability(result: AiResultShape, config: ExtensionConfig): VideoAnalysisResult {
  const baseProbability = clamp(Math.round(Number(result.probability ?? 0)), 0, 100);
  let finalProbability = baseProbability;
  let start = result.start ?? null;
  let end = result.end ?? null;

  const normalizedRange = normalizeAdRange(start, end, config.video.minAdDuration);
  start = normalizedRange.start;
  end = normalizedRange.end;

  if (start && end) {
    const duration = timeStringToSeconds(end) - timeStringToSeconds(start);
    if (duration > config.video.maxAdDuration) {
      const overflowMinutes = (duration - config.video.maxAdDuration) / 60;
      finalProbability -= overflowMinutes * config.video.durationPenalty;
    }
  }

  return {
    probability: baseProbability,
    finalProbability: clamp(Math.round(finalProbability), 0, 100),
    start,
    end,
    note: result.note?.trim() || "AI 未返回说明",
    source: "live",
    cacheHit: false,
    danmakuCount: 0
  };
}

async function callAiProvider(
  config: ExtensionConfig,
  danmakuText: string,
  topComment: string,
  signal: AbortSignal
): Promise<{ result: VideoAnalysisResult; rawResponse: string }> {
  const provider = config.ai.provider;
  if (!config.ai.model.trim()) {
    throw new Error("请先填写 AI 模型名称");
  }

  if (provider === "custom") {
    const validationError = getCustomBaseUrlValidationError(config.ai.baseUrl);
    if (validationError) {
      throw new Error(validationError);
    }

    if (!config.ai.apiKey.trim()) {
      throw new Error("请先为自定义兼容接口填写访问密钥");
    }

    await ensureCustomOriginPermission(config.ai.baseUrl);
  } else if (!config.ai.apiKey.trim()) {
    throw new Error("请先配置 AI API Key");
  }

  const baseUrl = getProviderBaseUrl(provider, config);
  const userContent = `弹幕内容：\n${danmakuText}\n\n评论区情况：\n${topComment || "无"}`;
  let responseText = "";

  if (provider === "gemini") {
    const response = await fetch(
      `${baseUrl}/models/${encodeURIComponent(config.ai.model)}:generateContent?key=${encodeURIComponent(config.ai.apiKey)}`,
      {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${config.ai.prompt}\n\n${userContent}` }]
            }
          ]
        })
      }
    );

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(data.error?.message || "Gemini 请求失败");
    }

    responseText = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
  } else if (provider === "anthropic") {
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.ai.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.ai.model,
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: `${config.ai.prompt}\n\n${userContent}`
          }
        ]
      })
    });

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(data.error?.message || "Anthropic 请求失败");
    }

    responseText = data.content?.map((item) => item.text ?? "").join("\n") ?? "";
  } else {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.ai.apiKey}`
      },
      body: JSON.stringify({
        model: config.ai.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: config.ai.prompt },
          { role: "user", content: userContent }
        ]
      })
    });

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(data.error?.message || "AI 请求失败");
    }

    responseText = data.choices?.[0]?.message?.content ?? "";
  }

  const parsed = parseAiJson(responseText);
  const result = calculateFinalProbability(parsed, config);
  result.rawResponse = responseText;
  return {
    result,
    rawResponse: responseText
  };
}

export async function analyzeVideo(
  payload: BackgroundAnalyzeVideoPayload,
  config: ExtensionConfig
): Promise<VideoAnalysisResult> {
  const signal = createController(payload.requestId);
  const timeoutId = setTimeout(() => {
    cancelAnalysisRequest(payload.requestId);
  }, config.ai.requestTimeoutMs);

  try {
    const cid = await fetchCidByBvid(payload.bvid);
    const xml = await fetchDanmakuXml(cid);
    const filtered = filterDanmakuText(xml, config);
    if (!filtered.text) {
      return {
        probability: 0,
        finalProbability: 0,
        start: null,
        end: null,
        note: "过滤后的有效弹幕过少，且没有足够的广告指示信息，已跳过 AI 分析。",
        source: "live",
        cacheHit: false,
        danmakuCount: filtered.count
      };
    }

    const { result, rawResponse } = await callAiProvider(config, filtered.text, payload.topComment, signal);
    return {
      ...result,
      danmakuCount: filtered.count,
      rawResponse
    };
  } finally {
    clearTimeout(timeoutId);
    cleanupRequest(payload.requestId);
  }
}
