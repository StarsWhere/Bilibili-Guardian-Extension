import { AI_PROVIDER_DEFAULTS } from "@/shared/config";
import type { AIProvider, ExtensionConfig } from "@/shared/types";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildOriginPattern(baseUrl: string): string | null {
  try {
    const origin = new URL(baseUrl).origin;
    return `${origin}/*`;
  } catch {
    return null;
  }
}

export async function ensureCustomOriginPermission(baseUrl: string): Promise<void> {
  const originPattern = buildOriginPattern(baseUrl);
  if (!originPattern) {
    throw new Error("自定义 API Base URL 无效");
  }

  const alreadyGranted = await chrome.permissions.contains({ origins: [originPattern] });
  if (alreadyGranted) {
    return;
  }

  const granted = await chrome.permissions.request({ origins: [originPattern] });
  if (!granted) {
    throw new Error(`未授予自定义接口权限：${originPattern}`);
  }
}

export function getProviderBaseUrl(provider: AIProvider, config: ExtensionConfig): string {
  if (provider === "custom") {
    return stripTrailingSlash(config.ai.baseUrl.trim());
  }

  return stripTrailingSlash(config.ai.baseUrl.trim() || AI_PROVIDER_DEFAULTS[provider].baseUrl);
}

export async function fetchModels(provider: AIProvider, config: ExtensionConfig): Promise<string[]> {
  if (provider === "custom") {
    await ensureCustomOriginPermission(config.ai.baseUrl);
  }

  const baseUrl = getProviderBaseUrl(provider, config);
  const apiKey = config.ai.apiKey.trim();

  if (!baseUrl) {
    return AI_PROVIDER_DEFAULTS[provider].models;
  }

  try {
    if ((provider === "openai" || provider === "deepseek" || provider === "custom") && apiKey) {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        const data = (await response.json()) as { data?: Array<{ id: string }> };
        const models = data.data?.map((item) => item.id).filter(Boolean);
        if (models && models.length > 0) {
          return models;
        }
      }
    }

    if (provider === "gemini" && apiKey) {
      const response = await fetch(`${baseUrl}/models?key=${encodeURIComponent(apiKey)}`);
      if (response.ok) {
        const data = (await response.json()) as { models?: Array<{ name: string }> };
        const models =
          data.models
            ?.map((item) => item.name.replace(/^models\//, ""))
            .filter((name) => name.includes("gemini")) ?? [];
        if (models.length > 0) {
          return models;
        }
      }
    }
  } catch (error) {
    console.warn("[Guardian] 获取模型列表失败，回退默认列表", error);
  }

  return AI_PROVIDER_DEFAULTS[provider].models;
}
