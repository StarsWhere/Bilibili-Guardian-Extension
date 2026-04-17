import { sendMessage } from "./bridge";
import { FeedGuard } from "./modules/feedGuard";
import { VideoGuard } from "./modules/videoGuard";
import { RouteManager } from "./router";
import { ControlCenter, type GuardianRuntimeState } from "./ui/ControlCenter";
import type { DeepPartial, ExtensionConfig, PanelTabId } from "@/shared/types";
import type { RouteModule } from "@/shared/router";
import { classifyFeedPage, isVideoPage } from "@/shared/url";

class GuardianApp {
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
    currentVideoAutoSkip: false,
    diagnostics: []
  };
  private readonly ui!: ControlCenter;
  private readonly feedGuard!: FeedGuard;
  private readonly videoGuard!: VideoGuard;
  private readonly routeManager!: RouteManager;

  constructor() {
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
      sendFeedScanMetric: (blockedCount) => sendMessage("RUN_FEED_SCAN", { blockedCount }).then(() => undefined)
    });

    this.videoGuard = new VideoGuard({
      get config() {
        return app.config;
      },
      getCurrentVideoAutoSkip: () => this.runtime.currentVideoAutoSkip,
      setCurrentVideoState: (patch) => {
        this.runtime.route = "video";
        this.runtime.videoBvid = patch.bvid ?? this.runtime.videoBvid;
        this.runtime.videoPhase = patch.phase ?? this.runtime.videoPhase;
        this.runtime.videoError = patch.error ?? this.runtime.videoError;
        this.runtime.videoResult = patch.result ?? this.runtime.videoResult;
        this.render();
      },
      log: (message) => this.log(message),
      getCachedVideoResult: (bvid) => sendMessage("GET_CACHED_VIDEO_RESULT", { bvid }),
      analyzeVideo: (payload) => sendMessage("ANALYZE_VIDEO", payload),
      cancelVideoAnalysis: async (requestId) => {
        await sendMessage("CANCEL_VIDEO_ANALYSIS", { requestId });
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
          await this.videoGuard.mount(currentUrl);
        },
        unmount: async () => {
          await this.videoGuard.unmount();
          this.runtime.videoPhase = "idle";
          this.runtime.videoError = null;
          this.runtime.videoResult = null;
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
      {} as ExtensionConfig,
      this.runtime,
      {
        onTogglePanel: () => void this.togglePanel(),
        onSetTheme: (theme) => void this.saveConfig({ ui: { ...this.config.ui, theme } }),
        onSaveConfig: (next) => this.saveConfig(next),
        onSetTab: (tab) => void this.setTab(tab),
        onRunFeedScan: () => this.feedGuard.runScan(),
        onRunVideoAnalysis: () => void this.videoGuard.rerun(true),
        onFetchModels: (provider, baseUrl) => sendMessage("FETCH_MODELS", { provider, baseUrl }),
        onToggleCurrentVideoAutoSkip: (enabled) => {
          this.runtime.currentVideoAutoSkip = enabled;
          this.videoGuard.setAutoSkipEnabled(enabled);
          this.render();
        },
        onResetDiagnostics: () => {
          this.runtime.diagnostics = [];
          this.render();
        },
        onMoveButton: (nextPosition) => void this.saveConfig({ ui: { ...this.config.ui, floatingButtonPosition: nextPosition } })
      }
    );
  }

  async init(): Promise<void> {
    this.config = await sendMessage("GET_CONFIG", undefined);
    this.runtime.currentVideoAutoSkip = this.config.video.defaultAutoSkip;
    this.ui.update(this.config, this.runtime);
    this.ui.mount();
    this.render();
    this.routeManager.start();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes["guardian.config"]) {
        return;
      }

      const nextValue = changes["guardian.config"].newValue as ExtensionConfig;
      if (!nextValue) {
        return;
      }

      const previousConfig = this.config;
      this.config = nextValue;
      this.runtime.currentVideoAutoSkip = nextValue.video.defaultAutoSkip;
      this.render();
      if (this.shouldRefreshRoute(nextValue, previousConfig)) {
        void this.routeManager.refresh();
      }
    });
  }

  private async saveConfig(patch: DeepPartial<ExtensionConfig>): Promise<void> {
    const previousConfig = this.config;
    this.config = await sendMessage("SAVE_CONFIG", patch);
    this.log("配置已保存");
    this.render();
    if (this.shouldRefreshRoute(this.config, previousConfig)) {
      await this.routeManager.refresh();
    }
  }

  private async togglePanel(): Promise<void> {
    await this.saveConfig({ ui: { ...this.config.ui, panelOpen: !this.config.ui.panelOpen } });
  }

  private async setTab(tab: PanelTabId): Promise<void> {
    await this.saveConfig({ ui: { ...this.config.ui, activeTab: tab } });
  }

  private render(): void {
    document.body.dataset.guardianTheme = this.config?.ui?.theme ?? "light";
    this.ui.update(this.config, this.runtime);
  }

  log(message: string): void {
    const stamped = `[${new Date().toLocaleTimeString()}] ${message}`;
    this.runtime.diagnostics = [stamped, ...this.runtime.diagnostics].slice(0, 40);
    this.render();
  }

  private shouldRefreshRoute(nextConfig: ExtensionConfig, previousConfig = this.config): boolean {
    return JSON.stringify(previousConfig.feed) !== JSON.stringify(nextConfig.feed) ||
      JSON.stringify(previousConfig.video) !== JSON.stringify(nextConfig.video) ||
      JSON.stringify(previousConfig.ai) !== JSON.stringify(nextConfig.ai);
  }
}

const app = new GuardianApp();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void app.init();
  });
} else {
  void app.init();
}
