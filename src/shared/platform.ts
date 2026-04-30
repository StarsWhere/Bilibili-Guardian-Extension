import type {
  AIProvider,
  BackgroundAnalyzeVideoPayload,
  DeepPartial,
  ExtensionConfig,
  FeedFeedbackPayload,
  FeedFeedbackResult,
  VideoAnalysisResult
} from "./types";

export interface GuardianPlatformServices {
  loadConfig(): Promise<ExtensionConfig>;
  saveConfig(patch: DeepPartial<ExtensionConfig>): Promise<ExtensionConfig>;
  subscribeConfigChanges(listener: (config: ExtensionConfig) => void): () => void;
  sendFeedScanMetric(blockedCount: number): Promise<void>;
  submitFeedFeedback(payload: FeedFeedbackPayload): Promise<FeedFeedbackResult>;
  getCachedVideoResult(bvid: string, pageIndex?: number): Promise<VideoAnalysisResult | null>;
  analyzeVideo(payload: BackgroundAnalyzeVideoPayload): Promise<VideoAnalysisResult>;
  cancelVideoAnalysis(requestId: string): Promise<boolean>;
  setVideoRangeDisabled(bvid: string, rangeId: string, disabled: boolean, pageIndex?: number): Promise<VideoAnalysisResult | null>;
  fetchModels(provider: AIProvider, baseUrl: string): Promise<string[]>;
}
