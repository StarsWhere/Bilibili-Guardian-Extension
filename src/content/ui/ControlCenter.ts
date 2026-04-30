import { AI_PROVIDER_DEFAULTS, getCustomBaseUrlValidationError } from "@/shared/config";
import type {
  DeepPartial,
  ExtensionConfig,
  FeedPageScope,
  PanelTabId,
  VideoAnalysisErrorDetails,
  VideoAnalysisFailureCode,
  VideoAnalysisFailureStage,
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
  videoErrorDetails: VideoAnalysisErrorDetails | null;
  currentVideoAutoSkip: boolean;
  diagnostics: string[];
}

interface ControlCenterCallbacks {
  onTogglePanel(): void | Promise<void>;
  onSetTheme(theme: "light" | "dark"): void | Promise<void>;
  onSaveConfig(next: DeepPartial<ExtensionConfig>): Promise<void>;
  onRunFeedScan(): void;
  onRunVideoAnalysis(): void;
  onFetchModels(provider: ExtensionConfig["ai"]["provider"], baseUrl: string): Promise<string[]>;
  onToggleCurrentVideoAutoSkip(enabled: boolean): void;
  onResetDiagnostics(): void;
  onMoveButton(nextPosition: { x: number; y: number }): void;
}

type DisplayTabId = "overview" | "feed" | "video" | "advanced";
type ToastTone = "info" | "success" | "warning" | "danger";
type AdvancedSectionId = "service" | "preferences" | "diagnostics";
type VideoQuickCardAction = "run-video" | "open-video-settings" | "open-service-settings" | "open-diagnostics";

interface PanelSnapshot {
  focusSelector: string | null;
  scrollTop: number;
}

interface EdgeToastState {
  id: number;
  text: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

interface OverviewStatusItem {
  label: string;
  value: string;
  note: string;
  tone: ToastTone;
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

function toFailureStageLabel(stage: VideoAnalysisFailureStage): string {
  switch (stage) {
    case "response_parse":
      return "响应解析";
    default:
      return stage;
  }
}

function toFailureCodeLabel(code: VideoAnalysisFailureCode): string {
  switch (code) {
    case "empty_response":
      return "空响应";
    case "completed_without_output":
      return "完成但无输出";
    case "no_json_found":
      return "未找到 JSON";
    case "invalid_json":
      return "JSON 语法错误";
    case "invalid_result_shape":
      return "字段结构异常";
    default:
      return code;
  }
}

export function hasConfiguredRecognitionService(config: ExtensionConfig): boolean {
  const hasBaseUrl = config.ai.baseUrl.trim().length > 0;
  const hasModel = config.ai.model.trim().length > 0;
  const hasKey = config.ai.apiKey.trim().length > 0;

  if (config.ai.provider === "custom") {
    return hasModel && hasKey && !getCustomBaseUrlValidationError(config.ai.baseUrl);
  }

  return hasBaseUrl && hasModel && hasKey;
}

export function shouldAutoPickFetchedModel(
  provider: ExtensionConfig["ai"]["provider"],
  model: string
): boolean {
  if (!model.trim()) {
    return true;
  }

  if (provider === "custom") {
    return false;
  }

  return AI_PROVIDER_DEFAULTS[provider].models.includes(model);
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

function getVideoWaitingSummary(phase: VideoAnalysisPhase): string {
  if (phase === "collecting") {
    return "正在整理当前视频的弹幕和评论，请稍等。";
  }

  if (phase === "analyzing") {
    return "正在调用 AI 识别当前视频，请稍等。";
  }

  return "正在识别当前视频，请稍等。";
}

function toToastLabel(tone: ToastTone): string {
  switch (tone) {
    case "success":
      return "已完成";
    case "warning":
      return "请留意";
    case "danger":
      return "处理失败";
    default:
      return "处理中";
  }
}

export class ControlCenter {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly button: HTMLButtonElement;
  private readonly miniCard: HTMLDivElement;
  private readonly toastRegion: HTMLDivElement;
  private readonly panelToastRegion: HTMLDivElement;
  private readonly overlay: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly panelHeader: HTMLDivElement;
  private readonly panelTabs: HTMLDivElement;
  private readonly panelBody: HTMLDivElement;
  private readonly panelFooter: HTMLDivElement;
  private config: ExtensionConfig;
  private runtime: GuardianRuntimeState;
  private availableModels: string[] = [];
  private draftConfig: ExtensionConfig | null = null;
  private expandedAdvancedSection: AdvancedSectionId = "service";
  private pendingAdvancedSection: AdvancedSectionId | null = null;
  private customServiceDraft = { baseUrl: "", model: "" };
  private isOpen = false;
  private restoreFocusTarget: HTMLElement | null = null;
  private previousBodyOverflow = "";
  private previousHtmlOverflow = "";
  private edgeToasts: EdgeToastState[] = [];
  private toastTimers = new Map<number, number>();
  private nextToastId = 1;
  private videoQuickCardCollapsed = false;
  private videoQuickCardVideoKey: string | null = null;
  private panelTab: DisplayTabId;

  constructor(initialConfig: ExtensionConfig, initialRuntime: GuardianRuntimeState, private readonly callbacks: ControlCenterCallbacks) {
    this.config = initialConfig;
    this.runtime = initialRuntime;
    this.panelTab = normalizeTab(initialConfig.ui?.activeTab ?? "overview");
    this.root = document.createElement("div");
    this.root.id = "guardian-root";
    this.style = document.createElement("style");
    this.style.textContent = createStyles();
    this.button = document.createElement("button");
    this.button.className = "guardian-floating-btn";
    this.button.type = "button";
    this.miniCard = document.createElement("div");
    this.miniCard.className = "guardian-video-quick-card";
    this.toastRegion = document.createElement("div");
    this.toastRegion.className = "guardian-edge-toast-region";
    this.panelToastRegion = document.createElement("div");
    this.panelToastRegion.className = "guardian-panel-toast-region";
    this.overlay = document.createElement("div");
    this.overlay.className = "guardian-overlay";
    this.panel = document.createElement("div");
    this.panel.className = "guardian-modal";
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.tabIndex = -1;
    this.panelHeader = document.createElement("div");
    this.panelHeader.className = "guardian-modal-header";
    this.panelTabs = document.createElement("div");
    this.panelTabs.className = "guardian-tabs";
    this.panelBody = document.createElement("div");
    this.panelBody.className = "guardian-modal-body";
    this.panelFooter = document.createElement("div");
    this.panelFooter.className = "guardian-modal-footer";
  }

  mount(): void {
    this.panel.append(this.panelHeader, this.panelTabs, this.panelToastRegion, this.panelBody, this.panelFooter);
    this.overlay.appendChild(this.panel);
    this.root.append(this.style, this.button, this.miniCard, this.toastRegion, this.overlay);
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

  public showEdgeToast(
    text: string,
    tone: ToastTone,
    options: { durationMs?: number; actionLabel?: string; onAction?: () => void } = {}
  ): void {
    const toast: EdgeToastState = {
      id: this.nextToastId,
      text,
      tone,
      actionLabel: options.actionLabel,
      onAction: options.onAction
    };
    this.nextToastId += 1;

    this.edgeToasts = [...this.edgeToasts, toast].slice(-4);
    this.renderEdgeToasts();

    const durationMs = options.durationMs ?? 2600;
    if (durationMs <= 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      this.dismissEdgeToast(toast.id);
    }, durationMs);
    this.toastTimers.set(toast.id, timerId);
  }

  public async openPanel(tab: PanelTabId = "overview"): Promise<void> {
    this.panelTab = normalizeTab(tab);

    if (!this.config.ui.panelOpen) {
      this.restoreFocusTarget = this.button;
      await Promise.resolve(this.callbacks.onTogglePanel());
      return;
    }

    this.renderModal();
  }

  public async openAdvancedPanelSection(section: AdvancedSectionId): Promise<void> {
    this.pendingAdvancedSection = section;
    this.expandedAdvancedSection = section;
    await this.openPanel("advanced");
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
      void this.handlePanelClick(event);
    });

    this.panel.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });

    this.panel.addEventListener("input", (event) => {
      this.handleFormMutation(event);
    });

    this.panel.addEventListener("change", (event) => {
      void this.handlePanelChange(event);
      this.handleFormMutation(event);
    });

    this.miniCard.addEventListener("click", (event) => {
      void this.handleVideoQuickCardClick(event);
    });

    this.miniCard.addEventListener("change", (event) => {
      this.handleVideoQuickCardChange(event);
    });

    this.toastRegion.addEventListener("click", (event) => {
      this.handleToastClick(event);
    });

    this.panelToastRegion.addEventListener("click", (event) => {
      this.handleToastClick(event);
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
    const size = 44;

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
        if (!this.config.ui.panelOpen) {
          this.panelTab = "overview";
        }
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

  private resetDraftConfig(): void {
    this.draftConfig = structuredClone(this.config);
    if (this.draftConfig.ai.provider === "custom") {
      this.customServiceDraft = {
        baseUrl: this.draftConfig.ai.baseUrl,
        model: this.draftConfig.ai.model
      };
    }
  }

  private getFormConfig(): ExtensionConfig {
    if (!this.draftConfig) {
      this.resetDraftConfig();
    }

    return this.draftConfig as ExtensionConfig;
  }

  private getAdvancedSection(serviceReady: boolean): AdvancedSectionId {
    if (this.pendingAdvancedSection) {
      const next = this.pendingAdvancedSection;
      this.expandedAdvancedSection = next;
      this.pendingAdvancedSection = null;
      return next;
    }

    if (!serviceReady && !this.pendingAdvancedSection && this.panelTab === "advanced") {
      return this.expandedAdvancedSection || "service";
    }

    return this.expandedAdvancedSection || "service";
  }

  private capturePanelSnapshot(): PanelSnapshot | null {
    if (!this.config.ui.panelOpen) {
      return null;
    }

    const activeElement = document.activeElement as HTMLElement | null;
    const focusSelector = activeElement ? this.getFocusableSelector(activeElement) : null;
    return {
      focusSelector,
      scrollTop: this.panelBody.scrollTop
    };
  }

  private restorePanelSnapshot(snapshot: PanelSnapshot | null): void {
    if (!snapshot) {
      return;
    }

    this.panelBody.scrollTop = snapshot.scrollTop;

    if (snapshot.focusSelector) {
      this.panel.querySelector<HTMLElement>(snapshot.focusSelector)?.focus();
    }
  }

  private getFocusableSelector(element: HTMLElement): string | null {
    if (!this.panel.contains(element)) {
      return null;
    }

    if (element.dataset.field) {
      return `[data-field="${element.dataset.field}"]`;
    }

    if (element.dataset.action) {
      return `[data-action="${element.dataset.action}"]`;
    }

    if (element.dataset.tab) {
      return `[data-tab="${element.dataset.tab}"]`;
    }

    if (element.dataset.section) {
      return `[data-section="${element.dataset.section}"]`;
    }

    return null;
  }

  private openAdvancedSection(section: AdvancedSectionId): void {
    this.pendingAdvancedSection = section;
    if (this.panelTab !== "advanced") {
      this.panelTab = "advanced";
      this.renderModal();
      return;
    }

    this.expandedAdvancedSection = section;
    this.renderModal();
  }

  private render(): void {
    const wasOpen = this.isOpen;
    const isOpen = this.config.ui.panelOpen;
    this.syncVideoQuickCardState();

    if (!wasOpen && isOpen) {
      this.resetDraftConfig();
    }

    document.body.dataset.guardianTheme = this.config.ui.theme;
    this.root.dataset.panelOpen = String(isOpen);
    this.renderButton();
    this.renderVideoQuickCard();
    this.renderEdgeToasts();
    this.renderModal();

    this.isOpen = isOpen;
    if (!wasOpen && isOpen) {
      this.handleOpen();
    } else if (wasOpen && !isOpen) {
      this.draftConfig = null;
      this.pendingAdvancedSection = null;
      this.panelTab = "overview";
      this.handleClose();
    }
  }

  private syncVideoQuickCardState(): void {
    const nextVideoKey = this.runtime.route === "video"
      ? this.runtime.videoBvid ?? "__video__"
      : null;

    if (nextVideoKey !== this.videoQuickCardVideoKey) {
      this.videoQuickCardVideoKey = nextVideoKey;
      this.videoQuickCardCollapsed = false;
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
    this.button.dataset.route = this.runtime.route;
    this.button.dataset.phase = this.runtime.videoPhase;
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
    const position = this.config.ui.floatingButtonPosition;
    const safePosition = clampButtonPosition(
      {
        x: Number.isFinite(position.x) ? position.x : 24,
        y: Number.isFinite(position.y) ? position.y : 96
      },
      { width: window.innerWidth, height: window.innerHeight },
      44
    );

    this.config.ui.floatingButtonPosition = safePosition;
    this.button.style.left = `${safePosition.x}px`;
    this.button.style.top = `${safePosition.y}px`;
  }

  private renderVideoQuickCard(): void {
    if (this.runtime.route !== "video" || this.config.ui.panelOpen) {
      this.miniCard.classList.remove("visible", "collapsed");
      this.miniCard.innerHTML = "";
      return;
    }

    const status = this.getVideoStatusView();
    const serviceReady = hasConfiguredRecognitionService(this.config);
    const summary = this.runtime.videoError || status.summary;
    const primaryAction = this.getVideoQuickPrimaryAction(serviceReady);
    const actionDisabled = this.isVideoAnalysisInFlight();

    this.miniCard.classList.add("visible");
    this.miniCard.classList.toggle("collapsed", this.videoQuickCardCollapsed);
    this.miniCard.innerHTML = this.videoQuickCardCollapsed
      ? `
        <div class="guardian-video-quick-card-shell" data-role="video-quick-card" data-state="collapsed">
          <div class="guardian-video-quick-card-collapsed">
            <span class="guardian-status-dot ${status.tone}" aria-hidden="true"></span>
            <span class="guardian-video-quick-card-inline">${escapeHtml(status.pill)} · ${escapeHtml(status.phase)}</span>
            <button class="guardian-icon-text-btn" type="button" data-action="toggle-video-quick-card" aria-label="展开视频快捷卡">展开</button>
          </div>
        </div>
      `
      : `
        <div class="guardian-video-quick-card-shell" data-role="video-quick-card" data-state="expanded">
          <div class="guardian-video-quick-card-head">
            <div>
              <div class="guardian-label">视频快捷操作</div>
              <div class="guardian-note">${escapeHtml(this.runtime.videoBvid ? `当前视频：${this.runtime.videoBvid}` : "当前视频状态已接管")}</div>
            </div>
            <button class="guardian-icon-text-btn" type="button" data-action="toggle-video-quick-card" aria-label="收起视频快捷卡">收起</button>
          </div>
          <div class="guardian-video-quick-card-status">
            <span class="guardian-status-dot ${status.tone}" aria-hidden="true"></span>
            <span class="guardian-pill ${status.tone}">${escapeHtml(status.pill)}</span>
            <span class="guardian-video-quick-card-inline">${escapeHtml(status.probability)}</span>
            <span class="guardian-video-quick-card-inline">${escapeHtml(status.range)}</span>
          </div>
          <div class="guardian-video-quick-card-summary">${escapeHtml(summary)}</div>
          <div class="guardian-video-quick-card-actions">
            <button class="guardian-btn primary" type="button" data-action="video-quick-primary" ${actionDisabled ? "disabled" : ""}>${escapeHtml(primaryAction.label)}</button>
            ${this.renderVideoQuickSecondaryActions(serviceReady, actionDisabled)}
          </div>
          <label class="guardian-video-quick-card-switch ${!this.runtime.videoBvid ? "disabled" : ""}">
            <span>当前视频自动跳过</span>
            <input type="checkbox" data-action="video-quick-toggle-skip" ${this.runtime.currentVideoAutoSkip ? "checked" : ""} ${this.runtime.videoBvid ? "" : "disabled"}>
          </label>
        </div>
      `;
  }

  private getVideoQuickPrimaryAction(serviceReady: boolean): { label: string; action: VideoQuickCardAction } {
    if (this.isVideoAnalysisInFlight()) {
      return {
        label: "识别中…",
        action: "run-video"
      };
    }

    if (!serviceReady) {
      return {
        label: "去配置识别服务",
        action: "open-service-settings"
      };
    }

    if (this.runtime.videoPhase === "error") {
      return {
        label: "查看排查",
        action: "open-diagnostics"
      };
    }

    return {
      label: "重新识别",
      action: "run-video"
    };
  }

  private renderVideoQuickSecondaryActions(serviceReady: boolean, actionDisabled: boolean): string {
    const buttons: string[] = [];

    if (serviceReady && this.runtime.videoPhase === "error") {
      buttons.push(`<button class="guardian-btn" type="button" data-action="video-quick-run-video" ${actionDisabled ? "disabled" : ""}>重新识别</button>`);
    }

    buttons.push(`<button class="guardian-btn" type="button" data-action="video-quick-open-settings">完整设置</button>`);
    return buttons.join("");
  }

  private async handleVideoQuickAction(action: VideoQuickCardAction): Promise<void> {
    switch (action) {
      case "run-video":
        this.callbacks.onRunVideoAnalysis();
        this.showEdgeToast("已开始重新识别当前视频。", "success");
        return;
      case "open-service-settings":
        await this.openAdvancedPanelSection("service");
        return;
      case "open-diagnostics":
        await this.openAdvancedPanelSection("diagnostics");
        return;
      case "open-video-settings":
      default:
        await this.openPanel("video");
        return;
    }
  }

  private renderModal(): void {
    const snapshot = this.capturePanelSnapshot();
    const currentTab = this.panelTab;
    const diagnostics = this.runtime.diagnostics.length > 0 ? this.runtime.diagnostics.join("\n") : "暂时还没有问题排查记录。";
    const persistedServiceReady = hasConfiguredRecognitionService(this.config);
    const formConfig = this.getFormConfig();
    const draftServiceReady = hasConfiguredRecognitionService(formConfig);
    const advancedSection = this.getAdvancedSection(draftServiceReady);

    this.overlay.classList.toggle("open", this.config.ui.panelOpen);
    this.panel.classList.toggle("open", this.config.ui.panelOpen);

    this.panelHeader.innerHTML = `
      <div class="guardian-header-copy">
        <div class="guardian-header-kicker">${escapeHtml(toDisplayRoute(this.runtime.route))}</div>
        <h2 class="guardian-title">Bilibili Guardian</h2>
        <p class="guardian-subtitle">整理推荐流，识别视频中的疑似广告片段。</p>
      </div>
      <div class="guardian-header-actions">
        <button class="guardian-icon-btn" type="button" data-action="toggle-theme" title="${this.config.ui.theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}">
          ${this.config.ui.theme === "dark" ? "☀" : "☾"}
        </button>
        <button class="guardian-icon-btn" type="button" data-action="close-panel" title="关闭窗口">×</button>
      </div>
    `;
    this.panelTabs.innerHTML = this.renderTabs(currentTab);
    this.panelBody.innerHTML = `
      ${currentTab === "overview" ? this.renderOverview(persistedServiceReady) : ""}
      ${currentTab === "feed" ? this.renderFeedTab(formConfig) : ""}
      ${currentTab === "video" ? this.renderVideoTab(persistedServiceReady, formConfig) : ""}
      ${currentTab === "advanced" ? this.renderAdvancedTab(diagnostics, draftServiceReady, formConfig, advancedSection) : ""}
    `;
    this.panelFooter.innerHTML = `
      <span>${escapeHtml(this.getSupportFootnote())}</span>
      <span>按 Esc 或点击空白处可关闭窗口</span>
    `;

    this.bindPanelEvents();
    this.restorePanelSnapshot(snapshot);
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
    const serviceState: OverviewStatusItem = {
      label: "AI 服务",
      value: serviceReady ? "已准备好" : "未配置",
      note: serviceReady ? `${toProviderLabel(this.config.ai.provider)} · ${this.config.ai.model || "未选择模型"}` : "补全服务后才能识别视频广告片段",
      tone: serviceReady ? "success" : "warning"
    };

    return `
      ${this.renderOnboardingTaskStrip(serviceReady)}
      <section class="guardian-card guardian-command-panel">
        <div class="guardian-hero-head">
          <div>
            <h3 class="guardian-card-title">当前状态</h3>
            <div class="guardian-note">状态会随你所在的 B 站页面自动更新。</div>
          </div>
          <span class="guardian-pill ${pageState.tone}">${escapeHtml(pageState.pill)}</span>
        </div>
        <div class="guardian-status-grid">
          ${this.renderOverviewStatusItem({ label: "当前页面", value: pageState.value, note: pageState.note, tone: pageState.tone })}
          ${this.renderOverviewStatusItem({ label: "首页整理", value: feedState.value, note: feedState.note, tone: this.runtime.route === "feed" ? "success" : "info" })}
          ${this.renderOverviewStatusItem({ label: "视频识别", value: videoState.value, note: videoState.note, tone: this.getVideoStatusView().tone })}
          ${this.renderOverviewStatusItem(serviceState)}
        </div>
        <div class="guardian-highlight ${highlight.tone}">
          <strong>${escapeHtml(highlight.title)}</strong>
          <span>${escapeHtml(highlight.note)}</span>
        </div>
        ${this.renderOverviewMeta(serviceReady)}
        <div class="guardian-actions">
          <button class="guardian-btn primary" type="button" data-action="run-feed" ${this.runtime.route === "feed" ? "" : "disabled"}>立即整理当前页面</button>
          ${serviceReady
            ? `<button class="guardian-btn" type="button" data-action="run-video" ${this.runtime.route === "video" && !this.isVideoAnalysisInFlight() ? "" : "disabled"}>${this.isVideoAnalysisInFlight() ? "正在识别当前视频" : "重新识别当前视频"}</button>`
            : `<button class="guardian-btn" type="button" data-action="goto-advanced-service">去完成识别服务设置</button>`}
        </div>
      </section>
    `;
  }

  private renderOnboardingTaskStrip(serviceReady: boolean): string {
    if (this.config.ui.onboardingDismissed && serviceReady) {
      return "";
    }

    return `
      <section class="guardian-task-strip" data-role="onboarding-tasks">
        <div class="guardian-task-copy">
          <span class="guardian-soft-badge">快速上手</span>
          <strong>${serviceReady ? "基础能力已就绪" : "还差一步启用视频识别"}</strong>
          <span>${serviceReady ? "推荐流整理可以直接使用，视频页会自动进入识别流程。" : "先补全 AI 服务，视频页才能判断并跳过疑似广告片段。"}</span>
        </div>
        <div class="guardian-task-actions">
          ${serviceReady ? `<button class="guardian-btn subtle" type="button" data-action="dismiss-onboarding">收起提示</button>` : `<button class="guardian-btn primary" type="button" data-action="goto-advanced-service">配置识别服务</button>`}
          ${!this.config.ui.onboardingDismissed ? `<button class="guardian-btn subtle" type="button" data-action="dismiss-onboarding">知道了</button>` : ""}
        </div>
      </section>
    `;
  }

  private renderOverviewStatusItem(item: OverviewStatusItem): string {
    return `
      <article class="guardian-status-item ${item.tone}">
        <div class="guardian-status-head">
          <span class="guardian-status-dot ${item.tone}" aria-hidden="true"></span>
          <span class="guardian-state-label">${escapeHtml(item.label)}</span>
        </div>
        <div class="guardian-state-value">${escapeHtml(item.value)}</div>
        <div class="guardian-state-note">${escapeHtml(item.note)}</div>
      </article>
    `;
  }

  private renderFeedTab(formConfig: ExtensionConfig): string {
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
          ${this.renderSwitchField("feed.enabled", "启用首页过滤", "进入支持页面后自动整理推荐内容。", formConfig.feed.enabled)}
          ${this.renderSwitchField("feed.blockAds", "隐藏广告与推广内容", "优先移除明显推广卡片和广告位。", formConfig.feed.blockAds)}
          ${this.renderSwitchField("feed.blockLive", "隐藏直播推荐", "减少直播内容对首页和搜索结果的打扰。", formConfig.feed.blockLive)}
          ${this.renderSwitchField("feed.continuousScan", "自动跟随新内容继续整理", "页面动态加载新卡片时，继续保持整理效果。", formConfig.feed.continuousScan)}
          ${this.renderSwitchField("feed.autoDislikeContent", "屏蔽时自动点不感兴趣", "开启后，移除命中内容前会尝试向 B 站反馈不感兴趣。", formConfig.feed.autoDislikeContent)}
          ${this.renderSwitchField("feed.autoDislikeAuthor", "屏蔽时自动点不想看此 UP 主", "开启后，移除命中内容前会尝试向 B 站反馈不想看此 UP 主。", formConfig.feed.autoDislikeAuthor)}
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
            ] as const).map((scope) => this.renderChoiceItem(scope.label, `data-scope="${scope.id}"`, formConfig.feed.scopes.includes(scope.id))).join("")}
          </div>
        </div>
        <div class="guardian-grid-2">
          <label class="guardian-label">不想看到的分类
            <textarea class="guardian-textarea" data-field="feed.categoryBlacklist" placeholder="每行填写一个分类名称">${escapeHtml(listToLines(formConfig.feed.categoryBlacklist))}</textarea>
          </label>
          <label class="guardian-label">不想看到的关键词
            <textarea class="guardian-textarea" data-field="feed.keywordBlacklist" placeholder="每行填写一个关键词，可用于标题或 UP 主">${escapeHtml(listToLines(formConfig.feed.keywordBlacklist))}</textarea>
          </label>
        </div>
        <div class="guardian-actions">
          <button class="guardian-btn primary" type="button" data-action="save-feed">保存首页过滤设置</button>
          <button class="guardian-btn" type="button" data-action="run-feed" ${this.runtime.route === "feed" ? "" : "disabled"}>立即整理当前页面</button>
        </div>
      </section>
    `;
  }

  private renderVideoTab(serviceReady: boolean, formConfig: ExtensionConfig): string {
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
          ${this.renderSwitchField("video.enabled", "启用视频跳过", "进入视频页后自动尝试识别。", formConfig.video.enabled)}
          ${this.renderSwitchField("video.defaultAutoSkip", "识别后默认自动跳过", "适合希望减少手动操作的日常使用。", formConfig.video.defaultAutoSkip)}
          ${this.renderSwitchField("video.subtitleAnalysisEnabled", "优先使用 AI 字幕识别", "字幕可用时以字幕识别结果为准，支持多个广告区间。", formConfig.video.subtitleAnalysisEnabled)}
          ${this.renderSwitchField("video.danmakuAnalysisEnabled", "允许弹幕识别兜底", "仅在字幕不可用时使用弹幕与评论判断。", formConfig.video.danmakuAnalysisEnabled)}
          ${this.renderSwitchField("toggle-current-skip", "当前这个视频允许自动跳过", this.runtime.videoBvid ? "你可以临时关闭当前视频的自动跳过。" : "打开视频后，这里会显示当前视频专属开关。", this.runtime.currentVideoAutoSkip, true, !this.runtime.videoBvid)}
        </div>
        <div class="guardian-grid-2">
          <label class="guardian-label">识别灵敏度
            <input class="guardian-field" data-field="video.probabilityThreshold" type="number" min="0" max="100" value="${formConfig.video.probabilityThreshold}">
          </label>
          <label class="guardian-label">结果保存时长（分钟）
            <input class="guardian-field" data-field="video.cacheTtlMinutes" type="number" min="1" value="${formConfig.video.cacheTtlMinutes}">
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
            ? `<button class="guardian-btn" type="button" data-action="run-video" ${this.runtime.route === "video" && !this.isVideoAnalysisInFlight() ? "" : "disabled"}>${this.isVideoAnalysisInFlight() ? "正在识别当前视频" : "重新识别当前视频"}</button>`
            : `<button class="guardian-btn" type="button" data-action="goto-advanced-service">去完成识别服务设置</button>`}
        </div>
      </section>
    `;
  }

  private renderAdvancedTab(
    diagnostics: string,
    serviceReady: boolean,
    formConfig: ExtensionConfig,
    advancedSection: AdvancedSectionId
  ): string {
    const selectedModel = this.availableModels.includes(formConfig.ai.model) ? formConfig.ai.model : "";

    return `
      <section class="guardian-card">
        <div class="guardian-section-head">
          <div>
            <h3 class="guardian-card-title">高级设置</h3>
            <div class="guardian-note">这里保留更进阶的识别服务和偏好设置，日常使用通常不需要频繁修改。</div>
          </div>
          <span class="guardian-soft-badge">${serviceReady ? "已具备识别条件" : "建议先补全识别服务"}</span>
        </div>

        <details class="guardian-details" data-section="service" ${advancedSection === "service" ? "open" : ""}>
          <summary data-action="open-advanced-section" data-section="service">识别服务设置</summary>
          <div class="guardian-details-body">
            <div class="guardian-grid-2">
              <label class="guardian-label">识别服务
                <select class="guardian-select" data-field="ai.provider">
                  ${Object.entries(AI_PROVIDER_DEFAULTS).map(([provider]) => `<option value="${provider}" ${formConfig.ai.provider === provider ? "selected" : ""}>${escapeHtml(toProviderLabel(provider as ExtensionConfig["ai"]["provider"]))}</option>`).join("")}
                </select>
              </label>
              <label class="guardian-label">从已获取模型中选择
                <select class="guardian-select" data-action="select-model-option" ${this.availableModels.length > 0 ? "" : "disabled"}>
                  <option value="">${this.availableModels.length > 0 ? "请选择一个模型" : "请先获取模型列表"}</option>
                  ${this.availableModels.map((model) => `<option value="${escapeHtml(model)}" ${selectedModel === model ? "selected" : ""}>${escapeHtml(model)}</option>`).join("")}
                </select>
              </label>
            </div>
            <label class="guardian-label">模型名称
              <input class="guardian-field" data-field="ai.model" placeholder="例如：gpt-4o-mini" value="${escapeHtml(formConfig.ai.model)}">
            </label>
            <label class="guardian-label">接口地址
              <input class="guardian-field" data-field="ai.baseUrl" placeholder="例如：https://api.openai.com/v1" value="${escapeHtml(formConfig.ai.baseUrl)}">
            </label>
            <label class="guardian-label">访问密钥
              <input class="guardian-field" data-field="ai.apiKey" type="password" placeholder="请输入你的服务密钥" value="${escapeHtml(formConfig.ai.apiKey)}">
            </label>
            <div class="guardian-actions">
              <button class="guardian-btn primary" type="button" data-action="save-service">保存识别服务设置</button>
              <button class="guardian-btn" type="button" data-action="fetch-models">获取可用模型</button>
            </div>
            <div class="guardian-empty">
              ${this.availableModels.length > 0
                ? `已获取 ${this.availableModels.length} 个模型，你可以直接从上面的下拉框里选择，也可以继续手动输入自定义模型。`
                : "还没有获取到可用模型列表，需要时可以点击上方按钮尝试获取。"}
            </div>
          </div>
        </details>

        <details class="guardian-details" data-section="preferences" ${advancedSection === "preferences" ? "open" : ""}>
          <summary data-action="open-advanced-section" data-section="preferences">识别偏好</summary>
          <div class="guardian-details-body">
            <label class="guardian-label">字幕识别说明词
              <textarea class="guardian-textarea guardian-textarea-lg" data-field="ai.subtitlePrompt" placeholder="用于 AI 字幕多区间识别">${escapeHtml(formConfig.ai.subtitlePrompt)}</textarea>
            </label>
            <label class="guardian-label">弹幕识别说明词
              <textarea class="guardian-textarea guardian-textarea-lg" data-field="ai.danmakuPrompt" placeholder="用于弹幕和评论识别">${escapeHtml(formConfig.ai.danmakuPrompt)}</textarea>
            </label>
            <div class="guardian-grid-2">
              <label class="guardian-label">优先参考词
                <textarea class="guardian-textarea" data-field="ai.whitelist" placeholder="每行填写一个词">${escapeHtml(listToLines(formConfig.ai.whitelist))}</textarea>
              </label>
              <label class="guardian-label">忽略参考词
                <textarea class="guardian-textarea" data-field="ai.blacklist" placeholder="每行填写一个词">${escapeHtml(listToLines(formConfig.ai.blacklist))}</textarea>
              </label>
            </div>
            <div class="guardian-choice-grid">
              ${this.renderChoiceItem("启用优先参考词", 'data-field="ai.whitelistEnabled"', formConfig.ai.whitelistEnabled)}
              ${this.renderChoiceItem("优先参考词使用正则", 'data-field="ai.whitelistRegex"', formConfig.ai.whitelistRegex)}
              ${this.renderChoiceItem("启用忽略参考词", 'data-field="ai.blacklistEnabled"', formConfig.ai.blacklistEnabled)}
              ${this.renderChoiceItem("忽略参考词使用正则", 'data-field="ai.blacklistRegex"', formConfig.ai.blacklistRegex)}
            </div>
            <div class="guardian-grid-2">
              <label class="guardian-label">长内容修正
                <input class="guardian-field" data-field="video.durationPenalty" type="number" min="0" value="${formConfig.video.durationPenalty}">
              </label>
              <label class="guardian-label">最少参考弹幕数
                <input class="guardian-field" data-field="video.minDanmakuForAnalysis" type="number" min="1" value="${formConfig.video.minDanmakuForAnalysis}">
              </label>
              <label class="guardian-label">最多参考字幕条数
                <input class="guardian-field" data-field="video.maxSubtitleCueCount" type="number" min="1" value="${formConfig.video.maxSubtitleCueCount}">
              </label>
              <label class="guardian-label">最短片段时长（秒）
                <input class="guardian-field" data-field="video.minAdDuration" type="number" min="1" value="${formConfig.video.minAdDuration}">
              </label>
              <label class="guardian-label">最长片段时长（秒）
                <input class="guardian-field" data-field="video.maxAdDuration" type="number" min="1" value="${formConfig.video.maxAdDuration}">
              </label>
            </div>
            <div class="guardian-actions">
              <button class="guardian-btn primary" type="button" data-action="save-preferences">保存识别偏好</button>
            </div>
          </div>
        </details>

        <details class="guardian-details" data-section="diagnostics" ${advancedSection === "diagnostics" ? "open" : ""}>
          <summary data-action="open-advanced-section" data-section="diagnostics">问题排查</summary>
          <div class="guardian-details-body">
            <div class="guardian-note">如果你遇到识别失败、页面结构变化或自动跳过异常，可以先看看这里。</div>
            ${this.renderVideoDiagnosticDetail()}
            <div class="guardian-subsection">
              <div class="guardian-label">运行日志</div>
              <div class="guardian-diagnostics">${escapeHtml(diagnostics)}</div>
            </div>
            <div class="guardian-actions">
              <button class="guardian-btn" type="button" data-action="show-onboarding">重新查看使用说明</button>
              <button class="guardian-btn" type="button" data-action="clear-diagnostics">清空记录</button>
            </div>
          </div>
        </details>
      </section>
    `;
  }

  private renderVideoDiagnosticDetail(): string {
    const details = this.runtime.videoErrorDetails;
    if (!details) {
      return `
        <div class="guardian-empty" data-role="video-diagnostic-empty">
          最近还没有视频识别失败的详细信息。等下一次失败发生后，这里会显示服务、模型、失败阶段和 AI 返回预览。
        </div>
      `;
    }

    return `
      <section class="guardian-diagnostic-detail" data-role="video-diagnostic">
        <div class="guardian-diagnostic-head">
          <div>
            <div class="guardian-label">最近一次视频识别失败</div>
            <div class="guardian-note">${escapeHtml(toFailureCodeLabel(details.code))} · ${escapeHtml(toFailureStageLabel(details.stage))}</div>
          </div>
          <span class="guardian-pill danger">需要排查</span>
        </div>
        <div class="guardian-diagnostic-meta">
          <span>服务：${escapeHtml(toProviderLabel(details.provider))}</span>
          <span>模型：${escapeHtml(details.model)}</span>
          <span>请求：${escapeHtml(details.requestId)}</span>
          <span>读取来源：${escapeHtml(details.responseSource)}</span>
        </div>
        <div class="guardian-diagnostic-message">${escapeHtml(details.parserMessage)}</div>
        <div class="guardian-note">建议动作：${escapeHtml(details.suggestion)}</div>
        <div class="guardian-subsection">
          <div class="guardian-label">提取文本预览</div>
          <div class="guardian-diagnostics guardian-diagnostics-preview">${escapeHtml(details.responsePreview)}</div>
        </div>
        ${details.responseEnvelopePreview ? `
          <div class="guardian-subsection">
            <div class="guardian-label">原始响应摘要</div>
            <div class="guardian-diagnostics guardian-diagnostics-preview">${escapeHtml(details.responseEnvelopePreview)}</div>
          </div>
        ` : ""}
        ${details.exchangeTranscript ? `
          <div class="guardian-subsection">
            <div class="guardian-label">完整请求与响应</div>
            <div class="guardian-note">已自动隐藏 Authorization / API Key，仅保留请求体与响应体内容。</div>
            <div class="guardian-diagnostics guardian-diagnostics-preview">${escapeHtml(details.exchangeTranscript)}</div>
          </div>
        ` : ""}
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

  private renderOverviewMeta(serviceReady: boolean): string {
    const items: Array<{ label: string; value: string }> = [
      {
        label: "识别服务",
        value: serviceReady ? "已准备好" : "未完成配置"
      }
    ];

    if (this.runtime.route === "feed") {
      items.unshift({
        label: "当前范围",
        value: toScopeLabel(this.runtime.pageScope)
      });
    } else if (this.runtime.route === "video") {
      items.unshift({
        label: "视频状态",
        value: this.runtime.videoBvid ? "当前视频已就绪" : "正在等待视频信息"
      });
    } else {
      items.unshift({
        label: "当前页面",
        value: "暂未进入支持范围"
      });
    }

    return `
      <div class="guardian-overview-meta">
        ${items.map((item) => `
          <div class="guardian-overview-meta-item">
            <span class="guardian-overview-meta-label">${escapeHtml(item.label)}</span>
            <span class="guardian-overview-meta-value">${escapeHtml(item.value)}</span>
          </div>
        `).join("")}
      </div>
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
        summary: getVideoWaitingSummary(this.runtime.videoPhase)
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

  private isVideoAnalysisInFlight(): boolean {
    return this.runtime.videoPhase === "collecting" || this.runtime.videoPhase === "analyzing";
  }

  private bindPanelEvents(): void {
    this.bindInteractiveInputs();
  }

  private async handlePanelClick(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const tabButton = target.closest<HTMLElement>("[data-tab]");
    if (tabButton) {
      const tab = tabButton.dataset.tab as DisplayTabId;
      if (this.panelTab !== tab) {
        this.panelTab = tab;
        this.renderModal();
      }
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (!actionElement) {
      return;
    }

    if (actionElement instanceof HTMLButtonElement && actionElement.disabled) {
      return;
    }

    const action = actionElement.dataset.action;
    switch (action) {
      case "toggle-theme":
        void Promise.resolve(this.callbacks.onSetTheme(this.config.ui.theme === "dark" ? "light" : "dark"));
        this.showEdgeToast(this.config.ui.theme === "dark" ? "已切换为浅色模式。" : "已切换为深色模式。", "success");
        return;
      case "close-panel":
        this.callbacks.onTogglePanel();
        return;
      case "goto-advanced-service":
        this.openAdvancedSection("service");
        return;
      case "open-advanced-section":
        event.preventDefault();
        this.expandedAdvancedSection = actionElement.dataset.section as AdvancedSectionId;
        this.renderModal();
        return;
      case "dismiss-onboarding":
        await this.persistConfig(
          {
            ui: {
              ...this.config.ui,
              onboardingDismissed: true
            }
          },
          "已收起使用说明，之后不会再重复打扰。"
        );
        return;
      case "show-onboarding":
        await this.persistConfig(
          {
            ui: {
              ...this.config.ui,
              onboardingDismissed: false
            }
          },
          "已重新打开使用说明。"
        );
        this.panelTab = "overview";
        this.renderModal();
        return;
      case "run-feed":
        this.callbacks.onRunFeedScan();
        this.showEdgeToast("已开始整理当前页面。", "success");
        return;
      case "run-video":
        if (this.isVideoAnalysisInFlight()) {
          return;
        }
        this.callbacks.onRunVideoAnalysis();
        this.showEdgeToast("已开始重新识别当前视频。", "success");
        return;
      case "clear-diagnostics":
        this.callbacks.onResetDiagnostics();
        this.showEdgeToast("问题排查记录已清空。", "success");
        return;
      case "save-feed":
        await this.saveFeedSettings();
        return;
      case "save-video":
        await this.saveVideoSettings();
        return;
      case "save-service":
        await this.saveServiceSettings();
        return;
      case "save-preferences":
        await this.savePreferenceSettings();
        return;
      case "fetch-models":
        await this.fetchAvailableModels();
        return;
      default:
        return;
    }
  }

  private async handlePanelChange(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }

    const action = target.dataset.action;
    if (action === "toggle-current-skip" && target instanceof HTMLInputElement) {
      this.callbacks.onToggleCurrentVideoAutoSkip(target.checked);
      this.showEdgeToast(target.checked ? "当前视频已允许自动跳过。" : "当前视频已关闭自动跳过。", "success");
      return;
    }

    if (action === "select-model-option" && target instanceof HTMLSelectElement) {
      if (!target.value) {
        return;
      }

      const formConfig = this.getFormConfig();
      formConfig.ai.model = target.value;
      if (formConfig.ai.provider === "custom") {
        this.customServiceDraft.model = target.value;
      }

      this.renderModal();
    }
  }

  private async saveFeedSettings(): Promise<void> {
    const formConfig = this.getFormConfig();
    await this.persistConfig(
      {
        feed: {
          ...formConfig.feed
        }
      },
      "首页过滤设置已保存。"
    );
  }

  private async saveVideoSettings(): Promise<void> {
    const formConfig = this.getFormConfig();
    await this.persistConfig(
      {
        video: {
          ...formConfig.video
        }
      },
      "视频跳过设置已保存。"
    );
  }

  private async saveServiceSettings(): Promise<void> {
    const formConfig = this.getFormConfig();
    await this.persistConfig(
      {
        ai: {
          ...this.config.ai,
          provider: formConfig.ai.provider,
          model: formConfig.ai.model,
          baseUrl: formConfig.ai.baseUrl,
          apiKey: formConfig.ai.apiKey
        }
      },
      "识别服务设置已保存。"
    );
  }

  private async savePreferenceSettings(): Promise<void> {
    const formConfig = this.getFormConfig();
    await this.persistConfig(
      {
        ai: {
          ...this.config.ai,
          prompt: formConfig.ai.danmakuPrompt,
          danmakuPrompt: formConfig.ai.danmakuPrompt,
          subtitlePrompt: formConfig.ai.subtitlePrompt,
          whitelist: formConfig.ai.whitelist,
          blacklist: formConfig.ai.blacklist,
          whitelistEnabled: formConfig.ai.whitelistEnabled,
          whitelistRegex: formConfig.ai.whitelistRegex,
          blacklistEnabled: formConfig.ai.blacklistEnabled,
          blacklistRegex: formConfig.ai.blacklistRegex
        },
        video: {
          ...this.config.video,
          durationPenalty: formConfig.video.durationPenalty,
          minDanmakuForAnalysis: formConfig.video.minDanmakuForAnalysis,
          maxSubtitleCueCount: formConfig.video.maxSubtitleCueCount,
          minAdDuration: formConfig.video.minAdDuration,
          maxAdDuration: formConfig.video.maxAdDuration
        }
      },
      "识别偏好已保存。"
    );
  }

  private async fetchAvailableModels(): Promise<void> {
    const formConfig = this.getFormConfig();
    const provider = formConfig.ai.provider;
    const baseUrl = formConfig.ai.baseUrl;

    try {
      this.availableModels = await this.callbacks.onFetchModels(provider, baseUrl);
      if (
        this.availableModels.length > 0 &&
        shouldAutoPickFetchedModel(provider, formConfig.ai.model)
      ) {
        formConfig.ai.model = this.availableModels[0];
        if (provider === "custom") {
          this.customServiceDraft.model = formConfig.ai.model;
        }
      }
      this.showEdgeToast(this.availableModels.length > 0 ? "已获取可用模型列表。" : "没有获取到模型列表，请检查服务设置。", this.availableModels.length > 0 ? "success" : "warning");
      this.renderModal();
    } catch (error) {
      this.showEdgeToast(`获取模型失败：${this.formatError(error)}`, "danger");
    }
  }

  private async handleVideoQuickCardClick(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (!actionElement) {
      return;
    }

    if (actionElement instanceof HTMLButtonElement && actionElement.disabled) {
      return;
    }

    const action = actionElement.dataset.action;
    if (action === "toggle-video-quick-card") {
      this.videoQuickCardCollapsed = !this.videoQuickCardCollapsed;
      this.renderVideoQuickCard();
      return;
    }

    if (action === "video-quick-primary") {
      if (this.isVideoAnalysisInFlight()) {
        return;
      }
      await this.handleVideoQuickAction(this.getVideoQuickPrimaryAction(hasConfiguredRecognitionService(this.config)).action);
      return;
    }

    if (action === "video-quick-run-video") {
      if (this.isVideoAnalysisInFlight()) {
        return;
      }
      await this.handleVideoQuickAction("run-video");
      return;
    }

    if (action === "video-quick-open-settings") {
      await this.handleVideoQuickAction("open-video-settings");
    }
  }

  private handleVideoQuickCardChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.dataset.action !== "video-quick-toggle-skip") {
      return;
    }

    this.callbacks.onToggleCurrentVideoAutoSkip(target.checked);
    this.showEdgeToast(target.checked ? "当前视频已允许自动跳过。" : "当前视频已关闭自动跳过。", "success");
  }

  private handleToastClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest<HTMLElement>("[data-action='toast-action']");
    if (!button) {
      return;
    }

    const toastId = Number(button.dataset.toastId);
    const toast = this.edgeToasts.find((item) => item.id === toastId);
    toast?.onAction?.();
    this.dismissEdgeToast(toastId);
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

  private handleFormMutation(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }

    if (target.dataset.scope) {
      const formConfig = this.getFormConfig();
      const scopes = Array.from(this.panel.querySelectorAll<HTMLInputElement>("[data-scope]"))
        .filter((input) => input.checked)
        .map((input) => input.dataset.scope as FeedPageScope);
      formConfig.feed.scopes = scopes.length > 0 ? scopes : this.config.feed.scopes;
      return;
    }

    const field = target.dataset.field;
    if (!field) {
      return;
    }

    const formConfig = this.getFormConfig();

    switch (field) {
      case "feed.enabled":
        formConfig.feed.enabled = target instanceof HTMLInputElement ? target.checked : formConfig.feed.enabled;
        return;
      case "feed.blockAds":
        formConfig.feed.blockAds = target instanceof HTMLInputElement ? target.checked : formConfig.feed.blockAds;
        return;
      case "feed.blockLive":
        formConfig.feed.blockLive = target instanceof HTMLInputElement ? target.checked : formConfig.feed.blockLive;
        return;
      case "feed.continuousScan":
        formConfig.feed.continuousScan = target instanceof HTMLInputElement ? target.checked : formConfig.feed.continuousScan;
        return;
      case "feed.autoDislikeContent":
        formConfig.feed.autoDislikeContent = target instanceof HTMLInputElement ? target.checked : formConfig.feed.autoDislikeContent;
        return;
      case "feed.autoDislikeAuthor":
        formConfig.feed.autoDislikeAuthor = target instanceof HTMLInputElement ? target.checked : formConfig.feed.autoDislikeAuthor;
        return;
      case "feed.categoryBlacklist":
        formConfig.feed.categoryBlacklist = linesToList(target.value);
        return;
      case "feed.keywordBlacklist":
        formConfig.feed.keywordBlacklist = linesToList(target.value);
        return;
      case "video.enabled":
        formConfig.video.enabled = target instanceof HTMLInputElement ? target.checked : formConfig.video.enabled;
        return;
      case "video.defaultAutoSkip":
        formConfig.video.defaultAutoSkip = target instanceof HTMLInputElement ? target.checked : formConfig.video.defaultAutoSkip;
        return;
      case "video.subtitleAnalysisEnabled":
        formConfig.video.subtitleAnalysisEnabled = target instanceof HTMLInputElement ? target.checked : formConfig.video.subtitleAnalysisEnabled;
        return;
      case "video.danmakuAnalysisEnabled":
        formConfig.video.danmakuAnalysisEnabled = target instanceof HTMLInputElement ? target.checked : formConfig.video.danmakuAnalysisEnabled;
        return;
      case "video.probabilityThreshold":
        formConfig.video.probabilityThreshold = this.readNumericValue(target.value, formConfig.video.probabilityThreshold);
        return;
      case "video.cacheTtlMinutes":
        formConfig.video.cacheTtlMinutes = this.readNumericValue(target.value, formConfig.video.cacheTtlMinutes);
        return;
      case "video.durationPenalty":
        formConfig.video.durationPenalty = this.readNumericValue(target.value, formConfig.video.durationPenalty);
        return;
      case "video.minDanmakuForAnalysis":
        formConfig.video.minDanmakuForAnalysis = this.readNumericValue(target.value, formConfig.video.minDanmakuForAnalysis);
        return;
      case "video.maxSubtitleCueCount":
        formConfig.video.maxSubtitleCueCount = this.readNumericValue(target.value, formConfig.video.maxSubtitleCueCount);
        return;
      case "video.minAdDuration":
        formConfig.video.minAdDuration = this.readNumericValue(target.value, formConfig.video.minAdDuration);
        return;
      case "video.maxAdDuration":
        formConfig.video.maxAdDuration = this.readNumericValue(target.value, formConfig.video.maxAdDuration);
        return;
      case "ai.provider":
        if (target instanceof HTMLSelectElement) {
          this.handleProviderChange(target.value as ExtensionConfig["ai"]["provider"]);
        }
        return;
      case "ai.model":
        formConfig.ai.model = target.value;
        if (formConfig.ai.provider === "custom") {
          this.customServiceDraft.model = target.value;
        }
        return;
      case "ai.baseUrl":
        formConfig.ai.baseUrl = target.value;
        if (formConfig.ai.provider === "custom") {
          this.customServiceDraft.baseUrl = target.value;
        }
        return;
      case "ai.apiKey":
        formConfig.ai.apiKey = target.value;
        return;
      case "ai.prompt":
        formConfig.ai.prompt = target.value;
        formConfig.ai.danmakuPrompt = target.value;
        return;
      case "ai.danmakuPrompt":
        formConfig.ai.danmakuPrompt = target.value;
        formConfig.ai.prompt = target.value;
        return;
      case "ai.subtitlePrompt":
        formConfig.ai.subtitlePrompt = target.value;
        return;
      case "ai.whitelist":
        formConfig.ai.whitelist = linesToList(target.value);
        return;
      case "ai.blacklist":
        formConfig.ai.blacklist = linesToList(target.value);
        return;
      case "ai.whitelistEnabled":
        formConfig.ai.whitelistEnabled = target instanceof HTMLInputElement ? target.checked : formConfig.ai.whitelistEnabled;
        return;
      case "ai.whitelistRegex":
        formConfig.ai.whitelistRegex = target instanceof HTMLInputElement ? target.checked : formConfig.ai.whitelistRegex;
        return;
      case "ai.blacklistEnabled":
        formConfig.ai.blacklistEnabled = target instanceof HTMLInputElement ? target.checked : formConfig.ai.blacklistEnabled;
        return;
      case "ai.blacklistRegex":
        formConfig.ai.blacklistRegex = target instanceof HTMLInputElement ? target.checked : formConfig.ai.blacklistRegex;
        return;
      default:
        return;
    }
  }

  private handleProviderChange(nextProvider: ExtensionConfig["ai"]["provider"]): void {
    const formConfig = this.getFormConfig();
    if (formConfig.ai.provider === "custom") {
      this.customServiceDraft = {
        baseUrl: formConfig.ai.baseUrl,
        model: formConfig.ai.model
      };
    }

    formConfig.ai.provider = nextProvider;
    this.availableModels = [];

    if (nextProvider === "custom") {
      formConfig.ai.baseUrl = this.customServiceDraft.baseUrl;
      formConfig.ai.model = this.customServiceDraft.model;
    } else {
      formConfig.ai.baseUrl = AI_PROVIDER_DEFAULTS[nextProvider].baseUrl;
      formConfig.ai.model = AI_PROVIDER_DEFAULTS[nextProvider].models[0] ?? "";
    }

    this.renderModal();
  }

  private async persistConfig(patch: DeepPartial<ExtensionConfig>, successMessage: string): Promise<void> {
    try {
      await this.callbacks.onSaveConfig(patch);
      this.showEdgeToast(successMessage, "success");
    } catch (error) {
      this.showEdgeToast(`保存失败：${this.formatError(error)}`, "danger");
    }
  }

  private renderEdgeToasts(): void {
    const activeRegion = this.config.ui.panelOpen ? this.panelToastRegion : this.toastRegion;
    const inactiveRegion = this.config.ui.panelOpen ? this.toastRegion : this.panelToastRegion;
    const toastMarkup = this.edgeToasts
      .map((toast) => `
        <section class="guardian-edge-toast ${toast.tone}" data-toast-id="${toast.id}" role="status" aria-live="polite">
          <div class="guardian-edge-toast-head">
            <span class="guardian-edge-toast-badge ${toast.tone}">${escapeHtml(toToastLabel(toast.tone))}</span>
          </div>
          <div class="guardian-edge-toast-copy">${escapeHtml(toast.text)}</div>
          ${toast.actionLabel ? `
            <div class="guardian-edge-toast-actions">
              <button class="guardian-edge-toast-action" type="button" data-action="toast-action" data-toast-id="${toast.id}">${escapeHtml(toast.actionLabel)}</button>
            </div>
          ` : ""}
        </section>
      `)
      .join("");

    inactiveRegion.innerHTML = "";
    inactiveRegion.classList.remove("visible");
    activeRegion.innerHTML = toastMarkup;
    activeRegion.classList.toggle("visible", this.edgeToasts.length > 0);
  }

  private dismissEdgeToast(id: number): void {
    const timerId = this.toastTimers.get(id);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      this.toastTimers.delete(id);
    }

    const nextToasts = this.edgeToasts.filter((toast) => toast.id !== id);
    if (nextToasts.length === this.edgeToasts.length) {
      return;
    }

    this.edgeToasts = nextToasts;
    this.renderEdgeToasts();
  }

  private formatError(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "请稍后重试。";
  }

  private readNumericValue(raw: string, fallback: number): number {
    const value = Number(raw.trim());
    return Number.isFinite(value) ? value : fallback;
  }
}
