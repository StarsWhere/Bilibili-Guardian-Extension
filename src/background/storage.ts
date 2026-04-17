import { DEFAULT_CONFIG, mergeConfig } from "@/shared/config";
import type { DeepPartial, ExtensionConfig } from "@/shared/types";

const STORAGE_KEY = "guardian.config";

export async function loadConfig(): Promise<ExtensionConfig> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return mergeConfig(result[STORAGE_KEY] as DeepPartial<ExtensionConfig> | undefined, DEFAULT_CONFIG);
}

export async function saveConfig(patch: DeepPartial<ExtensionConfig>): Promise<ExtensionConfig> {
  const current = await loadConfig();
  const merged = mergeConfig(patch, current);
  await chrome.storage.local.set({ [STORAGE_KEY]: merged });
  return merged;
}
