import { createErrorWithDetails } from "@/shared/errors";
import type {
  BackgroundEnvelope,
  BackgroundErrorEnvelope,
  BackgroundSuccessEnvelope,
  BackgroundMessageType,
  BackgroundRequest,
  BackgroundResponse
} from "@/shared/types";

export async function sendMessage<K extends BackgroundMessageType>(
  type: K,
  payload: BackgroundRequest<K>
): Promise<BackgroundResponse<K>> {
  const reply = (await chrome.runtime.sendMessage({
    type,
    payload
  } satisfies BackgroundEnvelope<K>)) as BackgroundSuccessEnvelope<K> | BackgroundErrorEnvelope;

  if (!reply.ok) {
    if (reply.details) {
      throw createErrorWithDetails(reply.error || "扩展消息失败", reply.details);
    }

    throw new Error(reply.error || "扩展消息失败");
  }

  return reply.data;
}
