import { FeedGuard } from "@/content/modules/feedGuard";
import { VideoGuard } from "@/content/modules/videoGuard";
import { RouteManager } from "@/content/router";
import { ControlCenter, hasConfiguredRecognitionService, type GuardianRuntimeState } from "@/content/ui/ControlCenter";
import { DEFAULT_CONFIG } from "@/shared/config";
import type { GuardianPlatformServices } from "@/shared/platform";
import type { RouteModule } from "@/shared/router";
import type { DeepPartial, ExtensionConfig, VideoAnalysisErrorDetails } from "@/shared/types";
import { classifyFeedPage, isVideoPage } from "@/shared/url";

function hasOwnPatchField<T extends object, K extends PropertyKey>(
  patch: T,
  key: K
): patch is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(patch, key);
}

export class GuardianApp {
  config!: ExtensionConfig;
  runtime: GuardianRuntimeState = {
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

  private readonly ui: ControlCenter;
  private readonly feedGuard: FeedGuard;
  private readonly videoGuard: VideoGuard;
  private readonly routeManager: RouteManager;
  private unsubscribeConfigChange: (() => void) | null = null;

  constructor(private readonly services: GuardianPlatformServices) {
    const app = this;

    this.feedGuard = new FeedGuard({
      get config() {
        return app.config;
      },
      notifyFeedScan: ({ removedCount, scope }) => {
        const previousRoute = app.runtime.route;
        const previousScope = app.runtime.pageScope;

        app.runtime.route = removedCount >= 0 ? "feed" : app.runtime.route;
        app.runtime.pageScope = scope;

        if (removedCount > 0) {
          app.runtime.feedRemovedTotal += removedCount;
          app.runtime.feedLastRemoved = removedCount;
          app.render();
          return;
        }

        if (previousRoute !== app.runtime.route || previousScope !== app.runtime.pageScope) {
          app.render();
        }
      },
      log: (message) => this.log(message),
      sendFeedScanMetric: (blockedCount) => this.services.sendFeedScanMetric(blockedCount),
      submitFeedFeedback: (payload) => this.services.submitFeedFeedback(payload)
    });

    this.videoGuard = new VideoGuard({
      get config() {
        return app.config;
      },
      getCurrentVideoAutoSkip: () => this.runtime.currentVideoAutoSkip,
      setCurrentVideoState: (patch) => {
        const previousPhase = this.runtime.videoPhase;
        const previousError = this.runtime.videoError;
        const previousResult = this.runtime.videoResult;
        this.runtime.route = "video";
        if (hasOwnPatchField(patch, "bvid")) {
          this.runtime.videoBvid = patch.bvid as typeof this.runtime.videoBvid;
        }
        if (hasOwnPatchField(patch, "phase")) {
          this.runtime.videoPhase = patch.phase as typeof this.runtime.videoPhase;
        }
        if (hasOwnPatchField(patch, "error")) {
          this.runtime.videoError = patch.error as typeof this.runtime.videoError;
        }
        if (hasOwnPatchField(patch, "result")) {
          this.runtime.videoResult = patch.result as typeof this.runtime.videoResult;
        }
        if (hasOwnPatchField(patch, "errorDetails")) {
          this.runtime.videoErrorDetails = patch.errorDetails as typeof this.runtime.videoErrorDetails;
        }
        this.render();
        this.maybeShowVideoStateToast(previousPhase, previousError, previousResult);
      },
      log: (message) => this.log(message),
      logVideoDiagnostic: (details) => this.logVideoDiagnostic(details),
      getCachedVideoResult: (bvid) => this.services.getCachedVideoResult(bvid),
      analyzeVideo: (payload) => this.services.analyzeVideo(payload),
      cancelVideoAnalysis: async (requestId) => {
        await this.services.cancelVideoAnalysis(requestId);
      }
    });

    const routeModules: RouteModule[] = [
      {
        id: "video",
        match: (url) => this.config.video.enabled && isVideoPage(url),
        mount: async ({ currentUrl }) => {
          this.runtime.route = "video";
          this.runtime.pageScope = null;
          this.runtime.currentVideoAutoSkip = this.config.video.defaultAutoSkip;
          this.render();
          if (!hasConfiguredRecognitionService(this.config)) {
            this.ui.showEdgeToast("视频识别服务还没设置好。", "warning", {
              durationMs: 4200,
              actionLabel: "去配置",
              onAction: () => {
                void this.ui.openAdvancedPanelSection("service");
              }
            });
          }
          await this.videoGuard.mount(currentUrl);
        },
        unmount: async () => {
          await this.videoGuard.unmount();
          this.runtime.videoPhase = "idle";
          this.runtime.videoError = null;
          this.runtime.videoResult = null;
          this.runtime.videoErrorDetails = null;
          this.runtime.videoBvid = null;
          this.render();
        }
      },
      {
        id: "feed",
        match: (url) => Boolean(classifyFeedPage(url)) && this.config.feed.enabled,
        mount: async ({ currentUrl }) => {
          this.runtime.route = "feed";
          this.runtime.pageScope = classifyFeedPage(currentUrl);
          this.render();
          await this.feedGuard.mount(currentUrl);
        },
        unmount: async () => {
          this.feedGuard.unmount();
          this.runtime.route = "idle";
          this.runtime.pageScope = null;
          this.render();
        }
      }
    ];

    this.routeManager = new RouteManager(routeModules);
    this.ui = new ControlCenter(
      DEFAULT_CONFIG,
      this.runtime,
      {
        onTogglePanel: () => this.togglePanel(),
        onSetTheme: (theme) => this.saveConfig({ ui: { ...this.config.ui, theme } }),
        onSaveConfig: (next) => this.saveConfig(next),
        onRunFeedScan: () => this.feedGuard.runScan(),
        onRunVideoAnalysis: () => this.videoGuard.rerun(true),
        onFetchModels: (provider, baseUrl) => this.services.fetchModels(provider, baseUrl),
        onToggleCurrentVideoAutoSkip: (enabled) => {
          this.runtime.currentVideoAutoSkip = enabled;
          this.videoGuard.setAutoSkipEnabled(enabled);
          this.render();
        },
        onResetDiagnostics: () => {
          this.runtime.diagnostics = [];
          this.runtime.videoErrorDetails = null;
          this.render();
        },
        onMoveButton: (nextPosition) => void this.saveConfig({ ui: { ...this.config.ui, floatingButtonPosition: nextPosition } })
      }
    );
  }

  async init(): Promise<void> {
    this.config = await this.services.loadConfig();
    this.runtime.currentVideoAutoSkip = this.config.video.defaultAutoSkip;
    this.ui.update(this.config, this.runtime);
    this.ui.mount();
    this.render();
    this.routeManager.start();
    this.unsubscribeConfigChange = this.services.subscribeConfigChanges((nextValue) => {
      const previousConfig = this.config;
      this.config = nextValue;
      this.runtime.currentVideoAutoSkip = nextValue.video.defaultAutoSkip;
      this.render();
      if (this.shouldRefreshRoute(nextValue, previousConfig)) {
        void this.routeManager.refresh();
      }
    });
  }

  async togglePanel(): Promise<void> {
    await this.saveConfig({ ui: { ...this.config.ui, panelOpen: !this.config.ui.panelOpen } });
  }

  destroy(): void {
    this.unsubscribeConfigChange?.();
    this.unsubscribeConfigChange = null;
    this.routeManager.stop();
  }

  log(message: string): void {
    const stamped = `[${new Date().toLocaleTimeString()}] ${message}`;
    this.runtime.diagnostics = [stamped, ...this.runtime.diagnostics].slice(0, 40);
    this.render();
  }

  logVideoDiagnostic(details: VideoAnalysisErrorDetails): void {
    this.log(`视频诊断：${details.provider} / ${details.model} / ${details.code} / ${details.responseSource}`);

    if (details.responsePreview) {
      const compactPreview = details.responsePreview.replace(/\s+/g, " ").trim();
      this.log(`AI 返回预览：${compactPreview}`);
    }
  }

  private async saveConfig(patch: DeepPartial<ExtensionConfig>): Promise<void> {
    const previousConfig = this.config;
    this.config = await this.services.saveConfig(patch);
    this.log("配置已保存");
    this.render();
    if (this.shouldRefreshRoute(this.config, previousConfig)) {
      await this.routeManager.refresh();
    }
  }

  private render(): void {
    document.body.dataset.guardianTheme = this.config?.ui?.theme ?? "light";
    this.ui.update(this.config, this.runtime);
  }

  private maybeShowVideoStateToast(
    previousPhase: GuardianRuntimeState["videoPhase"],
    previousError: GuardianRuntimeState["videoError"],
    previousResult: GuardianRuntimeState["videoResult"]
  ): void {
    if (this.runtime.route !== "video") {
      return;
    }

    if (this.runtime.videoPhase === previousPhase && this.runtime.videoError === previousError && this.runtime.videoResult === previousResult) {
      return;
    }

    if (this.runtime.videoPhase === "analyzing" && previousPhase !== "analyzing") {
      this.ui.showEdgeToast("正在识别当前视频。", "info", { durationMs: 2200 });
      return;
    }

    if (this.runtime.videoPhase === "cached" && previousPhase !== "cached") {
      this.ui.showEdgeToast("已直接使用上次识别结果。", "info", { durationMs: 2600 });
      return;
    }

    if (this.runtime.videoPhase === "ready" && previousPhase !== "ready" && this.runtime.videoResult) {
      const result = this.runtime.videoResult;
      if (result.finalProbability >= this.config.video.probabilityThreshold && result.start && result.end) {
        this.ui.showEdgeToast(`识别完成，建议在 ${result.start} - ${result.end} 跳过。`, "success", {
          durationMs: 3600
        });
      } else {
        this.ui.showEdgeToast("识别完成，当前没有明显需要跳过的片段。", "info", {
          durationMs: 3200
        });
      }
      return;
    }

    if (this.runtime.videoPhase === "error" && this.runtime.videoError && this.runtime.videoError !== previousError) {
      this.ui.showEdgeToast(`视频识别失败：${this.runtime.videoError}`, "danger", {
        durationMs: 5200,
        actionLabel: "查看排查",
        onAction: () => {
          void this.ui.openAdvancedPanelSection("diagnostics");
        }
      });
      return;
    }

    if (this.runtime.videoPhase === "skipped" && previousPhase !== "skipped" && this.runtime.videoResult?.start && this.runtime.videoResult?.end) {
      this.ui.showEdgeToast(`已自动跳过 ${this.runtime.videoResult.start} - ${this.runtime.videoResult.end}。`, "success", {
        durationMs: 3200
      });
    }
  }

  private shouldRefreshRoute(nextConfig: ExtensionConfig, previousConfig = this.config): boolean {
    return JSON.stringify(previousConfig.feed) !== JSON.stringify(nextConfig.feed) ||
      JSON.stringify(previousConfig.video) !== JSON.stringify(nextConfig.video) ||
      JSON.stringify(previousConfig.ai) !== JSON.stringify(nextConfig.ai);
  }
}
