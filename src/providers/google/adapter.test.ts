import { describe, expect, it, vi } from "vitest";

import { ConfigError } from "../../core/errors.js";
import { createHttpClient } from "../../http/client.js";

import {
  buildGoogleGenerateRequest,
  createGoogleProvider,
  normalizeGoogleGenerateResponse,
} from "./adapter.js";

describe("google direct provider adapter", () => {
  it("maps Gemini image generation requests to generateContent", () => {
    expect(
      buildGoogleGenerateRequest(
        {
          aspectRatio: "16:9",
          canonicalModelId: "gemini-2.5-flash-image-preview",
          imageSize: "2K",
          prompt: "A bright studio portrait of a robot chef",
        },
        "google-key",
      ),
    ).toEqual({
      apiMethod: "generateContent",
      body: {
        contents: [
          {
            parts: [{ text: "A bright studio portrait of a robot chef" }],
          },
        ],
        generationConfig: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "2K",
          },
        },
      },
      rawModelId: "gemini-2.5-flash-image-preview",
      requestInit: {
        body: {
          contents: [
            {
              parts: [{ text: "A bright studio portrait of a robot chef" }],
            },
          ],
          generationConfig: {
            imageConfig: {
              aspectRatio: "16:9",
              imageSize: "2K",
            },
          },
        },
        headers: {
          "x-goog-api-key": "google-key",
        },
        method: "POST",
      },
      routeModelId: "gemini-2.5-flash-image-preview",
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent",
    });
  });

  it("maps Imagen requests to predict with Google parameter names", () => {
    expect(
      buildGoogleGenerateRequest(
        {
          aspectRatio: "9:16",
          canonicalModelId: "imagen-4-ultra",
          numberOfImages: 3,
          outputMimeType: "image/jpeg",
          personGeneration: "allow_adult",
          prompt: "A cinematic portrait on 35mm film",
        },
        "google-key",
      ),
    ).toEqual({
      apiMethod: "predict",
      body: {
        instances: [{ prompt: "A cinematic portrait on 35mm film" }],
        parameters: {
          aspectRatio: "9:16",
          outputMimeType: "image/jpeg",
          personGeneration: "allow_adult",
          sampleCount: 3,
        },
      },
      rawModelId: "imagen-4.0-ultra-generate-001",
      requestInit: {
        body: {
          instances: [{ prompt: "A cinematic portrait on 35mm film" }],
          parameters: {
            aspectRatio: "9:16",
            outputMimeType: "image/jpeg",
            personGeneration: "allow_adult",
            sampleCount: 3,
          },
        },
        headers: {
          "x-goog-api-key": "google-key",
        },
        method: "POST",
      },
      routeModelId: "imagen-4.0-ultra-generate-001",
      url: "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-ultra-generate-001:predict",
    });
  });

  it("normalizes Gemini generateContent responses into provider output and preserves raw data", () => {
    const rawResponse = {
      candidates: [
        {
          content: {
            parts: [
              { text: "Refined studio portrait prompt" },
              {
                inlineData: {
                  data: "abc123",
                  mimeType: "image/png",
                },
              },
            ],
          },
        },
      ],
      promptFeedback: {
        blockReason: "SAFETY",
      },
    };

    expect(
      normalizeGoogleGenerateResponse(
        {
          canonicalModelId: "gemini-2.5-flash-image-preview",
          prompt: "A bright studio portrait of a robot chef",
        },
        rawResponse,
      ),
    ).toEqual({
      assets: [
        {
          base64Data: "abc123",
          mimeType: "image/png",
        },
      ],
      canonicalModelId: "gemini-2.5-flash-image-preview",
      model: "gemini-2.5-flash-image-preview",
      provider: "google",
      rawResponse,
      revisedPrompt: "Refined studio portrait prompt",
      routeModelId: "gemini-2.5-flash-image-preview",
      warnings: ["Prompt blocked: SAFETY"],
    });
  });

  it("normalizes Imagen predict responses into provider output and preserves raw data", () => {
    const rawResponse = {
      predictions: [
        {
          bytesBase64Encoded: "image-a",
          mimeType: "image/png",
        },
        {
          bytesBase64Encoded: "image-b",
          raiFilteredReason: "SAFETY",
        },
      ],
    };

    expect(
      normalizeGoogleGenerateResponse(
        {
          canonicalModelId: "imagen-4",
          prompt: "A bright studio portrait of a robot chef",
        },
        rawResponse,
      ),
    ).toEqual({
      assets: [
        {
          base64Data: "image-a",
          mimeType: "image/png",
        },
        {
          base64Data: "image-b",
          mimeType: "image/png",
        },
      ],
      canonicalModelId: "imagen-4",
      model: "imagen-4",
      provider: "google",
      rawResponse,
      routeModelId: "imagen-4.0-generate-001",
      warnings: ["Google safety filter: SAFETY"],
    });
  });

  it("fails clearly for missing GOOGLE_API_KEY only when generateImage is used", async () => {
    const provider = createGoogleProvider({
      env: {},
      httpClient: {
        request: vi.fn(),
        requestJson: vi.fn(),
      },
    });

    expect(provider.supportsCanonicalModel("imagen-4-fast")).toBe(true);

    await expect(
      provider.generateImage({
        canonicalModelId: "imagen-4-fast",
        prompt: "A product photo of a glass bottle",
      }),
    ).rejects.toThrowError(
      new ConfigError("CONFIG_ENV_MISSING", 'Provider "google" requires GOOGLE_API_KEY to be set.'),
    );
  });

  it("executes requests through the shared HTTP client and returns normalized provider output", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            predictions: [{ bytesBase64Encoded: "generated-image" }],
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        ),
    );

    const provider = createGoogleProvider({
      env: { GOOGLE_API_KEY: "google-key" },
      httpClient: createHttpClient({ fetchFn }),
    });

    await expect(
      provider.generateImage({
        canonicalModelId: "imagen-4-fast",
        prompt: "A product photo of a glass bottle",
      }),
    ).resolves.toEqual({
      assets: [{ base64Data: "generated-image", mimeType: "image/png" }],
      canonicalModelId: "imagen-4-fast",
      model: "imagen-4-fast",
      provider: "google",
      rawResponse: {
        predictions: [{ bytesBase64Encoded: "generated-image" }],
      },
      routeModelId: "imagen-4.0-fast-generate-001",
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict",
      expect.objectContaining({
        body: JSON.stringify({
          instances: [{ prompt: "A product photo of a glass bottle" }],
        }),
        headers: expect.any(Headers),
        method: "POST",
      }),
    );

    const firstCall = fetchFn.mock.calls[0] as [unknown, RequestInit | undefined] | undefined;
    expect(firstCall).toBeDefined();

    expect(
      new Headers(firstCall?.[1] ? firstCall[1].headers : undefined).get("x-goog-api-key"),
    ).toBe("google-key");
  });
});
