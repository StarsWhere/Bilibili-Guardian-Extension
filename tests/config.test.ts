import { DEFAULT_CONFIG, mergeConfig } from "@/shared/config";

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
});
