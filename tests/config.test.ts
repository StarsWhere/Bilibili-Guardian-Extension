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
});
