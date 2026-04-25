import { submitFeedFeedbackWithClient } from "@/core/feedFeedback";
import { createFetchHttpClient } from "@/core/http";
import type { FeedFeedbackPayload, FeedFeedbackResult } from "@/shared/types";

export async function submitFeedFeedback(payload: FeedFeedbackPayload): Promise<FeedFeedbackResult> {
  return submitFeedFeedbackWithClient(createFetchHttpClient(), payload);
}
