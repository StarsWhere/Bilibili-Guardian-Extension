import type { AIProvider, DeepPartial, ExtensionConfig } from "./types";

export const AI_PROVIDER_DEFAULTS: Record<
  AIProvider,
  {
    baseUrl: string;
    models: string[];
  }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4.1", "gpt-4o"]
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"]
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"]
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    models: ["claude-3-7-sonnet-latest", "claude-3-5-haiku-latest"]
  },
  custom: {
    baseUrl: "",
    models: []
  }
};

export const DEFAULT_AGENT_PROMPT = `你是一个智能 agent，专门分析 Bilibili 视频的弹幕与评论，判断视频是否包含商业广告（恰饭）并输出结构化 JSON。

任务：
1. 阅读整理后的弹幕时间线。
2. 结合首条评论/置顶评论内容。
3. 判断是否存在广告，并给出起止时间、概率与说明。

要求：
- 只返回 JSON。
- 字段格式固定：
{
  "probability": 0-100 的整数,
  "start": "MM:SS 或 HH:MM:SS，若无则为 null",
  "end": "MM:SS 或 HH:MM:SS，若无则为 null",
  "note": "中文分析说明"
}
- 当 probability >= 30 时必须尽量给出 start 和 end。
- 优先识别“空降”“指路”“感谢金主”“广告后”等路标型弹幕。
- 忽略“正片”“省流”“总结”等常规内容提示。`;

export function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function normalizeBaseUrl(value: string): string {
  return stripTrailingSlash(value.trim());
}

export function getCustomBaseUrlValidationError(baseUrl: string): string | null {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    return "请填写自定义 OpenAI 兼容接口地址，例如：https://example.com/v1";
  }

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    return "自定义接口地址格式无效，请填写完整 URL，例如：https://example.com/v1";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "自定义接口地址必须以 http:// 或 https:// 开头";
  }

  return null;
}

export const DEFAULT_CONFIG: ExtensionConfig = {
  ui: {
    theme: "light",
    floatingButtonPosition: { x: 24, y: 96 },
    panelOpen: false,
    activeTab: "overview",
    diagnosticsEnabled: true,
    onboardingDismissed: false
  },
  feed: {
    enabled: true,
    blockAds: true,
    blockLive: true,
    continuousScan: true,
    autoDislikeContent: false,
    autoDislikeAuthor: false,
    keywordBlacklist: [],
    categoryBlacklist: ["番剧", "直播", "国创", "电影", "电视剧", "漫画"],
    scopes: ["home", "search", "popular", "ranking", "channel"]
  },
  video: {
    enabled: true,
    defaultAutoSkip: true,
    probabilityThreshold: 70,
    durationPenalty: 5,
    minAdDuration: 30,
    maxAdDuration: 300,
    minDanmakuForAnalysis: 20,
    maxDanmakuCount: 500,
    cacheTtlMinutes: 240
  },
  ai: {
    provider: "openai",
    baseUrl: AI_PROVIDER_DEFAULTS.openai.baseUrl,
    apiKey: "",
    model: AI_PROVIDER_DEFAULTS.openai.models[0],
    prompt: DEFAULT_AGENT_PROMPT,
    requestTimeoutMs: 20000,
    whitelistEnabled: true,
    whitelistRegex: false,
    whitelist: [
      "空降",
      "指路",
      "广告",
      "快进",
      "恰饭",
      "感谢",
      "赞助",
      "推广",
      "分",
      "秒",
      ":"
    ],
    blacklistEnabled: true,
    blacklistRegex: false,
    blacklist: ["正片", "省流", "总结", "回顾"]
  }
};

export function mergeConfig(input: DeepPartial<ExtensionConfig> | undefined, current = DEFAULT_CONFIG): ExtensionConfig {
  if (!input) {
    return structuredClone(current);
  }

  return {
    ui: {
      ...current.ui,
      ...input.ui,
      floatingButtonPosition: {
        ...current.ui.floatingButtonPosition,
        ...input.ui?.floatingButtonPosition
      }
    },
    feed: { ...current.feed, ...input.feed },
    video: { ...current.video, ...input.video },
    ai: { ...current.ai, ...input.ai }
  };
}
