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
    expect(merged.ai.provider).toBe(DEFAULT_CONFIG.ai.provider);
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
