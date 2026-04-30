import { analyzeVideo, cancelAnalysisRequest } from "./analyze";
import { getCachedVideoResult, setCachedVideoResult, setVideoRangeDisabled } from "./cache";
import { submitFeedFeedback } from "./feedFeedback";
import { fetchModels, ensureCustomOriginPermission } from "./providers";
import { loadConfig, saveConfig } from "./storage";
import { mergeConfig } from "@/shared/config";
import { getVideoAnalysisErrorDetails } from "@/shared/errors";
import type {
  BackgroundEnvelope,
  BackgroundErrorEnvelope,
  BackgroundMessageType,
  BackgroundRequest,
  BackgroundResponse,
  BackgroundSuccessEnvelope,
  DeepPartial,
  ExtensionConfig
} from "@/shared/types";

type Handler<K extends BackgroundMessageType> = (
  payload: BackgroundRequest<K>
) => Promise<BackgroundResponse<K>> | BackgroundResponse<K>;

async function maybeEnsureCustomPermission(configPatch: DeepPartial<ExtensionConfig>): Promise<void> {
  const current = await loadConfig();
  const merged = mergeConfig(configPatch, current);
  const provider = merged.ai.provider;
  const baseUrl = merged.ai.baseUrl.trim();

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
  async SUBMIT_FEED_FEEDBACK(payload) {
    return submitFeedFeedback(payload);
  },
  async ANALYZE_VIDEO(payload) {
    const config = await loadConfig();
    const pageIndex = payload.pageIndex ?? 1;
    if (!payload.force) {
      const cached = await getCachedVideoResult(payload.bvid, pageIndex);
      if (cached) {
        return cached;
      }
    }

    const result = await analyzeVideo(payload, config);
    await setCachedVideoResult(payload.bvid, result, config.video.cacheTtlMinutes, pageIndex);
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
    return getCachedVideoResult(payload.bvid, payload.pageIndex ?? 1);
  },
  async SET_VIDEO_RANGE_DISABLED(payload) {
    return setVideoRangeDisabled(payload.bvid, payload.rangeId, payload.disabled, payload.pageIndex ?? 1);
  }
};

chrome.runtime.onMessage.addListener((message: BackgroundEnvelope, _sender, sendResponse) => {
  const handler = handlers[message.type as BackgroundMessageType] as Handler<BackgroundMessageType> | undefined;

  if (!handler) {
    sendResponse({ ok: false, error: `未知消息类型：${message.type}` } satisfies BackgroundErrorEnvelope);
    return false;
  }

  Promise.resolve(handler(message.payload as never))
    .then((response) => sendResponse({ ok: true, data: response } satisfies BackgroundSuccessEnvelope))
    .catch((error) => {
      const details = getVideoAnalysisErrorDetails(error);
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        ...(details ? { details } : {})
      } satisfies BackgroundErrorEnvelope);
    });

  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  await loadConfig();
  console.info("[Guardian] background ready");
});
