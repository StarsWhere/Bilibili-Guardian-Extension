import type { FeedFeedbackPayload, FeedFeedbackResult } from "@/shared/types";
import type { HttpClient } from "./http";

const FEEDBACK_ENDPOINT = "https://api.bilibili.com/x/web-interface/feedback/dislike";
const VIDEO_VIEW_ENDPOINT = "https://api.bilibili.com/x/web-interface/view";
const FEEDBACK_REASON_ID: Record<FeedFeedbackPayload["action"], number> = {
  content: 1,
  author: 4
};

interface BilibiliApiResponse<T = unknown> {
  code: number;
  message?: string;
  data?: T;
}

interface VideoViewData {
  aid?: number;
  owner?: {
    mid?: number;
  };
}

function readBilibiliMessage(response: BilibiliApiResponse): string {
  return response.message || (response.code === 0 ? "0" : `Bilibili API 返回 code=${response.code}`);
}

async function resolveVideoTarget(
  client: HttpClient,
  payload: FeedFeedbackPayload
): Promise<{ id: number; mid: number }> {
  if (payload.id && payload.id > 0) {
    return {
      id: payload.id,
      mid: payload.mid && payload.mid > 0 ? payload.mid : 0
    };
  }

  if (!payload.bvid) {
    throw new Error("缺少视频 aid 或 bvid，无法提交首页反馈");
  }

  const viewUrl = `${VIDEO_VIEW_ENDPOINT}?bvid=${encodeURIComponent(payload.bvid)}`;
  const response = await client.requestJson<BilibiliApiResponse<VideoViewData>>(viewUrl, {
    credentials: "include"
  });

  if (!response.ok || response.data.code !== 0 || !response.data.data?.aid) {
    throw new Error(`获取视频 aid 失败：${readBilibiliMessage(response.data)}`);
  }

  return {
    id: response.data.data.aid,
    mid: payload.mid && payload.mid > 0 ? payload.mid : response.data.data.owner?.mid ?? 0
  };
}

export async function submitFeedFeedbackWithClient(
  client: HttpClient,
  payload: FeedFeedbackPayload
): Promise<FeedFeedbackResult> {
  const target = await resolveVideoTarget(client, payload);
  const form = new URLSearchParams({
    app_id: "100",
    platform: "5",
    from_spmid: payload.fromSpmid,
    spmid: payload.spmid || "333.1007.0.0",
    goto: payload.goto || "av",
    id: String(target.id),
    mid: String(target.mid),
    track_id: payload.trackId,
    feedback_page: "1",
    reason_id: String(FEEDBACK_REASON_ID[payload.action])
  });

  const response = await client.requestJson<BilibiliApiResponse>(FEEDBACK_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString(),
    credentials: "include"
  });

  if (!response.ok || response.data.code !== 0) {
    throw new Error(`首页反馈提交失败：${readBilibiliMessage(response.data)}（HTTP ${response.status}）`);
  }

  return {
    ok: true,
    message: readBilibiliMessage(response.data)
  };
}
