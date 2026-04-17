import { classifyFeedPage, extractBvid, isVideoPage } from "@/shared/url";

describe("url helpers", () => {
  it("classifies feed pages", () => {
    expect(classifyFeedPage(new URL("https://www.bilibili.com/"))).toBe("home");
    expect(classifyFeedPage(new URL("https://www.bilibili.com/search?keyword=test"))).toBe("search");
    expect(classifyFeedPage(new URL("https://www.bilibili.com/v/popular/"))).toBe("popular");
    expect(classifyFeedPage(new URL("https://www.bilibili.com/v/popular/rank/all"))).toBe("ranking");
  });

  it("detects video pages and BV ids", () => {
    const url = new URL("https://www.bilibili.com/video/BV1xx411c7mD");
    expect(isVideoPage(url)).toBe(true);
    expect(extractBvid(url)).toBe("BV1xx411c7mD");
  });
});
