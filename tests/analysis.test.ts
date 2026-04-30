import { DEFAULT_CONFIG } from "@/shared/config";
import { getVideoAnalysisErrorDetails } from "@/shared/errors";
import { selectBestSubtitleTrack } from "@/core/bilibili";
import { createVideoAnalysisService, extractOpenAiCompatibleResponse, parseAiResponse, parseSubtitleAiResponse } from "@/core/analysis";
import type { HttpClient } from "@/core/http";

const context = {
  provider: "openai" as const,
  model: "gpt-4.1-mini",
  requestId: "BV1test-123"
};

describe("parseAiResponse", () => {
  it("extracts text from content part arrays in OpenAI-compatible responses", () => {
    expect(
      extractOpenAiCompatibleResponse({
        choices: [
          {
            message: {
              content: [
                { type: "text", text: "{\"probability\": 72," },
                { type: "text", text: "\"start\": \"00:30\", \"end\": \"01:20\", \"note\": \"有口播\"}" }
              ]
            }
          }
        ]
      })
    ).toMatchObject({
      text: "{\"probability\": 72,\n\"start\": \"00:30\", \"end\": \"01:20\", \"note\": \"有口播\"}",
      source: "chat.choices[0].message.content[]"
    });
  });

  it("extracts text from response-style output payloads", () => {
    expect(
      extractOpenAiCompatibleResponse({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: "{\"probability\": 55, \"start\": null, \"end\": null, \"note\": \"疑似广告\"}"
              }
            ]
          }
        ]
      })
    ).toMatchObject({
      text: "{\"probability\": 55, \"start\": null, \"end\": null, \"note\": \"疑似广告\"}",
      source: "responses.output[*].content"
    });
  });

  it("extracts text from top-level responses.output_text", () => {
    expect(
      extractOpenAiCompatibleResponse({
        object: "response",
        output_text: "{\"probability\": 61, \"start\": null, \"end\": null, \"note\": \"结构化输出\"}"
      })
    ).toMatchObject({
      text: "{\"probability\": 61, \"start\": null, \"end\": null, \"note\": \"结构化输出\"}",
      source: "responses.output_text"
    });
  });

  it("parses plain JSON", () => {
    expect(
      parseAiResponse('{"probability": 82, "start": "00:30", "end": "01:12", "note": "命中广告"}', context)
    ).toEqual({
      probability: 82,
      start: "00:30",
      end: "01:12",
      note: "命中广告"
    });
  });

  it("parses JSON wrapped in a markdown code fence", () => {
    expect(
      parseAiResponse('```json\n{"probability": "68", "start": null, "end": null, "note": "需要观察"}\n```', context)
    ).toEqual({
      probability: 68,
      start: null,
      end: null,
      note: "需要观察"
    });
  });

  it("parses JSON embedded in surrounding text", () => {
    expect(
      parseAiResponse('下面是结论：\n{"probability": 45, "start": "00:10", "end": "00:45", "note": "中间有口播"}\n请参考。', context)
    ).toEqual({
      probability: 45,
      start: "00:10",
      end: "00:45",
      note: "中间有口播"
    });
  });

  it("reports an empty response with diagnostic details", () => {
    expect.assertions(4);

    try {
      parseAiResponse("   ", context);
    } catch (error) {
      const details = getVideoAnalysisErrorDetails(error);
      expect(error).toBeInstanceOf(Error);
      expect(details?.code).toBe("empty_response");
      expect(details?.responsePreview).toBe("(空响应)");
      expect(details?.responseSource).toBe("response_text");
    }
  });

  it("reports when no JSON object can be found", () => {
    expect.assertions(3);

    try {
      parseAiResponse("这段视频大概率没有广告，我就不返回 JSON 了。", context);
    } catch (error) {
      const details = getVideoAnalysisErrorDetails(error);
      expect((error as Error).message).toContain("没有找到可解析的 JSON");
      expect(details?.code).toBe("no_json_found");
      expect(details?.suggestion).toContain("提示词");
    }
  });

  it("reports JSON syntax errors with a response preview", () => {
    expect.assertions(3);

    try {
      parseAiResponse('{"probability": 80, "start": "00:10", "end": "00:40", "note": "广告",}', context);
    } catch (error) {
      const details = getVideoAnalysisErrorDetails(error);
      expect((error as Error).message).toContain("不是有效的 JSON");
      expect(details?.code).toBe("invalid_json");
      expect(details?.responsePreview).toContain('"probability": 80');
    }
  });

  it("reports invalid result shapes", () => {
    expect.assertions(3);

    try {
      parseAiResponse('{"probability": "high", "start": 10, "end": null, "note": 1}', context);
    } catch (error) {
      const details = getVideoAnalysisErrorDetails(error);
      expect((error as Error).message).toContain("probability");
      expect(details?.code).toBe("invalid_result_shape");
      expect(details?.parserMessage).toContain("probability");
    }
  });

  it("selects Chinese AI subtitle tracks before author subtitles", () => {
    expect(
      selectBestSubtitleTrack([
        {
          lan: "en",
          lan_doc: "English",
          type: 1,
          ai_type: 0,
          subtitle_url: "//example.com/en.json"
        },
        {
          lan: "zh-CN",
          lan_doc: "中文（自动生成）",
          type: 1,
          ai_type: 0,
          subtitle_url: "//example.com/zh-ai.json"
        },
        {
          lan: "zh-CN",
          lan_doc: "中文",
          type: 0,
          subtitle_url: "//example.com/zh-author.json"
        }
      ])?.subtitleUrl
    ).toBe("https://example.com/zh-ai.json");
  });

  it("parses subtitle AI responses with multiple ranges", () => {
    expect(
      parseSubtitleAiResponse(
        '{"ranges":[{"probability":82,"start":"00:10","end":"00:40","note":"片头赞助"},{"probability":"71","start":"05:00","end":"05:30","note":"结尾推广"}],"note":"两段广告"}',
        context
      )
    ).toEqual({
      ranges: [
        {
          probability: 82,
          start: "00:10",
          end: "00:40",
          note: "片头赞助"
        },
        {
          probability: 71,
          start: "05:00",
          end: "05:30",
          note: "结尾推广"
        }
      ],
      note: "两段广告"
    });
  });

  it("analyzes subtitles into multiple skip ranges", async () => {
    const requestJson = vi.fn(async (url: string) => {
      if (url.includes("/x/web-interface/view")) {
        return {
          ok: true,
          status: 200,
          data: {
            code: 0,
            data: {
              aid: 100,
              bvid: "BV1subtitle",
              cid: 200,
              title: "字幕测试",
              pages: [{ cid: 200 }]
            }
          }
        };
      }

      if (url.includes("/x/web-interface/nav")) {
        return {
          ok: true,
          status: 200,
          data: {
            code: 0,
            data: {
              wbi_img: {
                img_url: "https://i0.hdslb.com/bfs/wbi/abcdefghijklmnopqrstuvwxyz1234567890abcdefabcdefabcdefab.png",
                sub_url: "https://i0.hdslb.com/bfs/wbi/1234567890abcdefghijklmnopqrstuvwxyzabcdefabcdefabcd.png"
              }
            }
          }
        };
      }

      if (url.includes("/x/player/wbi/v2")) {
        return {
          ok: true,
          status: 200,
          data: {
            code: 0,
            data: {
              subtitle: {
                subtitles: [
                  {
                    lan: "zh-CN",
                    lan_doc: "中文（自动生成）",
                    type: 1,
                    ai_type: 0,
                    ai_status: 2,
                    subtitle_url: "https://aisubtitle.hdslb.com/subtitle.json"
                  }
                ]
              }
            }
          }
        };
      }

      if (url.includes("aisubtitle.hdslb.com/subtitle.json")) {
        return {
          ok: true,
          status: 200,
          data: {
            body: [
              { from: 10, to: 16, content: "本期视频由某某赞助" },
              { from: 20, to: 36, content: "点击链接购买课程" }
            ]
          }
        };
      }

      if (url.includes("/chat/completions")) {
        return {
          ok: true,
          status: 200,
          data: {
            choices: [
              {
                message: {
                  content: "{\"ranges\":[{\"probability\":84,\"start\":\"00:10\",\"end\":\"00:28\",\"note\":\"片头赞助\"},{\"probability\":76,\"start\":\"02:00\",\"end\":\"02:20\",\"note\":\"中段推广\"}],\"note\":\"字幕命中两段\"}"
                }
              }
            ]
          }
        };
      }

      throw new Error(`unexpected JSON request: ${url}`);
    });

    const service = createVideoAnalysisService({
      requestJson: requestJson as HttpClient["requestJson"],
      requestText: vi.fn()
    });
    const result = await service.analyzeVideo(
      {
        bvid: "BV1subtitle",
        pageIndex: 1,
        topComment: "首条评论：测试",
        requestId: "BV1subtitle-123"
      },
      {
        ...DEFAULT_CONFIG,
        ai: {
          ...DEFAULT_CONFIG.ai,
          apiKey: "token"
        }
      }
    );

    expect(result.method).toBe("subtitle");
    expect(result.ranges).toHaveLength(2);
    expect(result.finalProbability).toBe(84);
    expect(result.subtitleCueCount).toBe(2);
    expect(result.subtitleTrack?.lan).toBe("zh-CN");
  });

  it("falls back to danmaku only when subtitles are unavailable and danmaku analysis is enabled", async () => {
    const requestJson = vi.fn(async (url: string) => {
      if (url.includes("/x/web-interface/view")) {
        return {
          ok: true,
          status: 200,
          data: {
            code: 0,
            data: {
              aid: 100,
              bvid: "BV1fallback",
              cid: 200,
              pages: [{ cid: 200 }]
            }
          }
        };
      }

      if (url.includes("/x/web-interface/nav") || url.includes("/x/player/")) {
        return {
          ok: true,
          status: 200,
          data: {
            code: 0,
            data: {
              subtitle: {
                subtitles: []
              },
              wbi_img: {
                img_url: "https://i0.hdslb.com/bfs/wbi/abcdefghijklmnopqrstuvwxyz1234567890abcdefabcdefabcdefab.png",
                sub_url: "https://i0.hdslb.com/bfs/wbi/1234567890abcdefghijklmnopqrstuvwxyzabcdefabcdefabcd.png"
              }
            }
          }
        };
      }

      if (url.includes("/chat/completions")) {
        return {
          ok: true,
          status: 200,
          data: {
            choices: [
              {
                message: {
                  content: "{\"probability\":77,\"start\":\"00:30\",\"end\":\"01:00\",\"note\":\"弹幕空降广告\"}"
                }
              }
            ]
          }
        };
      }

      throw new Error(`unexpected JSON request: ${url}`);
    });
    const requestText = vi.fn(async () => ({
      ok: true,
      status: 200,
      data: `<i>${Array.from({ length: 20 }, (_, index) => `<d p="${index + 30},1,25,16777215,0,0,0,0">广告空降</d>`).join("")}</i>`
    }));

    const service = createVideoAnalysisService({
      requestJson: requestJson as HttpClient["requestJson"],
      requestText
    });
    const result = await service.analyzeVideo(
      {
        bvid: "BV1fallback",
        topComment: "首条评论：测试",
        requestId: "BV1fallback-123"
      },
      {
        ...DEFAULT_CONFIG,
        video: {
          ...DEFAULT_CONFIG.video,
          danmakuAnalysisEnabled: true
        },
        ai: {
          ...DEFAULT_CONFIG.ai,
          apiKey: "token"
        }
      }
    );

    expect(result.method).toBe("danmaku");
    expect(result.finalProbability).toBe(77);
    expect(requestText).toHaveBeenCalled();
  });

  it("does not fall back to danmaku when subtitle text is available but subtitle AI output is invalid", async () => {
    expect.assertions(3);

    const requestJson = vi.fn(async (url: string) => {
      if (url.includes("/x/web-interface/view")) {
        return {
          ok: true,
          status: 200,
          data: {
            code: 0,
            data: {
              aid: 100,
              bvid: "BV1subtitleError",
              cid: 200,
              pages: [{ cid: 200 }]
            }
          }
        };
      }

      if (url.includes("/x/web-interface/nav")) {
        return {
          ok: true,
          status: 200,
          data: {
            code: 0,
            data: {
              wbi_img: {
                img_url: "https://i0.hdslb.com/bfs/wbi/abcdefghijklmnopqrstuvwxyz1234567890abcdefabcdefabcdefab.png",
                sub_url: "https://i0.hdslb.com/bfs/wbi/1234567890abcdefghijklmnopqrstuvwxyzabcdefabcdefabcd.png"
              }
            }
          }
        };
      }

      if (url.includes("/x/player/wbi/v2")) {
        return {
          ok: true,
          status: 200,
          data: {
            code: 0,
            data: {
              subtitle: {
                subtitles: [
                  {
                    lan: "zh-CN",
                    lan_doc: "中文（自动生成）",
                    type: 1,
                    ai_type: 0,
                    subtitle_url: "https://aisubtitle.hdslb.com/subtitle-error.json"
                  }
                ]
              }
            }
          }
        };
      }

      if (url.includes("aisubtitle.hdslb.com/subtitle-error.json")) {
        return {
          ok: true,
          status: 200,
          data: {
            body: [{ from: 10, to: 20, content: "赞助内容" }]
          }
        };
      }

      if (url.includes("/chat/completions")) {
        return {
          ok: true,
          status: 200,
          data: {
            choices: [
              {
                message: {
                  content: "这段有广告，但我不返回 JSON。"
                }
              }
            ]
          }
        };
      }

      throw new Error(`unexpected JSON request: ${url}`);
    });
    const requestText = vi.fn();
    const service = createVideoAnalysisService({
      requestJson: requestJson as HttpClient["requestJson"],
      requestText
    });

    try {
      await service.analyzeVideo(
        {
          bvid: "BV1subtitleError",
          topComment: "首条评论：测试",
          requestId: "BV1subtitleError-123"
        },
        {
          ...DEFAULT_CONFIG,
          video: {
            ...DEFAULT_CONFIG.video,
            danmakuAnalysisEnabled: true
          },
          ai: {
            ...DEFAULT_CONFIG.ai,
            apiKey: "token"
          }
        }
      );
    } catch (error) {
      expect((error as Error).message).toContain("没有找到可解析的 JSON");
      expect(getVideoAnalysisErrorDetails(error)?.code).toBe("no_json_found");
      expect(requestText).not.toHaveBeenCalled();
    }
  });

  it("prefers responses API with json schema for GPT-5 and falls back to chat schema when completed without output", async () => {
    const requestJson = vi.fn(async (url: string, init?: { body?: string }) => {
      if (url.includes("/x/web-interface/view")) {
        return {
          ok: true,
          status: 200,
          data: {
            code: 0,
            data: {
              cid: 1001
            }
          }
        };
      }

      if (url.includes("/responses")) {
        return {
          ok: true,
          status: 200,
          data: {
            id: "resp_123",
            object: "response",
            model: "gpt-5.4",
            status: "completed",
            output: []
          }
        };
      }

      if (url.includes("/chat/completions")) {
        return {
          ok: true,
          status: 200,
          data: {
            id: "chat_resp",
            object: "chat.completion",
            model: "gpt-5.4",
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: "{\"probability\": 76, \"start\": \"00:30\", \"end\": \"01:00\", \"note\": \"命中广告\"}"
                }
              }
            ]
          }
        };
      }

      throw new Error(`unexpected JSON request: ${url}`);
    });

    const requestText = vi.fn(async (url: string) => {
      if (url.includes("/1001.xml")) {
        const entries = Array.from({ length: 20 }, (_, index) => `<d p="${index + 1},1,25,16777215,0,0,0,0">广告</d>`).join("");
        return {
          ok: true,
          status: 200,
          data: `<i>${entries}</i>`
        };
      }

      throw new Error(`unexpected text request: ${url}`);
    });

    const client: HttpClient = {
      requestJson: requestJson as HttpClient["requestJson"],
      requestText
    };

    const service = createVideoAnalysisService(client);
    const result = await service.analyzeVideo(
      {
        bvid: "BV1test",
        topComment: "首条评论：测试",
        requestId: "BV1test-123"
      },
      {
        ...DEFAULT_CONFIG,
        video: {
          ...DEFAULT_CONFIG.video,
          subtitleAnalysisEnabled: false,
          danmakuAnalysisEnabled: true
        },
        ai: {
          ...DEFAULT_CONFIG.ai,
          provider: "openai",
          model: "gpt-5.4",
          apiKey: "token"
        }
      }
    );

    expect(result.finalProbability).toBe(76);
    expect(result.start).toBe("00:30");
    expect(result.end).toBe("01:00");
    expect(requestJson.mock.calls[1]?.[0]).toContain("/responses");
    expect(requestJson.mock.calls[2]?.[0]).toContain("/chat/completions");

    const responsesBody = JSON.parse(String(requestJson.mock.calls[1]?.[1]?.body ?? "{}"));
    expect(responsesBody.reasoning).toEqual({
      effort: "medium",
      summary: "auto"
    });
    expect(responsesBody.text).toMatchObject({
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "video_analysis_result",
        strict: true
      }
    });
    expect(responsesBody.text.format.schema.properties.probability.minimum).toBe(0);
    expect(responsesBody.text.format.schema.additionalProperties).toBe(false);

    const chatBody = JSON.parse(String(requestJson.mock.calls[2]?.[1]?.body ?? "{}"));
    expect(chatBody.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "video_analysis_result",
        strict: true
      }
    });
    expect(chatBody.response_format.json_schema.schema.properties.note.type).toBe("string");
  });

  it("reports completed_without_output when both structured paths complete without text", async () => {
    expect.assertions(7);

    const requestJson = vi.fn(async (url: string) => {
      if (url.includes("/x/web-interface/view")) {
        return {
          ok: true,
          status: 200,
          data: {
            code: 0,
            data: {
              cid: 1001
            }
          }
        };
      }

      if (url.includes("/responses")) {
        return {
          ok: true,
          status: 200,
          data: {
            id: "resp_empty",
            object: "response",
            model: "gpt-5.4-mini",
            status: "completed",
            output: []
          }
        };
      }

      if (url.includes("/chat/completions")) {
        return {
          ok: true,
          status: 200,
          data: {
            id: "chat_empty",
            object: "chat.completion",
            model: "gpt-5.4-mini",
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: null
                }
              }
            ]
          }
        };
      }

      throw new Error(`unexpected JSON request: ${url}`);
    });

    const requestText = vi.fn(async (url: string) => {
      if (url.includes("/1001.xml")) {
        const entries = Array.from({ length: 20 }, (_, index) => `<d p="${index + 1},1,25,16777215,0,0,0,0">广告</d>`).join("");
        return {
          ok: true,
          status: 200,
          data: `<i>${entries}</i>`
        };
      }

      if (url.includes("/responses")) {
        return {
          ok: true,
          status: 200,
          data: [
            "event: response.completed",
            "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_empty\",\"object\":\"response\",\"status\":\"completed\",\"output\":[]}}",
            ""
          ].join("\n\n")
        };
      }

      if (url.includes("/chat/completions")) {
        return {
          ok: true,
          status: 200,
          data: [
            "data: {\"id\":\"chat_empty\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\",\"native_finish_reason\":\"stop\"}]}",
            "data: [DONE]",
            ""
          ].join("\n\n")
        };
      }

      throw new Error(`unexpected text request: ${url}`);
    });

    const client: HttpClient = {
      requestJson: requestJson as HttpClient["requestJson"],
      requestText
    };

    const service = createVideoAnalysisService(client);

    try {
      await service.analyzeVideo(
        {
          bvid: "BV1empty",
          topComment: "首条评论：测试",
          requestId: "BV1empty-123"
        },
        {
          ...DEFAULT_CONFIG,
          video: {
            ...DEFAULT_CONFIG.video,
            subtitleAnalysisEnabled: false,
            danmakuAnalysisEnabled: true
          },
          ai: {
            ...DEFAULT_CONFIG.ai,
            provider: "openai",
            model: "gpt-5.4-mini",
            apiKey: "token"
          }
        }
      );
    } catch (error) {
      const details = getVideoAnalysisErrorDetails(error);
      expect((error as Error).message).toContain("上游响应已完成");
      expect(details?.code).toBe("completed_without_output");
      expect(details?.responseSource).toContain("stream");
      expect(details?.parserMessage).toContain("流式路径");
      expect(details?.suggestion).toContain("output/output_text");
      expect(details?.exchangeTranscript).toContain("[openai.responses]");
      expect(details?.exchangeTranscript).toContain("[openai.chat.completions.stream]");
    }
  });

  it("recovers from completed-without-output by parsing responses stream events", async () => {
    const requestJson = vi.fn(async (url: string) => {
      if (url.includes("/x/web-interface/view")) {
        return {
          ok: true,
          status: 200,
          data: {
            code: 0,
            data: {
              cid: 1001
            }
          }
        };
      }

      if (url.includes("/responses")) {
        return {
          ok: true,
          status: 200,
          data: {
            id: "resp_empty",
            object: "response",
            model: "gpt-5.4-mini",
            status: "completed",
            output: []
          }
        };
      }

      if (url.includes("/chat/completions")) {
        return {
          ok: true,
          status: 200,
          data: {
            id: "chat_empty",
            object: "chat.completion",
            model: "gpt-5.4-mini",
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: null
                }
              }
            ]
          }
        };
      }

      throw new Error(`unexpected JSON request: ${url}`);
    });

    const requestText = vi.fn(async (url: string) => {
      if (url.includes("/1001.xml")) {
        const entries = Array.from({ length: 20 }, (_, index) => `<d p="${index + 1},1,25,16777215,0,0,0,0">广告</d>`).join("");
        return {
          ok: true,
          status: 200,
          data: `<i>${entries}</i>`
        };
      }

      if (url.includes("/responses")) {
        return {
          ok: true,
          status: 200,
          data: [
            "event: response.output_text.delta",
            "data: {\"type\":\"response.output_text.delta\",\"delta\":\"{\\\"probability\\\":64,\\\"start\\\":\\\"00:10\\\",\\\"end\\\":\\\"00:35\\\",\\\"note\\\":\\\"流式恢复成功\\\"}\"}",
            "",
            "event: response.completed",
            "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_stream\",\"object\":\"response\",\"status\":\"completed\",\"output\":[]}}",
            ""
          ].join("\n\n")
        };
      }

      throw new Error(`unexpected text request: ${url}`);
    });

    const client: HttpClient = {
      requestJson: requestJson as HttpClient["requestJson"],
      requestText
    };

    const service = createVideoAnalysisService(client);
    const result = await service.analyzeVideo(
      {
        bvid: "BV1stream",
        topComment: "首条评论：测试",
        requestId: "BV1stream-123"
      },
      {
        ...DEFAULT_CONFIG,
        video: {
          ...DEFAULT_CONFIG.video,
          subtitleAnalysisEnabled: false,
          danmakuAnalysisEnabled: true
        },
        ai: {
          ...DEFAULT_CONFIG.ai,
          provider: "openai",
          model: "gpt-5.4-mini",
          apiKey: "token"
        }
      }
    );

    expect(result.finalProbability).toBe(64);
    expect(result.start).toBe("00:10");
    expect(result.end).toBe("00:40");
    expect(result.note).toBe("流式恢复成功");
    expect(requestText).toHaveBeenCalledWith(
      expect.stringContaining("/responses"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "text/event-stream"
        })
      })
    );
  });
});
