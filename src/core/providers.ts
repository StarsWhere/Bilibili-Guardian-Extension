import {
  AI_PROVIDER_DEFAULTS,
  getCustomBaseUrlValidationError,
  normalizeBaseUrl
} from "@/shared/config";
import type { AIProvider, ExtensionConfig } from "@/shared/types";
import type { HttpClient } from "./http";

export type EnsureOriginAccess = (baseUrl: string) => Promise<void>;

export function getProviderBaseUrl(provider: AIProvider, config: ExtensionConfig): string {
  if (provider === "custom") {
    return normalizeBaseUrl(config.ai.baseUrl);
  }

  return normalizeBaseUrl(config.ai.baseUrl || AI_PROVIDER_DEFAULTS[provider].baseUrl);
}

export async function fetchModelsWithClient(
  client: HttpClient,
  provider: AIProvider,
  config: ExtensionConfig,
  ensureOriginAccess?: EnsureOriginAccess
): Promise<string[]> {
  if (provider === "custom") {
    const validationError = getCustomBaseUrlValidationError(config.ai.baseUrl);
    if (validationError) {
      throw new Error(validationError);
    }

    if (!config.ai.apiKey.trim()) {
      throw new Error("获取模型前，请先填写自定义兼容接口的访问密钥");
    }

    await ensureOriginAccess?.(config.ai.baseUrl);
  }

  const baseUrl = getProviderBaseUrl(provider, config);
  const apiKey = config.ai.apiKey.trim();

  if (!baseUrl) {
    return AI_PROVIDER_DEFAULTS[provider].models;
  }

  try {
    if ((provider === "openai" || provider === "deepseek" || provider === "custom") && apiKey) {
      const response = await client.requestJson<{ data?: Array<{ id: string }> }>(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        const models = response.data.data?.map((item) => item.id).filter(Boolean);
        if (models && models.length > 0) {
          return models;
        }
      }
    }

    if (provider === "gemini" && apiKey) {
      const response = await client.requestJson<{ models?: Array<{ name: string }> }>(
        `${baseUrl}/models?key=${encodeURIComponent(apiKey)}`
      );
      if (response.ok) {
        const models =
          response.data.models
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
