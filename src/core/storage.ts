import { DEFAULT_CONFIG, mergeConfig } from "@/shared/config";
import type { DeepPartial, ExtensionConfig, VideoAnalysisResult } from "@/shared/types";
import { normalizeVideoAnalysisResult } from "@/shared/videoResult";

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

function getVideoCacheKey(bvid: string, pageIndex = 1): string {
  return `${bvid}::p=${pageIndex}`;
}

function getLegacyVideoCacheKey(bvid: string): string {
  return bvid;
}

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
  bvid: string,
  pageIndex = 1
): Promise<VideoAnalysisResult | null> {
  const cache = await readVideoCache(store);
  const cacheKey = getVideoCacheKey(bvid, pageIndex);
  const legacyKey = getLegacyVideoCacheKey(bvid);
  const entry = cache[cacheKey] ?? (pageIndex === 1 ? cache[legacyKey] : undefined);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    delete cache[cacheKey];
    delete cache[legacyKey];
    await store.set(VIDEO_CACHE_KEY, cache);
    return null;
  }

  return normalizeVideoAnalysisResult({
    ...entry.result,
    source: "cache",
    cacheHit: true
  });
}

export async function setCachedVideoResultInStore(
  store: KeyValueStore,
  bvid: string,
  result: VideoAnalysisResult,
  ttlMinutes: number,
  pageIndex = 1
): Promise<void> {
  const cache = await readVideoCache(store);
  cache[getVideoCacheKey(bvid, pageIndex)] = {
    result: {
      ...normalizeVideoAnalysisResult(result),
      source: "live",
      cacheHit: false
    },
    expiresAt: Date.now() + ttlMinutes * 60 * 1000
  };
  await store.set(VIDEO_CACHE_KEY, cache);
}

export async function setVideoRangeDisabledInStore(
  store: KeyValueStore,
  bvid: string,
  rangeId: string,
  disabled: boolean,
  pageIndex = 1
): Promise<VideoAnalysisResult | null> {
  const cache = await readVideoCache(store);
  const cacheKey = getVideoCacheKey(bvid, pageIndex);
  const legacyKey = getLegacyVideoCacheKey(bvid);
  const entryKey = cache[cacheKey] ? cacheKey : pageIndex === 1 && cache[legacyKey] ? legacyKey : "";
  const entry = entryKey ? cache[entryKey] : undefined;

  if (!entry || entry.expiresAt < Date.now()) {
    if (entryKey) {
      delete cache[entryKey];
      await store.set(VIDEO_CACHE_KEY, cache);
    }
    return null;
  }

  const result = normalizeVideoAnalysisResult(entry.result);
  const disabledIds = new Set(result.disabledRangeIds ?? []);
  if (disabled) {
    disabledIds.add(rangeId);
  } else {
    disabledIds.delete(rangeId);
  }

  entry.result = normalizeVideoAnalysisResult({
    ...result,
    disabledRangeIds: Array.from(disabledIds)
  });
  cache[cacheKey] = entry;
  if (entryKey === legacyKey) {
    delete cache[legacyKey];
  }
  await store.set(VIDEO_CACHE_KEY, cache);

  return normalizeVideoAnalysisResult({
    ...entry.result,
    source: "cache",
    cacheHit: true
  });
}
