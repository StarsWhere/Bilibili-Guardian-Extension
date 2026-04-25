import { classifyFeedPage } from "@/shared/url";
import type { ExtensionConfig, FeedCardModel, FeedFeedbackAction, FeedFeedbackPayload, FeedFeedbackTarget, FeedPageScope } from "@/shared/types";

interface FeedGuardApp {
  config: ExtensionConfig;
  notifyFeedScan(result: { removedCount: number; scope: FeedPageScope | null }): void;
  log(message: string): void;
  sendFeedScanMetric(blockedCount: number): Promise<void>;
  submitFeedFeedback(payload: FeedFeedbackPayload): Promise<{ ok: boolean; message: string }>;
}

const CARD_ROOT_SELECTORS = [
  ".feed-card",
  ".bili-video-card",
  ".bili-feed-card",
  ".floor-single-card",
  ".video-card",
  ".rank-item",
  ".search-all-list .bili-video-card"
];

const TITLE_SELECTORS = [
  ".bili-video-card__info--tit",
  ".bili-video-card__info--title",
  ".video-name",
  ".title",
  ".rank-item-title"
];

const AUTHOR_SELECTORS = [
  ".bili-video-card__info--author",
  ".bili-video-card__info--owner",
  ".up-name",
  ".author",
  ".bili-video-card__info--bottom .name"
];

const CATEGORY_SELECTORS = [
  ".bili-grid-floor-header__title",
  ".floor-title",
  ".channel-name",
  ".partition"
];

const AD_SELECTORS = [
  ".bili-ad",
  "[ad-id]",
  ".ad-report",
  "[data-report*='ad']",
  ".ad-tag",
  ".video-card-ad"
];

const LIVE_SELECTORS = [
  ".live-tag",
  ".recommend-card__live-status",
  ".bili-live-card",
  ".live-mark"
];

const BVID_PATTERN = /\/video\/(BV[a-zA-Z0-9]+)/;
const MID_PATTERN = /space\.bilibili\.com\/(\d+)/;
const AID_PATTERN = /(?:^|[?&/])(?:aid|av)(\d+)(?:\D|$)/i;

function isGuardianMutationTarget(node: Node | null): boolean {
  if (!(node instanceof Element)) {
    return false;
  }

  return node.id === "guardian-root" || Boolean(node.closest("#guardian-root"));
}

export function shouldIgnoreMutations(mutations: Pick<MutationRecord, "target" | "addedNodes" | "removedNodes">[]): boolean {
  return mutations.every((mutation) => {
    if (isGuardianMutationTarget(mutation.target)) {
      return true;
    }

    const addedInsideGuardian = Array.from(mutation.addedNodes).every((node) => isGuardianMutationTarget(node));
    const removedInsideGuardian = Array.from(mutation.removedNodes).every((node) => isGuardianMutationTarget(node));

    return addedInsideGuardian && removedInsideGuardian;
  });
}

function firstText(root: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const found = root.querySelector(selector);
    if (found?.textContent?.trim()) {
      return found.textContent.trim();
    }
  }
  return "";
}

function uniqueCardRoots(): HTMLElement[] {
  const unique = new Set<HTMLElement>();
  for (const selector of CARD_ROOT_SELECTORS) {
    document.querySelectorAll<HTMLElement>(selector).forEach((element) => unique.add(element));
  }
  return [...unique];
}

function parseNumber(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function firstAttribute(root: Element, names: string[]): string {
  for (const name of names) {
    const direct = root.getAttribute(name);
    if (direct) {
      return direct;
    }

    const found = root.querySelector(`[${name}]`)?.getAttribute(name);
    if (found) {
      return found;
    }
  }

  return "";
}

function firstHref(root: Element, selector: string): string {
  return root.querySelector<HTMLAnchorElement>(selector)?.href || "";
}

function parseBvid(root: Element): string | null {
  const href = firstHref(root, "a[href*='/video/BV']");
  return href.match(BVID_PATTERN)?.[1] ?? null;
}

function parseAid(root: Element): number | null {
  const explicit = parseNumber(firstAttribute(root, ["data-aid", "data-avid", "data-id"]));
  if (explicit) {
    return explicit;
  }

  const href = firstHref(root, "a[href*='/video/av'], a[href*='aid=']");
  return parseNumber(href.match(AID_PATTERN)?.[1]);
}

function parseMid(root: Element): number | null {
  const explicit = parseNumber(firstAttribute(root, ["data-mid", "data-up-mid", "data-author-mid"]));
  if (explicit) {
    return explicit;
  }

  const href = firstHref(root, "a[href*='space.bilibili.com']");
  return parseNumber(href.match(MID_PATTERN)?.[1]);
}

export function buildFeedbackTarget(element: HTMLElement, title: string, author: string): FeedFeedbackTarget | null {
  const bvid = parseBvid(element);
  const id = parseAid(element);
  if (!bvid && !id) {
    return null;
  }

  return {
    title,
    author,
    bvid,
    id,
    mid: parseMid(element),
    goto: firstAttribute(element, ["data-goto", "data-card-goto"]) || "av",
    trackId: firstAttribute(element, ["data-track-id", "data-trackid", "data-uniq-id"]),
    spmid: firstAttribute(element, ["data-spmid"]) || "333.1007.0.0",
    fromSpmid: new URLSearchParams(window.location.search).get("spm_id_from") || ""
  };
}

function extractCards(): FeedCardModel[] {
  return uniqueCardRoots().map((element) => {
    const title = firstText(element, TITLE_SELECTORS);
    const author = firstText(element, AUTHOR_SELECTORS);
    const category = firstText(element, CATEGORY_SELECTORS) || element.closest(".bili-grid-floor")?.querySelector(".bili-grid-floor-header__title")?.textContent?.trim() || "";
    const plainText = element.textContent || "";
    const isLive = LIVE_SELECTORS.some((selector) => element.matches(selector) || Boolean(element.querySelector(selector))) || plainText.includes("正在直播");

    return {
      title,
      author,
      category,
      isAd: AD_SELECTORS.some((selector) => element.matches(selector) || Boolean(element.querySelector(selector))) || /广告|推广/.test(plainText),
      isLive,
      feedback: buildFeedbackTarget(element, title, author),
      feedbackUnsupportedReason: isLive ? "live" : null,
      element
    };
  });
}

export function shouldFilterCard(card: FeedCardModel, config: ExtensionConfig): boolean {
  if (config.feed.blockAds && card.isAd) {
    return true;
  }

  if (config.feed.blockLive && card.isLive) {
    return true;
  }

  if (card.category && config.feed.categoryBlacklist.some((keyword) => card.category.includes(keyword))) {
    return true;
  }

  if (config.feed.keywordBlacklist.length > 0) {
    return config.feed.keywordBlacklist.some(
      (keyword) => card.title.includes(keyword) || card.author.includes(keyword)
    );
  }

  return false;
}

function removeCards(cards: FeedCardModel[], removeDelayMs = 170): number {
  let removed = 0;
  cards.forEach((card) => {
    const target = card.element.closest<HTMLElement>(".bili-grid-floor") ?? card.element;
    if (target.dataset.guardianRemoved === "true") {
      return;
    }
    target.dataset.guardianRemoved = "true";
    target.style.opacity = "0";
    target.style.transform = "scale(0.98)";
    target.style.transition = "opacity 160ms ease, transform 160ms ease";
    window.setTimeout(() => target.remove(), removeDelayMs);
    removed += 1;
  });
  return removed;
}

function hasFeedbackActionEnabled(config: ExtensionConfig): boolean {
  return config.feed.autoDislikeContent || config.feed.autoDislikeAuthor;
}

function getFeedbackTargetLabel(target: FeedFeedbackTarget): string {
  return target.title || target.bvid || (target.id ? String(target.id) : "未知内容");
}

function getFeedbackKey(target: FeedFeedbackTarget, action: FeedFeedbackAction): string {
  const contentId = target.id ? `aid:${target.id}` : `bvid:${target.bvid ?? target.title}`;
  const authorId = target.mid ? `mid:${target.mid}` : `author:${target.author}`;
  return `${action}:${contentId}:${authorId}`;
}

function getMissingFeedbackKey(card: FeedCardModel): string {
  return card.title || card.author || card.category || card.element.textContent?.trim() || "unknown";
}

export class FeedGuard {
  private observer: MutationObserver | null = null;
  private throttleId: number | null = null;
  private currentScope: FeedPageScope | null = null;
  private readonly submittedFeedbackKeys = new Set<string>();
  private readonly missingFeedbackKeys = new Set<string>();

  constructor(private readonly app: FeedGuardApp) {}

  match(url: URL): boolean {
    const scope = classifyFeedPage(url);
    if (!scope) {
      return false;
    }

    return this.app.config.feed.enabled && this.app.config.feed.scopes.includes(scope);
  }

  async mount(url: URL): Promise<void> {
    this.currentScope = classifyFeedPage(url);
    this.runScan();

    if (this.app.config.feed.continuousScan) {
      this.observer = new MutationObserver((mutations) => {
        if (shouldIgnoreMutations(mutations)) {
          return;
        }

        if (this.throttleId !== null) {
          return;
        }

        this.throttleId = window.setTimeout(() => {
          this.throttleId = null;
          this.runScan();
        }, 300);
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  unmount(): void {
    if (this.throttleId !== null) {
      window.clearTimeout(this.throttleId);
      this.throttleId = null;
    }

    this.observer?.disconnect();
    this.observer = null;
    this.currentScope = null;
    this.submittedFeedbackKeys.clear();
    this.missingFeedbackKeys.clear();
  }

  runScan(): void {
    if (!this.currentScope || !this.app.config.feed.enabled) {
      return;
    }

    const cards = extractCards();
    const matched = cards.filter((card) => shouldFilterCard(card, this.app.config));
    const shouldRunFeedbackActions = hasFeedbackActionEnabled(this.app.config);
    if (shouldRunFeedbackActions) {
      matched.forEach((card) => {
        void this.performFeedbackActions(card);
      });
    }
    const removedCount = removeCards(matched, shouldRunFeedbackActions ? 520 : 170);
    this.app.notifyFeedScan({ removedCount, scope: this.currentScope });

    if (removedCount > 0) {
      void this.app.sendFeedScanMetric(removedCount);
      this.app.log(`FeedGuard 移除了 ${removedCount} 个卡片`);
    }
  }

  private async performFeedbackActions(card: FeedCardModel): Promise<void> {
    if (card.feedbackUnsupportedReason === "live") {
      return;
    }

    if (!card.feedback) {
      const missingKey = getMissingFeedbackKey(card);
      if (!this.missingFeedbackKeys.has(missingKey)) {
        this.missingFeedbackKeys.add(missingKey);
        this.app.log(`首页反馈跳过：无法从卡片提取 aid/bvid（${card.title || "无标题"}）`);
      }
      return;
    }

    if (this.app.config.feed.autoDislikeContent) {
      await this.submitFeedbackAction(card.feedback, "content");
    }

    if (this.app.config.feed.autoDislikeAuthor) {
      await this.submitFeedbackAction(card.feedback, "author");
    }
  }

  private async submitFeedbackAction(target: FeedFeedbackTarget, action: FeedFeedbackAction): Promise<void> {
    const actionLabel = action === "content" ? "不感兴趣" : "不想看此 UP 主";
    const feedbackKey = getFeedbackKey(target, action);
    if (this.submittedFeedbackKeys.has(feedbackKey)) {
      return;
    }

    this.submittedFeedbackKeys.add(feedbackKey);
    try {
      const result = await this.app.submitFeedFeedback({
        ...target,
        action
      });
      this.app.log(`首页反馈成功：${actionLabel} / ${getFeedbackTargetLabel(target)} / ${result.message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.app.log(`首页反馈失败：${actionLabel} / ${getFeedbackTargetLabel(target)} / ${message}`);
    }
  }
}
