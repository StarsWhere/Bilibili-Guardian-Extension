export interface RouteContext {
  currentUrl: URL;
}

export interface RouteModule {
  id: string;
  match(url: URL): boolean;
  mount(context: RouteContext): void | Promise<void>;
  unmount(): void | Promise<void>;
}
