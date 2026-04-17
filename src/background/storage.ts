import { loadConfigFromStore, saveConfigToStore } from "@/core/storage";
import type { DeepPartial, ExtensionConfig } from "@/shared/types";
import { chromeLocalStore } from "./chromeStore";

export async function loadConfig(): Promise<ExtensionConfig> {
  return loadConfigFromStore(chromeLocalStore);
}

export async function saveConfig(patch: DeepPartial<ExtensionConfig>): Promise<ExtensionConfig> {
  return saveConfigToStore(chromeLocalStore, patch);
}
