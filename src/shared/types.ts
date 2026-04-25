export type ThemeMode = "light" | "dark";
export type PanelTabId = "overview" | "feed" | "video" | "advanced" | "ai" | "diagnostics";
export type AIProvider = "openai" | "deepseek" | "gemini" | "anthropic" | "custom";
export type FeedPageScope = "home" | "search" | "popular" | "ranking" | "channel";
export type VideoAnalysisFailureStage = "response_parse";
export type VideoAnalysisFailureCode =
  | "empty_response"
  | "completed_without_output"
  | "no_json_found"
  | "invalid_json"
  | "invalid_result_shape";
export type VideoAnalysisPhase =
  | "idle"
  | "collecting"
  | "cached"
  | "analyzing"
  | "ready"
  | "error"
  | "skipped";

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export interface FloatingButtonPosition {
  x: number;
  y: number;
}

export interface ExtensionConfig {
  ui: {
    theme: ThemeMode;
    floatingButtonPosition: FloatingButtonPosition;
    panelOpen: boolean;
    activeTab: PanelTabId;
    diagnosticsEnabled: boolean;
    onboardingDismissed: boolean;
  };
  feed: {
    enabled: boolean;
    blockAds: boolean;
    blockLive: boolean;
    continuousScan: boolean;
    autoDislikeContent: boolean;
    autoDislikeAuthor: boolean;
    keywordBlacklist: string[];
    categoryBlacklist: string[];
    scopes: FeedPageScope[];
  };
  video: {
    enabled: boolean;
    defaultAutoSkip: boolean;
    probabilityThreshold: number;
    durationPenalty: number;
    minAdDuration: number;
    maxAdDuration: number;
    minDanmakuForAnalysis: number;
    maxDanmakuCount: number;
    cacheTtlMinutes: number;
  };
  ai: {
    provider: AIProvider;
    baseUrl: string;
    apiKey: string;
    model: string;
    prompt: string;
    requestTimeoutMs: number;
    whitelistEnabled: boolean;
    whitelistRegex: boolean;
    whitelist: string[];
    blacklistEnabled: boolean;
    blacklistRegex: boolean;
    blacklist: string[];
  };
}

export interface FeedCardModel {
  title: string;
  author: string;
  category: string;
  isAd: boolean;
  isLive: boolean;
  feedback: FeedFeedbackTarget | null;
  element: HTMLElement;
}

export type FeedFeedbackAction = "content" | "author";

export interface FeedFeedbackTarget {
  title: string;
  author: string;
  bvid: string | null;
  id: number | null;
  mid: number | null;
  goto: string;
  trackId: string;
  spmid: string;
  fromSpmid: string;
}

export interface FeedFeedbackPayload extends FeedFeedbackTarget {
  action: FeedFeedbackAction;
}

export interface FeedFeedbackResult {
  ok: boolean;
  message: string;
}

export interface VideoAnalysisResult {
  probability: number;
  finalProbability: number;
  start: string | null;
  end: string | null;
  note: string;
  source: "live" | "cache";
  cacheHit: boolean;
  danmakuCount: number;
  rawResponse?: string;
}

export interface VideoAnalysisErrorDetails {
  requestId: string;
  provider: AIProvider;
  model: string;
  stage: VideoAnalysisFailureStage;
  code: VideoAnalysisFailureCode;
  parserMessage: string;
  responsePreview: string;
  responseSource: string;
  responseLength: number;
  suggestion: string;
  responseEnvelopePreview?: string;
  exchangeTranscript?: string;
}

export interface BackgroundAnalyzeVideoPayload {
  bvid: string;
  topComment: string;
  force?: boolean;
  requestId: string;
}

export interface BackgroundFetchModelsPayload {
  provider: AIProvider;
  baseUrl?: string;
}

export interface BackgroundMessageMap {
  GET_CONFIG: {
    request: undefined;
    response: ExtensionConfig;
  };
  SAVE_CONFIG: {
    request: DeepPartial<ExtensionConfig>;
    response: ExtensionConfig;
  };
  RUN_FEED_SCAN: {
    request: {
      blockedCount: number;
    };
    response: {
      acknowledged: true;
      receivedAt: number;
    };
  };
  SUBMIT_FEED_FEEDBACK: {
    request: FeedFeedbackPayload;
    response: FeedFeedbackResult;
  };
  ANALYZE_VIDEO: {
    request: BackgroundAnalyzeVideoPayload;
    response: VideoAnalysisResult;
  };
  CANCEL_VIDEO_ANALYSIS: {
    request: {
      requestId: string;
    };
    response: {
      cancelled: boolean;
    };
  };
  FETCH_MODELS: {
    request: BackgroundFetchModelsPayload;
    response: string[];
  };
  GET_CACHED_VIDEO_RESULT: {
    request: {
      bvid: string;
    };
    response: VideoAnalysisResult | null;
  };
}

export type BackgroundMessageType = keyof BackgroundMessageMap;
export type BackgroundRequest<K extends BackgroundMessageType> = BackgroundMessageMap[K]["request"];
export type BackgroundResponse<K extends BackgroundMessageType> = BackgroundMessageMap[K]["response"];

export interface BackgroundEnvelope<K extends BackgroundMessageType = BackgroundMessageType> {
  type: K;
  payload: BackgroundRequest<K>;
}

export interface BackgroundSuccessEnvelope<K extends BackgroundMessageType = BackgroundMessageType> {
  ok: true;
  data: BackgroundResponse<K>;
}

export interface BackgroundErrorEnvelope {
  ok: false;
  error: string;
  details?: VideoAnalysisErrorDetails;
}

export interface FeedScanResult {
  removedCount: number;
  matchedCards: FeedCardModel[];
}
