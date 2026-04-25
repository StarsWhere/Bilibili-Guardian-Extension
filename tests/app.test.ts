import { GuardianApp } from "@/app/GuardianApp";
import { DEFAULT_CONFIG } from "@/shared/config";
import type { GuardianPlatformServices } from "@/shared/platform";

function createServices(): GuardianPlatformServices {
  return {
    loadConfig: vi.fn().mockResolvedValue(DEFAULT_CONFIG),
    saveConfig: vi.fn().mockResolvedValue(DEFAULT_CONFIG),
    subscribeConfigChanges: vi.fn().mockReturnValue(() => {}),
    sendFeedScanMetric: vi.fn().mockResolvedValue(undefined),
    submitFeedFeedback: vi.fn().mockResolvedValue({ ok: true, message: "0" }),
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
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.removeAttribute("data-guardian-theme");
  });

  it("can be constructed before async config loading completes", () => {
    expect(() => new GuardianApp(createServices())).not.toThrow();
  });

  it("clears previous video result, error and diagnostics when the patch explicitly sets them to null", async () => {
    const app = new GuardianApp(createServices());
    await app.init();

    const bridge = ((app as unknown as { videoGuard: { app: { setCurrentVideoState: (patch: Record<string, unknown>) => void } } }).videoGuard).app;

    bridge.setCurrentVideoState({
      bvid: "BV1state",
      phase: "ready",
      result: {
        probability: 80,
        finalProbability: 80,
        start: "00:20",
        end: "00:50",
        note: "旧结果",
        source: "live",
        cacheHit: false,
        danmakuCount: 12
      },
      error: "旧错误",
      errorDetails: {
        requestId: "req-old",
        provider: "openai",
        model: "gpt-4.1-mini",
        stage: "response_parse",
        code: "invalid_json",
        parserMessage: "old",
        responsePreview: "old",
        responseSource: "choices[0].message.content",
        responseLength: 3,
        suggestion: "old"
      }
    });

    bridge.setCurrentVideoState({
      phase: "collecting",
      result: null,
      error: null,
      errorDetails: null
    });

    expect(app.runtime.videoPhase).toBe("collecting");
    expect(app.runtime.videoResult).toBeNull();
    expect(app.runtime.videoError).toBeNull();
    expect(app.runtime.videoErrorDetails).toBeNull();

    app.destroy();
  });
});
