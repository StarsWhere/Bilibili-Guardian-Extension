import type { RouteModule } from "@/shared/router";

export class RouteManager {
  private currentModule: RouteModule | null = null;
  private currentUrl = new URL(window.location.href);
  private unlisten: (() => void) | null = null;

  constructor(private readonly modules: RouteModule[]) {}

  start(): void {
    this.handleUrlChange(new URL(window.location.href));
    this.unlisten = observeUrlChanges((url) => this.handleUrlChange(url));
  }

  async refresh(): Promise<void> {
    await this.handleUrlChange(new URL(window.location.href), true);
  }

  stop(): void {
    this.unlisten?.();
    this.unlisten = null;
    void this.currentModule?.unmount();
    this.currentModule = null;
  }

  private async handleUrlChange(nextUrl: URL, force = false): Promise<void> {
    if (!force && nextUrl.href === this.currentUrl.href && this.currentModule) {
      return;
    }

    this.currentUrl = nextUrl;
    const matched = this.modules.find((module) => module.match(nextUrl)) ?? null;

    if (this.currentModule && this.currentModule !== matched) {
      await this.currentModule.unmount();
    }

    if (matched && this.currentModule !== matched) {
      this.currentModule = matched;
      await matched.mount({ currentUrl: nextUrl });
      return;
    }

    if (matched && this.currentModule === matched) {
      await matched.unmount();
      await matched.mount({ currentUrl: nextUrl });
      return;
    }

    this.currentModule = null;
  }
}

function observeUrlChanges(onChange: (url: URL) => void): () => void {
  const wrapHistory =
    <K extends "pushState" | "replaceState">(key: K) =>
    () => {
      const original = window.history[key];
      window.history[key] = function (this: History, ...args: Parameters<History[K]>) {
        const result = original.apply(this, args);
        onChange(new URL(window.location.href));
        return result;
      } as History[K];
      return () => {
        window.history[key] = original;
      };
    };

  const restorePush = wrapHistory("pushState")();
  const restoreReplace = wrapHistory("replaceState")();
  const handler = () => onChange(new URL(window.location.href));
  window.addEventListener("popstate", handler);
  window.addEventListener("hashchange", handler);

  return () => {
    restorePush();
    restoreReplace();
    window.removeEventListener("popstate", handler);
    window.removeEventListener("hashchange", handler);
  };
}
