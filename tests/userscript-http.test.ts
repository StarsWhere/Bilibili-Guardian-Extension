import { createGmHttpClient } from "@/core/http";

describe("createGmHttpClient", () => {
  it("parses JSON responses from GM_xmlhttpRequest", async () => {
    const gmRequest = vi.fn((details: {
      onload(response: { status: number; responseText: string }): void;
    }) => {
      details.onload({
        status: 200,
        responseText: JSON.stringify({
          data: [{ id: "custom-model" }]
        })
      });

      return {
        abort() {
          return undefined;
        }
      };
    });

    const client = createGmHttpClient(gmRequest);
    const response = await client.requestJson<{ data: Array<{ id: string }> }>("https://example.com/models");

    expect(response.ok).toBe(true);
    expect(response.data.data[0]?.id).toBe("custom-model");
  });

  it("maps GM_xmlhttpRequest failures to readable errors", async () => {
    const gmRequest = vi.fn((details: {
      onerror(error: unknown): void;
    }) => {
      details.onerror(new Error("network denied"));
      return {
        abort() {
          return undefined;
        }
      };
    });

    const client = createGmHttpClient(gmRequest);

    await expect(client.requestText("https://example.com/fail")).rejects.toThrow("Tampermonkey 请求失败");
  });

  it("aborts pending requests when the signal is cancelled", async () => {
    let aborted = false;
    const gmRequest = vi.fn(() => ({
      abort() {
        aborted = true;
      }
    }));

    const client = createGmHttpClient(gmRequest);
    const controller = new AbortController();
    const promise = client.requestText("https://example.com/slow", {
      signal: controller.signal
    });

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(aborted).toBe(true);
  });
});
