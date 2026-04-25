import { DEFAULT_CONFIG } from "@/shared/config";
import type { FeedCardModel } from "@/shared/types";
import { clickCardFeedbackAction, shouldFilterCard, shouldIgnoreMutations } from "@/content/modules/feedGuard";

function createCard(overrides: Partial<FeedCardModel>): FeedCardModel {
  return {
    title: "",
    author: "",
    category: "",
    isAd: false,
    isLive: false,
    element: document.createElement("div"),
    ...overrides
  };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("shouldFilterCard", () => {
  it("filters ads when enabled", () => {
    expect(shouldFilterCard(createCard({ isAd: true }), DEFAULT_CONFIG)).toBe(true);
  });

  it("filters category blacklist", () => {
    const config = {
      ...DEFAULT_CONFIG,
      feed: {
        ...DEFAULT_CONFIG.feed,
        categoryBlacklist: ["番剧"]
      }
    };

    expect(shouldFilterCard(createCard({ category: "番剧" }), config)).toBe(true);
  });

  it("filters keyword blacklist against title and author", () => {
    const config = {
      ...DEFAULT_CONFIG,
      feed: {
        ...DEFAULT_CONFIG.feed,
        keywordBlacklist: ["测试关键词"]
      }
    };

    expect(shouldFilterCard(createCard({ title: "这是测试关键词视频" }), config)).toBe(true);
    expect(shouldFilterCard(createCard({ author: "测试关键词UP" }), config)).toBe(true);
  });
});

describe("shouldIgnoreMutations", () => {
  it("ignores mutations produced by the extension itself", () => {
    const guardianRoot = document.createElement("div");
    guardianRoot.id = "guardian-root";
    const panel = document.createElement("div");
    guardianRoot.appendChild(panel);

    expect(
      shouldIgnoreMutations([
        {
          target: guardianRoot,
          addedNodes: [panel] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList
        }
      ])
    ).toBe(true);
  });

  it("keeps scanning for actual page mutations", () => {
    const pageNode = document.createElement("div");
    const card = document.createElement("div");

    expect(
      shouldIgnoreMutations([
        {
          target: pageNode,
          addedNodes: [card] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList
        }
      ])
    ).toBe(false);
  });
});

describe("clickCardFeedbackAction", () => {
  it("clicks a direct feedback button inside a card", async () => {
    const card = document.createElement("div");
    const button = document.createElement("button");
    const clicked = vi.fn();
    button.textContent = "不感兴趣";
    button.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect;
    button.addEventListener("click", clicked);
    card.appendChild(button);
    document.body.appendChild(card);

    await expect(clickCardFeedbackAction(card, ["不感兴趣"])).resolves.toBe(true);
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("opens the card menu before clicking an overlay feedback button", async () => {
    vi.useFakeTimers();

    const card = document.createElement("div");
    const trigger = document.createElement("button");
    const menuItem = document.createElement("button");
    const clicked = vi.fn();

    trigger.title = "更多";
    trigger.className = "more";
    trigger.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect;
    trigger.addEventListener("click", () => {
      document.body.appendChild(menuItem);
    });

    menuItem.textContent = "不想看此 UP 主";
    menuItem.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect;
    menuItem.addEventListener("click", clicked);

    card.appendChild(trigger);
    document.body.appendChild(card);

    const promise = clickCardFeedbackAction(card, ["不想看此 UP 主"]);
    await vi.advanceTimersByTimeAsync(120);

    await expect(promise).resolves.toBe(true);
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("clicks the hidden Bilibili homepage no-interest trigger when its result title matches", async () => {
    vi.useFakeTimers();

    const card = document.createElement("div");
    const result = document.createElement("div");
    const resultTitle = document.createElement("span");
    const trigger = document.createElement("div");
    const clicked = vi.fn();

    result.className = "bili-video-card__no-interest";
    result.style.display = "none";
    resultTitle.className = "no-interest-title";
    resultTitle.textContent = "不想看此UP主";
    result.appendChild(resultTitle);

    trigger.className = "bili-video-card__info--no-interest";
    trigger.style.display = "none";
    trigger.addEventListener("click", () => {
      clicked();
      result.style.display = "block";
    });

    card.append(result, trigger);
    document.body.appendChild(card);

    const promise = clickCardFeedbackAction(card, ["不想看此 UP 主"]);
    await vi.advanceTimersByTimeAsync(120);

    await expect(promise).resolves.toBe(true);
    expect(clicked).toHaveBeenCalledTimes(1);
  });
});
