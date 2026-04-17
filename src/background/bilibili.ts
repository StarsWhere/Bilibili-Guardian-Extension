import {
  fetchCidByBvid as fetchCidByBvidWithClient,
  fetchDanmakuXml as fetchDanmakuXmlWithClient,
  parseDanmakuXml
} from "@/core/bilibili";
import { createFetchHttpClient } from "@/core/http";

export async function fetchCidByBvid(bvid: string): Promise<number> {
  return fetchCidByBvidWithClient(createFetchHttpClient(), bvid);
}

export async function fetchDanmakuXml(cid: number): Promise<string> {
  return fetchDanmakuXmlWithClient(createFetchHttpClient(), cid);
}
