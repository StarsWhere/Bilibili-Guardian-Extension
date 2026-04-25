import { submitFeedFeedbackWithClient } from "@/core/feedFeedback";
import type { HttpClient } from "@/core/http";
import type { FeedFeedbackPayload } from "@/shared/types";

function createPayload(overrides: Partial<FeedFeedbackPayload> = {}): FeedFeedbackPayload {
  return {
    action: "content",
    title: "测试标题",
    author: "测试 UP",
    bvid: "BV1test",
    id: 123,
    mid: 456,
    goto: "av",
    trackId: "track-test",
    spmid: "333.1007.0.0",
    fromSpmid: "",
    ...overrides
  };
}

describe("submitFeedFeedbackWithClient", () => {
  it("submits PC dislike feedback with the expected form fields", async () => {
    const requestJson = vi.fn(async () => ({
      ok: true,
      status: 200,
      data: {
        code: 0,
        message: "0"
      }
    }));
    const client = {
      requestText: vi.fn(),
      requestJson
    } as unknown as HttpClient;

    await expect(submitFeedFeedbackWithClient(client, createPayload({ action: "author" }))).resolves.toEqual({
      ok: true,
      message: "0"
    });

    const body = new URLSearchParams(String(requestJson.mock.calls[0]?.[1]?.body));
    expect(requestJson.mock.calls[0]?.[0]).toBe("https://api.bilibili.com/x/web-interface/feedback/dislike");
    expect(requestJson.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include"
    });
    expect(body.get("reason_id")).toBe("4");
    expect(body.get("id")).toBe("123");
    expect(body.get("mid")).toBe("456");
    expect(body.get("track_id")).toBe("track-test");
  });

  it("resolves aid from bvid when the card did not expose aid", async () => {
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          code: 0,
          data: {
            aid: 789,
            owner: {
              mid: 654
            }
          }
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          code: 0,
          message: "0"
        }
      });
    const client = {
      requestText: vi.fn(),
      requestJson
    } as unknown as HttpClient;

    await submitFeedFeedbackWithClient(client, createPayload({ id: null, mid: null }));

    const body = new URLSearchParams(String(requestJson.mock.calls[1]?.[1]?.body));
    expect(String(requestJson.mock.calls[0]?.[0])).toContain("/x/web-interface/view?bvid=BV1test");
    expect(body.get("id")).toBe("789");
    expect(body.get("mid")).toBe("654");
  });

  it("throws API messages so FeedGuard can log failed submissions", async () => {
    const client = {
      requestText: vi.fn(),
      requestJson: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          code: -101,
          message: "账号未登录"
        }
      })
    } as unknown as HttpClient;

    await expect(submitFeedFeedbackWithClient(client, createPayload())).rejects.toThrow("账号未登录");
  });
});
