import { classifyFeedPage } from "@/shared/url";
import type { ExtensionConfig, FeedCardModel, FeedPageScope } from "@/shared/types";

interface FeedGuardApp {
  config: ExtensionConfig;
  notifyFeedScan(result: { removedCount: number; scope: FeedPageScope | null }): void;
  log(message: string): void;
  sendFeedScanMetric(blockedCount: number): Promise<void>;
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

const BILI_VIDEO_CARD_DISLIKE_TRIGGER_SELECTOR = ".bili-video-card__info--no-interest";
const BILI_VIDEO_CARD_DISLIKE_RESULT_SELECTOR = ".bili-video-card__no-interest";
const BILI_VIDEO_CARD_DISLIKE_RESULT_TITLE_SELECTOR = ".no-interest-title";

const FEEDBACK_MENU_TRIGGER_SELECTORS = [
  ".bili-video-card__info--more",
  ".bili-feed-card__info--more",
  ".bili-card-more",
  ".bili-card__more",
  ".more",
  ".three-point",
  "[class*='more']",
  "[class*='dislike']",
  "[class*='feedback']",
  "[aria-label*='更多']",
  "[title*='更多']",
  "[aria-label*='不感兴趣']",
  "[title*='不感兴趣']"
];

const FEEDBACK_CLICKABLE_SELECTORS = [
  "button",
  "a",
  "[role='button']",
  "[tabindex]",
  ".bili-dropdown-item",
  ".v-popover-content-item",
  ".feed-card-dislike",
  ".bili-video-card__info--no-interest",
  "[class*='dislike']",
  "[class*='feedback']"
];

const CONTENT_DISLIKE_TEXTS = ["不感兴趣", "减少此类内容", "内容不感兴趣"];
const AUTHOR_DISLIKE_TEXTS = ["不想看此UP主", "不想看此 UP 主", "不看此UP", "不看此 UP", "不喜欢该UP主", "不喜欢该 UP 主"];

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

function getElementLabel(element: Element): string {
  return [
    element.textContent,
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("data-title")
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function isVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

function isDisplayed(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function matchesAnyText(element: Element, texts: string[]): boolean {
  const label = getElementLabel(element).toLowerCase();
  const compactLabel = label.replace(/\s+/g, "");
  return texts.some((text) => {
    const normalizedText = text.toLowerCase();
    return label.includes(normalizedText) || compactLabel.includes(normalizedText.replace(/\s+/g, ""));
  });
}

function findFeedbackButton(scope: ParentNode, texts: string[]): HTMLElement | null {
  for (const selector of FEEDBACK_CLICKABLE_SELECTORS) {
    for (const element of Array.from(scope.querySelectorAll<HTMLElement>(selector))) {
      if (matchesAnyText(element, texts) && isVisible(element)) {
        return element;
      }
    }
  }

  return null;
}

function clickElement(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
  element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  element.click();
}

async function waitForFeedbackMenu(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 120));
}

async function waitForBiliVideoCardFeedbackResult(card: HTMLElement, texts: string[]): Promise<boolean> {
  for (let index = 0; index < 4; index += 1) {
    await waitForFeedbackMenu();
    const result = card.querySelector<HTMLElement>(BILI_VIDEO_CARD_DISLIKE_RESULT_SELECTOR);
    const title = result?.querySelector<HTMLElement>(BILI_VIDEO_CARD_DISLIKE_RESULT_TITLE_SELECTOR);
    if (result && isDisplayed(result) && title && matchesAnyText(title, texts)) {
      return true;
    }
  }

  return false;
}

async function clickKnownBiliVideoCardDislikeAction(card: HTMLElement, texts: string[]): Promise<boolean> {
  const resultTitle = card.querySelector<HTMLElement>(
    `${BILI_VIDEO_CARD_DISLIKE_RESULT_SELECTOR} ${BILI_VIDEO_CARD_DISLIKE_RESULT_TITLE_SELECTOR}`
  );
  const trigger = card.querySelector<HTMLElement>(BILI_VIDEO_CARD_DISLIKE_TRIGGER_SELECTOR);

  if (!trigger || !resultTitle || !matchesAnyText(resultTitle, texts)) {
    return false;
  }

  clickElement(trigger);
  return waitForBiliVideoCardFeedbackResult(card, texts);
}

function revealFeedbackMenu(card: HTMLElement): boolean {
  card.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
  card.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));

  for (const selector of FEEDBACK_MENU_TRIGGER_SELECTORS) {
    const trigger = card.querySelector<HTMLElement>(selector);
    if (trigger && isVisible(trigger)) {
      clickElement(trigger);
      return true;
    }
  }

  return false;
}

export async function clickCardFeedbackAction(card: HTMLElement, texts: string[]): Promise<boolean> {
  if (await clickKnownBiliVideoCardDislikeAction(card, texts)) {
    return true;
  }

  const directButton = findFeedbackButton(card, texts);
  if (directButton) {
    clickElement(directButton);
    return true;
  }

  if (!revealFeedbackMenu(card)) {
    return false;
  }

  await waitForFeedbackMenu();

  const cardButton = findFeedbackButton(card, texts);
  if (cardButton) {
    clickElement(cardButton);
    return true;
  }

  const documentButton = findFeedbackButton(document, texts);
  if (documentButton) {
    clickElement(documentButton);
    return true;
  }

  return false;
}

function uniqueCardRoots(): HTMLElement[] {
  const unique = new Set<HTMLElement>();
  for (const selector of CARD_ROOT_SELECTORS) {
    document.querySelectorAll<HTMLElement>(selector).forEach((element) => unique.add(element));
  }
  return [...unique];
}

function extractCards(): FeedCardModel[] {
  return uniqueCardRoots().map((element) => {
    const title = firstText(element, TITLE_SELECTORS);
    const author = firstText(element, AUTHOR_SELECTORS);
    const category = firstText(element, CATEGORY_SELECTORS) || element.closest(".bili-grid-floor")?.querySelector(".bili-grid-floor-header__title")?.textContent?.trim() || "";
    const plainText = element.textContent || "";

    return {
      title,
      author,
      category,
      isAd: AD_SELECTORS.some((selector) => element.matches(selector) || Boolean(element.querySelector(selector))) || /广告|推广/.test(plainText),
      isLive: LIVE_SELECTORS.some((selector) => element.matches(selector) || Boolean(element.querySelector(selector))) || plainText.includes("正在直播"),
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

export class FeedGuard {
  private observer: MutationObserver | null = null;
  private throttleId: number | null = null;
  private currentScope: FeedPageScope | null = null;

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
    if (this.app.config.feed.autoDislikeContent) {
      const clicked = await clickCardFeedbackAction(card.element, CONTENT_DISLIKE_TEXTS);
      if (clicked) {
        this.app.log("已尝试反馈：不感兴趣");
      }
    }

    if (this.app.config.feed.autoDislikeAuthor) {
      const clicked = await clickCardFeedbackAction(card.element, AUTHOR_DISLIKE_TEXTS);
      if (clicked) {
        this.app.log("已尝试反馈：不想看此 UP 主");
      }
    }
  }
}
