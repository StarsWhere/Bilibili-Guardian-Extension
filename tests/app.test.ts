import { GuardianApp } from "@/app/GuardianApp";
import { DEFAULT_CONFIG } from "@/shared/config";
import type { GuardianPlatformServices } from "@/shared/platform";

function createServices(): GuardianPlatformServices {
  return {
    loadConfig: vi.fn().mockResolvedValue(DEFAULT_CONFIG),
    saveConfig: vi.fn().mockResolvedValue(DEFAULT_CONFIG),
    subscribeConfigChanges: vi.fn().mockReturnValue(() => {}),
    sendFeedScanMetric: vi.fn().mockResolvedValue(undefined),
    getCachedVideoResult: vi.fn().mockResolvedValue(null),
    analyzeVideo: vi.fn().mockResolvedValue({
      probability: 0,
      finalProbability: 0,
      start: null,
      end: null,
      note: "",
      source: "live",
      cacheHit: false,
      danmakuCount: 0
    }),
    cancelVideoAnalysis: vi.fn().mockResolvedValue(false),
    fetchModels: vi.fn().mockResolvedValue([])
  };
}

describe("GuardianApp", () => {
  it("can be constructed before async config loading completes", () => {
    expect(() => new GuardianApp(createServices())).not.toThrow();
  });
});
