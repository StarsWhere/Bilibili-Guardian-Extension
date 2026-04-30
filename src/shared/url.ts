import type { FeedPageScope } from "./types";

export function isVideoPage(url: URL): boolean {
  return url.hostname === "www.bilibili.com" && url.pathname.startsWith("/video/");
}

export function classifyFeedPage(url: URL): FeedPageScope | null {
  if (url.hostname !== "www.bilibili.com" || isVideoPage(url)) {
    return null;
  }

  if (url.pathname === "/" || url.pathname === "") {
    return "home";
  }

  if (url.pathname.startsWith("/search")) {
    return "search";
  }

  if (url.pathname.startsWith("/v/popular/rank")) {
    return "ranking";
  }

  if (url.pathname.startsWith("/v/popular")) {
    return "popular";
  }

  return "channel";
}

export function extractBvid(url: URL): string | null {
  const matched = url.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/);
  return matched?.[1] ?? null;
}

export function extractPageIndex(url: URL): number {
  const pageIndex = Number(url.searchParams.get("p") || "1");
  return Number.isFinite(pageIndex) && pageIndex > 0 ? Math.floor(pageIndex) : 1;
}
