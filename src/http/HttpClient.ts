import { CarrierError } from "../domain/models/Errors.js";

// Wraps Node's fetch with timeout handling and consistent
// error mapping. All external calls go through here.

export interface HttpRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  // When true, body is sent as-is (string) instead of JSON.stringify'd.
  // Used for form-encoded requests like OAuth token exchange.
  rawBody?: boolean;
  timeoutMs?: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
}

export class HttpClient {
  private defaultTimeoutMs: number;

  constructor(defaultTimeoutMs = 10_000) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  async request<T = unknown>(
    options: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    const timeout = options.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const defaultContentType = options.rawBody
        ? "application/x-www-form-urlencoded"
        : "application/json";

      let serializedBody: string | undefined;
      if (options.body != null) {
        serializedBody = options.rawBody
          ? String(options.body)
          : JSON.stringify(options.body);
      }

      const response = await fetch(options.url, {
        method: options.method,
        headers: {
          "Content-Type": defaultContentType,
          ...options.headers,
        },
        body: serializedBody,
        signal: controller.signal,
      });

      // Some error responses are not valid JSON.
      let data: T;
      const text = await response.text();
      try {
        data = JSON.parse(text) as T;
      } catch {
        throw new CarrierError("MALFORMED_RESPONSE", "Response is not valid JSON", {
          statusCode: response.status,
          details: { body: text.slice(0, 500) },
        });
      }

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return { status: response.status, headers, data };
    } catch (err) {
      if (err instanceof CarrierError) throw err;

      if (err instanceof DOMException && err.name === "AbortError") {
        throw new CarrierError("TIMEOUT", `Request timed out after ${timeout}ms`, {
          details: { url: options.url, timeoutMs: timeout },
        });
      }

      // Network failures: DNS, connection refused, etc.
      const message =
        err instanceof Error ? err.message : "Unknown network error";
      throw new CarrierError("NETWORK_ERROR", message, {
        details: { url: options.url },
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
