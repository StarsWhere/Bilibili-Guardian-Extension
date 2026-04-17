import { createVideoAnalysisService } from "@/core/analysis";
import { createFetchHttpClient } from "@/core/http";
import { ensureCustomOriginPermission } from "./providers";
import type { BackgroundAnalyzeVideoPayload, ExtensionConfig, VideoAnalysisResult } from "@/shared/types";

const service = createVideoAnalysisService(createFetchHttpClient(), ensureCustomOriginPermission);

export function cancelAnalysisRequest(requestId: string): boolean {
  return service.cancelAnalysisRequest(requestId);
}

export async function analyzeVideo(
  payload: BackgroundAnalyzeVideoPayload,
  config: ExtensionConfig
): Promise<VideoAnalysisResult> {
  return service.analyzeVideo(payload, config);
}
