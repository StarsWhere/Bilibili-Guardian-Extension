import { getVideoAnalysisErrorDetails } from "@/shared/errors";
import { extractBvid, extractPageIndex } from "@/shared/url";
import { timeStringToSeconds } from "@/shared/time";
import type {
  ExtensionConfig,
  VideoAdRange,
  VideoAnalysisErrorDetails,
  VideoAnalysisResult,
  VideoAnalysisPhase
} from "@/shared/types";
import { getEnabledVideoAdRanges, getVideoAdRanges, normalizeVideoAnalysisResult } from "@/shared/videoResult";

interface VideoGuardApp {
  config: ExtensionConfig;
  getCurrentVideoAutoSkip(): boolean;
  setCurrentVideoState(patch: Partial<VideoGuardState>): void;
  setCurrentVideoAutoSkip(enabled: boolean): void;
  log(message: string): void;
  logVideoDiagnostic(details: VideoAnalysisErrorDetails): void;
  openVideoSettings(): void;
  getCachedVideoResult(bvid: string, pageIndex: number): Promise<VideoAnalysisResult | null>;
  analyzeVideo(payload: { bvid: string; pageIndex: number; topComment: string; force?: boolean; requestId: string }): Promise<VideoAnalysisResult>;
  cancelVideoAnalysis(requestId: string): Promise<void>;
  setVideoRangeDisabled(bvid: string, pageIndex: number, rangeId: string, disabled: boolean): Promise<VideoAnalysisResult | null>;
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
  private currentPageIndex = 1;
  private currentRequestId: string | null = null;
  private activeSkipListener: ((event: Event) => void) | null = null;
  private activeVideo: HTMLVideoElement | null = null;
  private skippedForCurrentRange = false;
  private skippedRangeIds = new Set<string>();
  private latestResult: VideoAnalysisResult | null = null;
  private activeRunRevision = 0;
  private progressOverlay: HTMLDivElement | null = null;
  private progressHost: HTMLElement | null = null;
  private progressPopupRangeId: string | null = null;
  private progressDurationListener: (() => void) | null = null;
  private progressDurationVideo: HTMLVideoElement | null = null;

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
    this.currentPageIndex = extractPageIndex(url);
    this.app.setCurrentVideoState({
      bvid,
      phase: "collecting",
      error: null,
      result: null,
      errorDetails: null
    });

    const cached = await this.app.getCachedVideoResult(bvid, this.currentPageIndex);
    if (cached) {
      this.latestResult = normalizeVideoAnalysisResult(cached);
      this.app.setCurrentVideoState({
        bvid,
        phase: "cached",
        result: this.latestResult,
        error: null,
        errorDetails: null
      });
      this.armSkipIfNeeded(this.latestResult);
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
    this.activeRunRevision += 1;
    if (this.currentRequestId) {
      await this.app.cancelVideoAnalysis(this.currentRequestId);
      this.currentRequestId = null;
    }

    if (this.activeVideo && this.activeSkipListener) {
      this.activeVideo.removeEventListener("timeupdate", this.activeSkipListener);
    }

    this.activeSkipListener = null;
    this.activeVideo = null;
    this.currentBvid = null;
    this.currentPageIndex = 1;
    this.latestResult = null;
    this.skippedForCurrentRange = false;
    this.skippedRangeIds.clear();
    this.removeProgressDurationListener();
    this.removeProgressOverlay();
  }

  async setRangeDisabled(rangeId: string, disabled: boolean): Promise<void> {
    if (!this.currentBvid || !this.latestResult) {
      return;
    }

    const disabledIds = new Set(this.latestResult.disabledRangeIds ?? []);
    if (disabled) {
      disabledIds.add(rangeId);
    } else {
      disabledIds.delete(rangeId);
    }

    const optimistic = normalizeVideoAnalysisResult({
      ...this.latestResult,
      disabledRangeIds: Array.from(disabledIds)
    });
    this.latestResult = optimistic;
    this.app.setCurrentVideoState({ result: optimistic });
    this.armSkipIfNeeded(optimistic);

    const persisted = await this.app.setVideoRangeDisabled(this.currentBvid, this.currentPageIndex, rangeId, disabled);
    if (persisted) {
      this.latestResult = normalizeVideoAnalysisResult(persisted);
      this.app.setCurrentVideoState({ result: this.latestResult });
      this.armSkipIfNeeded(this.latestResult);
    }
  }

  private async runAnalysis(force: boolean): Promise<void> {
    if (!this.currentBvid) {
      return;
    }

    const runRevision = this.activeRunRevision + 1;
    this.activeRunRevision = runRevision;

    if (this.currentRequestId) {
      await this.app.cancelVideoAnalysis(this.currentRequestId);
    }
    this.skippedRangeIds.clear();
    this.skippedForCurrentRange = false;

    const requestId = `${this.currentBvid}-${Date.now()}`;
    this.currentRequestId = requestId;
    this.app.setCurrentVideoState({
      phase: "collecting",
      bvid: this.currentBvid,
      error: null,
      result: null,
      errorDetails: null
    });

    const topComment = await collectTopComment();
    if (runRevision !== this.activeRunRevision || requestId !== this.currentRequestId) {
      return;
    }

    this.app.setCurrentVideoState({
      phase: "analyzing"
    });

    try {
      const result = await this.app.analyzeVideo({
        bvid: this.currentBvid,
        pageIndex: this.currentPageIndex,
        topComment,
        force,
        requestId
      });
      if (runRevision !== this.activeRunRevision || requestId !== this.currentRequestId) {
        return;
      }

      this.latestResult = normalizeVideoAnalysisResult(result);
      this.app.setCurrentVideoState({
        phase: result.cacheHit ? "cached" : "ready",
        result: this.latestResult,
        error: null,
        errorDetails: null
      });
      this.armSkipIfNeeded(this.latestResult);
      this.app.log(`VideoGuard 完成分析 ${this.currentBvid}`);
    } catch (error) {
      if (runRevision !== this.activeRunRevision || requestId !== this.currentRequestId) {
        return;
      }

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
      if (runRevision === this.activeRunRevision && requestId === this.currentRequestId) {
        this.currentRequestId = null;
      }
    }
  }

  private armSkipIfNeeded(result: VideoAnalysisResult): void {
    const video = currentVideoElement();
    if (!video) {
      return;
    }

    if (this.activeVideo && this.activeSkipListener) {
      this.activeVideo.removeEventListener("timeupdate", this.activeSkipListener);
      this.activeSkipListener = null;
    }

    this.skippedForCurrentRange = false;
    const ranges = getEnabledVideoAdRanges(result, this.app.config.video.probabilityThreshold)
      .sort((left, right) => timeStringToSeconds(left.start) - timeStringToSeconds(right.start));
    this.renderProgressOverlay(result);

    if (!this.app.getCurrentVideoAutoSkip() || ranges.length === 0) {
      return;
    }

    this.activeSkipListener = () => {
      for (const range of ranges) {
        if (this.skippedRangeIds.has(range.id)) {
          continue;
        }

        const start = timeStringToSeconds(range.start);
        const end = timeStringToSeconds(range.end);
        if (video.currentTime >= start && video.currentTime < end) {
          video.currentTime = end;
          this.skippedForCurrentRange = true;
          this.skippedRangeIds.add(range.id);
          this.app.setCurrentVideoState({ phase: "skipped" });
          this.app.log(`已自动跳过 ${range.start} - ${range.end}`);
          return;
        }
      }
    };

    this.activeVideo = video;
    video.addEventListener("timeupdate", this.activeSkipListener);
    this.activeSkipListener(new Event("timeupdate"));
  }

  private findProgressHost(): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      ".bpx-player-progress, .bpx-player-progress-wrap, .bilibili-player-video-progress, .squirtle-progress-wrap"
    );
  }

  private renderProgressOverlay(result: VideoAnalysisResult): void {
    const video = currentVideoElement();
    if (!video) {
      this.removeProgressOverlay();
      return;
    }

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      if (!this.progressDurationListener) {
        const rerender = () => this.latestResult && this.renderProgressOverlay(this.latestResult);
        this.progressDurationListener = rerender;
        this.progressDurationVideo = video;
        video.addEventListener("loadedmetadata", rerender);
        video.addEventListener("durationchange", rerender);
      }
      return;
    }

    const host = this.findProgressHost();
    if (!host) {
      this.removeProgressOverlay();
      return;
    }

    if (!this.progressOverlay || this.progressHost !== host) {
      this.removeProgressOverlay();
      this.progressHost = host;
      this.progressOverlay = document.createElement("div");
      this.progressOverlay.className = "guardian-progress-overlay";
      this.progressOverlay.addEventListener("click", (event) => void this.handleProgressOverlayClick(event));
      if (window.getComputedStyle(host).position === "static") {
        host.style.position = "relative";
      }
      host.appendChild(this.progressOverlay);
    }

    const disabledIds = new Set(result.disabledRangeIds ?? []);
    const ranges = getVideoAdRanges(result);
    this.progressOverlay.innerHTML = ranges.map((range) => {
      const start = timeStringToSeconds(range.start);
      const end = timeStringToSeconds(range.end);
      const left = Math.max(0, Math.min(100, (start / video.duration) * 100));
      const width = Math.max(0.35, Math.min(100 - left, ((end - start) / video.duration) * 100));
      const disabled = disabledIds.has(range.id);
      return `
        <button class="guardian-progress-range ${disabled ? "disabled" : ""}" type="button" data-range-id="${range.id}" style="left:${left}%;width:${width}%;" title="${range.start} - ${range.end}"></button>
      `;
    }).join("");

    if (this.progressPopupRangeId) {
      const selected = ranges.find((range) => range.id === this.progressPopupRangeId);
      if (selected) {
        this.renderProgressPopup(selected, result);
      } else {
        this.progressPopupRangeId = null;
      }
    }
  }

  private renderProgressPopup(range: VideoAdRange, result: VideoAnalysisResult): void {
    if (!this.progressOverlay) {
      return;
    }

    const disabled = new Set(result.disabledRangeIds ?? []).has(range.id);
    const video = currentVideoElement();
    const duration = video?.duration && Number.isFinite(video.duration) ? video.duration : 1;
    const midpoint = (timeStringToSeconds(range.start) + timeStringToSeconds(range.end)) / 2;
    const left = Math.max(8, Math.min(92, (midpoint / duration) * 100));
    const popup = document.createElement("div");
    popup.className = "guardian-progress-popover";
    popup.style.left = `${left}%`;
    popup.innerHTML = `
      <div class="guardian-progress-popover-head">
        <strong>${range.start} - ${range.end}</strong>
        <span>${range.finalProbability}%</span>
      </div>
      <div class="guardian-progress-popover-note">${escapeHtml(range.note)}</div>
      <div class="guardian-progress-popover-actions">
        <button type="button" data-action="toggle-range" data-range-id="${range.id}">${disabled ? "启用本段" : "禁用本段"}</button>
        <button type="button" data-action="toggle-auto-skip">${this.app.getCurrentVideoAutoSkip() ? "关闭自动跳过" : "开启自动跳过"}</button>
        <button type="button" data-action="rerun-video">重新识别</button>
        <button type="button" data-action="open-video-settings">完整设置</button>
      </div>
    `;

    this.progressOverlay.querySelector(".guardian-progress-popover")?.remove();
    this.progressOverlay.appendChild(popup);
  }

  private async handleProgressOverlayClick(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const rangeButton = target.closest<HTMLElement>("[data-range-id]");
    const actionButton = target.closest<HTMLElement>("[data-action]");
    if (actionButton?.dataset.action === "toggle-range") {
      const rangeId = actionButton.dataset.rangeId;
      const result = this.latestResult;
      if (!rangeId || !result) {
        return;
      }
      const disabled = !(result.disabledRangeIds ?? []).includes(rangeId);
      await this.setRangeDisabled(rangeId, disabled);
      return;
    }

    if (actionButton?.dataset.action === "toggle-auto-skip") {
      this.app.setCurrentVideoAutoSkip(!this.app.getCurrentVideoAutoSkip());
      if (this.latestResult) {
        this.armSkipIfNeeded(this.latestResult);
      }
      return;
    }

    if (actionButton?.dataset.action === "rerun-video") {
      await this.rerun(true);
      return;
    }

    if (actionButton?.dataset.action === "open-video-settings") {
      this.app.openVideoSettings();
      return;
    }

    const rangeId = rangeButton?.dataset.rangeId;
    const range = getVideoAdRanges(this.latestResult).find((item) => item.id === rangeId);
    if (range && this.latestResult) {
      this.progressPopupRangeId = range.id;
      this.renderProgressPopup(range, this.latestResult);
    }
  }

  private removeProgressOverlay(): void {
    this.progressOverlay?.remove();
    this.progressOverlay = null;
    this.progressHost = null;
    this.progressPopupRangeId = null;
  }

  private removeProgressDurationListener(): void {
    if (this.progressDurationVideo && this.progressDurationListener) {
      this.progressDurationVideo.removeEventListener("loadedmetadata", this.progressDurationListener);
      this.progressDurationVideo.removeEventListener("durationchange", this.progressDurationListener);
    }
    this.progressDurationVideo = null;
    this.progressDurationListener = null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
