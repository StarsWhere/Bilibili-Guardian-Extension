import { ControlCenter, type GuardianRuntimeState } from "@/content/ui/ControlCenter";
import { AI_PROVIDER_DEFAULTS, DEFAULT_CONFIG, mergeConfig } from "@/shared/config";
import type { DeepPartial, ExtensionConfig } from "@/shared/types";

function createRuntime(): GuardianRuntimeState {
  return {
    route: "idle",
    pageScope: null,
    feedRemovedTotal: 0,
    feedLastRemoved: 0,
    videoBvid: null,
    videoPhase: "idle",
    videoError: null,
    videoResult: null,
    videoErrorDetails: null,
    currentVideoAutoSkip: false,
    diagnostics: []
  };
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe("ControlCenter advanced settings", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.removeAttribute("data-guardian-theme");
  });

  it("keeps the service section open and draft values after saving service settings", async () => {
    let config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: true,
        activeTab: "advanced"
      },
      ai: {
        ...DEFAULT_CONFIG.ai,
        provider: "custom",
        baseUrl: "http://localhost:8000/v1",
        model: "custom-model",
        apiKey: "token"
      }
    };

    const runtime = createRuntime();
    let controlCenter!: ControlCenter;

    controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig: vi.fn(async (patch: DeepPartial<ExtensionConfig>) => {
        config = mergeConfig(patch, config);
        controlCenter.update(config, runtime);
      }),
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    const modelInput = document.querySelector<HTMLInputElement>("[data-field='ai.model']");
    expect(modelInput).not.toBeNull();
    modelInput!.value = "changed-custom-model";
    modelInput!.dispatchEvent(new Event("input", { bubbles: true }));

    document.querySelector<HTMLElement>("[data-action='save-service']")?.click();
    await flushPromises();

    const details = document.querySelector<HTMLDetailsElement>("[data-section='service']");
    const updatedModelInput = document.querySelector<HTMLInputElement>("[data-field='ai.model']");

    expect(details?.open).toBe(true);
    expect(updatedModelInput?.value).toBe("changed-custom-model");
    expect(document.querySelector(".guardian-tab.active")?.textContent).toContain("高级设置");
  });

  it("keeps draft values and fetched models visible after fetching model list", async () => {
    const config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: true,
        activeTab: "advanced"
      },
      ai: {
        ...DEFAULT_CONFIG.ai,
        provider: "custom",
        baseUrl: "http://localhost:8000/v1",
        model: "",
        apiKey: "token"
      }
    };

    const runtime = createRuntime();
    const onFetchModels = vi.fn().mockResolvedValue(["custom-model-a", "custom-model-b"]);
    const controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig: vi.fn().mockResolvedValue(undefined),
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels,
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    const baseUrlInput = document.querySelector<HTMLInputElement>("[data-field='ai.baseUrl']");
    baseUrlInput!.value = "http://localhost:8000/v1";
    baseUrlInput!.dispatchEvent(new Event("input", { bubbles: true }));

    document.querySelector<HTMLElement>("[data-action='fetch-models']")?.click();
    await flushPromises();

    const details = document.querySelector<HTMLDetailsElement>("[data-section='service']");
    const updatedBaseUrlInput = document.querySelector<HTMLInputElement>("[data-field='ai.baseUrl']");
    const updatedModelInput = document.querySelector<HTMLInputElement>("[data-field='ai.model']");
    const select = document.querySelector<HTMLSelectElement>("[data-action='select-model-option']");
    const options = Array.from(select?.options ?? []).map((option) => option.value);

    expect(onFetchModels).toHaveBeenCalledWith("custom", "http://localhost:8000/v1");
    expect(details?.open).toBe(true);
    expect(updatedBaseUrlInput?.value).toBe("http://localhost:8000/v1");
    expect(updatedModelInput?.value).toBe("custom-model-a");
    expect(options).toContain("custom-model-a");
    expect(options).toContain("custom-model-b");
  });

  it("uses video safety preference fields instead of legacy duration correction fields", async () => {
    const config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: true,
        activeTab: "advanced"
      },
      ai: {
        ...DEFAULT_CONFIG.ai,
        apiKey: "token"
      }
    };
    const onSaveConfig = vi.fn().mockResolvedValue(undefined);
    const controlCenter = new ControlCenter(config, createRuntime(), {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig,
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    const modalText = document.querySelector<HTMLElement>(".guardian-modal")?.textContent ?? "";
    expect(modalText).toContain("片头保护（秒）");
    expect(modalText).toContain("最长可跳片段（秒）");
    expect(modalText).not.toContain("长内容修正");
    expect(document.querySelector("[data-field='video.durationPenalty']")).toBeNull();
    expect(document.querySelector("[data-field='video.minAdDuration']")).toBeNull();
    expect(document.querySelector("[data-field='video.maxAdDuration']")).toBeNull();

    const introGuardInput = document.querySelector<HTMLInputElement>("[data-field='video.introGuardSeconds']");
    const maxSkipInput = document.querySelector<HTMLInputElement>("[data-field='video.maxSkipDurationSeconds']");
    introGuardInput!.value = "45";
    introGuardInput!.dispatchEvent(new Event("input", { bubbles: true }));
    maxSkipInput!.value = "240";
    maxSkipInput!.dispatchEvent(new Event("input", { bubbles: true }));

    document.querySelector<HTMLElement>("[data-action='save-preferences']")?.click();
    await flushPromises();

    expect(onSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({
          introGuardSeconds: 45,
          maxSkipDurationSeconds: 240
        })
      })
    );
  });

  it("syncs provider changes with default base url and restores custom draft", async () => {
    const config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: true,
        activeTab: "advanced"
      },
      ai: {
        ...DEFAULT_CONFIG.ai,
        provider: "custom",
        baseUrl: "http://localhost:8000/v1",
        model: "custom-model",
        apiKey: "token"
      }
    };

    const runtime = createRuntime();
    const controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig: vi.fn().mockResolvedValue(undefined),
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    const baseUrlInput = document.querySelector<HTMLInputElement>("[data-field='ai.baseUrl']");
    const modelInput = document.querySelector<HTMLInputElement>("[data-field='ai.model']");
    baseUrlInput!.value = "http://localhost:9000/v1";
    baseUrlInput!.dispatchEvent(new Event("input", { bubbles: true }));
    modelInput!.value = "my-custom-model";
    modelInput!.dispatchEvent(new Event("input", { bubbles: true }));

    let providerSelect = document.querySelector<HTMLSelectElement>("[data-field='ai.provider']");
    providerSelect!.value = "deepseek";
    providerSelect!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(document.querySelector<HTMLInputElement>("[data-field='ai.baseUrl']")?.value).toBe(AI_PROVIDER_DEFAULTS.deepseek.baseUrl);
    expect(document.querySelector<HTMLInputElement>("[data-field='ai.model']")?.value).toBe(AI_PROVIDER_DEFAULTS.deepseek.models[0]);

    providerSelect = document.querySelector<HTMLSelectElement>("[data-field='ai.provider']");
    providerSelect!.value = "custom";
    providerSelect!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(document.querySelector<HTMLInputElement>("[data-field='ai.baseUrl']")?.value).toBe("http://localhost:9000/v1");
    expect(document.querySelector<HTMLInputElement>("[data-field='ai.model']")?.value).toBe("my-custom-model");
  });

  it("opens the service section directly when jumping from overview", async () => {
    let config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: true,
        activeTab: "overview",
        onboardingDismissed: true
      }
    };

    const runtime = createRuntime();
    let controlCenter!: ControlCenter;

    controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig: vi.fn().mockResolvedValue(undefined),
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    document.querySelector<HTMLElement>("[data-action='goto-advanced-service']")?.click();
    await flushPromises();

    expect(document.querySelector(".guardian-tab.active")?.textContent).toContain("高级设置");
    expect(document.querySelector<HTMLDetailsElement>("[data-section='service']")?.open).toBe(true);
  });

  it("shows the latest video diagnostic details in diagnostics section", () => {
    const config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: true,
        activeTab: "advanced"
      }
    };

    const runtime = createRuntime();
    runtime.videoErrorDetails = {
      requestId: "BV1test-123",
      provider: "openai",
      model: "gpt-4.1-mini",
      stage: "response_parse",
      code: "invalid_json",
      parserMessage: "Unexpected token } in JSON at position 42",
      responsePreview: "```json\n{\"probability\":80,}\n```",
      responseSource: "choices[0].message.content",
      responseLength: 31,
      suggestion: "确认模型输出没有尾随逗号。",
      responseEnvelopePreview: "{\"choices\":[{\"finish_reason\":\"stop\"}]}",
      exchangeTranscript: "[openai.chat.completions] https://example.com/v1/chat/completions\nRequest Body:\n{}\nResponse Body:\n{}"
    };
    runtime.diagnostics = ["[14:28:49] VideoGuard 分析失败：AI 返回内容不是有效的 JSON"];

    const controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig: vi.fn().mockResolvedValue(undefined),
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    document.querySelector<HTMLElement>("[data-action='open-advanced-section'][data-section='diagnostics']")?.click();

    const detail = document.querySelector<HTMLElement>("[data-role='video-diagnostic']");
    expect(detail?.textContent).toContain("最近一次视频识别失败");
    expect(detail?.textContent).toContain("OpenAI");
    expect(detail?.textContent).toContain("gpt-4.1-mini");
    expect(detail?.textContent).toContain("choices[0].message.content");
    expect(detail?.textContent).toContain("Unexpected token } in JSON at position 42");
    expect(detail?.textContent).toContain("确认模型输出没有尾随逗号。");
    expect(detail?.textContent).toContain("finish_reason");
    expect(detail?.textContent).toContain("完整请求与响应");
    expect(detail?.textContent).toContain("Request Body:");
    const logs = document.querySelectorAll(".guardian-diagnostics");
    expect(logs[3]?.textContent).toContain("VideoGuard 分析失败");
  });

  it("shows edge toasts even when the full panel is closed", () => {
    const config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: false,
        activeTab: "overview"
      }
    };

    const runtime = createRuntime();
    const controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig: vi.fn().mockResolvedValue(undefined),
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();
    controlCenter.showEdgeToast("识别完成，建议跳过。", "success", {
      actionLabel: "查看"
    });

    const toast = document.querySelector<HTMLElement>(".guardian-edge-toast");
    expect(toast?.textContent).toContain("识别完成，建议跳过。");
    expect(document.querySelector(".guardian-overlay.open")).toBeNull();
  });

  it("renders the video quick card and opens the target tab without saving config", async () => {
    let config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: false,
        activeTab: "overview"
      },
      ai: {
        ...DEFAULT_CONFIG.ai,
        apiKey: "token"
      }
    };

    const runtime = createRuntime();
    runtime.route = "video";
    runtime.videoBvid = "BV1quick";
    runtime.videoPhase = "ready";
    runtime.currentVideoAutoSkip = true;
    runtime.videoResult = {
      probability: 82,
      finalProbability: 82,
      start: "00:30",
      end: "01:10",
      note: "当前视频存在较明显的口播片段。",
      source: "live",
      cacheHit: false,
      danmakuCount: 18
    };

    const onRunVideoAnalysis = vi.fn();
    const onToggleCurrentVideoAutoSkip = vi.fn();
    let controlCenter!: ControlCenter;
    const onTogglePanel = vi.fn(() => {
      config = {
        ...config,
        ui: {
          ...config.ui,
          panelOpen: !config.ui.panelOpen
        }
      };
      controlCenter.update(config, runtime);
    });
    const onSaveConfig = vi.fn().mockResolvedValue(undefined);

    controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel,
      onSetTheme: vi.fn(),
      onSaveConfig,
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis,
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip,
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    const card = document.querySelector<HTMLElement>("[data-role='video-quick-card']");
    expect(card?.textContent).toContain("视频快捷操作");
    expect(card?.textContent).toContain("00:30 - 01:10");

    document.querySelector<HTMLElement>("[data-action='video-quick-primary']")?.click();
    expect(onRunVideoAnalysis).toHaveBeenCalledTimes(1);

    const checkbox = document.querySelector<HTMLInputElement>("[data-action='video-quick-toggle-skip']");
    checkbox!.checked = false;
    checkbox!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onToggleCurrentVideoAutoSkip).toHaveBeenCalledWith(false);

    document.querySelector<HTMLElement>("[data-action='video-quick-open-settings']")?.click();
    await flushPromises();

    expect(onTogglePanel).toHaveBeenCalledTimes(1);
    expect(onSaveConfig).not.toHaveBeenCalled();
    expect(document.querySelector(".guardian-tab.active")?.textContent).toContain("视频跳过");
  });

  it("shows no skippable range when candidates are disabled or below threshold", () => {
    const config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: false,
        activeTab: "overview"
      },
      ai: {
        ...DEFAULT_CONFIG.ai,
        apiKey: "token"
      }
    };

    const runtime = createRuntime();
    runtime.route = "video";
    runtime.videoBvid = "BV1noskip";
    runtime.videoPhase = "ready";
    runtime.currentVideoAutoSkip = true;
    runtime.videoResult = {
      probability: 90,
      finalProbability: 90,
      start: "00:40",
      end: "01:10",
      note: "候选区间不应作为可跳区间展示。",
      method: "subtitle",
      ranges: [
        {
          id: "range-disabled",
          start: "00:40",
          end: "01:10",
          probability: 90,
          finalProbability: 90,
          note: "已禁用"
        },
        {
          id: "range-low",
          start: "02:00",
          end: "02:30",
          probability: 60,
          finalProbability: 60,
          note: "低于阈值"
        }
      ],
      disabledRangeIds: ["range-disabled"],
      source: "live",
      cacheHit: false,
      danmakuCount: 0
    };

    const controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig: vi.fn().mockResolvedValue(undefined),
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    const cardText = document.querySelector<HTMLElement>("[data-role='video-quick-card']")?.textContent ?? "";
    expect(cardText).toContain("已识别");
    expect(cardText).toContain("0/2 段可跳过 · 当前无可跳区间");
    expect(cardText).not.toContain("建议跳过");
    expect(cardText).not.toContain("最高 00:40 - 01:10");
  });

  it("shows the collecting state without reusing the previous result and disables rerun actions", () => {
    const config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: true,
        activeTab: "video"
      },
      ai: {
        ...DEFAULT_CONFIG.ai,
        apiKey: "token"
      }
    };

    const runtime = createRuntime();
    runtime.route = "video";
    runtime.videoBvid = "BV1collecting";
    runtime.videoPhase = "collecting";
    runtime.videoResult = {
      probability: 82,
      finalProbability: 82,
      start: "00:30",
      end: "01:10",
      note: "旧结果不应该继续显示。",
      source: "live",
      cacheHit: false,
      danmakuCount: 18
    };

    const controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig: vi.fn().mockResolvedValue(undefined),
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    const panelRunButton = document.querySelector<HTMLElement>("[data-action='run-video']");

    expect(document.querySelector<HTMLElement>("[data-role='video-quick-card']")).toBeNull();
    expect(document.querySelector<HTMLElement>(".guardian-video-quick-card")?.classList.contains("visible")).toBe(false);
    expect(document.querySelector<HTMLElement>(".guardian-modal")?.textContent).toContain("正在整理当前视频的字幕、弹幕和评论，请稍等。");
    expect(document.querySelector<HTMLElement>(".guardian-modal")?.textContent).not.toContain("旧结果不应该继续显示。");
    expect(panelRunButton?.textContent).toContain("正在识别当前视频");
    expect(panelRunButton?.hasAttribute("disabled")).toBe(true);
  });

  it("resets the video quick card expansion state when switching to a new video", async () => {
    const config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: false,
        activeTab: "overview"
      },
      ai: {
        ...DEFAULT_CONFIG.ai,
        apiKey: "token"
      }
    };

    const runtime = createRuntime();
    runtime.route = "video";
    runtime.videoBvid = "BV1first";
    runtime.videoPhase = "ready";
    runtime.videoResult = {
      probability: 60,
      finalProbability: 60,
      start: "00:10",
      end: "00:40",
      note: "第一次视频结果。",
      source: "live",
      cacheHit: false,
      danmakuCount: 12
    };

    const controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig: vi.fn().mockResolvedValue(undefined),
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    document.querySelector<HTMLElement>("[data-action='toggle-video-quick-card']")?.click();
    expect(document.querySelector<HTMLElement>("[data-role='video-quick-card']")?.dataset.state).toBe("collapsed");

    const sameVideoRuntime = {
      ...runtime,
      videoPhase: "cached" as const
    };
    controlCenter.update(config, sameVideoRuntime);
    expect(document.querySelector<HTMLElement>("[data-role='video-quick-card']")?.dataset.state).toBe("collapsed");

    const nextVideoRuntime = {
      ...runtime,
      videoBvid: "BV1second",
      videoResult: {
        ...runtime.videoResult!,
        note: "第二个视频结果。"
      }
    };
    controlCenter.update(config, nextVideoRuntime);

    await flushPromises();
    expect(document.querySelector<HTMLElement>("[data-role='video-quick-card']")?.dataset.state).toBe("expanded");
  });

  it("keeps edge toasts in an independent host without replacing the quick card host", () => {
    const config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: false,
        activeTab: "overview"
      },
      ai: {
        ...DEFAULT_CONFIG.ai,
        apiKey: "token"
      }
    };

    const runtime = createRuntime();
    runtime.route = "video";
    runtime.videoBvid = "BV1toast";
    runtime.videoPhase = "ready";

    const controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig: vi.fn().mockResolvedValue(undefined),
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    const quickCardHost = document.querySelector(".guardian-video-quick-card");
    controlCenter.showEdgeToast("toast 文案", "info");

    const toast = document.querySelector<HTMLElement>(".guardian-edge-toast");
    expect(toast?.parentElement).toBe(document.querySelector(".guardian-edge-toast-region"));
    expect(toast?.closest(".guardian-video-quick-card")).toBeNull();
    expect(document.querySelector(".guardian-video-quick-card")).toBe(quickCardHost);
    expect(toast?.textContent).toContain("处理中");
    expect(document.querySelector(".guardian-edge-toast-dismiss")).toBeNull();
  });

  it("moves toasts inside the side panel and hides the quick card while the panel is open", () => {
    const config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: true,
        activeTab: "overview"
      },
      ai: {
        ...DEFAULT_CONFIG.ai,
        apiKey: "token"
      }
    };

    const runtime = createRuntime();
    runtime.route = "video";
    runtime.videoBvid = "BV1panel";
    runtime.videoPhase = "ready";

    const controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig: vi.fn().mockResolvedValue(undefined),
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();
    controlCenter.showEdgeToast("面板内通知", "warning", { durationMs: 0 });

    expect(document.querySelector<HTMLElement>("[data-role='video-quick-card']")).toBeNull();
    expect(document.querySelector<HTMLElement>(".guardian-video-quick-card")?.classList.contains("visible")).toBe(false);
    expect(document.querySelector<HTMLElement>(".guardian-panel-toast-region .guardian-edge-toast")?.textContent).toContain("面板内通知");
    expect(document.querySelector<HTMLElement>(".guardian-edge-toast-region .guardian-edge-toast")).toBeNull();
  });

  it("switches tabs locally and resets to overview after closing and reopening", async () => {
    let config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: true,
        activeTab: "overview"
      }
    };

    const runtime = createRuntime();
    let controlCenter!: ControlCenter;
    const onSaveConfig = vi.fn().mockResolvedValue(undefined);

    controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel: vi.fn(() => {
        config = {
          ...config,
          ui: {
            ...config.ui,
            panelOpen: !config.ui.panelOpen
          }
        };
        controlCenter.update(config, runtime);
      }),
      onSetTheme: vi.fn(),
      onSaveConfig,
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    document.querySelector<HTMLElement>("[data-tab='video']")?.click();
    await flushPromises();

    expect(document.querySelector(".guardian-tab.active")?.textContent).toContain("视频跳过");
    expect(onSaveConfig).not.toHaveBeenCalled();

    document.querySelector<HTMLElement>("[data-action='close-panel']")?.click();
    await flushPromises();
    expect(document.querySelector(".guardian-overlay.open")).toBeNull();

    await controlCenter.openPanel();
    await flushPromises();

    expect(document.querySelector(".guardian-tab.active")?.textContent).toContain("主页概览");
    expect(onSaveConfig).not.toHaveBeenCalled();
  });

  it("renders contextual overview meta without homepage-scope noise on video pages", () => {
    const config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        panelOpen: true,
        activeTab: "overview"
      },
      ai: {
        ...DEFAULT_CONFIG.ai,
        apiKey: "token"
      }
    };

    const runtime = createRuntime();
    runtime.route = "video";
    runtime.videoBvid = "BV1meta";
    runtime.videoPhase = "ready";

    const controlCenter = new ControlCenter(config, runtime, {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig: vi.fn().mockResolvedValue(undefined),
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    const items = Array.from(document.querySelectorAll(".guardian-overview-meta-item")).map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "");
    expect(items).toContain("视频状态 当前视频已就绪");
    expect(items).toContain("识别服务 已准备好");
    expect(document.querySelector(".guardian-overview-meta")?.textContent).not.toContain("当前页面暂不在首页整理范围内");
  });

  it("keeps the floating entry visible when a stored position is outside the viewport", () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 240 });

    const config: ExtensionConfig = {
      ...DEFAULT_CONFIG,
      ui: {
        ...DEFAULT_CONFIG.ui,
        floatingButtonPosition: {
          x: 9999,
          y: 9999
        }
      }
    };

    const controlCenter = new ControlCenter(config, createRuntime(), {
      onTogglePanel: vi.fn(),
      onSetTheme: vi.fn(),
      onSaveConfig: vi.fn().mockResolvedValue(undefined),
      onRunFeedScan: vi.fn(),
      onRunVideoAnalysis: vi.fn(),
      onFetchModels: vi.fn().mockResolvedValue([]),
      onToggleCurrentVideoAutoSkip: vi.fn(),
      onResetDiagnostics: vi.fn(),
      onMoveButton: vi.fn()
    });

    controlCenter.mount();

    const entry = document.querySelector<HTMLElement>(".guardian-floating-btn");
    expect(entry?.style.left).toBe("268px");
    expect(entry?.style.top).toBe("188px");

    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
  });
});
