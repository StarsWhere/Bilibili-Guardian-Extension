import { DEFAULT_CONFIG } from "@/shared/config";
import type { FeedCardModel } from "@/shared/types";
import { buildFeedbackTarget, shouldFilterCard, shouldIgnoreMutations } from "@/content/modules/feedGuard";

function createCard(overrides: Partial<FeedCardModel>): FeedCardModel {
  return {
    title: "",
    author: "",
    category: "",
    isAd: false,
    isLive: false,
    feedback: null,
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

describe("buildFeedbackTarget", () => {
  it("extracts bvid and up mid from Bilibili homepage cards", () => {
    const card = document.createElement("div");
    card.innerHTML = `
      <a class="bili-video-card__image--link" href="https://www.bilibili.com/video/BV1NzXoBBEdg" data-spmid="333.1007" data-mod="tianma.3-2-8"></a>
      <a class="bili-video-card__info--owner" href="//space.bilibili.com/434043230">
        <span class="bili-video-card__info--author">朱朱董事长</span>
      </a>
    `;

    expect(buildFeedbackTarget(card, "测试标题", "朱朱董事长")).toMatchObject({
      bvid: "BV1NzXoBBEdg",
      id: null,
      mid: 434043230,
      goto: "av",
      spmid: "333.1007"
    });
  });
});
