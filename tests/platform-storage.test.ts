import {
  getCachedVideoResultFromStore,
  loadConfigFromStore,
  saveConfigToStore,
  setVideoRangeDisabledInStore,
  setCachedVideoResultInStore,
  type KeyValueStore
} from "@/core/storage";

function createMemoryStore(): KeyValueStore {
  const data = new Map<string, unknown>();

  return {
    async get<T>(key: string): Promise<T | undefined> {
      return data.get(key) as T | undefined;
    },
    async set<T>(key: string, value: T): Promise<void> {
      data.set(key, value);
    }
  };
}

describe("shared storage helpers", () => {
  it("merges config patches against defaults", async () => {
    const store = createMemoryStore();
    const config = await saveConfigToStore(store, {
      ai: {
        model: "custom-model"
      }
    });

    const loaded = await loadConfigFromStore(store);

    expect(config.ai.model).toBe("custom-model");
    expect(loaded.feed.enabled).toBe(true);
    expect(loaded.ai.model).toBe("custom-model");
  });

  it("stores video cache entries and marks cache hits", async () => {
    const store = createMemoryStore();

    await setCachedVideoResultInStore(store, "BV1test", {
      probability: 80,
      finalProbability: 75,
      start: "00:30",
      end: "01:00",
      note: "命中缓存测试",
      source: "live",
      cacheHit: false,
      danmakuCount: 42
    }, 10);

    const cached = await getCachedVideoResultFromStore(store, "BV1test");

    expect(cached?.cacheHit).toBe(true);
    expect(cached?.source).toBe("cache");
    expect(cached?.note).toBe("命中缓存测试");
  });

  it("stores disabled range ids with page-scoped video cache entries", async () => {
    const store = createMemoryStore();

    await setCachedVideoResultInStore(store, "BV1test", {
      probability: 90,
      finalProbability: 90,
      start: "00:10",
      end: "00:40",
      note: "多段缓存测试",
      method: "subtitle",
      ranges: [
        {
          id: "subtitle-1",
          start: "00:10",
          end: "00:40",
          probability: 90,
          finalProbability: 90,
          note: "片头广告"
        }
      ],
      disabledRangeIds: [],
      source: "live",
      cacheHit: false,
      danmakuCount: 0,
      subtitleCueCount: 2
    }, 10, 2);

    const updated = await setVideoRangeDisabledInStore(store, "BV1test", "subtitle-1", true, 2);

    expect(updated?.disabledRangeIds).toContain("subtitle-1");
    expect((await getCachedVideoResultFromStore(store, "BV1test", 1))).toBeNull();
    expect((await getCachedVideoResultFromStore(store, "BV1test", 2))?.disabledRangeIds).toContain("subtitle-1");
  });
});
