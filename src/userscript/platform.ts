import { createVideoAnalysisService } from "@/core/analysis";
import { submitFeedFeedbackWithClient } from "@/core/feedFeedback";
import { createGmHttpClient } from "@/core/http";
import {
  CONFIG_STORAGE_KEY,
  getCachedVideoResultFromStore,
  loadConfigFromStore,
  saveConfigToStore,
  setCachedVideoResultInStore,
  setVideoRangeDisabledInStore,
  type KeyValueStore
} from "@/core/storage";
import type { GuardianPlatformServices } from "@/shared/platform";
import type { ExtensionConfig } from "@/shared/types";

const gmStore: KeyValueStore = {
  async get<T>(key: string): Promise<T | undefined> {
    return GM_getValue<T | undefined>(key, undefined);
  },
  async set<T>(key: string, value: T): Promise<void> {
    await GM_setValue(key, value);
  }
};

export function createUserscriptPlatformServices(): GuardianPlatformServices {
  if (typeof GM_xmlhttpRequest !== "function") {
    throw new Error("当前脚本管理器没有提供 GM_xmlhttpRequest，请确认已在 Tampermonkey 中安装并授权脚本。");
  }

  const httpClient = createGmHttpClient(GM_xmlhttpRequest);
  const analysisService = createVideoAnalysisService(httpClient);

  return {
    loadConfig: () => loadConfigFromStore(gmStore),
    saveConfig: (patch) => saveConfigToStore(gmStore, patch),
    subscribeConfigChanges(listener) {
      if (typeof GM_addValueChangeListener !== "function") {
        return () => undefined;
      }

      const listenerId = GM_addValueChangeListener<ExtensionConfig>(CONFIG_STORAGE_KEY, (_name, _oldValue, newValue) => {
        if (newValue) {
          listener(newValue);
        }
      });

      return () => {
        if (typeof GM_removeValueChangeListener === "function") {
          GM_removeValueChangeListener(listenerId);
        }
      };
    },
    async sendFeedScanMetric() {
      return undefined;
    },
    submitFeedFeedback: (payload) => submitFeedFeedbackWithClient(httpClient, payload),
    getCachedVideoResult: (bvid, pageIndex) => getCachedVideoResultFromStore(gmStore, bvid, pageIndex),
    analyzeVideo: async (payload) => {
      const config = await loadConfigFromStore(gmStore);
      const pageIndex = payload.pageIndex ?? 1;
      const cached = await getCachedVideoResultFromStore(gmStore, payload.bvid, pageIndex);
      if (!payload.force && cached) {
        return cached;
      }

      const result = await analysisService.analyzeVideo(payload, config);
      await setCachedVideoResultInStore(gmStore, payload.bvid, result, config.video.cacheTtlMinutes, pageIndex);
      return result;
    },
    async cancelVideoAnalysis(requestId) {
      return analysisService.cancelAnalysisRequest(requestId);
    },
    setVideoRangeDisabled: (bvid, rangeId, disabled, pageIndex) =>
      setVideoRangeDisabledInStore(gmStore, bvid, rangeId, disabled, pageIndex),
    fetchModels: async (provider, baseUrl) => {
      const config = await loadConfigFromStore(gmStore);
      return analysisService.fetchModels(provider, {
        ...config,
        ai: {
          ...config.ai,
          provider,
          baseUrl: baseUrl || config.ai.baseUrl
        }
      });
    }
  };
}
