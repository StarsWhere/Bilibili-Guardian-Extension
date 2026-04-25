import { DEFAULT_CONFIG } from "@/shared/config";
import type { FeedCardModel } from "@/shared/types";
import { FeedGuard, buildFeedbackTarget, shouldFilterCard, shouldIgnoreMutations } from "@/content/modules/feedGuard";

function createCard(overrides: Partial<FeedCardModel>): FeedCardModel {
  return {
    title: "",
    author: "",
    category: "",
    isAd: false,
    isLive: false,
    feedback: null,
    feedbackUnsupportedReason: null,
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

  it("extracts bvid from data-target-url and b23 short links", () => {
    const dataTargetCard = document.createElement("div");
    dataTargetCard.innerHTML = `
      <a href="//cm.bilibili.com/cm/api/fees/pc/sync/v2" data-target-url="https://www.bilibili.com/video/BV1EhQPBuEYF?track_id=test"></a>
    `;

    const shortLinkCard = document.createElement("div");
    shortLinkCard.innerHTML = `
      <a href="https://b23.tv/BV1Xe91YREVN"></a>
    `;

    expect(buildFeedbackTarget(dataTargetCard, "推广卡", "")?.bvid).toBe("BV1EhQPBuEYF");
    expect(buildFeedbackTarget(shortLinkCard, "短链卡", "")?.bvid).toBe("BV1Xe91YREVN");
  });
});

describe("FeedGuard feedback submission", () => {
  it("deduplicates feedback for the same card across repeated scans", () => {
    document.body.innerHTML = `
      <div class="bili-video-card">
        <a class="bili-video-card__image--link" href="https://www.bilibili.com/video/BV1Duplicate" data-spmid="333.1007"></a>
        <h3 class="bili-video-card__info--tit">重复标题</h3>
        <a class="bili-video-card__info--owner" href="//space.bilibili.com/123">
          <span class="bili-video-card__info--author">重复 UP</span>
        </a>
      </div>
    `;

    const submitFeedFeedback = vi.fn().mockResolvedValue({ ok: true, message: "OK" });
    const guard = new FeedGuard({
      config: {
        ...DEFAULT_CONFIG,
        feed: {
          ...DEFAULT_CONFIG.feed,
          keywordBlacklist: ["重复标题"],
          autoDislikeContent: true
        }
      },
      notifyFeedScan: vi.fn(),
      log: vi.fn(),
      sendFeedScanMetric: vi.fn().mockResolvedValue(undefined),
      submitFeedFeedback
    });

    void guard.mount(new URL("https://www.bilibili.com/"));
    guard.runScan();

    expect(submitFeedFeedback).toHaveBeenCalledTimes(1);
  });

  it("does not submit feedback for live cards", () => {
    document.body.innerHTML = `
      <div class="bili-video-card">
        <span class="live-tag">直播</span>
        <h3 class="bili-video-card__info--tit">直播中寝室姐妹 第一次直播</h3>
      </div>
    `;

    const submitFeedFeedback = vi.fn().mockResolvedValue({ ok: true, message: "OK" });
    const log = vi.fn();
    const guard = new FeedGuard({
      config: {
        ...DEFAULT_CONFIG,
        feed: {
          ...DEFAULT_CONFIG.feed,
          keywordBlacklist: ["直播中"],
          autoDislikeContent: true
        }
      },
      notifyFeedScan: vi.fn(),
      log,
      sendFeedScanMetric: vi.fn().mockResolvedValue(undefined),
      submitFeedFeedback
    });

    void guard.mount(new URL("https://www.bilibili.com/"));

    expect(submitFeedFeedback).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("首页反馈跳过"));
  });

  it("does not submit feedback for partition live cards", () => {
    document.body.innerHTML = `
      <div class="floor-card-inner">
        <a href="//live.bilibili.com/2911989?hotRank=0&live_from=81003" data-spmid="333.1007">
          <div class="badge">
            <svg id="channel-icon-live"></svg>
            <span class="floor-title">直播</span>
          </div>
        </a>
        <p title="【全身冻补】可爱坏坏好兄弟" class="title">
          <a href="//live.bilibili.com/2911989?hotRank=0&live_from=81003">
            <div class="living"><span>直播中</span></div>
            <span>【全身冻补】可爱坏坏好兄弟</span>
          </a>
        </p>
      </div>
    `;

    const submitFeedFeedback = vi.fn().mockResolvedValue({ ok: true, message: "OK" });
    const log = vi.fn();
    const guard = new FeedGuard({
      config: {
        ...DEFAULT_CONFIG,
        feed: {
          ...DEFAULT_CONFIG.feed,
          keywordBlacklist: ["全身冻补"],
          autoDislikeContent: true
        }
      },
      notifyFeedScan: vi.fn(),
      log,
      sendFeedScanMetric: vi.fn().mockResolvedValue(undefined),
      submitFeedFeedback
    });

    void guard.mount(new URL("https://www.bilibili.com/"));

    expect(submitFeedFeedback).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("首页反馈跳过"));
  });

  it("silently skips feedback for non-video cards", () => {
    document.body.innerHTML = `
      <div class="floor-card-inner">
        <a href="//manga.bilibili.com/detail/mc123">
          <span class="title">被吃掉的到底是鸭子，还是我？</span>
        </a>
      </div>
    `;

    const submitFeedFeedback = vi.fn().mockResolvedValue({ ok: true, message: "OK" });
    const log = vi.fn();
    const guard = new FeedGuard({
      config: {
        ...DEFAULT_CONFIG,
        feed: {
          ...DEFAULT_CONFIG.feed,
          keywordBlacklist: ["鸭子"],
          autoDislikeContent: true
        }
      },
      notifyFeedScan: vi.fn(),
      log,
      sendFeedScanMetric: vi.fn().mockResolvedValue(undefined),
      submitFeedFeedback
    });

    void guard.mount(new URL("https://www.bilibili.com/"));

    expect(submitFeedFeedback).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("首页反馈跳过"));
  });
});
