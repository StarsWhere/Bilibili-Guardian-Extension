import {
  getCachedVideoResultFromStore,
  setVideoRangeDisabledInStore,
  setCachedVideoResultInStore
} from "@/core/storage";
import type { VideoAnalysisResult } from "@/shared/types";
import { chromeLocalStore } from "./chromeStore";

export async function getCachedVideoResult(bvid: string, pageIndex = 1): Promise<VideoAnalysisResult | null> {
  return getCachedVideoResultFromStore(chromeLocalStore, bvid, pageIndex);
}

export async function setCachedVideoResult(
  bvid: string,
  result: VideoAnalysisResult,
  ttlMinutes: number,
  pageIndex = 1
): Promise<void> {
  await setCachedVideoResultInStore(chromeLocalStore, bvid, result, ttlMinutes, pageIndex);
}

export async function setVideoRangeDisabled(
  bvid: string,
  rangeId: string,
  disabled: boolean,
  pageIndex = 1
): Promise<VideoAnalysisResult | null> {
  return setVideoRangeDisabledInStore(chromeLocalStore, bvid, rangeId, disabled, pageIndex);
}
