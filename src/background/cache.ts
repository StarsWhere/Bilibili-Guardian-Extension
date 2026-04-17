import {
  getCachedVideoResultFromStore,
  setCachedVideoResultInStore
} from "@/core/storage";
import type { VideoAnalysisResult } from "@/shared/types";
import { chromeLocalStore } from "./chromeStore";

export async function getCachedVideoResult(bvid: string): Promise<VideoAnalysisResult | null> {
  return getCachedVideoResultFromStore(chromeLocalStore, bvid);
}

export async function setCachedVideoResult(
  bvid: string,
  result: VideoAnalysisResult,
  ttlMinutes: number
): Promise<void> {
  await setCachedVideoResultInStore(chromeLocalStore, bvid, result, ttlMinutes);
}
