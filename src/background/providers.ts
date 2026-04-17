import { createFetchHttpClient } from "@/core/http";
import { fetchModelsWithClient, getProviderBaseUrl } from "@/core/providers";
import { getCustomBaseUrlValidationError, normalizeBaseUrl } from "@/shared/config";
import type { AIProvider, ExtensionConfig } from "@/shared/types";

function buildOriginPattern(baseUrl: string): string | null {
  const validationError = getCustomBaseUrlValidationError(baseUrl);
  if (validationError) {
    throw new Error(validationError);
  }

  try {
    const origin = new URL(normalizeBaseUrl(baseUrl)).origin;
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

export async function fetchModels(provider: AIProvider, config: ExtensionConfig): Promise<string[]> {
  return fetchModelsWithClient(createFetchHttpClient(), provider, config, ensureCustomOriginPermission);
}
