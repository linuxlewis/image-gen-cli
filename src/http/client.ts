import { HttpError } from "../core/errors.js";

export type FetchLike = typeof fetch;
type RequestBody = Exclude<RequestInit["body"], undefined>;
type RequestHeaders = NonNullable<RequestInit["headers"]>;
type JsonBody = Record<string, unknown> | readonly unknown[];

export type HttpRequestOptions = Omit<RequestInit, "body" | "headers" | "method"> & {
  body?: RequestBody | null;
  headers?: RequestHeaders;
  method?: string;
};

export type HttpJsonRequestOptions = Omit<HttpRequestOptions, "body"> & {
  body?: JsonBody | RequestBody | null;
};

export type HttpClient = {
  request: (input: string | URL, init?: HttpRequestOptions) => Promise<Response>;
  requestJson: <T>(input: string | URL, init?: HttpJsonRequestOptions) => Promise<T>;
};

export type CreateHttpClientOptions = {
  fetchFn?: FetchLike;
};

export function createHttpClient(options: CreateHttpClientOptions = {}): HttpClient {
  const fetchFn = options.fetchFn ?? fetch;

  async function request(input: string | URL, init: HttpRequestOptions = {}): Promise<Response> {
    const method = init.method ?? "GET";
    const url = input instanceof URL ? input.toString() : input;

    let response: Response;

    try {
      response = await fetchFn(url, {
        ...init,
        method,
      });
    } catch (error) {
      throw new HttpError("HTTP_NETWORK_ERROR", `Network request failed for ${method} ${url}.`, {
        cause: error,
        details: { originalError: error instanceof Error ? error.message : String(error) },
        method,
        url,
      });
    }

    if (response.ok) {
      return response;
    }

    let errorBody: string | undefined;

    try {
      errorBody = (await response.text()).trim() || undefined;
    } catch {
      errorBody = undefined;
    }

    throw new HttpError(
      "HTTP_ERROR",
      `HTTP ${response.status} ${response.statusText} for ${method} ${url}.`,
      {
        ...(errorBody ? { details: { responseBody: errorBody } } : {}),
        method,
        status: response.status,
        statusText: response.statusText,
        url,
      },
    );
  }

  async function requestJson<T>(
    input: string | URL,
    init: HttpJsonRequestOptions = {},
  ): Promise<T> {
    const { body, ...rest } = init;

    const shouldSerializeJsonBody =
      typeof body === "object" &&
      body !== null &&
      !(body instanceof ArrayBuffer) &&
      !ArrayBuffer.isView(body) &&
      !(body instanceof Blob) &&
      !(body instanceof FormData) &&
      !(body instanceof URLSearchParams) &&
      !(body instanceof ReadableStream);

    if (!shouldSerializeJsonBody) {
      const response = await request(input, {
        ...rest,
        ...(body === undefined ? {} : { body }),
      });

      return response.json() as Promise<T>;
    }

    const headers = new Headers(init.headers);

    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const response = await request(input, {
      ...rest,
      body: JSON.stringify(body satisfies JsonBody),
      headers,
    });

    return response.json() as Promise<T>;
  }

  return {
    request,
    requestJson,
  };
}
