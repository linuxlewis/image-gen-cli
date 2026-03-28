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

async function readErrorBody(response: Response): Promise<string | undefined> {
  try {
    const bodyText = await response.text();
    const normalizedBody = bodyText.trim();

    return normalizedBody.length > 0 ? normalizedBody : undefined;
  } catch {
    return undefined;
  }
}

function isJsonBody(value: HttpJsonRequestOptions["body"]): value is JsonBody {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof ArrayBuffer) &&
    !(value instanceof Blob) &&
    !(value instanceof FormData) &&
    !(value instanceof URLSearchParams) &&
    !(value instanceof ReadableStream)
  );
}

function normalizeJsonRequest(init: HttpJsonRequestOptions = {}): HttpRequestOptions {
  const { body, ...rest } = init;

  if (!isJsonBody(body)) {
    return {
      ...rest,
      ...(body === undefined ? {} : { body }),
    };
  }

  const headers = new Headers(init.headers);

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return {
    ...rest,
    body: JSON.stringify(body),
    headers,
  };
}

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

    const errorBody = await readErrorBody(response);

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
    const response = await request(input, normalizeJsonRequest(init));
    return (await response.json()) as T;
  }

  return {
    request,
    requestJson,
  };
}
