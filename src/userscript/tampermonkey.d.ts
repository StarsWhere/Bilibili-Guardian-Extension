declare function GM_getValue<T>(key: string, defaultValue?: T): T;
declare function GM_setValue<T>(key: string, value: T): void | Promise<void>;
declare function GM_registerMenuCommand(name: string, callback: () => void): void;
declare function GM_addValueChangeListener<T>(
  key: string,
  listener: (name: string, oldValue: T | undefined, newValue: T | undefined, remote: boolean) => void
): number;
declare function GM_removeValueChangeListener(listenerId: number): void;
declare function GM_xmlhttpRequest(details: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: string;
  onload(response: { status: number; responseText: string }): void;
  onerror(error: unknown): void;
  ontimeout(error: unknown): void;
}): { abort(): void };
