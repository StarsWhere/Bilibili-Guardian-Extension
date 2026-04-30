import { VideoGuard } from "@/content/modules/videoGuard";
import { DEFAULT_CONFIG } from "@/shared/config";
import type { VideoAnalysisResult } from "@/shared/types";

function createResult(note: string): VideoAnalysisResult {
  return {
    probability: 0,
    finalProbability: 0,
    start: null,
    end: null,
    note,
    source: "live",
    cacheHit: false,
    danmakuCount: 0
  };
}

function createMultiRangeResult(): VideoAnalysisResult {
  return {
    probability: 90,
    finalProbability: 90,
    start: "00:10",
    end: "00:20",
    note: "多段结果",
    method: "subtitle",
    ranges: [
      {
        id: "range-1",
        start: "00:10",
        end: "00:20",
        probability: 90,
        finalProbability: 90,
        note: "第一段"
      },
      {
        id: "range-2",
        start: "00:30",
        end: "00:40",
        probability: 88,
        finalProbability: 88,
        note: "第二段"
      }
    ],
    disabledRangeIds: [],
    source: "live",
    cacheHit: false,
    danmakuCount: 0,
    subtitleCueCount: 2
  };
}

function createVideoStateStore() {
  const runtime = {
    phase: "idle",
    bvid: null,
    result: null,
    error: null,
    errorDetails: null
  } as {
    phase: string;
    bvid: string | null;
    result: VideoAnalysisResult | null;
    error: string | null;
    errorDetails: unknown;
  };

  return {
    runtime,
    apply(patch: Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(patch, "phase")) {
        runtime.phase = patch.phase as string;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "bvid")) {
        runtime.bvid = patch.bvid as string | null;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "result")) {
        runtime.result = patch.result as VideoAnalysisResult | null;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "error")) {
        runtime.error = patch.error as string | null;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "errorDetails")) {
        runtime.errorDetails = patch.errorDetails;
      }
    }
  };
}

describe("VideoGuard", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("ignores stale collect-stage runs after rerun", async () => {
    vi.useFakeTimers();

    document.body.innerHTML = "<video></video>";
    const store = createVideoStateStore();
    const analyzeVideo = vi.fn().mockResolvedValue(createResult("latest"));
    const cancelVideoAnalysis = vi.fn().mockResolvedValue(undefined);

    const guard = new VideoGuard({
      config: {
        ...DEFAULT_CONFIG,
        ai: {
          ...DEFAULT_CONFIG.ai,
          apiKey: "token"
        }
      },
      getCurrentVideoAutoSkip: () => false,
      setCurrentVideoAutoSkip: vi.fn(),
      setCurrentVideoState: (patch) => {
        store.apply(patch as Record<string, unknown>);
      },
      log: vi.fn(),
      logVideoDiagnostic: vi.fn(),
      openVideoSettings: vi.fn(),
      getCachedVideoResult: vi.fn().mockResolvedValue(null),
      analyzeVideo,
      cancelVideoAnalysis,
      setVideoRangeDisabled: vi.fn().mockResolvedValue(null)
    });

    const mountPromise = guard.mount(new URL("https://www.bilibili.com/video/BV1Collect123"));
    await Promise.resolve();

    const rerunPromise = guard.rerun(true);
    document.body.innerHTML = `
      <video></video>
      <div class="reply-list">
        <div class="root-reply-container">
          <div class="reply-content">
            <div class="reply-con">首条评论</div>
          </div>
        </div>
      </div>
    `;

    await vi.advanceTimersByTimeAsync(500);
    await mountPromise;
    await rerunPromise;

    expect(cancelVideoAnalysis).toHaveBeenCalledTimes(1);
    expect(analyzeVideo).toHaveBeenCalledTimes(1);
    expect(store.runtime.phase).toBe("ready");
    expect(store.runtime.result?.note).toBe("latest");
  });

  it("keeps the latest rerun result when an older analysis finishes later", async () => {
    document.body.innerHTML = `
      <video></video>
      <div class="reply-list">
        <div class="root-reply-container">
          <div class="reply-content">
            <div class="reply-con">首条评论</div>
          </div>
        </div>
      </div>
    `;

    const store = createVideoStateStore();
    let resolveFirst!: (value: VideoAnalysisResult) => void;
    let resolveSecond!: (value: VideoAnalysisResult) => void;
    const analyzeVideo = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<VideoAnalysisResult>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<VideoAnalysisResult>((resolve) => {
            resolveSecond = resolve;
          })
      );

    const guard = new VideoGuard({
      config: {
        ...DEFAULT_CONFIG,
        ai: {
          ...DEFAULT_CONFIG.ai,
          apiKey: "token"
        }
      },
      getCurrentVideoAutoSkip: () => false,
      setCurrentVideoAutoSkip: vi.fn(),
      setCurrentVideoState: (patch) => {
        store.apply(patch as Record<string, unknown>);
      },
      log: vi.fn(),
      logVideoDiagnostic: vi.fn(),
      openVideoSettings: vi.fn(),
      getCachedVideoResult: vi.fn().mockResolvedValue(null),
      analyzeVideo,
      cancelVideoAnalysis: vi.fn().mockResolvedValue(undefined),
      setVideoRangeDisabled: vi.fn().mockResolvedValue(null)
    });

    const mountPromise = guard.mount(new URL("https://www.bilibili.com/video/BV1Analyze123"));
    await Promise.resolve();
    await Promise.resolve();

    const rerunPromise = guard.rerun(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(analyzeVideo).toHaveBeenCalledTimes(2);

    resolveSecond(createResult("new result"));
    await rerunPromise;
    expect(store.runtime.result?.note).toBe("new result");

    resolveFirst(createResult("stale result"));
    await mountPromise;
    expect(store.runtime.result?.note).toBe("new result");
  });

  it("skips multiple enabled ranges once and ignores disabled ranges", async () => {
    document.body.innerHTML = "<video></video>";
    const video = document.querySelector("video")!;
    const result = {
      ...createMultiRangeResult(),
      disabledRangeIds: ["range-1"]
    };
    const store = createVideoStateStore();

    const guard = new VideoGuard({
      config: {
        ...DEFAULT_CONFIG,
        ai: {
          ...DEFAULT_CONFIG.ai,
          apiKey: "token"
        }
      },
      getCurrentVideoAutoSkip: () => true,
      setCurrentVideoAutoSkip: vi.fn(),
      setCurrentVideoState: (patch) => {
        store.apply(patch as Record<string, unknown>);
      },
      log: vi.fn(),
      logVideoDiagnostic: vi.fn(),
      openVideoSettings: vi.fn(),
      getCachedVideoResult: vi.fn().mockResolvedValue(result),
      analyzeVideo: vi.fn(),
      cancelVideoAnalysis: vi.fn().mockResolvedValue(undefined),
      setVideoRangeDisabled: vi.fn().mockResolvedValue(null)
    });

    await guard.mount(new URL("https://www.bilibili.com/video/BV1Skip123"));

    video.currentTime = 12;
    video.dispatchEvent(new Event("timeupdate"));
    expect(video.currentTime).toBe(12);

    video.currentTime = 32;
    video.dispatchEvent(new Event("timeupdate"));
    expect(video.currentTime).toBe(40);
    expect(store.runtime.phase).toBe("skipped");

    video.currentTime = 32;
    video.dispatchEvent(new Event("timeupdate"));
    expect(video.currentTime).toBe(32);
  });

  it("renders progress markers and persists per-range disable actions", async () => {
    document.body.innerHTML = `
      <div class="bpx-player-progress"></div>
      <video></video>
    `;
    const video = document.querySelector("video")!;
    Object.defineProperty(video, "duration", {
      configurable: true,
      value: 100
    });
    const result = createMultiRangeResult();
    const updated = {
      ...result,
      disabledRangeIds: ["range-1"]
    };
    const setVideoRangeDisabled = vi.fn().mockResolvedValue(updated);
    const store = createVideoStateStore();

    const guard = new VideoGuard({
      config: {
        ...DEFAULT_CONFIG,
        ai: {
          ...DEFAULT_CONFIG.ai,
          apiKey: "token"
        }
      },
      getCurrentVideoAutoSkip: () => true,
      setCurrentVideoAutoSkip: vi.fn(),
      setCurrentVideoState: (patch) => {
        store.apply(patch as Record<string, unknown>);
      },
      log: vi.fn(),
      logVideoDiagnostic: vi.fn(),
      openVideoSettings: vi.fn(),
      getCachedVideoResult: vi.fn().mockResolvedValue(result),
      analyzeVideo: vi.fn(),
      cancelVideoAnalysis: vi.fn().mockResolvedValue(undefined),
      setVideoRangeDisabled
    });

    await guard.mount(new URL("https://www.bilibili.com/video/BV1Progress123"));

    const markers = document.querySelectorAll<HTMLElement>(".guardian-progress-range");
    expect(markers).toHaveLength(2);

    markers[0].click();
    document.querySelector<HTMLElement>("[data-action='toggle-range']")?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(setVideoRangeDisabled).toHaveBeenCalledWith("BV1Progress123", 1, "range-1", true);
    expect(store.runtime.result?.disabledRangeIds).toContain("range-1");
  });
});
