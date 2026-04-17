import { analyzeVideo, cancelAnalysisRequest } from "./analyze";
import { getCachedVideoResult, setCachedVideoResult } from "./cache";
import { fetchModels, ensureCustomOriginPermission } from "./providers";
import { loadConfig, saveConfig } from "./storage";
import type {
  BackgroundEnvelope,
  BackgroundMessageType,
  BackgroundRequest,
  BackgroundResponse,
  DeepPartial,
  ExtensionConfig
} from "@/shared/types";

type Handler<K extends BackgroundMessageType> = (
  payload: BackgroundRequest<K>
) => Promise<BackgroundResponse<K>> | BackgroundResponse<K>;

async function maybeEnsureCustomPermission(configPatch: DeepPartial<ExtensionConfig>): Promise<void> {
  const provider = configPatch.ai?.provider;
  const baseUrl = configPatch.ai?.baseUrl?.trim();
  if (provider === "custom" && baseUrl) {
    await ensureCustomOriginPermission(baseUrl);
  }
}

const handlers: { [K in BackgroundMessageType]: Handler<K> } = {
  async GET_CONFIG() {
    return loadConfig();
  },
  async SAVE_CONFIG(payload) {
    await maybeEnsureCustomPermission(payload);
    return saveConfig(payload);
  },
  async RUN_FEED_SCAN(payload) {
    return {
      acknowledged: true,
      receivedAt: Date.now() + payload.blockedCount
    };
  },
  async ANALYZE_VIDEO(payload) {
    const config = await loadConfig();
    if (!payload.force) {
      const cached = await getCachedVideoResult(payload.bvid);
      if (cached) {
        return cached;
      }
    }

    const result = await analyzeVideo(payload, config);
    await setCachedVideoResult(payload.bvid, result, config.video.cacheTtlMinutes);
    return result;
  },
  async CANCEL_VIDEO_ANALYSIS(payload) {
    return { cancelled: cancelAnalysisRequest(payload.requestId) };
  },
  async FETCH_MODELS(payload) {
    const config = await loadConfig();
    const updatedConfig = {
      ...config,
      ai: {
        ...config.ai,
        provider: payload.provider,
        baseUrl: payload.baseUrl ?? config.ai.baseUrl
      }
    };
    return fetchModels(payload.provider, updatedConfig);
  },
  async GET_CACHED_VIDEO_RESULT(payload) {
    return getCachedVideoResult(payload.bvid);
  }
};

chrome.runtime.onMessage.addListener((message: BackgroundEnvelope, _sender, sendResponse) => {
  const handler = handlers[message.type as BackgroundMessageType] as Handler<BackgroundMessageType> | undefined;

  if (!handler) {
    sendResponse({ error: `未知消息类型：${message.type}` });
    return false;
  }

  Promise.resolve(handler(message.payload as never))
    .then((response) => sendResponse({ ok: true, data: response }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    });

  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  await loadConfig();
  console.info("[Guardian] background ready");
});
