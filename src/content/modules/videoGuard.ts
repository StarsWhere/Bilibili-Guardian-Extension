import { getVideoAnalysisErrorDetails } from "@/shared/errors";
import { extractBvid } from "@/shared/url";
import { timeStringToSeconds } from "@/shared/time";
import type {
  ExtensionConfig,
  VideoAnalysisErrorDetails,
  VideoAnalysisResult,
  VideoAnalysisPhase
} from "@/shared/types";

interface VideoGuardApp {
  config: ExtensionConfig;
  getCurrentVideoAutoSkip(): boolean;
  setCurrentVideoState(patch: Partial<VideoGuardState>): void;
  log(message: string): void;
  logVideoDiagnostic(details: VideoAnalysisErrorDetails): void;
  getCachedVideoResult(bvid: string): Promise<VideoAnalysisResult | null>;
  analyzeVideo(payload: { bvid: string; topComment: string; force?: boolean; requestId: string }): Promise<VideoAnalysisResult>;
  cancelVideoAnalysis(requestId: string): Promise<void>;
}

interface VideoGuardState {
  phase: VideoAnalysisPhase;
  bvid: string | null;
  result: VideoAnalysisResult | null;
  error: string | null;
  errorDetails: VideoAnalysisErrorDetails | null;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function collectTopComment(): Promise<string> {
  for (let index = 0; index < 8; index += 1) {
    const reply = document.querySelector(".reply-list .root-reply-container");
    const content = reply?.querySelector(".reply-content .reply-con")?.textContent?.trim();
    const pinned = Boolean(reply?.querySelector(".reply-tag .top-badge"));
    if (content) {
      return pinned ? `存在置顶评论：${content}` : `首条评论：${content}`;
    }
    await sleep(500);
  }
  return "未获取到有效评论";
}

function currentVideoElement(): HTMLVideoElement | null {
  return document.querySelector("video");
}

export class VideoGuard {
  private currentBvid: string | null = null;
  private currentRequestId: string | null = null;
  private activeSkipListener: ((event: Event) => void) | null = null;
  private skippedForCurrentRange = false;
  private latestResult: VideoAnalysisResult | null = null;

  constructor(private readonly app: VideoGuardApp) {}

  match(url: URL): boolean {
    return this.app.config.video.enabled && Boolean(extractBvid(url));
  }

  async mount(url: URL): Promise<void> {
    const bvid = extractBvid(url);
    if (!bvid) {
      return;
    }

    this.currentBvid = bvid;
    this.app.setCurrentVideoState({
      bvid,
      phase: "collecting",
      error: null,
      result: null,
      errorDetails: null
    });

    const cached = await this.app.getCachedVideoResult(bvid);
    if (cached) {
      this.latestResult = cached;
      this.app.setCurrentVideoState({
        bvid,
        phase: "cached",
        result: cached,
        error: null,
        errorDetails: null
      });
      this.armSkipIfNeeded(cached);
      this.app.log(`VideoGuard 命中缓存 ${bvid}`);
      return;
    }

    await this.runAnalysis(false);
  }

  async rerun(force = true): Promise<void> {
    if (!this.currentBvid) {
      return;
    }
    await this.runAnalysis(force);
  }

  setAutoSkipEnabled(_enabled: boolean): void {
    if (this.latestResult) {
      this.armSkipIfNeeded(this.latestResult);
    }
  }

  async unmount(): Promise<void> {
    if (this.currentRequestId) {
      await this.app.cancelVideoAnalysis(this.currentRequestId);
      this.currentRequestId = null;
    }

    const video = currentVideoElement();
    if (video && this.activeSkipListener) {
      video.removeEventListener("timeupdate", this.activeSkipListener);
    }

    this.activeSkipListener = null;
    this.currentBvid = null;
    this.latestResult = null;
    this.skippedForCurrentRange = false;
  }

  private async runAnalysis(force: boolean): Promise<void> {
    if (!this.currentBvid) {
      return;
    }

    if (this.currentRequestId) {
      await this.app.cancelVideoAnalysis(this.currentRequestId);
    }

    this.app.setCurrentVideoState({
      phase: "collecting",
      error: null,
      result: null,
      errorDetails: null
    });

    const topComment = await collectTopComment();
    const requestId = `${this.currentBvid}-${Date.now()}`;
    this.currentRequestId = requestId;
    this.app.setCurrentVideoState({
      phase: "analyzing"
    });

    try {
      const result = await this.app.analyzeVideo({
        bvid: this.currentBvid,
        topComment,
        force,
        requestId
      });
      this.latestResult = result;
      this.app.setCurrentVideoState({
        phase: result.cacheHit ? "cached" : "ready",
        result,
        error: null,
        errorDetails: null
      });
      this.armSkipIfNeeded(result);
      this.app.log(`VideoGuard 完成分析 ${this.currentBvid}`);
    } catch (error) {
      const details = getVideoAnalysisErrorDetails(error);
      const message = error instanceof Error ? error.message : String(error);
      this.app.setCurrentVideoState({
        phase: "error",
        error: message,
        result: null,
        errorDetails: details
      });
      this.app.log(`VideoGuard 分析失败：${message}`);
      if (details) {
        this.app.logVideoDiagnostic(details);
      }
    } finally {
      this.currentRequestId = null;
    }
  }

  private armSkipIfNeeded(result: VideoAnalysisResult): void {
    const video = currentVideoElement();
    if (!video) {
      return;
    }

    if (this.activeSkipListener) {
      video.removeEventListener("timeupdate", this.activeSkipListener);
      this.activeSkipListener = null;
    }

    this.skippedForCurrentRange = false;
    const canSkip =
      this.app.getCurrentVideoAutoSkip() &&
      result.finalProbability >= this.app.config.video.probabilityThreshold &&
      Boolean(result.start && result.end);

    if (!canSkip || !result.start || !result.end) {
      return;
    }

    const start = timeStringToSeconds(result.start);
    const end = timeStringToSeconds(result.end);
    this.activeSkipListener = () => {
      if (this.skippedForCurrentRange) {
        return;
      }

      if (video.currentTime >= start && video.currentTime < end) {
        video.currentTime = end;
        this.skippedForCurrentRange = true;
        this.app.setCurrentVideoState({ phase: "skipped" });
        this.app.log(`已自动跳过 ${result.start} - ${result.end}`);
      }
    };

    video.addEventListener("timeupdate", this.activeSkipListener);
    this.activeSkipListener(new Event("timeupdate"));
  }
}
