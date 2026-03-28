import { describe, expect, it } from "vitest";

import { ConfigError, HttpError } from "../core/errors.js";
import type { HttpJsonRequestOptions } from "../http/client.js";
import {
  buildOpenAiImageGenerationRequest,
  createOpenAiProvider,
  getOpenAiRouteForCanonicalModel,
  normalizeOpenAiImageGenerationResponse,
  supportsOpenAiCanonicalModel,
} from "./openai.js";

describe("openai provider", () => {
  it("detects supported canonical models through the registry route metadata", () => {
    expect(supportsOpenAiCanonicalModel("gpt-image-1.5")).toBe(true);
    expect(supportsOpenAiCanonicalModel("gpt-image-1")).toBe(true);
    expect(supportsOpenAiCanonicalModel("gpt-image-1-mini")).toBe(true);
    expect(supportsOpenAiCanonicalModel("flux-1-schnell")).toBe(false);
  });

  it("maps canonical requests to the OpenAI images payload using route metadata", () => {
    const route = getOpenAiRouteForCanonicalModel("gpt-image-1-mini");

    if (!route) {
      throw new Error("Expected an OpenAI route for gpt-image-1-mini.");
    }

    expect(
      buildOpenAiImageGenerationRequest(
        route,
        {
          background: "transparent",
          canonicalModelId: "gpt-image-1-mini",
          imageCount: 2,
          outputCompression: 80,
          outputFormat: "webp",
          prompt: "A studio product photo of a glass bottle",
          quality: "high",
          size: "1536x1024",
          user: "user-123",
        },
        "sk-test",
      ),
    ).toEqual({
      body: {
        background: "transparent",
        model: "gpt-image-1-mini",
        n: 2,
        output_compression: 80,
        output_format: "webp",
        prompt: "A studio product photo of a glass bottle",
        quality: "high",
        size: "1536x1024",
        user: "user-123",
      },
      headers: {
        authorization: "Bearer sk-test",
      },
      method: "POST",
      url: "https://api.openai.com/v1/images/generations",
    });
  });

  it("fails clearly for missing OPENAI_API_KEY only when the adapter is created", () => {
    expect(supportsOpenAiCanonicalModel("gpt-image-1")).toBe(true);

    expect(() => createOpenAiProvider({ env: {} })).toThrowError(
      new ConfigError("CONFIG_ENV_MISSING", 'Provider "openai" requires OPENAI_API_KEY to be set.'),
    );
  });

  it("normalizes OpenAI image responses while preserving the raw response", () => {
    const route = getOpenAiRouteForCanonicalModel("gpt-image-1");

    if (!route) {
      throw new Error("Expected an OpenAI route for gpt-image-1.");
    }

    const rawResponse = {
      created: 1_742_000_000,
      data: [
        {
          b64_json: "abc123",
          revised_prompt: "A polished studio portrait",
        },
        {
          url: "https://cdn.example.com/image-2.png",
        },
      ],
      output_format: "png" as const,
      quality: "medium" as const,
      usage: {
        input_tokens: 120,
        input_tokens_details: {
          image_tokens: 20,
          text_tokens: 100,
        },
        output_tokens: 340,
        total_tokens: 460,
      },
    };

    expect(normalizeOpenAiImageGenerationResponse(route, rawResponse)).toEqual({
      assets: [
        {
          base64Data: "abc123",
          mimeType: "image/png",
        },
        {
          mimeType: "image/png",
          url: "https://cdn.example.com/image-2.png",
        },
      ],
      canonicalModelId: "gpt-image-1",
      createdAt: 1_742_000_000,
      model: "gpt-image-1",
      outputFormat: "png",
      provider: "openai",
      quality: "medium",
      rawResponse,
      revisedPrompt: "A polished studio portrait",
      routeModelId: "gpt-image-1",
      usage: {
        inputTokens: 120,
        inputTokensDetails: {
          imageTokens: 20,
          textTokens: 100,
        },
        outputTokens: 340,
        totalTokens: 460,
      },
    });
  });

  it("executes requests through the shared http client contract", async () => {
    const provider = createOpenAiProvider({
      env: { OPENAI_API_KEY: "sk-live" },
      httpClient: {
        request: async () => {
          throw new Error("not used");
        },
        requestJson: async <T>(input: string | URL, init?: HttpJsonRequestOptions) => {
          expect(input).toBe("https://api.openai.com/v1/images/generations");
          expect(init).toEqual({
            body: {
              model: "gpt-image-1.5",
              prompt: "A cinematic landscape",
              quality: "low",
            },
            headers: {
              authorization: "Bearer sk-live",
            },
            method: "POST",
          });

          return {
            created: 1_742_000_001,
            data: [{ b64_json: "xyz" }],
            output_format: "jpeg" as const,
            quality: "low" as const,
          } as T;
        },
      },
    });

    await expect(
      provider.generateImage({
        canonicalModelId: "gpt-image-1.5",
        prompt: "A cinematic landscape",
        quality: "low",
      }),
    ).resolves.toEqual({
      assets: [{ base64Data: "xyz", mimeType: "image/jpeg" }],
      canonicalModelId: "gpt-image-1.5",
      createdAt: 1_742_000_001,
      model: "gpt-image-1.5",
      outputFormat: "jpeg",
      provider: "openai",
      quality: "low",
      rawResponse: {
        created: 1_742_000_001,
        data: [{ b64_json: "xyz" }],
        output_format: "jpeg",
        quality: "low",
      },
      routeModelId: "gpt-image-1.5",
    });
  });

  it("converts OpenAI auth failures into a provider-specific auth error", async () => {
    const provider = createOpenAiProvider({
      env: { OPENAI_API_KEY: "sk-live" },
      httpClient: {
        request: async () => {
          throw new Error("not used");
        },
        requestJson: async <T>() =>
          Promise.reject(
            new HttpError("HTTP_ERROR", "HTTP 401 Unauthorized", {
              details: {
                responseBody: JSON.stringify({
                  error: {
                    message: "Incorrect API key provided.",
                  },
                }),
              },
              method: "POST",
              status: 401,
              statusText: "Unauthorized",
              url: "https://api.openai.com/v1/images/generations",
            }),
          ) as Promise<T>,
      },
    });

    await expect(
      provider.generateImage({
        canonicalModelId: "gpt-image-1",
        prompt: "A minimal black-and-white logo sketch",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_AUTH_ERROR",
      details: {
        responseBody: '{"error":{"message":"Incorrect API key provided."}}',
        status: 401,
      },
      message: "OpenAI authentication failed: Incorrect API key provided.",
      provider: "openai",
    });
  });
});
