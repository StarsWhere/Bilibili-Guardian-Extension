import { RouteManager } from "@/content/router";

describe("RouteManager", () => {
  let manager: RouteManager | null = null;

  afterEach(() => {
    manager?.stop();
    manager = null;
    window.history.pushState({}, "", "/");
  });

  it("force-refreshes the active module even when the URL is unchanged", async () => {
    window.history.pushState({}, "", "/video/BV1refresh");
    const mount = vi.fn();
    const unmount = vi.fn();

    manager = new RouteManager([
      {
        id: "video",
        match: (url) => url.pathname.startsWith("/video/"),
        mount,
        unmount
      }
    ]);

    manager.start();
    await Promise.resolve();

    expect(mount).toHaveBeenCalledTimes(1);
    expect(unmount).not.toHaveBeenCalled();

    await manager.refresh();

    expect(unmount).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(2);
  });
});
