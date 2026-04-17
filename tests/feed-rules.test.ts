import { DEFAULT_CONFIG } from "@/shared/config";
import type { FeedCardModel } from "@/shared/types";
import { shouldFilterCard, shouldIgnoreMutations } from "@/content/modules/feedGuard";

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
