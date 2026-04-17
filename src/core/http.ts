export interface HttpRequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export interface HttpResponse<T> {
  ok: boolean;
  status: number;
  data: T;
}

export interface HttpClient {
  requestText(url: string, options?: HttpRequestOptions): Promise<HttpResponse<string>>;
  requestJson<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
}

function createAbortError(): Error {
  try {
    return new DOMException("请求已取消", "AbortError");
  } catch {
    const error = new Error("请求已取消");
    error.name = "AbortError";
    return error;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

export function createFetchHttpClient(): HttpClient {
  return {
    async requestText(url: string, options: HttpRequestOptions = {}) {
      const response = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: options.signal
      });

      return {
        ok: response.ok,
        status: response.status,
        data: await response.text()
      };
    },
    async requestJson<T>(url: string, options: HttpRequestOptions = {}) {
      const response = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: options.signal
      });

      return {
        ok: response.ok,
        status: response.status,
        data: await readJson<T>(response)
      };
    }
  };
}

interface GmRequestDetails {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: string;
  onload(response: { status: number; responseText: string }): void;
  onerror(error: unknown): void;
  ontimeout(error: unknown): void;
}

interface GmRequestHandle {
  abort(): void;
}

type GmXmlHttpRequest = (details: GmRequestDetails) => GmRequestHandle;

function parseUnknownError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "请求失败";
}

export function createGmHttpClient(gmXmlHttpRequest: GmXmlHttpRequest): HttpClient {
  const requestText = (url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<string>> =>
    new Promise((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(createAbortError());
        return;
      }

      const abortListener = () => {
        handle.abort();
        reject(createAbortError());
      };

      const cleanup = () => {
        options.signal?.removeEventListener("abort", abortListener);
      };

      const handle = gmXmlHttpRequest({
        url,
        method: options.method ?? "GET",
        headers: options.headers,
        data: options.body,
        onload: (response) => {
          cleanup();
          resolve({
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            data: response.responseText
          });
        },
        onerror: (error) => {
          cleanup();
          reject(new Error(`Tampermonkey 请求失败：${parseUnknownError(error)}`));
        },
        ontimeout: () => {
          cleanup();
          reject(new Error("Tampermonkey 请求超时"));
        }
      });

      options.signal?.addEventListener("abort", abortListener, { once: true });
    });

  return {
    requestText,
    async requestJson<T>(url: string, options: HttpRequestOptions = {}) {
      const response = await requestText(url, options);

      try {
        return {
          ...response,
          data: JSON.parse(response.data) as T
        };
      } catch {
        throw new Error("返回内容不是有效的 JSON");
      }
    }
  };
}
