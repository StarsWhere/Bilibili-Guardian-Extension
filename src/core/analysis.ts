import {
  fetchCidByBvid,
  fetchDanmakuXml,
  fetchSubtitleJson,
  fetchSubtitleTracks,
  fetchVideoInfoByBvid,
  parseDanmakuXml,
  selectBestSubtitleTrack,
  type BilibiliSubtitleCue
} from "./bilibili";
import type { HttpClient } from "./http";
import { fetchModelsWithClient, getProviderBaseUrl, type EnsureOriginAccess } from "./providers";
import { getCustomBaseUrlValidationError } from "@/shared/config";
import { createErrorWithDetails } from "@/shared/errors";
import { clamp, isValidTimeString, normalizeAdRange, secondsToTimeString, timeStringToSeconds } from "@/shared/time";
import type {
  AIProvider,
  BackgroundAnalyzeVideoPayload,
  ExtensionConfig,
  VideoAdRange,
  VideoAnalysisErrorDetails,
  VideoAnalysisFailureCode,
  VideoAnalysisResult
} from "@/shared/types";
import { createRangeId, normalizeVideoAnalysisResult } from "@/shared/videoResult";

const SIMPLE_AD_KEYWORDS = ["广告", "推广", "赞助", "恰饭", "感谢金主", "商务合作"];
const RESPONSE_PREVIEW_LIMIT = 800;
const ENVELOPE_PREVIEW_LIMIT = 1200;

interface AiResultShape {
  probability: number;
  start: string | null;
  end: string | null;
  note: string;
}

interface AiRangeShape {
  probability: number;
  start: string;
  end: string;
  note: string;
}

interface AiSubtitleResultShape {
  ranges: AiRangeShape[];
  note: string;
}

type AnalysisMethod = "danmaku" | "subtitle";

export interface ParseAiResponseContext {
  provider: AIProvider;
  model: string;
  requestId: string;
  responseSource?: string;
  responseEnvelopePreview?: string;
  exchangeTranscript?: string;
}

interface ExtractedProviderResponse {
  text: string;
  source: string;
  envelopePreview?: string;
  completedWithoutOutput?: boolean;
}

interface ExtractedProviderStreamResponse {
  text: string;
  source: string;
  envelopePreview?: string;
  completedWithoutOutput?: boolean;
}

interface OpenAiResponsesApiPayload {
  status?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string; output_text?: string }>;
    output_text?: string;
  }>;
  usage?: unknown;
  error?: { message?: string };
}

interface OpenAiChatCompletionsPayload {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string; output_text?: string }>;
    };
    text?: string;
    delta?: string | Array<{ type?: string; text?: string; output_text?: string }>;
    finish_reason?: string;
  }>;
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string; output_text?: string }>;
    output_text?: string;
  }>;
  usage?: unknown;
  error?: { message?: string };
}

interface JsonSchemaEnvelope {
  name: string;
  strict: true;
  schema: Record<string, unknown>;
}

function sanitizeList(input: string[]): string[] {
  return input.map((item) => item.trim()).filter(Boolean);
}

function matchesPattern(text: string, patterns: string[], useRegex: boolean): boolean {
  const normalizedText = text.toLowerCase();
  return patterns.some((pattern) => {
    if (!useRegex) {
      return normalizedText.includes(pattern.toLowerCase());
    }

    try {
      return new RegExp(pattern, "i").test(text);
    } catch {
      return normalizedText.includes(pattern.toLowerCase());
    }
  });
}

function filterDanmakuText(xml: string, config: ExtensionConfig): { text: string; count: number } {
  const parsed = parseDanmakuXml(xml);
  let filtered = parsed;

  const blacklist = sanitizeList(config.ai.blacklist);
  if (config.ai.blacklistEnabled && blacklist.length > 0) {
    filtered = filtered.filter((entry) => !matchesPattern(entry.text, blacklist, config.ai.blacklistRegex));
  }

  const whitelist = sanitizeList(config.ai.whitelist);
  if (config.ai.whitelistEnabled && whitelist.length > 0) {
    filtered = filtered.filter((entry) => matchesPattern(entry.text, whitelist, config.ai.whitelistRegex));
  }

  if (
    filtered.length < config.video.minDanmakuForAnalysis &&
    !filtered.some((entry) => SIMPLE_AD_KEYWORDS.some((keyword) => entry.text.includes(keyword)))
  ) {
    return { text: "", count: filtered.length };
  }

  if (filtered.length > config.video.maxDanmakuCount) {
    filtered = filtered.slice(0, config.video.maxDanmakuCount);
  }

  return {
    text: filtered
      .sort((left, right) => left.time - right.time)
      .map((entry) => `${secondsToTimeString(entry.time)} ${entry.text}`)
      .join("\n"),
    count: filtered.length
  };
}

function subtitleCuesToTimedText(cues: BilibiliSubtitleCue[], config: ExtensionConfig): { text: string; count: number } {
  const safeLimit = Math.max(1, config.video.maxSubtitleCueCount);
  const selected = cues.slice(0, safeLimit);
  return {
    text: selected
      .map((cue) => `${secondsToTimeString(cue.from)} --> ${secondsToTimeString(cue.to)}  ${cue.content.replace(/\s+/g, " ").trim()}`)
      .join("\n"),
    count: selected.length
  };
}

function getPageCid(info: Awaited<ReturnType<typeof fetchVideoInfoByBvid>>, pageIndex: number): number {
  return info.pages[pageIndex - 1]?.cid ?? info.cid;
}

function createNoAnalysisResult(note: string, method: VideoAnalysisResult["method"] = "none"): VideoAnalysisResult {
  return normalizeVideoAnalysisResult({
    probability: 0,
    finalProbability: 0,
    start: null,
    end: null,
    note,
    method,
    ranges: [],
    disabledRangeIds: [],
    source: "live",
    cacheHit: false,
    danmakuCount: 0
  });
}

function buildResponsePreview(input: string): string {
  const normalized = input.trim();
  if (!normalized) {
    return "(空响应)";
  }

  if (normalized.length <= RESPONSE_PREVIEW_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, RESPONSE_PREVIEW_LIMIT)}\n...[已截断，共 ${normalized.length} 个字符]`;
}

function stringifyPreview(value: unknown, maxLength: number): string {
  const json = JSON.stringify(value, null, 2);
  if (!json) {
    return "(空响应)";
  }

  if (json.length <= maxLength) {
    return json;
  }

  return `${json.slice(0, maxLength)}\n...[已截断，共 ${json.length} 个字符]`;
}

function stringifyFull(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  const json = JSON.stringify(value, null, 2);
  return json || "(空响应)";
}

function unwrapMarkdownCodeFence(input: string): string {
  const matched = input.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i);
  return matched?.[1]?.trim() || input.trim();
}

function extractBalancedJsonObject(input: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (start === -1) {
      if (char === "{") {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === "\\") {
        escaping = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, index + 1);
      }
    }
  }

  return null;
}

function getParseSuggestion(code: VideoAnalysisFailureCode): string {
  switch (code) {
    case "empty_response":
      return "检查接口地址、模型名称和密钥是否正确，并确认服务端确实返回了内容。";
    case "completed_without_output":
      return "已确认上游响应完成但未映射出可消费文本，请检查兼容层是否正确透传 output/output_text 或 message.content。";
    case "no_json_found":
      return "检查提示词是否被模型忽略，或确认所选模型是否会返回自然语言而不是 JSON。";
    case "invalid_json":
      return "确认模型输出是否夹带解释文字、尾随逗号或其他不符合 JSON 语法的内容。";
    case "invalid_result_shape":
      return "确认模型返回字段包含 probability、start、end、note，且字段类型符合要求。";
    default:
      return "请检查当前模型和提示词是否能稳定返回结构化结果。";
  }
}

function collectTextFromUnknownContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (content && typeof content === "object" && !Array.isArray(content)) {
    const candidate = content as Record<string, unknown>;
    if (typeof candidate.text === "string") {
      return candidate.text;
    }

    if (typeof candidate.output_text === "string") {
      return candidate.output_text;
    }

    if ("content" in candidate) {
      return collectTextFromUnknownContent(candidate.content);
    }

    return "";
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (!part || typeof part !== "object") {
        return "";
      }

      const candidate = part as Record<string, unknown>;
      if (typeof candidate.text === "string") {
        return candidate.text;
      }

      if (typeof candidate.output_text === "string") {
        return candidate.output_text;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function collectTextFromResponseOutputDetailed(output: unknown): { text: string; source: string } {
  if (!Array.isArray(output)) {
    return {
      text: "",
      source: "responses.output[*].content"
    };
  }

  const topLevelSegments: string[] = [];
  const contentSegments: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as Record<string, unknown>;
    if (typeof candidate.output_text === "string" && candidate.output_text.trim()) {
      topLevelSegments.push(candidate.output_text);
    }

    if (!Array.isArray(candidate.content)) {
      continue;
    }

    for (const part of candidate.content) {
      if (!part || typeof part !== "object") {
        continue;
      }

      const contentPart = part as Record<string, unknown>;
      if (typeof contentPart.text === "string" && contentPart.text.trim()) {
        contentSegments.push(contentPart.text);
        continue;
      }

      if (typeof contentPart.output_text === "string" && contentPart.output_text.trim()) {
        contentSegments.push(contentPart.output_text);
      }
    }
  }

  if (topLevelSegments.length > 0) {
    return {
      text: topLevelSegments.join("\n"),
      source: "responses.output[*].output_text"
    };
  }

  if (contentSegments.length > 0) {
    return {
      text: contentSegments.join("\n"),
      source: "responses.output[*].content"
    };
  }

  return {
    text: "",
    source: "responses.output_text -> responses.output[*].output_text -> responses.output[*].content"
  };
}

function buildOpenAiCompatibleEnvelopePreview(data: Record<string, unknown>): string {
  const firstChoice = Array.isArray(data.choices) ? data.choices[0] : undefined;
  const summary = {
    id: data.id,
    object: data.object,
    model: data.model,
    created: data.created,
    output_text: data.output_text,
    usage: data.usage,
    error: data.error,
    first_choice: firstChoice && typeof firstChoice === "object"
      ? {
          finish_reason: (firstChoice as Record<string, unknown>).finish_reason,
          message: (firstChoice as Record<string, unknown>).message,
          text: (firstChoice as Record<string, unknown>).text,
          delta: (firstChoice as Record<string, unknown>).delta
        }
      : firstChoice,
    first_output: Array.isArray(data.output) ? data.output[0] : undefined
  };

  return stringifyPreview(summary, ENVELOPE_PREVIEW_LIMIT);
}

function buildStreamEnvelopePreview(summary: unknown): string {
  return stringifyPreview(summary, ENVELOPE_PREVIEW_LIMIT);
}

function parseSseDataLines(raw: string): Array<{ event?: string; data: unknown }> {
  const normalized = raw.replaceAll("\r\n", "\n");
  const blocks = normalized.split("\n\n");
  const events: Array<{ event?: string; data: unknown }> = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      continue;
    }

    let eventName: string | undefined;
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
        continue;
      }

      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) {
      continue;
    }

    const combined = dataLines.join("\n");
    if (combined === "[DONE]") {
      events.push({
        event: eventName,
        data: "[DONE]"
      });
      continue;
    }

    try {
      events.push({
        event: eventName,
        data: JSON.parse(combined) as unknown
      });
    } catch {
      events.push({
        event: eventName,
        data: combined
      });
    }
  }

  return events;
}

function extractOpenAiChatStreamResponse(raw: string): ExtractedProviderStreamResponse {
  const events = parseSseDataLines(raw);
  const contentChunks: string[] = [];
  let completed = false;
  let lastPayload: Record<string, unknown> | undefined;

  for (const entry of events) {
    if (entry.data === "[DONE]") {
      continue;
    }

    if (!entry.data || typeof entry.data !== "object" || Array.isArray(entry.data)) {
      continue;
    }

    const payload = entry.data as Record<string, unknown>;
    lastPayload = payload;
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const firstChoice = choices[0];
    const choice = firstChoice && typeof firstChoice === "object"
      ? firstChoice as Record<string, unknown>
      : null;
    const delta = choice?.delta && typeof choice.delta === "object"
      ? choice.delta as Record<string, unknown>
      : null;

    if (typeof delta?.content === "string") {
      contentChunks.push(delta.content);
    }

    if (choice?.finish_reason) {
      completed = true;
    }
  }

  return {
    text: contentChunks.join(""),
    source: "chat.stream.choices[0].delta.content",
    envelopePreview: buildStreamEnvelopePreview(lastPayload ?? { stream: "chat", note: "未解析到有效 JSON 事件" }),
    completedWithoutOutput: completed && contentChunks.length === 0
  };
}

function extractOpenAiResponsesStreamResponse(raw: string): ExtractedProviderStreamResponse {
  const events = parseSseDataLines(raw);
  const outputTextChunks: string[] = [];
  let completed = false;
  let completedResponseSummary: Record<string, unknown> | undefined;
  let finalTextFromDone = "";

  for (const entry of events) {
    if (!entry.data || typeof entry.data !== "object" || Array.isArray(entry.data)) {
      continue;
    }

    const payload = entry.data as Record<string, unknown>;
    const type = typeof payload.type === "string" ? payload.type : entry.event;

    if (type === "response.output_text.delta" && typeof payload.delta === "string") {
      outputTextChunks.push(payload.delta);
      continue;
    }

    if (type === "response.output_text.done" && typeof payload.text === "string") {
      finalTextFromDone = payload.text;
      continue;
    }

    if (type === "response.content_part.done") {
      const part = payload.part && typeof payload.part === "object"
        ? payload.part as Record<string, unknown>
        : null;
      if (part?.type === "output_text" && typeof part.text === "string") {
        finalTextFromDone = part.text;
      }
      continue;
    }

    if (type === "response.output_item.done") {
      const item = payload.item && typeof payload.item === "object"
        ? payload.item as Record<string, unknown>
        : null;
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const part of content) {
        if (!part || typeof part !== "object") {
          continue;
        }

        const candidate = part as Record<string, unknown>;
        if (candidate.type === "output_text" && typeof candidate.text === "string") {
          finalTextFromDone = candidate.text;
        }
      }
      continue;
    }

    if (type === "response.completed") {
      completed = true;
      const response = payload.response && typeof payload.response === "object"
        ? payload.response as Record<string, unknown>
        : payload;
      completedResponseSummary = response;
    }
  }

  const text = outputTextChunks.join("") || finalTextFromDone;
  return {
    text,
    source: outputTextChunks.length > 0
      ? "responses.stream.output_text.delta"
      : "responses.stream.output_text.done",
    envelopePreview: buildStreamEnvelopePreview(completedResponseSummary ?? { stream: "responses", note: "未解析到 response.completed" }),
    completedWithoutOutput: completed && !text
  };
}

export function extractOpenAiCompatibleResponse(data: Record<string, unknown>): ExtractedProviderResponse {
  const envelopePreview = buildOpenAiCompatibleEnvelopePreview(data);
  const isResponsesPayload =
    data.object === "response" ||
    typeof data.output_text === "string" ||
    Array.isArray(data.output) ||
    typeof data.status === "string";

  if (isResponsesPayload) {
    const topLevelOutputText = typeof data.output_text === "string" ? data.output_text.trim() : "";
    const responseOutput = collectTextFromResponseOutputDetailed(data.output);
    const responseStatus = typeof data.status === "string" ? data.status.trim().toLowerCase() : "";
    const hasError = Boolean(data.error);

    if (topLevelOutputText) {
      return {
        text: topLevelOutputText,
        source: "responses.output_text",
        envelopePreview
      };
    }

    if (responseOutput.text) {
      return {
        text: responseOutput.text,
        source: responseOutput.source,
        envelopePreview
      };
    }

    return {
      text: "",
      source: responseOutput.source,
      envelopePreview,
      completedWithoutOutput: responseStatus === "completed" && !hasError
    };
  }

  const choices = Array.isArray(data.choices) ? data.choices : [];
  const firstChoice = choices[0];
  const firstChoiceObject = firstChoice && typeof firstChoice === "object"
    ? firstChoice as Record<string, unknown>
    : null;
  const message = firstChoiceObject?.message && typeof firstChoiceObject.message === "object"
    ? firstChoiceObject.message as Record<string, unknown>
    : null;

  const messageContent = message ? collectTextFromUnknownContent(message.content) : "";
  const choiceText = typeof firstChoiceObject?.text === "string" ? firstChoiceObject.text : "";
  const deltaContent = firstChoiceObject ? collectTextFromUnknownContent(firstChoiceObject.delta) : "";

  if (messageContent) {
    return {
      text: messageContent,
      source: Array.isArray(message?.content) ? "chat.choices[0].message.content[]" : "chat.choices[0].message.content",
      envelopePreview
    };
  }

  if (choiceText) {
    return {
      text: choiceText,
      source: "chat.choices[0].text",
      envelopePreview
    };
  }

  if (deltaContent) {
    return {
      text: deltaContent,
      source: "chat.choices[0].delta",
      envelopePreview
    };
  }

  return {
    text: "",
    source: "chat.choices[0].message.content -> chat.choices[0].text -> chat.choices[0].delta",
    envelopePreview,
    completedWithoutOutput: Boolean(firstChoiceObject?.finish_reason)
  };
}

function shouldPreferStructuredGpt5Flow(provider: AIProvider, model: string): boolean {
  if (provider !== "openai" && provider !== "custom") {
    return false;
  }

  return /^gpt-5(\.|-|$)/i.test(model.trim());
}

function buildDanmakuVideoAnalysisJsonSchema(): JsonSchemaEnvelope {
  return {
    name: "video_analysis_result",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["probability", "start", "end", "note"],
      properties: {
        probability: {
          type: "integer",
          minimum: 0,
          maximum: 100
        },
        start: {
          type: ["string", "null"]
        },
        end: {
          type: ["string", "null"]
        },
        note: {
          type: "string"
        }
      }
    }
  };
}

function buildSubtitleVideoAnalysisJsonSchema(): JsonSchemaEnvelope {
  return {
    name: "video_subtitle_analysis_result",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["ranges", "note"],
      properties: {
        ranges: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["probability", "start", "end", "note"],
            properties: {
              probability: {
                type: "integer",
                minimum: 0,
                maximum: 100
              },
              start: {
                type: "string"
              },
              end: {
                type: "string"
              },
              note: {
                type: "string"
              }
            }
          }
        },
        note: {
          type: "string"
        }
      }
    }
  };
}

function buildOpenAiResponsesStructuredRequest(model: string, instructions: string, input: string, schema: JsonSchemaEnvelope): string {
  return JSON.stringify({
    model,
    instructions,
    input,
    store: false,
    reasoning: {
      effort: "medium",
      summary: "auto"
    },
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        ...schema
      }
    }
  });
}

function buildOpenAiChatStructuredRequest(model: string, systemPrompt: string, userContent: string, schema: JsonSchemaEnvelope): string {
  return JSON.stringify({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    response_format: {
      type: "json_schema",
      json_schema: schema
    }
  });
}

function buildOpenAiChatPromptRequest(model: string, systemPrompt: string, userContent: string): string {
  return JSON.stringify({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ]
  });
}

function buildOpenAiResponsesStructuredStreamRequest(model: string, instructions: string, input: string, schema: JsonSchemaEnvelope): string {
  return JSON.stringify({
    model,
    instructions,
    input,
    store: false,
    reasoning: {
      effort: "medium",
      summary: "auto"
    },
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        ...schema
      }
    },
    stream: true
  });
}

function buildOpenAiChatStructuredStreamRequest(model: string, systemPrompt: string, userContent: string, schema: JsonSchemaEnvelope): string {
  return JSON.stringify({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    response_format: {
      type: "json_schema",
      json_schema: schema
    },
    stream: true
  });
}

function appendExchangeTranscript(
  transcript: string[],
  label: string,
  url: string,
  requestBody: string,
  responseBody: unknown
): void {
  transcript.push(
    [
      `[${label}] ${url}`,
      "Request Body:",
      requestBody || "(空请求体)",
      "Response Body:",
      stringifyFull(responseBody)
    ].join("\n")
  );
}

function createParseError(
  code: VideoAnalysisFailureCode,
  message: string,
  rawResponse: string,
  context: ParseAiResponseContext,
  parserMessage: string
): Error {
  const details: VideoAnalysisErrorDetails = {
    requestId: context.requestId,
    provider: context.provider,
    model: context.model,
    stage: "response_parse",
    code,
    parserMessage,
    responsePreview: buildResponsePreview(rawResponse),
    responseSource: context.responseSource || "response_text",
    responseLength: rawResponse.length,
    suggestion: getParseSuggestion(code),
    responseEnvelopePreview: context.responseEnvelopePreview,
    exchangeTranscript: context.exchangeTranscript
  };

  return createErrorWithDetails(message, details);
}

function createCompletedWithoutOutputError(
  context: ParseAiResponseContext,
  parserMessage: string
): Error {
  return createParseError(
    "completed_without_output",
    "上游响应已完成，但未提供可消费的输出文本",
    "",
    context,
    parserMessage
  );
}

function mergeEnvelopePreview(current: string | undefined, label: string, next: string | undefined): string | undefined {
  if (!next) {
    return current;
  }

  if (!current) {
    return `[${label}]\n${next}`;
  }

  return `${current}\n\n[${label}]\n${next}`;
}

function normalizeProbability(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return undefined;
}

function validateAiResultShape(parsed: unknown, rawResponse: string, context: ParseAiResponseContext): AiResultShape {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw createParseError(
      "invalid_result_shape",
      "AI 返回的 JSON 结构不符合预期",
      rawResponse,
      context,
      "最外层返回值必须是一个 JSON 对象。"
    );
  }

  const candidate = parsed as Record<string, unknown>;
  if (!("probability" in candidate) || !("start" in candidate) || !("end" in candidate) || !("note" in candidate)) {
    throw createParseError(
      "invalid_result_shape",
      "AI 返回的 JSON 缺少必要字段",
      rawResponse,
      context,
      "必须包含 probability、start、end、note 四个字段。"
    );
  }

  const probability = normalizeProbability(candidate.probability);
  const start = normalizeNullableString(candidate.start);
  const end = normalizeNullableString(candidate.end);
  const note = typeof candidate.note === "string" ? candidate.note.trim() : undefined;

  if (probability === null) {
    throw createParseError(
      "invalid_result_shape",
      "AI 返回的 JSON 中 probability 不是有效数字",
      rawResponse,
      context,
      "probability 必须是数字，或可转换为数字的字符串。"
    );
  }

  if (start === undefined || end === undefined) {
    throw createParseError(
      "invalid_result_shape",
      "AI 返回的 JSON 中 start 或 end 字段类型不正确",
      rawResponse,
      context,
      "start 和 end 只能是字符串或 null。"
    );
  }

  if (note === undefined) {
    throw createParseError(
      "invalid_result_shape",
      "AI 返回的 JSON 中 note 字段类型不正确",
      rawResponse,
      context,
      "note 必须是字符串。"
    );
  }

  return {
    probability,
    start,
    end,
    note
  };
}

export function parseAiResponse(raw: string, context: ParseAiResponseContext): AiResultShape {
  const normalized = raw.trim();
  if (!normalized) {
    throw createParseError(
      "empty_response",
      "AI 返回为空，请检查当前模型或接口是否正常工作",
      raw,
      context,
      `响应内容为空字符串。当前读取来源：${context.responseSource || "response_text"}。`
    );
  }

  const text = unwrapMarkdownCodeFence(normalized);
  const jsonBlock = extractBalancedJsonObject(text);
  if (!jsonBlock) {
    throw createParseError(
      "no_json_found",
      "AI 返回中没有找到可解析的 JSON 对象",
      raw,
      context,
      `未在响应中找到成对平衡的 JSON 对象。当前读取来源：${context.responseSource || "response_text"}。`
    );
  }

  try {
    const parsed = JSON.parse(jsonBlock) as unknown;
    return validateAiResultShape(parsed, raw, context);
  } catch (error) {
    if (error instanceof Error && "details" in error) {
      throw error;
    }

    throw createParseError(
      "invalid_json",
      "AI 返回内容不是有效的 JSON",
      raw,
      context,
      error instanceof Error ? error.message : "JSON.parse 失败"
    );
  }
}

function validateSubtitleResultShape(parsed: unknown, rawResponse: string, context: ParseAiResponseContext): AiSubtitleResultShape {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw createParseError(
      "invalid_result_shape",
      "AI 返回的字幕 JSON 结构不符合预期",
      rawResponse,
      context,
      "最外层返回值必须是一个 JSON 对象。"
    );
  }

  const candidate = parsed as Record<string, unknown>;
  if (!Array.isArray(candidate.ranges)) {
    throw createParseError(
      "invalid_result_shape",
      "AI 返回的字幕 JSON 缺少 ranges 数组",
      rawResponse,
      context,
      "必须包含 ranges 数组字段。"
    );
  }

  const ranges: AiRangeShape[] = [];
  for (const [index, item] of candidate.ranges.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw createParseError(
        "invalid_result_shape",
        "AI 返回的字幕区间结构不符合预期",
        rawResponse,
        context,
        `ranges[${index}] 必须是一个 JSON 对象。`
      );
    }

    const range = item as Record<string, unknown>;
    const probability = normalizeProbability(range.probability);
    const start = normalizeNullableString(range.start);
    const end = normalizeNullableString(range.end);
    const note = typeof range.note === "string" ? range.note.trim() : undefined;
    if (probability === null || start === undefined || start === null || end === undefined || end === null || note === undefined) {
      throw createParseError(
        "invalid_result_shape",
        "AI 返回的字幕区间字段类型不正确",
        rawResponse,
        context,
        `ranges[${index}] 必须包含 probability、start、end、note，且 start/end/note 必须是字符串。`
      );
    }

    ranges.push({
      probability,
      start,
      end,
      note
    });
  }

  return {
    ranges,
    note: typeof candidate.note === "string" ? candidate.note.trim() : ""
  };
}

export function parseSubtitleAiResponse(raw: string, context: ParseAiResponseContext): AiSubtitleResultShape {
  const normalized = raw.trim();
  if (!normalized) {
    throw createParseError(
      "empty_response",
      "AI 返回为空，请检查当前模型或接口是否正常工作",
      raw,
      context,
      `响应内容为空字符串。当前读取来源：${context.responseSource || "response_text"}。`
    );
  }

  const text = unwrapMarkdownCodeFence(normalized);
  const jsonBlock = extractBalancedJsonObject(text);
  if (!jsonBlock) {
    throw createParseError(
      "no_json_found",
      "AI 返回中没有找到可解析的 JSON 对象",
      raw,
      context,
      `未在响应中找到成对平衡的 JSON 对象。当前读取来源：${context.responseSource || "response_text"}。`
    );
  }

  try {
    const parsed = JSON.parse(jsonBlock) as unknown;
    return validateSubtitleResultShape(parsed, raw, context);
  } catch (error) {
    if (error instanceof Error && "details" in error) {
      throw error;
    }

    throw createParseError(
      "invalid_json",
      "AI 返回内容不是有效的 JSON",
      raw,
      context,
      error instanceof Error ? error.message : "JSON.parse 失败"
    );
  }
}

function calculateRangeFinalProbability(
  range: AiRangeShape,
  config: ExtensionConfig,
  method: AnalysisMethod,
  index: number
): VideoAdRange | null {
  if (!isValidTimeString(range.start) || !isValidTimeString(range.end)) {
    return null;
  }

  let start = range.start;
  let end = range.end;
  const normalizedRange = normalizeAdRange(start, end, config.video.minAdDuration);
  if (!normalizedRange.start || !normalizedRange.end || !isValidTimeString(normalizedRange.start) || !isValidTimeString(normalizedRange.end)) {
    return null;
  }

  start = normalizedRange.start;
  end = normalizedRange.end;

  const baseProbability = clamp(Math.round(range.probability), 0, 100);
  let finalProbability = baseProbability;
  const duration = timeStringToSeconds(end) - timeStringToSeconds(start);
  if (duration <= 0) {
    return null;
  }

  if (duration > config.video.maxAdDuration) {
    const overflowMinutes = (duration - config.video.maxAdDuration) / 60;
    finalProbability -= overflowMinutes * config.video.durationPenalty;
  }

  return {
    id: createRangeId(method, start, end, index),
    start,
    end,
    probability: baseProbability,
    finalProbability: clamp(Math.round(finalProbability), 0, 100),
    note: range.note?.trim() || "AI 未返回说明"
  };
}

function calculateDanmakuFinalProbability(result: AiResultShape, config: ExtensionConfig): VideoAnalysisResult {
  const baseProbability = clamp(Math.round(result.probability), 0, 100);
  const range = result.start && result.end
    ? calculateRangeFinalProbability(
        {
          probability: result.probability,
          start: result.start,
          end: result.end,
          note: result.note
        },
        config,
        "danmaku",
        0
      )
    : null;

  return normalizeVideoAnalysisResult({
    probability: baseProbability,
    finalProbability: range?.finalProbability ?? baseProbability,
    start: range?.start ?? null,
    end: range?.end ?? null,
    note: result.note?.trim() || "AI 未返回说明",
    method: "danmaku",
    ranges: range ? [range] : [],
    disabledRangeIds: [],
    source: "live",
    cacheHit: false,
    danmakuCount: 0
  });
}

function calculateSubtitleFinalProbability(result: AiSubtitleResultShape, config: ExtensionConfig): VideoAnalysisResult {
  const ranges = result.ranges
    .map((range, index) => calculateRangeFinalProbability(range, config, "subtitle", index))
    .filter((range): range is VideoAdRange => Boolean(range));
  const topRange = [...ranges].sort((left, right) => right.finalProbability - left.finalProbability)[0] ?? null;

  return normalizeVideoAnalysisResult({
    probability: topRange?.probability ?? 0,
    finalProbability: topRange?.finalProbability ?? 0,
    start: topRange?.start ?? null,
    end: topRange?.end ?? null,
    note: result.note || topRange?.note || (ranges.length > 0 ? "字幕识别完成。" : "字幕识别完成，未发现明确广告区间。"),
    method: "subtitle",
    ranges,
    disabledRangeIds: [],
    source: "live",
    cacheHit: false,
    danmakuCount: 0
  });
}

async function callAiProvider(
  client: HttpClient,
  ensureOriginAccess: EnsureOriginAccess | undefined,
  config: ExtensionConfig,
  method: AnalysisMethod,
  prompt: string,
  analysisText: string,
  topComment: string,
  requestId: string,
  signal: AbortSignal
): Promise<{ result: VideoAnalysisResult; rawResponse: string }> {
  const provider = config.ai.provider;
  if (!config.ai.model.trim()) {
    throw new Error("请先填写 AI 模型名称");
  }

  if (provider === "custom") {
    const validationError = getCustomBaseUrlValidationError(config.ai.baseUrl);
    if (validationError) {
      throw new Error(validationError);
    }

    if (!config.ai.apiKey.trim()) {
      throw new Error("请先为自定义兼容接口填写访问密钥");
    }

    await ensureOriginAccess?.(config.ai.baseUrl);
  } else if (!config.ai.apiKey.trim()) {
    throw new Error("请先配置 AI API Key");
  }

  const baseUrl = getProviderBaseUrl(provider, config);
  const userContent = method === "subtitle"
    ? `字幕内容：\n${analysisText}\n\n评论区情况：\n${topComment || "无"}`
    : `弹幕内容：\n${analysisText}\n\n评论区情况：\n${topComment || "无"}`;
  const schema = method === "subtitle"
    ? buildSubtitleVideoAnalysisJsonSchema()
    : buildDanmakuVideoAnalysisJsonSchema();
  let responseText = "";
  let responseSource = "response_text";
  let responseEnvelopePreview: string | undefined;
  const exchangeTranscript: string[] = [];

  if (provider === "gemini") {
    const requestBody = JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${prompt}\n\n${userContent}` }]
        }
      ]
    });
    const response = await client.requestJson<{
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
      error?: { message?: string };
    }>(`${baseUrl}/models/${encodeURIComponent(config.ai.model)}:generateContent?key=${encodeURIComponent(config.ai.apiKey)}`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: requestBody
    });
    appendExchangeTranscript(
      exchangeTranscript,
      "gemini.generateContent",
      `${baseUrl}/models/${encodeURIComponent(config.ai.model)}:generateContent?key=[REDACTED]`,
      requestBody,
      response.data
    );

    if (!response.ok) {
      throw new Error(response.data.error?.message || "Gemini 请求失败");
    }

    responseText = response.data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
  } else if (provider === "anthropic") {
    const requestBody = JSON.stringify({
      model: config.ai.model,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\n${userContent}`
        }
      ]
    });
    const response = await client.requestJson<{
      content?: Array<{ type: string; text?: string }>;
      error?: { message?: string };
    }>(`${baseUrl}/messages`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.ai.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: requestBody
    });
    appendExchangeTranscript(
      exchangeTranscript,
      "anthropic.messages",
      `${baseUrl}/messages`,
      requestBody,
      response.data
    );

    if (!response.ok) {
      throw new Error(response.data.error?.message || "Anthropic 请求失败");
    }

    responseText = response.data.content?.map((item) => item.text ?? "").join("\n") ?? "";
  } else {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.ai.apiKey}`
    };

    if (shouldPreferStructuredGpt5Flow(provider, config.ai.model)) {
      const responsesRequestBody = buildOpenAiResponsesStructuredRequest(config.ai.model, prompt, userContent, schema);
      const responsesResponse = await client.requestJson<OpenAiResponsesApiPayload>(`${baseUrl}/responses`, {
        method: "POST",
        signal,
        headers,
        body: responsesRequestBody
      });
      appendExchangeTranscript(
        exchangeTranscript,
        "openai.responses",
        `${baseUrl}/responses`,
        responsesRequestBody,
        responsesResponse.data
      );

      if (!responsesResponse.ok) {
        throw new Error(responsesResponse.data.error?.message || "AI 请求失败");
      }

      const responsesExtracted = extractOpenAiCompatibleResponse(responsesResponse.data as Record<string, unknown>);
      responseText = responsesExtracted.text;
      responseSource = responsesExtracted.source;
      responseEnvelopePreview = mergeEnvelopePreview(undefined, "openai.responses", responsesExtracted.envelopePreview);

      if (!responseText && responsesExtracted.completedWithoutOutput) {
        const chatFallbackRequestBody = buildOpenAiChatStructuredRequest(config.ai.model, prompt, userContent, schema);
        const chatFallbackResponse = await client.requestJson<OpenAiChatCompletionsPayload>(
          `${baseUrl}/chat/completions`,
          {
            method: "POST",
            signal,
            headers,
            body: chatFallbackRequestBody
          }
        );
        appendExchangeTranscript(
          exchangeTranscript,
          "openai.chat.completions",
          `${baseUrl}/chat/completions`,
          chatFallbackRequestBody,
          chatFallbackResponse.data
        );

        if (!chatFallbackResponse.ok) {
          throw new Error(chatFallbackResponse.data.error?.message || "AI 请求失败");
        }

        const chatFallbackExtracted = extractOpenAiCompatibleResponse(chatFallbackResponse.data as Record<string, unknown>);
        responseText = chatFallbackExtracted.text;
        responseSource = chatFallbackExtracted.source;
        responseEnvelopePreview = mergeEnvelopePreview(
          responseEnvelopePreview,
          "openai.chat.completions",
          chatFallbackExtracted.envelopePreview
        );

        if (!responseText && (responsesExtracted.completedWithoutOutput || chatFallbackExtracted.completedWithoutOutput)) {
          const responsesStreamRequestBody = buildOpenAiResponsesStructuredStreamRequest(config.ai.model, prompt, userContent, schema);
          const responsesStreamResponse = await client.requestText(`${baseUrl}/responses`, {
            method: "POST",
            signal,
            headers: {
              ...headers,
              Accept: "text/event-stream"
            },
            body: responsesStreamRequestBody
          });
          appendExchangeTranscript(
            exchangeTranscript,
            "openai.responses.stream",
            `${baseUrl}/responses`,
            responsesStreamRequestBody,
            responsesStreamResponse.data
          );

          if (!responsesStreamResponse.ok) {
            throw new Error("AI 流式请求失败");
          }

          const responsesStreamExtracted = extractOpenAiResponsesStreamResponse(responsesStreamResponse.data);
          if (responsesStreamExtracted.text) {
            responseText = responsesStreamExtracted.text;
            responseSource = responsesStreamExtracted.source;
            responseEnvelopePreview = mergeEnvelopePreview(
              responseEnvelopePreview,
              "openai.responses.stream",
              responsesStreamExtracted.envelopePreview
            );
          } else {
            responseSource = responsesStreamExtracted.source;
            responseEnvelopePreview = mergeEnvelopePreview(
              responseEnvelopePreview,
              "openai.responses.stream",
              responsesStreamExtracted.envelopePreview
            );
          }

          if (!responseText && responsesStreamExtracted.completedWithoutOutput) {
            const chatStreamRequestBody = buildOpenAiChatStructuredStreamRequest(config.ai.model, prompt, userContent, schema);
            const chatStreamResponse = await client.requestText(`${baseUrl}/chat/completions`, {
              method: "POST",
              signal,
              headers: {
                ...headers,
                Accept: "text/event-stream"
              },
              body: chatStreamRequestBody
            });
            appendExchangeTranscript(
              exchangeTranscript,
              "openai.chat.completions.stream",
              `${baseUrl}/chat/completions`,
              chatStreamRequestBody,
              chatStreamResponse.data
            );

            if (!chatStreamResponse.ok) {
              throw new Error("AI 流式请求失败");
            }

            const chatStreamExtracted = extractOpenAiChatStreamResponse(chatStreamResponse.data);
            if (chatStreamExtracted.text) {
              responseText = chatStreamExtracted.text;
              responseSource = chatStreamExtracted.source;
              responseEnvelopePreview = mergeEnvelopePreview(
                responseEnvelopePreview,
                "openai.chat.completions.stream",
                chatStreamExtracted.envelopePreview
              );
            } else {
              responseSource = chatStreamExtracted.source;
              responseEnvelopePreview = mergeEnvelopePreview(
                responseEnvelopePreview,
                "openai.chat.completions.stream",
                chatStreamExtracted.envelopePreview
              );
            }

            if (!responseText && chatStreamExtracted.completedWithoutOutput) {
              throw createCompletedWithoutOutputError(
                {
                  provider,
                  model: config.ai.model,
                  requestId,
                  responseSource,
                  responseEnvelopePreview,
                  exchangeTranscript: exchangeTranscript.join("\n\n====================\n\n")
                },
                "已优先使用 /responses 结构化输出，并回退到 /chat/completions + json_schema；非流式 completed 结果未携带正文后，又尝试了两条流式路径，但仍未收到 output_text 或 delta.content。可判定为兼容层未映射最终文本。"
              );
            }
          }
        }
      }
    } else {
      const requestBody = buildOpenAiChatPromptRequest(config.ai.model, prompt, userContent);
      const response = await client.requestJson<OpenAiChatCompletionsPayload>(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal,
        headers,
        body: requestBody
      });
      appendExchangeTranscript(
        exchangeTranscript,
        "openai.chat.completions",
        `${baseUrl}/chat/completions`,
        requestBody,
        response.data
      );

      if (!response.ok) {
        throw new Error(response.data.error?.message || "AI 请求失败");
      }

      const extracted = extractOpenAiCompatibleResponse(response.data as Record<string, unknown>);
      responseText = extracted.text;
      responseSource = extracted.source;
      responseEnvelopePreview = mergeEnvelopePreview(undefined, "openai.chat.completions", extracted.envelopePreview);
    }
  }

  const parseContext = {
    provider,
    model: config.ai.model,
    requestId,
    responseSource,
    responseEnvelopePreview,
    exchangeTranscript: exchangeTranscript.join("\n\n====================\n\n")
  };
  const result = method === "subtitle"
    ? calculateSubtitleFinalProbability(parseSubtitleAiResponse(responseText, parseContext), config)
    : calculateDanmakuFinalProbability(parseAiResponse(responseText, parseContext), config);
  result.rawResponse = responseText;
  return {
    result,
    rawResponse: responseText
  };
}

export interface VideoAnalysisService {
  analyzeVideo(payload: BackgroundAnalyzeVideoPayload, config: ExtensionConfig): Promise<VideoAnalysisResult>;
  cancelAnalysisRequest(requestId: string): boolean;
  fetchModels(provider: AIProvider, config: ExtensionConfig): Promise<string[]>;
}

export function createVideoAnalysisService(
  client: HttpClient,
  ensureOriginAccess?: EnsureOriginAccess
): VideoAnalysisService {
  const activeControllers = new Map<string, AbortController>();

  const createController = (requestId: string): AbortSignal => {
    const controller = new AbortController();
    activeControllers.set(requestId, controller);
    return controller.signal;
  };

  const cleanupRequest = (requestId: string): void => {
    activeControllers.delete(requestId);
  };

  return {
    cancelAnalysisRequest(requestId) {
      const controller = activeControllers.get(requestId);
      if (!controller) {
        return false;
      }

      controller.abort();
      activeControllers.delete(requestId);
      return true;
    },
    async fetchModels(provider, config) {
      return fetchModelsWithClient(client, provider, config, ensureOriginAccess);
    },
    async analyzeVideo(payload, config) {
      const signal = createController(payload.requestId);
      const timeoutId = setTimeout(() => {
        const controller = activeControllers.get(payload.requestId);
        controller?.abort();
        activeControllers.delete(payload.requestId);
      }, config.ai.requestTimeoutMs);

      try {
        const pageIndex = payload.pageIndex ?? 1;
        let subtitleUnavailableReason = "";

        if (config.video.subtitleAnalysisEnabled) {
          let subtitleTextReady = false;
          try {
            const info = await fetchVideoInfoByBvid(client, payload.bvid);
            const cid = getPageCid(info, pageIndex);
            const tracks = await fetchSubtitleTracks(client, {
              aid: info.aid,
              bvid: payload.bvid,
              cid
            });
            const selectedTrack = selectBestSubtitleTrack(tracks);

            if (!selectedTrack) {
              subtitleUnavailableReason = "没有可用字幕轨道。";
            } else {
              const cues = await fetchSubtitleJson(client, selectedTrack.subtitleUrl);
              const transcript = subtitleCuesToTimedText(cues, config);
              if (!transcript.text) {
                subtitleUnavailableReason = "字幕正文为空。";
              } else {
                subtitleTextReady = true;
                const { result, rawResponse } = await callAiProvider(
                  client,
                  ensureOriginAccess,
                  config,
                  "subtitle",
                  config.ai.subtitlePrompt,
                  transcript.text,
                  payload.topComment,
                  payload.requestId,
                  signal
                );
                return {
                  ...result,
                  subtitleCueCount: transcript.count,
                  subtitleTrack: selectedTrack,
                  rawResponse
                };
              }
            }
          } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
              throw error;
            }
            if (subtitleTextReady) {
              throw error;
            }
            subtitleUnavailableReason = error instanceof Error ? error.message : String(error);
          }
        }

        if (!config.video.danmakuAnalysisEnabled) {
          return createNoAnalysisResult(
            subtitleUnavailableReason
              ? `字幕识别不可用：${subtitleUnavailableReason} 弹幕识别当前未开启。`
              : "字幕识别未开启，弹幕识别当前未开启。"
          );
        }

        const cid = pageIndex > 1
          ? getPageCid(await fetchVideoInfoByBvid(client, payload.bvid), pageIndex)
          : await fetchCidByBvid(client, payload.bvid);
        const xml = await fetchDanmakuXml(client, cid);
        const filtered = filterDanmakuText(xml, config);
        if (!filtered.text) {
          return {
            ...createNoAnalysisResult("过滤后的有效弹幕过少，且没有足够的广告指示信息，已跳过 AI 分析。", "danmaku"),
            danmakuCount: filtered.count
          };
        }

        const { result, rawResponse } = await callAiProvider(
          client,
          ensureOriginAccess,
          config,
          "danmaku",
          config.ai.danmakuPrompt,
          filtered.text,
          payload.topComment,
          payload.requestId,
          signal
        );
        return {
          ...result,
          danmakuCount: filtered.count,
          rawResponse
        };
      } finally {
        clearTimeout(timeoutId);
        cleanupRequest(payload.requestId);
      }
    }
  };
}
