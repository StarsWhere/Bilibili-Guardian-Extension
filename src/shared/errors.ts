import type { VideoAnalysisErrorDetails } from "./types";

export interface ErrorWithVideoAnalysisDetails extends Error {
  details?: VideoAnalysisErrorDetails;
}

function isVideoAnalysisErrorDetails(input: unknown): input is VideoAnalysisErrorDetails {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Partial<VideoAnalysisErrorDetails>;
  return typeof candidate.requestId === "string" &&
    typeof candidate.provider === "string" &&
    typeof candidate.model === "string" &&
    typeof candidate.stage === "string" &&
    typeof candidate.code === "string" &&
    typeof candidate.parserMessage === "string" &&
    typeof candidate.responsePreview === "string" &&
    typeof candidate.responseSource === "string" &&
    typeof candidate.responseLength === "number" &&
    typeof candidate.suggestion === "string" &&
    (candidate.responseEnvelopePreview === undefined || typeof candidate.responseEnvelopePreview === "string") &&
    (candidate.exchangeTranscript === undefined || typeof candidate.exchangeTranscript === "string");
}

export function createErrorWithDetails(message: string, details: VideoAnalysisErrorDetails): ErrorWithVideoAnalysisDetails {
  const error = new Error(message) as ErrorWithVideoAnalysisDetails;
  error.name = "VideoAnalysisError";
  error.details = details;
  return error;
}

export function getVideoAnalysisErrorDetails(error: unknown): VideoAnalysisErrorDetails | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const details = (error as ErrorWithVideoAnalysisDetails).details;
  return isVideoAnalysisErrorDetails(details) ? details : null;
}
