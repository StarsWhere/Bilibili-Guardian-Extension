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

type DisplayTabId = "overview" | "feed" | "video" | "advanced";
type ToastTone = "info" | "success" | "warning" | "danger";

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

function normalizeTab(tab: PanelTabId): DisplayTabId {
  if (tab === "ai" || tab === "diagnostics") {
    return "advanced";
  }

  return tab;
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

function getVideoSummary(result: VideoAnalysisResult | null, error: string | null): string {
  if (error) {
    return error;
  }

  if (!result) {
    return "打开视频后，扩展会自动尝试识别其中可能需要跳过的片段。";
  }

  return result.note || "已获得本次识别说明。";
}

export class ControlCenter {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly button: HTMLButtonElement;
  private readonly overlay: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private config: ExtensionConfig;
  private runtime: GuardianRuntimeState;
  private availableModels: string[] = [];
  private isOpen = false;
  private restoreFocusTarget: HTMLElement | null = null;
  private previousBodyOverflow = "";
  private previousHtmlOverflow = "";
  private toast: { text: string; tone: ToastTone } | null = null;
  private toastTimer: number | null = null;

  constructor(initialConfig: ExtensionConfig, initialRuntime: GuardianRuntimeState, private readonly callbacks: ControlCenterCallbacks) {
    this.config = initialConfig;
    this.runtime = initialRuntime;
    this.root = document.createElement("div");
    this.root.id = "guardian-root";
    this.style = document.createElement("style");
    this.style.textContent = createStyles();
    this.button = document.createElement("button");
    this.button.className = "guardian-floating-btn";
    this.button.type = "button";
    this.overlay = document.createElement("div");
    this.overlay.className = "guardian-overlay";
    this.panel = document.createElement("div");
    this.panel.className = "guardian-modal";
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.tabIndex = -1;
  }

  mount(): void {
    this.overlay.appendChild(this.panel);
    this.root.append(this.style, this.button, this.overlay);
    document.body.appendChild(this.root);
    this.bindFloatingButton();
    this.bindGlobalEvents();
    this.render();
  }

  update(config: ExtensionConfig, runtime: GuardianRuntimeState): void {
    this.config = config;
    this.runtime = runtime;
    this.render();
  }

  private bindGlobalEvents(): void {
    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay && this.config.ui.panelOpen) {
        this.callbacks.onTogglePanel();
      }
    });

    this.overlay.addEventListener(
      "wheel",
      (event) => {
        if (this.config.ui.panelOpen && event.target === this.overlay) {
          event.preventDefault();
        }
      },
      { passive: false }
    );

    this.panel.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    this.panel.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.config.ui.panelOpen) {
        event.preventDefault();
        this.callbacks.onTogglePanel();
      }
    });
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
        this.restoreFocusTarget = this.button;
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
    });
  }

  private render(): void {
    const wasOpen = this.isOpen;
    const isOpen = this.config.ui.panelOpen;

    document.body.dataset.guardianTheme = this.config.ui.theme;
    this.renderButton();
    this.renderModal();

    this.isOpen = isOpen;
    if (!wasOpen && isOpen) {
      this.handleOpen();
    } else if (wasOpen && !isOpen) {
      this.handleClose();
    }
  }

  private handleOpen(): void {
    this.previousBodyOverflow = document.body.style.overflow;
    this.previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    window.requestAnimationFrame(() => {
      const firstFocusable = this.panel.querySelector<HTMLElement>(
        "button, input, select, textarea, [href], [tabindex]:not([tabindex='-1'])"
      );
      (firstFocusable ?? this.panel).focus();
    });
  }

  private handleClose(): void {
    document.body.style.overflow = this.previousBodyOverflow;
    document.documentElement.style.overflow = this.previousHtmlOverflow;
    this.restoreFocusTarget?.focus();
    this.restoreFocusTarget = null;
  }

  private renderButton(): void {
    const badge = this.runtime.route === "feed"
      ? String(Math.min(99, this.runtime.feedLastRemoved || this.runtime.feedRemovedTotal))
      : this.runtime.route === "video"
        ? this.renderVideoBadge()
        : "守";

    this.button.innerHTML = `
      <span class="guardian-floating-btn-icon">守</span>
      <span class="guardian-floating-btn-badge">${escapeHtml(badge)}</span>
    `;
    this.button.title = this.getFloatingButtonHint();
    this.button.setAttribute("aria-label", this.config.ui.panelOpen ? "关闭扩展窗口" : "打开扩展窗口");
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
        return this.runtime.videoResult ? String(this.runtime.videoResult.finalProbability) : "好";
      case "error":
        return "!";
      default:
        return "守";
    }
  }

  private renderButtonPosition(): void {
    this.button.style.left = `${this.config.ui.floatingButtonPosition.x}px`;
    this.button.style.top = `${this.config.ui.floatingButtonPosition.y}px`;
  }

  private renderModal(): void {
    const currentTab = normalizeTab(this.config.ui.activeTab);
    const diagnostics = this.runtime.diagnostics.length > 0 ? this.runtime.diagnostics.join("\n") : "暂时还没有问题排查记录。";
    const serviceReady = hasConfiguredRecognitionService(this.config);

    this.overlay.classList.toggle("open", this.config.ui.panelOpen);
    this.panel.classList.toggle("open", this.config.ui.panelOpen);

    this.panel.innerHTML = `
      <div class="guardian-modal-header">
        <div class="guardian-header-copy">
          <h2 class="guardian-title">广告跳过与内容过滤</h2>
          <p class="guardian-subtitle">在首页帮你整理推荐内容，在视频页帮你识别并跳过疑似广告片段。</p>
        </div>
        <div class="guardian-header-actions">
          <button class="guardian-icon-btn" type="button" data-action="toggle-theme" title="${this.config.ui.theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}">
            ${this.config.ui.theme === "dark" ? "☀" : "☾"}
          </button>
          <button class="guardian-icon-btn" type="button" data-action="close-panel" title="关闭窗口">×</button>
        </div>
      </div>
      <div class="guardian-tabs">
        ${this.renderTabs(currentTab)}
      </div>
      ${this.toast ? `<div class="guardian-toast ${this.toast.tone}" role="status" aria-live="polite">${escapeHtml(this.toast.text)}</div>` : ""}
      <div class="guardian-modal-body">
        ${currentTab === "overview" ? this.renderOverview(serviceReady) : ""}
        ${currentTab === "feed" ? this.renderFeedTab() : ""}
        ${currentTab === "video" ? this.renderVideoTab(serviceReady) : ""}
        ${currentTab === "advanced" ? this.renderAdvancedTab(diagnostics, serviceReady) : ""}
      </div>
      <div class="guardian-modal-footer">
        <span>${escapeHtml(this.getSupportFootnote())}</span>
        <span>按 Esc 或点击空白处可关闭窗口</span>
      </div>
    `;

    this.bindPanelEvents();
  }

  private renderTabs(currentTab: DisplayTabId): string {
    const tabs: Array<{ id: DisplayTabId; label: string }> = [
      { id: "overview", label: "主页概览" },
      { id: "feed", label: "首页过滤" },
      { id: "video", label: "视频跳过" },
      { id: "advanced", label: "高级设置" }
    ];

    return tabs
      .map(
        (tab) =>
          `<button class="guardian-tab ${currentTab === tab.id ? "active" : ""}" type="button" data-tab="${tab.id}">${tab.label}</button>`
      )
      .join("");
  }

  private renderOverview(serviceReady: boolean): string {
    const pageState = this.getPageState();
    const feedState = this.getFeedState();
    const videoState = this.getVideoState();
    const highlight = this.getOverviewHighlight(serviceReady);

    return `
      ${!this.config.ui.onboardingDismissed ? `
        <section class="guardian-guide-card">
          <div class="guardian-guide-badge">快速上手</div>
          <h3 class="guardian-card-title">第一次使用，从这里开始</h3>
          <div class="guardian-guide-list">
            <div class="guardian-guide-item"><strong>首页过滤</strong><span>会帮你整理首页、热门、搜索结果等推荐内容。</span></div>
            <div class="guardian-guide-item"><strong>视频跳过</strong><span>进入视频页后会自动尝试识别是否存在需要跳过的片段。</span></div>
            <div class="guardian-guide-item"><strong>常用操作</strong><span>最常用的是“立即整理当前页面”和“重新识别当前视频”。</span></div>
          </div>
          <div class="guardian-actions">
            <button class="guardian-btn primary" type="button" data-action="dismiss-onboarding">知道了</button>
            <button class="guardian-btn" type="button" data-action="goto-advanced">去看看高级设置</button>
          </div>
        </section>
      ` : ""}
      <section class="guardian-card guardian-card-hero">
        <div class="guardian-hero-head">
          <div>
            <h3 class="guardian-card-title">当前保护状态</h3>
            <div class="guardian-note">这个窗口会根据你所在的页面自动切换到对应能力。</div>
          </div>
          <span class="guardian-pill ${pageState.tone}">${escapeHtml(pageState.pill)}</span>
        </div>
        <div class="guardian-state-grid">
          <article class="guardian-state-card">
            <div class="guardian-state-label">当前页面</div>
            <div class="guardian-state-value">${escapeHtml(pageState.value)}</div>
            <div class="guardian-state-note">${escapeHtml(pageState.note)}</div>
          </article>
          <article class="guardian-state-card">
            <div class="guardian-state-label">首页整理</div>
            <div class="guardian-state-value">${escapeHtml(feedState.value)}</div>
            <div class="guardian-state-note">${escapeHtml(feedState.note)}</div>
          </article>
          <article class="guardian-state-card">
            <div class="guardian-state-label">视频跳过</div>
            <div class="guardian-state-value">${escapeHtml(videoState.value)}</div>
            <div class="guardian-state-note">${escapeHtml(videoState.note)}</div>
          </article>
        </div>
        <div class="guardian-highlight ${highlight.tone}">
          <strong>${escapeHtml(highlight.title)}</strong>
          <span>${escapeHtml(highlight.note)}</span>
        </div>
        <div class="guardian-chip-row">
          <span class="guardian-chip">${escapeHtml(toScopeLabel(this.runtime.pageScope))}</span>
          <span class="guardian-chip">${serviceReady ? "识别服务已准备好" : "识别服务还没设置完成"}</span>
          ${this.runtime.videoBvid ? `<span class="guardian-chip">当前视频已就绪</span>` : ""}
        </div>
        <div class="guardian-actions">
          <button class="guardian-btn primary" type="button" data-action="run-feed" ${this.runtime.route === "feed" ? "" : "disabled"}>立即整理当前页面</button>
          ${serviceReady
            ? `<button class="guardian-btn" type="button" data-action="run-video" ${this.runtime.route === "video" ? "" : "disabled"}>重新识别当前视频</button>`
            : `<button class="guardian-btn" type="button" data-action="goto-advanced">去完成识别服务设置</button>`}
        </div>
      </section>
    `;
  }

  private renderFeedTab(): string {
    return `
      <section class="guardian-card">
        <div class="guardian-section-head">
          <div>
            <h3 class="guardian-card-title">首页过滤</h3>
            <div class="guardian-note">隐藏推广、直播和你不想看的内容，让推荐流更干净。</div>
          </div>
          <span class="guardian-soft-badge">${escapeHtml(toScopeLabel(this.runtime.pageScope))}</span>
        </div>
        <div class="guardian-stack">
          ${this.renderSwitchField("feed.enabled", "启用首页过滤", "进入支持页面后自动整理推荐内容。", this.config.feed.enabled)}
          ${this.renderSwitchField("feed.blockAds", "隐藏广告与推广内容", "优先移除明显推广卡片和广告位。", this.config.feed.blockAds)}
          ${this.renderSwitchField("feed.blockLive", "隐藏直播推荐", "减少直播内容对首页和搜索结果的打扰。", this.config.feed.blockLive)}
          ${this.renderSwitchField("feed.continuousScan", "自动跟随新内容继续整理", "页面动态加载新卡片时，继续保持整理效果。", this.config.feed.continuousScan)}
        </div>
        <div class="guardian-subsection">
          <div class="guardian-label">在哪些页面生效</div>
          <div class="guardian-choice-grid">
            ${([
              { id: "home", label: "首页" },
              { id: "search", label: "搜索结果页" },
              { id: "popular", label: "热门页" },
              { id: "ranking", label: "排行榜" },
              { id: "channel", label: "分区与频道页" }
            ] as const).map((scope) => this.renderChoiceItem(scope.label, `data-scope="${scope.id}"`, this.config.feed.scopes.includes(scope.id))).join("")}
          </div>
        </div>
        <div class="guardian-grid-2">
          <label class="guardian-label">不想看到的分类
            <textarea class="guardian-textarea" data-field="feed.categoryBlacklist" placeholder="每行填写一个分类名称">${escapeHtml(listToLines(this.config.feed.categoryBlacklist))}</textarea>
          </label>
          <label class="guardian-label">不想看到的关键词
            <textarea class="guardian-textarea" data-field="feed.keywordBlacklist" placeholder="每行填写一个关键词，可用于标题或 UP 主">${escapeHtml(listToLines(this.config.feed.keywordBlacklist))}</textarea>
          </label>
        </div>
        <div class="guardian-actions">
          <button class="guardian-btn primary" type="button" data-action="save-feed">保存首页过滤设置</button>
          <button class="guardian-btn" type="button" data-action="run-feed" ${this.runtime.route === "feed" ? "" : "disabled"}>立即整理当前页面</button>
        </div>
      </section>
    `;
  }

  private renderVideoTab(serviceReady: boolean): string {
    const status = this.getVideoStatusView();

    return `
      <section class="guardian-card">
        <div class="guardian-section-head">
          <div>
            <h3 class="guardian-card-title">视频跳过</h3>
            <div class="guardian-note">进入视频页后，自动判断是否存在适合跳过的片段。</div>
          </div>
          <span class="guardian-soft-badge">${serviceReady ? "识别服务已连接" : "还没完成识别服务设置"}</span>
        </div>
        <div class="guardian-stack">
          ${this.renderSwitchField("video.enabled", "启用视频跳过", "进入视频页后自动尝试识别。", this.config.video.enabled)}
          ${this.renderSwitchField("video.defaultAutoSkip", "识别后默认自动跳过", "适合希望减少手动操作的日常使用。", this.config.video.defaultAutoSkip)}
          ${this.renderSwitchField("toggle-current-skip", "当前这个视频允许自动跳过", this.runtime.videoBvid ? "你可以临时关闭当前视频的自动跳过。" : "打开视频后，这里会显示当前视频专属开关。", this.runtime.currentVideoAutoSkip, true, !this.runtime.videoBvid)}
        </div>
        <div class="guardian-grid-2">
          <label class="guardian-label">识别灵敏度
            <input class="guardian-field" data-field="video.probabilityThreshold" type="number" min="0" max="100" value="${this.config.video.probabilityThreshold}">
          </label>
          <label class="guardian-label">结果保存时长（分钟）
            <input class="guardian-field" data-field="video.cacheTtlMinutes" type="number" min="1" value="${this.config.video.cacheTtlMinutes}">
          </label>
        </div>
        <div class="guardian-result-card">
          <div class="guardian-result-head">
            <span class="guardian-pill ${status.tone}">${escapeHtml(status.pill)}</span>
            <span class="guardian-result-range">${escapeHtml(status.range)}</span>
          </div>
          <div class="guardian-result-grid">
            <div>
              <div class="guardian-result-label">当前状态</div>
              <div class="guardian-result-value">${escapeHtml(status.phase)}</div>
            </div>
            <div>
              <div class="guardian-result-label">识别结果</div>
              <div class="guardian-result-value">${escapeHtml(status.probability)}</div>
            </div>
          </div>
          <div class="guardian-result-note">${escapeHtml(status.summary)}</div>
        </div>
        <div class="guardian-actions">
          <button class="guardian-btn primary" type="button" data-action="save-video">保存视频跳过设置</button>
          ${serviceReady
            ? `<button class="guardian-btn" type="button" data-action="run-video" ${this.runtime.route === "video" ? "" : "disabled"}>重新识别当前视频</button>`
            : `<button class="guardian-btn" type="button" data-action="goto-advanced">去完成识别服务设置</button>`}
        </div>
      </section>
    `;
  }

  private renderAdvancedTab(diagnostics: string, serviceReady: boolean): string {
    return `
      <section class="guardian-card">
        <div class="guardian-section-head">
          <div>
            <h3 class="guardian-card-title">高级设置</h3>
            <div class="guardian-note">这里保留更进阶的识别服务和偏好设置，日常使用通常不需要频繁修改。</div>
          </div>
          <span class="guardian-soft-badge">${serviceReady ? "已具备识别条件" : "建议先补全识别服务"}</span>
        </div>

        <details class="guardian-details">
          <summary>识别服务设置</summary>
          <div class="guardian-details-body">
            <div class="guardian-grid-2">
              <label class="guardian-label">识别服务
                <select class="guardian-select" data-field="ai.provider">
                  ${Object.entries(AI_PROVIDER_DEFAULTS).map(([provider]) => `<option value="${provider}" ${this.config.ai.provider === provider ? "selected" : ""}>${escapeHtml(toProviderLabel(provider as ExtensionConfig["ai"]["provider"]))}</option>`).join("")}
                </select>
              </label>
              <label class="guardian-label">模型名称
                <input class="guardian-field" data-field="ai.model" placeholder="例如：gpt-4o-mini" value="${escapeHtml(this.config.ai.model)}">
              </label>
            </div>
            <label class="guardian-label">接口地址
              <input class="guardian-field" data-field="ai.baseUrl" placeholder="例如：https://api.openai.com/v1" value="${escapeHtml(this.config.ai.baseUrl)}">
            </label>
            <label class="guardian-label">访问密钥
              <input class="guardian-field" data-field="ai.apiKey" type="password" placeholder="请输入你的服务密钥" value="${escapeHtml(this.config.ai.apiKey)}">
            </label>
            <div class="guardian-actions">
              <button class="guardian-btn primary" type="button" data-action="save-service">保存识别服务设置</button>
              <button class="guardian-btn" type="button" data-action="fetch-models">获取可用模型</button>
            </div>
            ${this.availableModels.length > 0 ? `
              <div class="guardian-subsection">
                <div class="guardian-label">当前获取到的模型</div>
                <div class="guardian-chip-row">
                  ${this.availableModels.map((model) => `<span class="guardian-chip">${escapeHtml(model)}</span>`).join("")}
                </div>
              </div>
            ` : `
              <div class="guardian-empty">还没有获取到可用模型列表，需要时可以点击上方按钮尝试获取。</div>
            `}
          </div>
        </details>

        <details class="guardian-details">
          <summary>识别偏好</summary>
          <div class="guardian-details-body">
            <label class="guardian-label">识别说明词
              <textarea class="guardian-textarea guardian-textarea-lg" data-field="ai.prompt" placeholder="这里适合熟悉后再修改">${escapeHtml(this.config.ai.prompt)}</textarea>
            </label>
            <div class="guardian-grid-2">
              <label class="guardian-label">优先参考词
                <textarea class="guardian-textarea" data-field="ai.whitelist" placeholder="每行填写一个词">${escapeHtml(listToLines(this.config.ai.whitelist))}</textarea>
              </label>
              <label class="guardian-label">忽略参考词
                <textarea class="guardian-textarea" data-field="ai.blacklist" placeholder="每行填写一个词">${escapeHtml(listToLines(this.config.ai.blacklist))}</textarea>
              </label>
            </div>
            <div class="guardian-choice-grid">
              ${this.renderChoiceItem("启用优先参考词", 'data-field="ai.whitelistEnabled"', this.config.ai.whitelistEnabled)}
              ${this.renderChoiceItem("优先参考词使用正则", 'data-field="ai.whitelistRegex"', this.config.ai.whitelistRegex)}
              ${this.renderChoiceItem("启用忽略参考词", 'data-field="ai.blacklistEnabled"', this.config.ai.blacklistEnabled)}
              ${this.renderChoiceItem("忽略参考词使用正则", 'data-field="ai.blacklistRegex"', this.config.ai.blacklistRegex)}
            </div>
            <div class="guardian-grid-2">
              <label class="guardian-label">长内容修正
                <input class="guardian-field" data-field="video.durationPenalty" type="number" min="0" value="${this.config.video.durationPenalty}">
              </label>
              <label class="guardian-label">最少参考弹幕数
                <input class="guardian-field" data-field="video.minDanmakuForAnalysis" type="number" min="1" value="${this.config.video.minDanmakuForAnalysis}">
              </label>
              <label class="guardian-label">最短片段时长（秒）
                <input class="guardian-field" data-field="video.minAdDuration" type="number" min="1" value="${this.config.video.minAdDuration}">
              </label>
              <label class="guardian-label">最长片段时长（秒）
                <input class="guardian-field" data-field="video.maxAdDuration" type="number" min="1" value="${this.config.video.maxAdDuration}">
              </label>
            </div>
            <div class="guardian-actions">
              <button class="guardian-btn primary" type="button" data-action="save-preferences">保存识别偏好</button>
            </div>
          </div>
        </details>

        <details class="guardian-details">
          <summary>问题排查</summary>
          <div class="guardian-details-body">
            <div class="guardian-note">如果你遇到识别失败、页面结构变化或自动跳过异常，可以先看看这里。</div>
            <div class="guardian-diagnostics">${escapeHtml(diagnostics)}</div>
            <div class="guardian-actions">
              <button class="guardian-btn" type="button" data-action="show-onboarding">重新查看使用说明</button>
              <button class="guardian-btn" type="button" data-action="clear-diagnostics">清空记录</button>
            </div>
          </div>
        </details>
      </section>
    `;
  }

  private renderSwitchField(
    field: string,
    label: string,
    description: string,
    checked: boolean,
    useAction = false,
    disabled = false
  ): string {
    const attribute = useAction ? `data-action="${field}"` : `data-field="${field}"`;

    return `
      <label class="guardian-switch-row ${disabled ? "disabled" : ""}">
        <span class="guardian-switch-copy">
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(description)}</span>
        </span>
        <span class="guardian-switch-box">
          <span class="guardian-switch-state">${checked ? "已开启" : "已关闭"}</span>
          <span class="guardian-switch-control">
            <input class="guardian-switch-input" type="checkbox" ${attribute} ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
            <span class="guardian-switch-track"></span>
            <span class="guardian-switch-thumb"></span>
          </span>
        </span>
      </label>
    `;
  }

  private renderChoiceItem(label: string, attribute: string, checked: boolean): string {
    return `
      <label class="guardian-choice-item ${checked ? "checked" : ""}">
        <input type="checkbox" ${attribute} ${checked ? "checked" : ""}>
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  private getPageState(): { pill: string; tone: ToastTone; value: string; note: string } {
    if (this.runtime.route === "feed") {
      return {
        pill: "正在生效",
        tone: "success",
        value: "首页整理已开启",
        note: toScopeLabel(this.runtime.pageScope)
      };
    }

    if (this.runtime.route === "video") {
      return {
        pill: "正在生效",
        tone: "success",
        value: "视频识别已开启",
        note: this.runtime.videoBvid ? "当前视频已进入识别流程" : "正在等待视频信息准备完成"
      };
    }

    return {
      pill: "等待中",
      tone: "info",
      value: "当前页面暂未接管",
      note: "进入首页、热门、搜索结果或视频页后会自动生效"
    };
  }

  private getFeedState(): { value: string; note: string } {
    if (this.runtime.route !== "feed") {
      return {
        value: `${this.runtime.feedRemovedTotal} 条已整理`,
        note: "进入支持的推荐流页面后，可以一键重新整理当前页面"
      };
    }

    return {
      value: `${this.runtime.feedLastRemoved} 条刚刚被整理`,
      note: "已根据你的过滤规则处理当前看到的内容"
    };
  }

  private getVideoState(): { value: string; note: string } {
    const status = this.getVideoStatusView();
    return {
      value: status.pill,
      note: status.summary
    };
  }

  private getOverviewHighlight(serviceReady: boolean): { tone: ToastTone; title: string; note: string } {
    if (!serviceReady) {
      return {
        tone: "warning",
        title: "视频识别还没准备好",
        note: "到高级设置里补全识别服务后，视频页才能更稳定地给出结果。"
      };
    }

    if (this.runtime.route === "video" && this.runtime.videoResult && this.runtime.videoResult.finalProbability >= this.config.video.probabilityThreshold) {
      return {
        tone: "success",
        title: "当前视频更像是可跳过片段",
        note: "这次识别已经给出较高把握，你可以让它自动跳过。"
      };
    }

    if (this.runtime.route === "video" && (this.runtime.videoPhase === "collecting" || this.runtime.videoPhase === "analyzing")) {
      return {
        tone: "info",
        title: "正在识别当前视频",
        note: "稍等片刻，识别完成后这里会直接显示建议结果。"
      };
    }

    if (this.runtime.route === "feed") {
      return {
        tone: "info",
        title: "当前页面正在持续整理中",
        note: "滚动页面加载新内容后，也会继续按照你的规则整理。"
      };
    }

    return {
      tone: "info",
      title: "准备就绪",
      note: "当你进入支持页面时，这里会自动切换成对应状态。"
    };
  }

  private getVideoStatusView(): {
    tone: ToastTone;
    pill: string;
    phase: string;
    probability: string;
    range: string;
    summary: string;
  } {
    const result = this.runtime.videoResult;
    const probability = result ? `${result.finalProbability}%` : "--";
    const range = result?.start && result?.end ? `${result.start} - ${result.end}` : "还没有识别出明确区间";
    const summary = getVideoSummary(result, this.runtime.videoError);

    if (this.runtime.videoError) {
      return {
        tone: "danger",
        pill: "识别失败",
        phase: toVideoPhaseLabel(this.runtime.videoPhase),
        probability,
        range,
        summary
      };
    }

    if (this.runtime.videoPhase === "analyzing" || this.runtime.videoPhase === "collecting") {
      return {
        tone: "info",
        pill: "识别中",
        phase: toVideoPhaseLabel(this.runtime.videoPhase),
        probability,
        range,
        summary
      };
    }

    if (result && result.finalProbability >= this.config.video.probabilityThreshold) {
      return {
        tone: "success",
        pill: "建议跳过",
        phase: toVideoPhaseLabel(this.runtime.videoPhase),
        probability,
        range,
        summary
      };
    }

    if (result) {
      return {
        tone: "info",
        pill: "已识别",
        phase: toVideoPhaseLabel(this.runtime.videoPhase),
        probability,
        range,
        summary
      };
    }

    return {
      tone: "info",
      pill: "未开始",
      phase: toVideoPhaseLabel(this.runtime.videoPhase),
      probability,
      range,
      summary
    };
  }

  private getFloatingButtonHint(): string {
    if (this.runtime.route === "feed") {
      return `扩展正在整理当前页面，最近一次处理了 ${this.runtime.feedLastRemoved} 条内容`;
    }

    if (this.runtime.route === "video") {
      return `扩展正在处理当前视频：${toVideoPhaseLabel(this.runtime.videoPhase)}`;
    }

    return "打开扩展窗口，查看首页过滤和视频跳过状态";
  }

  private getSupportFootnote(): string {
    if (this.runtime.route === "feed") {
      return `当前已在${toScopeLabel(this.runtime.pageScope)}生效。`;
    }

    if (this.runtime.route === "video") {
      return "当前视频页已接入识别与自动跳过。";
    }

    return "当前页面暂未接管，进入首页、搜索结果、热门或视频页后会自动生效。";
  }

  private bindPanelEvents(): void {
    this.bindInteractiveInputs();

    this.panel.querySelectorAll<HTMLElement>("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.tab as DisplayTabId;
        this.callbacks.onSetTab(tab === "advanced" ? "advanced" : tab);
      });
    });

    this.panel.querySelector<HTMLElement>("[data-action='toggle-theme']")?.addEventListener("click", () => {
      this.callbacks.onSetTheme(this.config.ui.theme === "dark" ? "light" : "dark");
      this.showToast(this.config.ui.theme === "dark" ? "已切换为浅色模式。" : "已切换为深色模式。", "success");
    });

    this.panel.querySelector<HTMLElement>("[data-action='close-panel']")?.addEventListener("click", () => {
      this.callbacks.onTogglePanel();
    });

    this.panel.querySelectorAll<HTMLElement>("[data-action='goto-advanced']").forEach((button) => {
      button.addEventListener("click", () => {
        this.callbacks.onSetTab("advanced");
      });
    });

    this.panel.querySelector<HTMLElement>("[data-action='dismiss-onboarding']")?.addEventListener("click", async () => {
      await this.persistConfig(
        {
          ui: {
            ...this.config.ui,
            onboardingDismissed: true
          }
        },
        "已收起使用说明，之后不会再重复打扰。"
      );
    });

    this.panel.querySelector<HTMLElement>("[data-action='show-onboarding']")?.addEventListener("click", async () => {
      await this.persistConfig(
        {
          ui: {
            ...this.config.ui,
            onboardingDismissed: false,
            activeTab: "overview"
          }
        },
        "已重新打开使用说明。"
      );
    });

    this.panel.querySelectorAll<HTMLElement>("[data-action='run-feed']").forEach((button) => {
      button.addEventListener("click", () => {
        this.callbacks.onRunFeedScan();
        this.showToast("已开始整理当前页面。", "success");
      });
    });

    this.panel.querySelectorAll<HTMLElement>("[data-action='run-video']").forEach((button) => {
      button.addEventListener("click", () => {
        this.callbacks.onRunVideoAnalysis();
        this.showToast("已开始重新识别当前视频。", "success");
      });
    });

    this.panel.querySelector<HTMLElement>("[data-action='clear-diagnostics']")?.addEventListener("click", () => {
      this.callbacks.onResetDiagnostics();
      this.showToast("问题排查记录已清空。", "success");
    });

    this.panel.querySelector<HTMLInputElement>("[data-action='toggle-current-skip']")?.addEventListener("change", (event) => {
      const enabled = (event.currentTarget as HTMLInputElement).checked;
      this.callbacks.onToggleCurrentVideoAutoSkip(enabled);
      this.showToast(enabled ? "当前视频已允许自动跳过。" : "当前视频已关闭自动跳过。", "success");
    });

    this.panel.querySelector<HTMLElement>("[data-action='save-feed']")?.addEventListener("click", async () => {
      await this.persistConfig(
        {
          feed: {
            ...this.config.feed,
            enabled: this.readCheckbox("feed.enabled", this.config.feed.enabled),
            blockAds: this.readCheckbox("feed.blockAds", this.config.feed.blockAds),
            blockLive: this.readCheckbox("feed.blockLive", this.config.feed.blockLive),
            continuousScan: this.readCheckbox("feed.continuousScan", this.config.feed.continuousScan),
            scopes: this.readScopes(),
            categoryBlacklist: linesToList(this.readField("feed.categoryBlacklist", listToLines(this.config.feed.categoryBlacklist))),
            keywordBlacklist: linesToList(this.readField("feed.keywordBlacklist", listToLines(this.config.feed.keywordBlacklist)))
          }
        },
        "首页过滤设置已保存。"
      );
    });

    this.panel.querySelector<HTMLElement>("[data-action='save-video']")?.addEventListener("click", async () => {
      await this.persistConfig(
        {
          video: {
            ...this.config.video,
            enabled: this.readCheckbox("video.enabled", this.config.video.enabled),
            defaultAutoSkip: this.readCheckbox("video.defaultAutoSkip", this.config.video.defaultAutoSkip),
            probabilityThreshold: this.readNumberField("video.probabilityThreshold", this.config.video.probabilityThreshold),
            durationPenalty: this.readNumberField("video.durationPenalty", this.config.video.durationPenalty),
            minAdDuration: this.readNumberField("video.minAdDuration", this.config.video.minAdDuration),
            maxAdDuration: this.readNumberField("video.maxAdDuration", this.config.video.maxAdDuration),
            minDanmakuForAnalysis: this.readNumberField("video.minDanmakuForAnalysis", this.config.video.minDanmakuForAnalysis),
            cacheTtlMinutes: this.readNumberField("video.cacheTtlMinutes", this.config.video.cacheTtlMinutes)
          }
        },
        "视频跳过设置已保存。"
      );
    });

    this.panel.querySelector<HTMLElement>("[data-action='save-service']")?.addEventListener("click", async () => {
      await this.persistConfig(
        {
          ai: {
            ...this.config.ai,
            provider: this.readField("ai.provider", this.config.ai.provider) as ExtensionConfig["ai"]["provider"],
            model: this.readField("ai.model", this.config.ai.model),
            baseUrl: this.readField("ai.baseUrl", this.config.ai.baseUrl),
            apiKey: this.readField("ai.apiKey", this.config.ai.apiKey)
          }
        },
        "识别服务设置已保存。"
      );
    });

    this.panel.querySelector<HTMLElement>("[data-action='save-preferences']")?.addEventListener("click", async () => {
      await this.persistConfig(
        {
          ai: {
            ...this.config.ai,
            prompt: this.readField("ai.prompt", this.config.ai.prompt),
            whitelist: linesToList(this.readField("ai.whitelist", listToLines(this.config.ai.whitelist))),
            blacklist: linesToList(this.readField("ai.blacklist", listToLines(this.config.ai.blacklist))),
            whitelistEnabled: this.readCheckbox("ai.whitelistEnabled", this.config.ai.whitelistEnabled),
            whitelistRegex: this.readCheckbox("ai.whitelistRegex", this.config.ai.whitelistRegex),
            blacklistEnabled: this.readCheckbox("ai.blacklistEnabled", this.config.ai.blacklistEnabled),
            blacklistRegex: this.readCheckbox("ai.blacklistRegex", this.config.ai.blacklistRegex)
          },
          video: {
            ...this.config.video,
            durationPenalty: this.readNumberField("video.durationPenalty", this.config.video.durationPenalty),
            minDanmakuForAnalysis: this.readNumberField("video.minDanmakuForAnalysis", this.config.video.minDanmakuForAnalysis),
            minAdDuration: this.readNumberField("video.minAdDuration", this.config.video.minAdDuration),
            maxAdDuration: this.readNumberField("video.maxAdDuration", this.config.video.maxAdDuration)
          }
        },
        "识别偏好已保存。"
      );
    });

    this.panel.querySelector<HTMLElement>("[data-action='fetch-models']")?.addEventListener("click", async () => {
      const provider = this.readField("ai.provider", this.config.ai.provider) as ExtensionConfig["ai"]["provider"];
      const baseUrl = this.readField("ai.baseUrl", this.config.ai.baseUrl);

      try {
        this.availableModels = await this.callbacks.onFetchModels(provider, baseUrl);
        this.showToast(this.availableModels.length > 0 ? "已获取可用模型列表。" : "没有获取到模型列表，请检查服务设置。", this.availableModels.length > 0 ? "success" : "warning");
        this.renderModal();
      } catch (error) {
        this.showToast(`获取模型失败：${this.formatError(error)}`, "danger");
      }
    });
  }

  private bindInteractiveInputs(): void {
    this.panel.querySelectorAll<HTMLInputElement>(".guardian-switch-input").forEach((input) => {
      const row = input.closest(".guardian-switch-row");
      const state = row?.querySelector<HTMLElement>(".guardian-switch-state");
      const update = () => {
        if (state) {
          state.textContent = input.checked ? "已开启" : "已关闭";
        }
      };

      update();
      input.addEventListener("change", update);
    });

    this.panel.querySelectorAll<HTMLInputElement>(".guardian-choice-item input").forEach((input) => {
      const item = input.closest(".guardian-choice-item");
      const update = () => {
        item?.classList.toggle("checked", input.checked);
      };

      update();
      input.addEventListener("change", update);
    });
  }

  private async persistConfig(patch: DeepPartial<ExtensionConfig>, successMessage: string): Promise<void> {
    try {
      await this.callbacks.onSaveConfig(patch);
      this.showToast(successMessage, "success");
    } catch (error) {
      this.showToast(`保存失败：${this.formatError(error)}`, "danger");
    }
  }

  private showToast(text: string, tone: ToastTone): void {
    this.toast = { text, tone };
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.renderModal();
    this.toastTimer = window.setTimeout(() => {
      this.toast = null;
      this.toastTimer = null;
      this.renderModal();
    }, 2600);
  }

  private formatError(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "请稍后重试。";
  }

  private readField(field: string, fallback = ""): string {
    const element = this.panel.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-field="${field}"]`);
    return element?.value ?? fallback;
  }

  private readNumberField(field: string, fallback: number): number {
    const raw = this.readField(field, String(fallback)).trim();
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  private readCheckbox(field: string, fallback = false): boolean {
    const element = this.panel.querySelector<HTMLInputElement>(`[data-field="${field}"]`);
    return element ? element.checked : fallback;
  }

  private readScopes(): FeedPageScope[] {
    const scopes = Array.from(this.panel.querySelectorAll<HTMLInputElement>("[data-scope]"))
      .filter((input) => input.checked)
      .map((input) => input.dataset.scope as FeedPageScope);

    return scopes.length > 0 ? scopes : this.config.feed.scopes;
  }
}
