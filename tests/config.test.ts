import { DEFAULT_CONFIG, getCustomBaseUrlValidationError, mergeConfig } from "@/shared/config";

describe("mergeConfig", () => {
  it("merges nested sections without dropping defaults", () => {
    const merged = mergeConfig({
      video: {
        probabilityThreshold: 88
      }
    });

    expect(merged.video.probabilityThreshold).toBe(88);
    expect(merged.feed.blockAds).toBe(DEFAULT_CONFIG.feed.blockAds);
    expect(merged.feed.autoDislikeContent).toBe(false);
    expect(merged.feed.autoDislikeAuthor).toBe(false);
    expect(merged.ai.provider).toBe(DEFAULT_CONFIG.ai.provider);
    expect(merged.video.subtitleAnalysisEnabled).toBe(true);
    expect(merged.video.danmakuAnalysisEnabled).toBe(false);
    expect(merged.video.introGuardSeconds).toBe(30);
    expect(merged.video.maxSkipDurationSeconds).toBe(300);
  });

  it("migrates the legacy prompt to the danmaku prompt while keeping subtitle prompt defaults", () => {
    const merged = mergeConfig({
      ai: {
        prompt: "旧弹幕提示词"
      }
    });

    expect(merged.ai.prompt).toBe("旧弹幕提示词");
    expect(merged.ai.danmakuPrompt).toBe("旧弹幕提示词");
    expect(merged.ai.subtitlePrompt).toBe(DEFAULT_CONFIG.ai.subtitlePrompt);
  });

  it("preserves onboarding flag defaults and allows overriding it", () => {
    const merged = mergeConfig({
      ui: {
        onboardingDismissed: true
      }
    });

    expect(DEFAULT_CONFIG.ui.onboardingDismissed).toBe(false);
    expect(merged.ui.onboardingDismissed).toBe(true);
    expect(mergeConfig(undefined).ui.onboardingDismissed).toBe(false);
  });

  it("validates custom OpenAI-compatible base URLs", () => {
    expect(getCustomBaseUrlValidationError("")).toContain("请填写自定义 OpenAI 兼容接口地址");
    expect(getCustomBaseUrlValidationError("localhost:8000/v1")).toMatch(/格式无效|http:\/\/ 或 https:\/\//);
    expect(getCustomBaseUrlValidationError("ftp://localhost:8000/v1")).toContain("http:// 或 https://");
    expect(getCustomBaseUrlValidationError("https://example.com/v1/")).toBeNull();
  });
});
