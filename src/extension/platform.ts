import { sendMessage } from "@/content/bridge";
import type { GuardianPlatformServices } from "@/shared/platform";
import type { ExtensionConfig } from "@/shared/types";

export function createChromePlatformServices(): GuardianPlatformServices {
  return {
    loadConfig: () => sendMessage("GET_CONFIG", undefined),
    saveConfig: (patch) => sendMessage("SAVE_CONFIG", patch),
    subscribeConfigChanges(listener) {
      const handler = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
        if (areaName !== "local" || !changes["guardian.config"]) {
          return;
        }

        const nextValue = changes["guardian.config"].newValue as ExtensionConfig | undefined;
        if (nextValue) {
          listener(nextValue);
        }
      };

      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    },
    sendFeedScanMetric: (blockedCount) => sendMessage("RUN_FEED_SCAN", { blockedCount }).then(() => undefined),
    submitFeedFeedback: (payload) => sendMessage("SUBMIT_FEED_FEEDBACK", payload),
    getCachedVideoResult: (bvid) => sendMessage("GET_CACHED_VIDEO_RESULT", { bvid }),
    analyzeVideo: (payload) => sendMessage("ANALYZE_VIDEO", payload),
    cancelVideoAnalysis: async (requestId) => {
      const result = await sendMessage("CANCEL_VIDEO_ANALYSIS", { requestId });
      return result.cancelled;
    },
    fetchModels: (provider, baseUrl) => sendMessage("FETCH_MODELS", { provider, baseUrl })
  };
}
