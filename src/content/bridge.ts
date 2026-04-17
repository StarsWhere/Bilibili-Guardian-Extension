import type {
  BackgroundEnvelope,
  BackgroundMessageType,
  BackgroundRequest,
  BackgroundResponse
} from "@/shared/types";

interface RuntimeReply<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function sendMessage<K extends BackgroundMessageType>(
  type: K,
  payload: BackgroundRequest<K>
): Promise<BackgroundResponse<K>> {
  const reply = (await chrome.runtime.sendMessage({
    type,
    payload
  } satisfies BackgroundEnvelope<K>)) as RuntimeReply<BackgroundResponse<K>>;

  if (!reply.ok) {
    throw new Error(reply.error || "扩展消息失败");
  }

  return reply.data as BackgroundResponse<K>;
}
