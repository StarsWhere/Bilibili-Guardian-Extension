import type { HttpClient } from "./http";

const BILIBILI_VIEW_ENDPOINT = "https://api.bilibili.com/x/web-interface/view";
const BILIBILI_NAV_ENDPOINT = "https://api.bilibili.com/x/web-interface/nav";
const BILIBILI_PLAYER_V2_ENDPOINT = "https://api.bilibili.com/x/player/v2";
const BILIBILI_PLAYER_WBI_V2_ENDPOINT = "https://api.bilibili.com/x/player/wbi/v2";

const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32,
  15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19,
  29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63,
  57, 62, 11, 36, 20, 34, 44, 52
];

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export interface BilibiliVideoPage {
  cid: number;
  page?: number;
}

export interface BilibiliVideoInfo {
  aid: number;
  bvid: string;
  cid: number;
  title: string;
  pages: BilibiliVideoPage[];
}

export interface BilibiliSubtitleTrack {
  lan?: string;
  lan_doc?: string;
  subtitle_url?: string;
  type?: number;
  ai_type?: number;
  ai_status?: number;
}

export interface BilibiliSubtitleCue {
  from: number;
  to: number;
  content: string;
}

export interface BilibiliSubtitleJson {
  body?: Array<{
    from?: number;
    to?: number;
    content?: string;
  }>;
}

export interface SelectedSubtitleTrack {
  lan: string;
  lanDoc: string;
  type: number | null;
  aiType: number | null;
  aiStatus: number | null;
  subtitleUrl: string;
}

function readBilibiliMessage(data: { message?: string; msg?: string }): string {
  return data.message || data.msg || "Bilibili 接口请求失败";
}

function normalizeSubtitleUrl(url: string | undefined): string {
  if (!url) {
    return "";
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  if (url.startsWith("http://")) {
    return url.replace(/^http:/, "https:");
  }

  return url;
}

function isChineseSubtitle(track: BilibiliSubtitleTrack): boolean {
  const lan = `${track.lan ?? ""} ${track.lan_doc ?? ""}`.toLowerCase();
  return /zh|chi|中文|简体|繁体|汉语/.test(lan);
}

function subtitleTrackScore(track: BilibiliSubtitleTrack): number {
  let score = 0;
  if (isChineseSubtitle(track)) {
    score += 1000;
  }

  if (Number(track.type) === 1) {
    score += 100;
  }

  if (Number(track.ai_type) === 0) {
    score += 30;
  } else if (Number(track.ai_type) === 1) {
    score += 20;
  }

  if (Number(track.type) !== 1) {
    score += 10;
  }

  return score;
}

export function selectBestSubtitleTrack(tracks: BilibiliSubtitleTrack[]): SelectedSubtitleTrack | null {
  const candidates = tracks
    .filter((track) => normalizeSubtitleUrl(track.subtitle_url).length > 0)
    .sort((left, right) => subtitleTrackScore(right) - subtitleTrackScore(left));

  const selected = candidates[0];
  if (!selected) {
    return null;
  }

  return {
    lan: selected.lan ?? "",
    lanDoc: selected.lan_doc ?? "",
    type: typeof selected.type === "number" ? selected.type : null,
    aiType: typeof selected.ai_type === "number" ? selected.ai_type : null,
    aiStatus: typeof selected.ai_status === "number" ? selected.ai_status : null,
    subtitleUrl: normalizeSubtitleUrl(selected.subtitle_url)
  };
}

function getMixinKey(orig: string): string {
  return mixinKeyEncTab.map((index) => orig[index]).join("").slice(0, 32);
}

function md5cycle(x: number[], k: number[]): void {
  let a = x[0], b = x[1], c = x[2], d = x[3];
  a = ff(a, b, c, d, k[0], 7, -680876936);
  d = ff(d, a, b, c, k[1], 12, -389564586);
  c = ff(c, d, a, b, k[2], 17, 606105819);
  b = ff(b, c, d, a, k[3], 22, -1044525330);
  a = ff(a, b, c, d, k[4], 7, -176418897);
  d = ff(d, a, b, c, k[5], 12, 1200080426);
  c = ff(c, d, a, b, k[6], 17, -1473231341);
  b = ff(b, c, d, a, k[7], 22, -45705983);
  a = ff(a, b, c, d, k[8], 7, 1770035416);
  d = ff(d, a, b, c, k[9], 12, -1958414417);
  c = ff(c, d, a, b, k[10], 17, -42063);
  b = ff(b, c, d, a, k[11], 22, -1990404162);
  a = ff(a, b, c, d, k[12], 7, 1804603682);
  d = ff(d, a, b, c, k[13], 12, -40341101);
  c = ff(c, d, a, b, k[14], 17, -1502002290);
  b = ff(b, c, d, a, k[15], 22, 1236535329);
  a = gg(a, b, c, d, k[1], 5, -165796510);
  d = gg(d, a, b, c, k[6], 9, -1069501632);
  c = gg(c, d, a, b, k[11], 14, 643717713);
  b = gg(b, c, d, a, k[0], 20, -373897302);
  a = gg(a, b, c, d, k[5], 5, -701558691);
  d = gg(d, a, b, c, k[10], 9, 38016083);
  c = gg(c, d, a, b, k[15], 14, -660478335);
  b = gg(b, c, d, a, k[4], 20, -405537848);
  a = gg(a, b, c, d, k[9], 5, 568446438);
  d = gg(d, a, b, c, k[14], 9, -1019803690);
  c = gg(c, d, a, b, k[3], 14, -187363961);
  b = gg(b, c, d, a, k[8], 20, 1163531501);
  a = gg(a, b, c, d, k[13], 5, -1444681467);
  d = gg(d, a, b, c, k[2], 9, -51403784);
  c = gg(c, d, a, b, k[7], 14, 1735328473);
  b = gg(b, c, d, a, k[12], 20, -1926607734);
  a = hh(a, b, c, d, k[5], 4, -378558);
  d = hh(d, a, b, c, k[8], 11, -2022574463);
  c = hh(c, d, a, b, k[11], 16, 1839030562);
  b = hh(b, c, d, a, k[14], 23, -35309556);
  a = hh(a, b, c, d, k[1], 4, -1530992060);
  d = hh(d, a, b, c, k[4], 11, 1272893353);
  c = hh(c, d, a, b, k[7], 16, -155497632);
  b = hh(b, c, d, a, k[10], 23, -1094730640);
  a = hh(a, b, c, d, k[13], 4, 681279174);
  d = hh(d, a, b, c, k[0], 11, -358537222);
  c = hh(c, d, a, b, k[3], 16, -722521979);
  b = hh(b, c, d, a, k[6], 23, 76029189);
  a = hh(a, b, c, d, k[9], 4, -640364487);
  d = hh(d, a, b, c, k[12], 11, -421815835);
  c = hh(c, d, a, b, k[15], 16, 530742520);
  b = hh(b, c, d, a, k[2], 23, -995338651);
  a = ii(a, b, c, d, k[0], 6, -198630844);
  d = ii(d, a, b, c, k[7], 10, 1126891415);
  c = ii(c, d, a, b, k[14], 15, -1416354905);
  b = ii(b, c, d, a, k[5], 21, -57434055);
  a = ii(a, b, c, d, k[12], 6, 1700485571);
  d = ii(d, a, b, c, k[3], 10, -1894986606);
  c = ii(c, d, a, b, k[10], 15, -1051523);
  b = ii(b, c, d, a, k[1], 21, -2054922799);
  a = ii(a, b, c, d, k[8], 6, 1873313359);
  d = ii(d, a, b, c, k[15], 10, -30611744);
  c = ii(c, d, a, b, k[6], 15, -1560198380);
  b = ii(b, c, d, a, k[13], 21, 1309151649);
  a = ii(a, b, c, d, k[4], 6, -145523070);
  d = ii(d, a, b, c, k[11], 10, -1120210379);
  c = ii(c, d, a, b, k[2], 15, 718787259);
  b = ii(b, c, d, a, k[9], 21, -343485551);
  x[0] = add32(a, x[0]);
  x[1] = add32(b, x[1]);
  x[2] = add32(c, x[2]);
  x[3] = add32(d, x[3]);
}

function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
  a = add32(add32(a, q), add32(x, t));
  return add32((a << s) | (a >>> (32 - s)), b);
}

function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn((b & c) | ((~b) & d), a, b, x, s, t);
}

function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn((b & d) | (c & (~d)), a, b, x, s, t);
}

function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn(b ^ c ^ d, a, b, x, s, t);
}

function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn(c ^ (b | (~d)), a, b, x, s, t);
}

function md51(input: string): number[] {
  let state = [1732584193, -271733879, -1732584194, 271733878];
  let index: number;

  for (index = 64; index <= input.length; index += 64) {
    md5cycle(state, md5blk(input.substring(index - 64, index)));
  }

  const remain = input.substring(index - 64);
  const tail = new Array<number>(16).fill(0);
  for (index = 0; index < remain.length; index += 1) {
    tail[index >> 2] |= remain.charCodeAt(index) << ((index % 4) << 3);
  }
  tail[index >> 2] |= 0x80 << ((index % 4) << 3);

  if (index > 55) {
    md5cycle(state, tail);
    tail.fill(0);
  }

  tail[14] = input.length * 8;
  md5cycle(state, tail);
  return state;
}

function md5blk(input: string): number[] {
  const blocks: number[] = [];
  for (let index = 0; index < 64; index += 4) {
    blocks[index >> 2] =
      input.charCodeAt(index) +
      (input.charCodeAt(index + 1) << 8) +
      (input.charCodeAt(index + 2) << 16) +
      (input.charCodeAt(index + 3) << 24);
  }
  return blocks;
}

const hexChr = "0123456789abcdef".split("");

function rhex(input: number): string {
  let output = "";
  for (let index = 0; index < 4; index += 1) {
    output += hexChr[(input >> (index * 8 + 4)) & 0x0F] + hexChr[(input >> (index * 8)) & 0x0F];
  }
  return output;
}

function md5(input: string): string {
  return md51(input).map(rhex).join("");
}

function add32(left: number, right: number): number {
  return (left + right) & 0xFFFFFFFF;
}

function encodeWbi(params: Record<string, string | number>, imgKey: string, subKey: string): string {
  const mixinKey = getMixinKey(imgKey + subKey);
  const fullParams: Record<string, string | number> = {
    ...params,
    wts: Math.round(Date.now() / 1000)
  };
  const charFilter = /[!'()*]/g;
  const query = Object.keys(fullParams)
    .sort()
    .map((key) => {
      const value = String(fullParams[key]).replace(charFilter, "");
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join("&");

  return `${query}&w_rid=${md5(query + mixinKey)}`;
}

async function buildWbiPlayerUrl(client: HttpClient, params: Record<string, string | number>): Promise<string> {
  const response = await client.requestJson<{
    code: number;
    data?: {
      wbi_img?: {
        img_url?: string;
        sub_url?: string;
      };
    };
    message?: string;
  }>(`${BILIBILI_NAV_ENDPOINT}?_=${Date.now()}`, { credentials: "include" });

  if (!response.ok || response.data.code !== 0) {
    throw new Error(readBilibiliMessage(response.data));
  }

  const imgUrl = response.data.data?.wbi_img?.img_url ?? "";
  const subUrl = response.data.data?.wbi_img?.sub_url ?? "";
  if (!imgUrl || !subUrl) {
    throw new Error("nav 接口没有返回 wbi_img");
  }

  const imgKey = imgUrl.substring(imgUrl.lastIndexOf("/") + 1, imgUrl.lastIndexOf("."));
  const subKey = subUrl.substring(subUrl.lastIndexOf("/") + 1, subUrl.lastIndexOf("."));
  return `${BILIBILI_PLAYER_WBI_V2_ENDPOINT}?${encodeWbi(params, imgKey, subKey)}`;
}

export async function fetchCidByBvid(client: HttpClient, bvid: string): Promise<number> {
  const response = await client.requestJson<{
    code: number;
    data?: {
      cid?: number;
    };
    message?: string;
  }>(`${BILIBILI_VIEW_ENDPOINT}?bvid=${encodeURIComponent(bvid)}`, { credentials: "include" });

  if (!response.ok || response.data.code !== 0 || !response.data.data?.cid) {
    throw new Error(response.data.message || "获取视频 CID 失败");
  }

  return response.data.data.cid;
}

export async function fetchDanmakuXml(client: HttpClient, cid: number): Promise<string> {
  const response = await client.requestText(`https://comment.bilibili.com/${cid}.xml`);
  if (!response.ok) {
    throw new Error("获取弹幕数据失败");
  }

  return response.data;
}

export async function fetchVideoInfoByBvid(client: HttpClient, bvid: string): Promise<BilibiliVideoInfo> {
  const response = await client.requestJson<{
    code: number;
    data?: {
      aid?: number;
      bvid?: string;
      cid?: number;
      title?: string;
      pages?: BilibiliVideoPage[];
    };
    message?: string;
  }>(`${BILIBILI_VIEW_ENDPOINT}?bvid=${encodeURIComponent(bvid)}&_=${Date.now()}`, { credentials: "include" });

  if (!response.ok || response.data.code !== 0 || !response.data.data?.aid || !response.data.data.cid) {
    throw new Error(readBilibiliMessage(response.data));
  }

  return {
    aid: response.data.data.aid,
    bvid: response.data.data.bvid ?? bvid,
    cid: response.data.data.cid,
    title: response.data.data.title ?? "",
    pages: response.data.data.pages ?? []
  };
}

async function fetchSubtitleTracksByUrl(client: HttpClient, url: string): Promise<BilibiliSubtitleTrack[]> {
  const response = await client.requestJson<{
    code: number;
    data?: {
      subtitle?: {
        subtitles?: BilibiliSubtitleTrack[];
      };
    };
    message?: string;
  }>(url, { credentials: "include" });

  if (!response.ok || response.data.code !== 0) {
    throw new Error(readBilibiliMessage(response.data));
  }

  return response.data.data?.subtitle?.subtitles ?? [];
}

export async function fetchSubtitleTracks(
  client: HttpClient,
  input: { aid: number; bvid: string; cid: number }
): Promise<BilibiliSubtitleTrack[]> {
  const requests: string[] = [];

  try {
    requests.push(await buildWbiPlayerUrl(client, { bvid: input.bvid, cid: input.cid, _: Date.now() }));
  } catch {
    // WBI is preferred, but the unsigned endpoints still work for many videos.
  }

  requests.push(`${BILIBILI_PLAYER_V2_ENDPOINT}?bvid=${encodeURIComponent(input.bvid)}&cid=${encodeURIComponent(input.cid)}&_=${Date.now()}`);
  requests.push(`${BILIBILI_PLAYER_V2_ENDPOINT}?aid=${encodeURIComponent(input.aid)}&cid=${encodeURIComponent(input.cid)}&_=${Date.now() + 1}`);

  let lastError: unknown = null;
  for (const url of requests) {
    try {
      const tracks = await fetchSubtitleTracksByUrl(client, url);
      if (tracks.length > 0) {
        return tracks;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

export async function fetchSubtitleJson(client: HttpClient, subtitleUrl: string): Promise<BilibiliSubtitleCue[]> {
  const response = await client.requestJson<BilibiliSubtitleJson>(normalizeSubtitleUrl(subtitleUrl), {
    credentials: "include",
    headers: {
      Referer: "https://www.bilibili.com/"
    }
  });

  if (!response.ok) {
    throw new Error("获取字幕 JSON 失败");
  }

  return (response.data.body ?? [])
    .map((cue) => ({
      from: Number(cue.from ?? 0),
      to: Number(cue.to ?? 0),
      content: String(cue.content ?? "").trim()
    }))
    .filter((cue) => Number.isFinite(cue.from) && Number.isFinite(cue.to) && cue.to > cue.from && cue.content);
}

export interface ParsedDanmakuEntry {
  time: number;
  text: string;
}

export function parseDanmakuXml(xml: string): ParsedDanmakuEntry[] {
  const entries: ParsedDanmakuEntry[] = [];
  const regex = /<d p="([^"]+)">([\s\S]*?)<\/d>/g;
  let matched: RegExpExecArray | null;

  while ((matched = regex.exec(xml)) !== null) {
    const attrs = matched[1].split(",");
    const time = Number(attrs[0] ?? 0);
    const rawText = decodeXmlEntities(matched[2] ?? "").trim();

    if (!Number.isNaN(time) && rawText) {
      entries.push({ time, text: rawText });
    }
  }

  return entries;
}
