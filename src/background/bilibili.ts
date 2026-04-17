function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function fetchCidByBvid(bvid: string): Promise<number> {
  const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`);
  const data = (await response.json()) as {
    code: number;
    data?: {
      cid?: number;
    };
    message?: string;
  };

  if (data.code !== 0 || !data.data?.cid) {
    throw new Error(data.message || "获取视频 CID 失败");
  }

  return data.data.cid;
}

export async function fetchDanmakuXml(cid: number): Promise<string> {
  const response = await fetch(`https://comment.bilibili.com/${cid}.xml`);
  if (!response.ok) {
    throw new Error("获取弹幕数据失败");
  }

  return response.text();
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
