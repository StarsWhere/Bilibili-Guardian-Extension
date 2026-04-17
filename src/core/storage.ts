import { DEFAULT_CONFIG, mergeConfig } from "@/shared/config";
import type { DeepPartial, ExtensionConfig, VideoAnalysisResult } from "@/shared/types";

export const CONFIG_STORAGE_KEY = "guardian.config";
export const VIDEO_CACHE_KEY = "guardian.videoCache";

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
}

interface CachedVideoEntry {
  result: VideoAnalysisResult;
  expiresAt: number;
}

type VideoCacheStore = Record<string, CachedVideoEntry>;

async function readVideoCache(store: KeyValueStore): Promise<VideoCacheStore> {
  return (await store.get<VideoCacheStore>(VIDEO_CACHE_KEY)) ?? {};
}

export async function loadConfigFromStore(store: KeyValueStore): Promise<ExtensionConfig> {
  const input = await store.get<DeepPartial<ExtensionConfig>>(CONFIG_STORAGE_KEY);
  return mergeConfig(input, DEFAULT_CONFIG);
}

export async function saveConfigToStore(
  store: KeyValueStore,
  patch: DeepPartial<ExtensionConfig>
): Promise<ExtensionConfig> {
  const current = await loadConfigFromStore(store);
  const merged = mergeConfig(patch, current);
  await store.set(CONFIG_STORAGE_KEY, merged);
  return merged;
}

export async function getCachedVideoResultFromStore(
  store: KeyValueStore,
  bvid: string
): Promise<VideoAnalysisResult | null> {
  const cache = await readVideoCache(store);
  const entry = cache[bvid];
  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    delete cache[bvid];
    await store.set(VIDEO_CACHE_KEY, cache);
    return null;
  }

  return {
    ...entry.result,
    source: "cache",
    cacheHit: true
  };
}

export async function setCachedVideoResultInStore(
  store: KeyValueStore,
  bvid: string,
  result: VideoAnalysisResult,
  ttlMinutes: number
): Promise<void> {
  const cache = await readVideoCache(store);
  cache[bvid] = {
    result: {
      ...result,
      source: "live",
      cacheHit: false
    },
    expiresAt: Date.now() + ttlMinutes * 60 * 1000
  };
  await store.set(VIDEO_CACHE_KEY, cache);
}
