import { AI_PROVIDER_DEFAULTS } from "@/shared/config";
import type {
  DeepPartial,
  ExtensionConfig,
  FeedPageScope,
  PanelTabId,
  VideoAnalysisResult,
  VideoAnalysisPhase
} from "@/shared/types";
import { createStyles } from "./styles";
import { clampButtonPosition, hasDragged, snapToViewportEdge } from "./drag";

export interface GuardianRuntimeState {
  route: "feed" | "video" | "idle";
  pageScope: FeedPageScope | null;
  feedRemovedTotal: number;
  feedLastRemoved: number;
  videoBvid: string | null;
  videoPhase: VideoAnalysisPhase;
  videoError: string | null;
  videoResult: VideoAnalysisResult | null;
  currentVideoAutoSkip: boolean;
  diagnostics: string[];
}

interface ControlCenterCallbacks {
  onTogglePanel(): void;
  onSetTheme(theme: "light" | "dark"): void;
  onSaveConfig(next: DeepPartial<ExtensionConfig>): Promise<void>;
  onSetTab(tab: PanelTabId): void;
  onRunFeedScan(): void;
  onRunVideoAnalysis(): void;
  onFetchModels(provider: ExtensionConfig["ai"]["provider"], baseUrl: string): Promise<string[]>;
  onToggleCurrentVideoAutoSkip(enabled: boolean): void;
  onResetDiagnostics(): void;
  onMoveButton(nextPosition: { x: number; y: number }): void;
}

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToLines(value: string[]): string {
  return value.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
export function toDisplayRoute(route: GuardianRuntimeState["route"]): string {
  switch (route) {
    case "feed":
      return "首页内容过滤中";
    case "video":
      return "视频识别已接管";
    default:
      return "等待进入支持页面";
  }
}

export function toScopeLabel(scope: FeedPageScope | null): string {
  switch (scope) {
    case "home":
      return "首页";
    case "search":
      return "搜索结果页";
    case "popular":
      return "热门页";
    case "ranking":
      return "排行榜";
    case "channel":
      return "分区或频道页";
    default:
      return "当前页面暂不在首页整理范围内";
  }
}

export function toVideoPhaseLabel(phase: VideoAnalysisPhase): string {
  switch (phase) {
    case "collecting":
      return "正在整理参考信息";
    case "cached":
      return "已直接使用上次识别结果";
    case "analyzing":
      return "正在识别当前视频";
    case "ready":
      return "识别完成";
    case "error":
      return "这次识别失败了";
    case "skipped":
      return "已帮你自动跳过";
    default:
      return "还没开始识别";
  }
}

export function toProviderLabel(provider: ExtensionConfig["ai"]["provider"]): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "deepseek":
      return "DeepSeek";
    case "gemini":
      return "Gemini";
    case "anthropic":
      return "Anthropic";
    case "custom":
      return "自定义兼容接口";
    default:
      return provider;
  }
}

export function hasConfiguredRecognitionService(config: ExtensionConfig): boolean {
  const hasBaseUrl = config.ai.baseUrl.trim().length > 0;
  const hasModel = config.ai.model.trim().length > 0;
  const hasKey = config.ai.apiKey.trim().length > 0;

  if (config.ai.provider === "custom") {
    return hasBaseUrl && hasModel;
  }

  return hasBaseUrl && hasModel && hasKey;
}

export class ControlCenter {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLDivElement;
  private config: ExtensionConfig;
  private runtime: GuardianRuntimeState;
  private availableModels: string[] = [];

  constructor(initialConfig: ExtensionConfig, initialRuntime: GuardianRuntimeState, private readonly callbacks: ControlCenterCallbacks) {
    this.config = initialConfig;
    this.runtime = initialRuntime;
    this.root = document.createElement("div");
    this.root.id = "guardian-root";
    this.style = document.createElement("style");
    this.style.textContent = createStyles();
    this.button = document.createElement("button");
    this.button.className = "guardian-floating-btn";
    this.panel = document.createElement("div");
    this.panel.className = "guardian-panel";
  }

  mount(): void {
    this.root.append(this.style, this.button, this.panel);
    document.body.appendChild(this.root);
    this.bindFloatingButton();
    this.render();
  }

  update(config: ExtensionConfig, runtime: GuardianRuntimeState): void {
    this.config = config;
    this.runtime = runtime;
    this.render();
  }

  private bindFloatingButton(): void {
    let dragStart = { x: 0, y: 0 };
    let origin = { x: 0, y: 0 };
    let dragging = false;
    const size = 56;

    const move = (event: MouseEvent) => {
      if (!dragging) {
        return;
      }

      const next = {
        x: origin.x + (event.clientX - dragStart.x),
        y: origin.y + (event.clientY - dragStart.y)
      };

      const clamped = clampButtonPosition(next, { width: window.innerWidth, height: window.innerHeight }, size);
      this.config.ui.floatingButtonPosition = clamped;
      this.renderButtonPosition();
    };

    const end = (event: MouseEvent) => {
      if (!dragging) {
        return;
      }

      dragging = false;
      this.button.classList.remove("dragging");
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", end);

      const endPosition = this.config.ui.floatingButtonPosition;
      if (!hasDragged(origin, endPosition)) {
        this.callbacks.onTogglePanel();
        return;
      }

      const snapped = snapToViewportEdge(endPosition, { width: window.innerWidth, height: window.innerHeight }, size);
      this.config.ui.floatingButtonPosition = snapped;
      this.renderButtonPosition();
      this.callbacks.onMoveButton(snapped);
      if (event.cancelable) {
        event.preventDefault();
      }
    };

    this.button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      dragStart = { x: event.clientX, y: event.clientY };
      origin = { ...this.config.ui.floatingButtonPosition };
      dragging = true;
      this.button.classList.add("dragging");
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", end);
    });

    window.addEventListener("resize", () => {
      const clamped = clampButtonPosition(
        this.config.ui.floatingButtonPosition,
        { width: window.innerWidth, height: window.innerHeight },
        size
      );
      this.config.ui.floatingButtonPosition = clamped;
      this.renderButtonPosition();
      this.renderPanelPosition();
    });
  }

  private render(): void {
    document.body.dataset.guardianTheme = this.config.ui.theme;
    this.renderButton();
    this.renderPanel();
  }

  private renderButton(): void {
    const badge = this.runtime.route === "feed"
      ? String(Math.min(99, this.runtime.feedLastRemoved || this.runtime.feedRemovedTotal))
      : this.runtime.route === "video"
        ? this.renderVideoBadge()
        : "G";

    this.button.innerHTML = `
      <span style="font-size:22px;font-weight:800;">守</span>
      <span class="guardian-floating-btn-badge">${badge}</span>
    `;
    this.renderButtonPosition();
  }

  private renderVideoBadge(): string {
    switch (this.runtime.videoPhase) {
      case "analyzing":
      case "collecting":
        return "...";
      case "ready":
      case "cached":
      case "skipped":
        return this.runtime.videoResult ? String(this.runtime.videoResult.finalProbability) : "AI";
      case "error":
        return "!";
      default:
        return "AI";
    }
  }

  private renderButtonPosition(): void {
    this.button.style.left = `${this.config.ui.floatingButtonPosition.x}px`;
    this.button.style.top = `${this.config.ui.floatingButtonPosition.y}px`;
  }

  private renderPanel(): void {
    this.panel.classList.toggle("open", this.config.ui.panelOpen);
    this.renderPanelPosition();

    const diagnostics = this.runtime.diagnostics.length > 0 ? this.runtime.diagnostics.join("\n") : "暂无诊断日志。";
    const videoStatus = this.renderVideoStatus();
    const feedScopeInfo = this.runtime.pageScope ? this.runtime.pageScope : "当前页面不在推荐流范围";

    this.panel.innerHTML = `
      <div class="guardian-panel-header">
        <div>
          <h2 class="guardian-title">Bilibili Guardian</h2>
          <p class="guardian-subtitle">统一控制台 · 推荐流过滤 + 视频 AI 跳过</p>
        </div>
        <div class="guardian-header-actions">
          <button class="guardian-icon-btn" data-action="toggle-theme">${this.config.ui.theme === "dark" ? "☀" : "☾"}</button>
          <button class="guardian-icon-btn" data-action="close-panel">×</button>
        </div>
      </div>
      <div class="guardian-tabs">
        ${this.renderTabs()}
      </div>
      <div class="guardian-panel-body">
        ${this.config.ui.activeTab === "overview" ? `
          <section class="guardian-card">
            <h3 class="guardian-card-title">总览</h3>
            <div class="guardian-metrics">
              <div class="guardian-metric">
                <div class="guardian-metric-label">当前场景</div>
                <div class="guardian-metric-value">${this.runtime.route === "feed" ? "推荐流" : this.runtime.route === "video" ? "视频页" : "待机"}</div>
              </div>
              <div class="guardian-metric">
                <div class="guardian-metric-label">最近过滤数量</div>
                <div class="guardian-metric-value">${this.runtime.feedLastRemoved}</div>
              </div>
            </div>
            <div class="guardian-chip-row">
              <span class="guardian-chip">Feed Scope: ${escapeHtml(feedScopeInfo)}</span>
              ${this.runtime.videoBvid ? `<span class="guardian-chip">BV: ${escapeHtml(this.runtime.videoBvid)}</span>` : ""}
            </div>
            <div class="guardian-status">${videoStatus}</div>
            <div class="guardian-actions">
              <button class="guardian-btn primary" data-action="run-feed">立即扫描推荐流</button>
              <button class="guardian-btn" data-action="run-video">重新分析当前视频</button>
            </div>
          </section>
        ` : ""}

        ${this.config.ui.activeTab === "feed" ? `
          <section class="guardian-card">
            <h3 class="guardian-card-title">推荐流过滤</h3>
            <div class="guardian-switch-row"><strong>启用推荐流过滤</strong><input type="checkbox" data-field="feed.enabled" ${this.config.feed.enabled ? "checked" : ""}></div>
            <div class="guardian-switch-row"><strong>广告卡片过滤</strong><input type="checkbox" data-field="feed.blockAds" ${this.config.feed.blockAds ? "checked" : ""}></div>
            <div class="guardian-switch-row"><strong>直播卡片过滤</strong><input type="checkbox" data-field="feed.blockLive" ${this.config.feed.blockLive ? "checked" : ""}></div>
            <div class="guardian-switch-row"><strong>持续监听页面变化</strong><input type="checkbox" data-field="feed.continuousScan" ${this.config.feed.continuousScan ? "checked" : ""}></div>
            <label class="guardian-label">页面范围
              <div class="guardian-checklist">
                ${(["home", "search", "popular", "ranking", "channel"] as const).map((scope) => `
                  <label><input type="checkbox" data-scope="${scope}" ${this.config.feed.scopes.includes(scope) ? "checked" : ""}> ${scope}</label>
                `).join("")}
              </div>
            </label>
            <div class="guardian-grid-2">
              <label class="guardian-label">分类黑名单
                <textarea class="guardian-textarea" data-field="feed.categoryBlacklist">${escapeHtml(listToLines(this.config.feed.categoryBlacklist))}</textarea>
              </label>
              <label class="guardian-label">关键词黑名单
                <textarea class="guardian-textarea" data-field="feed.keywordBlacklist">${escapeHtml(listToLines(this.config.feed.keywordBlacklist))}</textarea>
              </label>
            </div>
            <div class="guardian-actions">
              <button class="guardian-btn primary" data-action="save-feed">保存过滤设置</button>
              <button class="guardian-btn" data-action="run-feed">立即扫描</button>
            </div>
          </section>
        ` : ""}

        ${this.config.ui.activeTab === "video" ? `
          <section class="guardian-card">
            <h3 class="guardian-card-title">视频页跳过</h3>
            <div class="guardian-switch-row"><strong>启用视频分析</strong><input type="checkbox" data-field="video.enabled" ${this.config.video.enabled ? "checked" : ""}></div>
            <div class="guardian-switch-row"><strong>默认自动跳过</strong><input type="checkbox" data-field="video.defaultAutoSkip" ${this.config.video.defaultAutoSkip ? "checked" : ""}></div>
            <div class="guardian-switch-row"><strong>当前视频自动跳过</strong><input type="checkbox" data-action="toggle-current-skip" ${this.runtime.currentVideoAutoSkip ? "checked" : ""}></div>
            <div class="guardian-grid-2">
              <label class="guardian-label">概率阈值
                <input class="guardian-field" data-field="video.probabilityThreshold" type="number" value="${this.config.video.probabilityThreshold}">
              </label>
              <label class="guardian-label">时长惩罚
                <input class="guardian-field" data-field="video.durationPenalty" type="number" value="${this.config.video.durationPenalty}">
              </label>
              <label class="guardian-label">最小时长（秒）
                <input class="guardian-field" data-field="video.minAdDuration" type="number" value="${this.config.video.minAdDuration}">
              </label>
              <label class="guardian-label">最大时长（秒）
                <input class="guardian-field" data-field="video.maxAdDuration" type="number" value="${this.config.video.maxAdDuration}">
              </label>
              <label class="guardian-label">最少弹幕数
                <input class="guardian-field" data-field="video.minDanmakuForAnalysis" type="number" value="${this.config.video.minDanmakuForAnalysis}">
              </label>
              <label class="guardian-label">缓存 TTL（分钟）
                <input class="guardian-field" data-field="video.cacheTtlMinutes" type="number" value="${this.config.video.cacheTtlMinutes}">
              </label>
            </div>
            <div class="guardian-actions">
              <button class="guardian-btn primary" data-action="save-video">保存视频设置</button>
              <button class="guardian-btn" data-action="run-video">重新分析</button>
            </div>
            <div class="guardian-status">${videoStatus}</div>
          </section>
        ` : ""}

        ${this.config.ui.activeTab === "ai" ? `
          <section class="guardian-card">
            <h3 class="guardian-card-title">AI 设置</h3>
            <div class="guardian-grid-2">
              <label class="guardian-label">Provider
                <select class="guardian-select" data-field="ai.provider">
                  ${Object.keys(AI_PROVIDER_DEFAULTS).map((provider) => `<option value="${provider}" ${this.config.ai.provider === provider ? "selected" : ""}>${provider}</option>`).join("")}
                </select>
              </label>
              <label class="guardian-label">Model
                <input class="guardian-field" data-field="ai.model" value="${escapeHtml(this.config.ai.model)}">
              </label>
            </div>
            <label class="guardian-label">API Base URL
              <input class="guardian-field" data-field="ai.baseUrl" value="${escapeHtml(this.config.ai.baseUrl)}">
            </label>
            <label class="guardian-label">API Key
              <input class="guardian-field" data-field="ai.apiKey" type="password" value="${escapeHtml(this.config.ai.apiKey)}">
            </label>
            <label class="guardian-label">Agent Prompt
              <textarea class="guardian-textarea" data-field="ai.prompt">${escapeHtml(this.config.ai.prompt)}</textarea>
            </label>
            <div class="guardian-grid-2">
              <label class="guardian-label">白名单
                <textarea class="guardian-textarea" data-field="ai.whitelist">${escapeHtml(listToLines(this.config.ai.whitelist))}</textarea>
              </label>
              <label class="guardian-label">黑名单
                <textarea class="guardian-textarea" data-field="ai.blacklist">${escapeHtml(listToLines(this.config.ai.blacklist))}</textarea>
              </label>
            </div>
            <div class="guardian-checklist">
              <label><input type="checkbox" data-field="ai.whitelistEnabled" ${this.config.ai.whitelistEnabled ? "checked" : ""}> 启用白名单</label>
              <label><input type="checkbox" data-field="ai.whitelistRegex" ${this.config.ai.whitelistRegex ? "checked" : ""}> 白名单正则</label>
              <label><input type="checkbox" data-field="ai.blacklistEnabled" ${this.config.ai.blacklistEnabled ? "checked" : ""}> 启用黑名单</label>
              <label><input type="checkbox" data-field="ai.blacklistRegex" ${this.config.ai.blacklistRegex ? "checked" : ""}> 黑名单正则</label>
            </div>
            <div class="guardian-actions">
              <button class="guardian-btn primary" data-action="save-ai">保存 AI 设置</button>
              <button class="guardian-btn" data-action="fetch-models">拉取模型列表</button>
            </div>
            ${this.availableModels.length > 0 ? `<div class="guardian-chip-row">${this.availableModels.map((model) => `<span class="guardian-chip">${escapeHtml(model)}</span>`).join("")}</div>` : ""}
          </section>
        ` : ""}

        ${this.config.ui.activeTab === "diagnostics" ? `
          <section class="guardian-card">
            <h3 class="guardian-card-title">诊断</h3>
            <div class="guardian-note">这里会显示当前路由、运行日志和最近错误，方便排查页面结构变化、AI 响应异常和自动跳过逻辑。</div>
            <div class="guardian-diagnostics">${escapeHtml(diagnostics)}</div>
            <div class="guardian-actions">
              <button class="guardian-btn" data-action="clear-diagnostics">清空日志</button>
            </div>
          </section>
        ` : ""}
      </div>
    `;

    this.bindPanelEvents();
  }

  private renderTabs(): string {
    const tabs: Array<{ id: PanelTabId; label: string }> = [
      { id: "overview", label: "总览" },
      { id: "feed", label: "过滤" },
      { id: "video", label: "视频" },
      { id: "ai", label: "AI" },
      { id: "diagnostics", label: "诊断" }
    ];

    return tabs
      .map(
        (tab) =>
          `<button class="guardian-tab ${this.config.ui.activeTab === tab.id ? "active" : ""}" data-tab="${tab.id}">${tab.label}</button>`
      )
      .join("");
  }

  private renderVideoStatus(): string {
    const result = this.runtime.videoResult;
    const pill = this.runtime.videoError
      ? `<span class="guardian-pill danger">失败</span>`
      : this.runtime.videoPhase === "analyzing" || this.runtime.videoPhase === "collecting"
        ? `<span class="guardian-pill info">分析中</span>`
        : result && result.finalProbability >= this.config.video.probabilityThreshold
          ? `<span class="guardian-pill success">可跳过</span>`
          : `<span class="guardian-pill info">待机</span>`;

    const range = result?.start && result?.end ? `${result.start} - ${result.end}` : "未识别到有效区间";
    const probability = result ? `${result.finalProbability}%（原始 ${result.probability}%）` : "--";
    const note = this.runtime.videoError || result?.note || "尚未开始分析。";

    return `${pill}<br><strong>阶段：</strong>${this.runtime.videoPhase}<br><strong>区间：</strong>${escapeHtml(range)}<br><strong>概率：</strong>${escapeHtml(probability)}<br><strong>说明：</strong>${escapeHtml(note)}`;
  }

  private renderPanelPosition(): void {
    const x = this.config.ui.floatingButtonPosition.x + 68;
    const y = this.config.ui.floatingButtonPosition.y;
    this.panel.style.left = `${Math.min(x, window.innerWidth - this.panel.offsetWidth - 12)}px`;
    this.panel.style.top = `${Math.min(y, window.innerHeight - 120)}px`;
  }

  private bindPanelEvents(): void {
    this.panel.querySelectorAll<HTMLElement>("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.tab as PanelTabId;
        this.callbacks.onSetTab(tab);
      });
    });

    this.panel.querySelector<HTMLElement>("[data-action='toggle-theme']")?.addEventListener("click", () => {
      this.callbacks.onSetTheme(this.config.ui.theme === "dark" ? "light" : "dark");
    });

    this.panel.querySelector<HTMLElement>("[data-action='close-panel']")?.addEventListener("click", () => {
      this.callbacks.onTogglePanel();
    });

    this.panel.querySelector<HTMLElement>("[data-action='run-feed']")?.addEventListener("click", () => {
      this.callbacks.onRunFeedScan();
    });

    this.panel.querySelector<HTMLElement>("[data-action='run-video']")?.addEventListener("click", () => {
      this.callbacks.onRunVideoAnalysis();
    });

    this.panel.querySelector<HTMLElement>("[data-action='clear-diagnostics']")?.addEventListener("click", () => {
      this.callbacks.onResetDiagnostics();
    });

    this.panel.querySelector<HTMLInputElement>("[data-action='toggle-current-skip']")?.addEventListener("change", (event) => {
      this.callbacks.onToggleCurrentVideoAutoSkip((event.currentTarget as HTMLInputElement).checked);
    });

    this.panel.querySelector<HTMLElement>("[data-action='save-feed']")?.addEventListener("click", async () => {
      await this.callbacks.onSaveConfig({
        feed: {
          ...this.config.feed,
          enabled: this.readCheckbox("feed.enabled"),
          blockAds: this.readCheckbox("feed.blockAds"),
          blockLive: this.readCheckbox("feed.blockLive"),
          continuousScan: this.readCheckbox("feed.continuousScan"),
          scopes: this.readScopes(),
          categoryBlacklist: linesToList(this.readField("feed.categoryBlacklist")),
          keywordBlacklist: linesToList(this.readField("feed.keywordBlacklist"))
        }
      });
    });

    this.panel.querySelector<HTMLElement>("[data-action='save-video']")?.addEventListener("click", async () => {
      await this.callbacks.onSaveConfig({
        video: {
          ...this.config.video,
          enabled: this.readCheckbox("video.enabled"),
          defaultAutoSkip: this.readCheckbox("video.defaultAutoSkip"),
          probabilityThreshold: Number(this.readField("video.probabilityThreshold")),
          durationPenalty: Number(this.readField("video.durationPenalty")),
          minAdDuration: Number(this.readField("video.minAdDuration")),
          maxAdDuration: Number(this.readField("video.maxAdDuration")),
          minDanmakuForAnalysis: Number(this.readField("video.minDanmakuForAnalysis")),
          cacheTtlMinutes: Number(this.readField("video.cacheTtlMinutes"))
        }
      });
    });

    this.panel.querySelector<HTMLElement>("[data-action='save-ai']")?.addEventListener("click", async () => {
      await this.callbacks.onSaveConfig({
        ai: {
          ...this.config.ai,
          provider: this.readField("ai.provider") as ExtensionConfig["ai"]["provider"],
          model: this.readField("ai.model"),
          baseUrl: this.readField("ai.baseUrl"),
          apiKey: this.readField("ai.apiKey"),
          prompt: this.readField("ai.prompt"),
          whitelist: linesToList(this.readField("ai.whitelist")),
          blacklist: linesToList(this.readField("ai.blacklist")),
          whitelistEnabled: this.readCheckbox("ai.whitelistEnabled"),
          whitelistRegex: this.readCheckbox("ai.whitelistRegex"),
          blacklistEnabled: this.readCheckbox("ai.blacklistEnabled"),
          blacklistRegex: this.readCheckbox("ai.blacklistRegex")
        }
      });
    });

    this.panel.querySelector<HTMLElement>("[data-action='fetch-models']")?.addEventListener("click", async () => {
      const provider = this.readField("ai.provider") as ExtensionConfig["ai"]["provider"];
      const baseUrl = this.readField("ai.baseUrl");
      this.availableModels = await this.callbacks.onFetchModels(provider, baseUrl);
      this.renderPanel();
    });
  }

  private readField(field: string): string {
    const element = this.panel.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-field="${field}"]`);
    return element?.value ?? "";
  }

  private readCheckbox(field: string): boolean {
    const element = this.panel.querySelector<HTMLInputElement>(`[data-field="${field}"]`);
    return Boolean(element?.checked);
  }

  private readScopes(): FeedPageScope[] {
    return Array.from(this.panel.querySelectorAll<HTMLInputElement>("[data-scope]"))
      .filter((input) => input.checked)
      .map((input) => input.dataset.scope as FeedPageScope);
  }
}
