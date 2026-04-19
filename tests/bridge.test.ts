import { getVideoAnalysisErrorDetails } from "@/shared/errors";
import { sendMessage } from "@/content/bridge";

describe("sendMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rethrows structured background errors with diagnostic details", async () => {
    const send = vi.fn().mockResolvedValue({
      ok: false,
      error: "AI 返回内容不是有效的 JSON",
      details: {
        requestId: "BV1test-123",
        provider: "openai",
        model: "gpt-4.1-mini",
        stage: "response_parse",
        code: "invalid_json",
        parserMessage: "Unexpected token } in JSON at position 42",
        responsePreview: "{\"probability\":80,}",
        responseSource: "choices[0].message.content",
        responseLength: 19,
        suggestion: "确认模型输出没有尾随逗号。",
        responseEnvelopePreview: "{\"choices\":[{\"finish_reason\":\"stop\"}]}",
        exchangeTranscript: "[openai.chat.completions] https://example.com/v1/chat/completions\nRequest Body:\n{}\nResponse Body:\n{}"
      }
    });

    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: send
      }
    });

    await expect(sendMessage("ANALYZE_VIDEO", {
      bvid: "BV1test",
      topComment: "首条评论：测试",
      requestId: "BV1test-123"
    })).rejects.toMatchObject({
      message: "AI 返回内容不是有效的 JSON"
    });

    const error = await sendMessage("ANALYZE_VIDEO", {
      bvid: "BV1test",
      topComment: "首条评论：测试",
      requestId: "BV1test-123"
    }).catch((caught) => caught);

    expect(getVideoAnalysisErrorDetails(error)?.code).toBe("invalid_json");
    expect(send).toHaveBeenCalledTimes(2);
  });
});
