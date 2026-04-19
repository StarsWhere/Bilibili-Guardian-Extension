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
      onSetTab: vi.fn(),
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
      onSetTab: vi.fn(),
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
      onSetTab: vi.fn(),
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
      onSetTab: vi.fn((tab) => {
        config = {
          ...config,
          ui: {
            ...config.ui,
            activeTab: tab
          }
        };
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
      onSetTab: vi.fn(),
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
});
