import type { VideoAnalysisResult } from "@/shared/types";

const VIDEO_CACHE_KEY = "guardian.videoCache";

interface CachedVideoEntry {
  result: VideoAnalysisResult;
  expiresAt: number;
}

type VideoCacheStore = Record<string, CachedVideoEntry>;

async function readStore(): Promise<VideoCacheStore> {
  const result = await chrome.storage.local.get(VIDEO_CACHE_KEY);
  return (result[VIDEO_CACHE_KEY] as VideoCacheStore | undefined) ?? {};
}

async function writeStore(store: VideoCacheStore): Promise<void> {
  await chrome.storage.local.set({ [VIDEO_CACHE_KEY]: store });
}

export async function getCachedVideoResult(bvid: string): Promise<VideoAnalysisResult | null> {
  const store = await readStore();
  const entry = store[bvid];
  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    delete store[bvid];
    await writeStore(store);
    return null;
  }

  return {
    ...entry.result,
    source: "cache",
    cacheHit: true
  };
}

export async function setCachedVideoResult(
  bvid: string,
  result: VideoAnalysisResult,
  ttlMinutes: number
): Promise<void> {
  const store = await readStore();
  store[bvid] = {
    result: {
      ...result,
      source: "live",
      cacheHit: false
    },
    expiresAt: Date.now() + ttlMinutes * 60 * 1000
  };
  await writeStore(store);
}
