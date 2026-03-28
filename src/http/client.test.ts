import { describe, expect, it } from "vitest";

import { createHttpClient } from "./client.js";

describe("http client", () => {
  it("serializes object bodies as JSON", async () => {
    const client = createHttpClient({
      fetchFn: async (_input, init) =>
        new Response(JSON.stringify({ method: init?.method, body: init?.body }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
    });

    await expect(
      client.requestJson<{ method: string; body: string }>("https://example.com/images", {
        body: { prompt: "test" },
        method: "POST",
      }),
    ).resolves.toEqual({
      body: '{"prompt":"test"}',
      method: "POST",
    });
  });

  it("passes byte bodies through unchanged without forcing JSON headers", async () => {
    const body = Buffer.from([1, 2, 3, 4]);

    const client = createHttpClient({
      fetchFn: async (_input, init) =>
        new Response(
          JSON.stringify({
            bodyIdentityPreserved: init?.body === body,
            contentType: new Headers(init?.headers).get("content-type"),
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        ),
    });

    await expect(
      client.requestJson<{ bodyIdentityPreserved: boolean; contentType: string | null }>(
        "https://example.com/upload",
        {
          body,
          headers: { "x-test": "bytes" },
          method: "POST",
        },
      ),
    ).resolves.toEqual({
      bodyIdentityPreserved: true,
      contentType: null,
    });
  });

  it("raises an HttpError for non-ok responses", async () => {
    const client = createHttpClient({
      fetchFn: async () =>
        new Response(JSON.stringify({ error: "bad request" }), {
          headers: { "content-type": "application/json" },
          status: 400,
          statusText: "Bad Request",
        }),
    });

    await expect(client.request("https://example.com/images")).rejects.toMatchObject({
      code: "HTTP_ERROR",
      details: { responseBody: '{"error":"bad request"}' },
      method: "GET",
      status: 400,
      statusText: "Bad Request",
      url: "https://example.com/images",
    });
  });

  it("wraps fetch failures as network errors", async () => {
    const client = createHttpClient({
      fetchFn: async () => {
        throw new Error("socket hang up");
      },
    });

    await expect(client.request("https://example.com/images")).rejects.toMatchObject({
      code: "HTTP_NETWORK_ERROR",
      details: { originalError: "socket hang up" },
      method: "GET",
      url: "https://example.com/images",
    });
  });
});
