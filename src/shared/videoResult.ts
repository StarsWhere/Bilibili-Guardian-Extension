import type { VideoAdRange, VideoAnalysisResult } from "./types";

export function createRangeId(method: VideoAnalysisResult["method"] | undefined, start: string, end: string, index: number): string {
  return `${method ?? "legacy"}-${index + 1}-${start.replaceAll(":", "")}-${end.replaceAll(":", "")}`;
}

export function getVideoAdRanges(result: VideoAnalysisResult | null | undefined): VideoAdRange[] {
  if (!result) {
    return [];
  }

  if (Array.isArray(result.ranges)) {
    return result.ranges;
  }

  if (!result.start || !result.end) {
    return [];
  }

  return [
    {
      id: createRangeId(result.method, result.start, result.end, 0),
      start: result.start,
      end: result.end,
      probability: result.probability,
      finalProbability: result.finalProbability,
      note: result.note
    }
  ];
}

export function getTopVideoAdRange(result: VideoAnalysisResult | null | undefined): VideoAdRange | null {
  const ranges = getVideoAdRanges(result);
  if (ranges.length === 0) {
    return null;
  }

  return [...ranges].sort((left, right) => right.finalProbability - left.finalProbability)[0];
}

export function normalizeVideoAnalysisResult(result: VideoAnalysisResult): VideoAnalysisResult {
  const ranges = getVideoAdRanges(result);
  const topRange = getTopVideoAdRange({
    ...result,
    ranges
  });

  return {
    ...result,
    method: result.method ?? (ranges.length > 0 ? "danmaku" : "none"),
    ranges,
    disabledRangeIds: result.disabledRangeIds ?? [],
    probability: topRange?.probability ?? result.probability,
    finalProbability: topRange?.finalProbability ?? result.finalProbability,
    start: topRange?.start ?? result.start,
    end: topRange?.end ?? result.end,
    note: result.note || topRange?.note || "未识别出明确广告片段"
  };
}

export function getEnabledVideoAdRanges(
  result: VideoAnalysisResult | null | undefined,
  probabilityThreshold: number
): VideoAdRange[] {
  if (!result) {
    return [];
  }

  const disabled = new Set(result.disabledRangeIds ?? []);
  return getVideoAdRanges(result).filter(
    (range) => !disabled.has(range.id) && range.finalProbability >= probabilityThreshold
  );
}

export function getTopEnabledVideoAdRange(
  result: VideoAnalysisResult | null | undefined,
  probabilityThreshold: number
): VideoAdRange | null {
  const ranges = getEnabledVideoAdRanges(result, probabilityThreshold);
  if (ranges.length === 0) {
    return null;
  }

  return [...ranges].sort((left, right) => right.finalProbability - left.finalProbability)[0];
}
