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

function removeCards(cards: FeedCardModel[]): number {
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
    window.setTimeout(() => target.remove(), 170);
    removed += 1;
  });
  return removed;
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
      this.observer = new MutationObserver(() => {
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
    const removedCount = removeCards(matched);
    this.app.notifyFeedScan({ removedCount, scope: this.currentScope });

    if (removedCount > 0) {
      void this.app.sendFeedScanMetric(removedCount);
      this.app.log(`FeedGuard 移除了 ${removedCount} 个卡片`);
    }
  }
}
