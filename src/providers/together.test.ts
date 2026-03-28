import { describe, expect, it } from "vitest";

import { ConfigError, HttpError } from "../core/errors.js";
import type { HttpJsonRequestOptions } from "../http/client.js";
import {
  buildTogetherImageGenerationRequest,
  createTogetherProvider,
  getTogetherRouteForCanonicalModel,
  normalizeTogetherImageGenerationResponse,
  supportsTogetherCanonicalModel,
} from "./together.js";

describe("together provider", () => {
  it("detects supported FLUX canonical models through the registry route metadata", () => {
    expect(supportsTogetherCanonicalModel("flux-1-schnell")).toBe(true);
    expect(supportsTogetherCanonicalModel("flux-2-pro")).toBe(true);
    expect(supportsTogetherCanonicalModel("imagen-4")).toBe(false);
  });

  it("maps canonical requests to the Together images payload using route metadata", () => {
    const route = getTogetherRouteForCanonicalModel("flux-1-kontext-pro");

    if (!route) {
      throw new Error("Expected a Together route for flux-1-kontext-pro.");
    }

    expect(
      buildTogetherImageGenerationRequest(
        route,
        {
          canonicalModelId: "flux-1-kontext-pro",
          imageCount: 2,
          outputFormat: "png",
          prompt: "editorial portrait",
          size: "1536x1024",
        },
        "tg-test",
      ),
    ).toEqual({
      body: {
        height: 1024,
        model: "black-forest-labs/FLUX.1-kontext-pro",
        n: 2,
        output_format: "png",
        prompt: "editorial portrait",
        width: 1536,
      },
      headers: {
        authorization: "Bearer tg-test",
      },
      method: "POST",
      url: "https://api.together.xyz/v1/images/generations",
    });
  });

  it("rejects webp because Together only supports png and jpeg output", () => {
    const route = getTogetherRouteForCanonicalModel("flux-2-flex");

    if (!route) {
      throw new Error("Expected a Together route for flux-2-flex.");
    }

    expect(() =>
      buildTogetherImageGenerationRequest(
        route,
        {
          canonicalModelId: "flux-2-flex",
          outputFormat: "webp",
          prompt: "replace the packaging with a matte black box",
        },
        "tg-test",
      ),
    ).toThrowError('Together does not support output format "webp".');
  });

  it("fails clearly for missing TOGETHER_API_KEY when the adapter is created", () => {
    expect(supportsTogetherCanonicalModel("flux-1-schnell")).toBe(true);

    expect(() => createTogetherProvider({ env: {} })).toThrowError(
      new ConfigError(
        "CONFIG_ENV_MISSING",
        'Provider "together" requires TOGETHER_API_KEY to be set.',
      ),
    );
  });

  it("normalizes Together image responses while preserving the raw response", () => {
    const route = getTogetherRouteForCanonicalModel("flux-2-pro");

    if (!route) {
      throw new Error("Expected a Together route for flux-2-pro.");
    }

    const rawResponse = {
      data: [
        {
          b64_json: "abc123",
          index: 0,
          type: "image/png",
        },
        {
          index: 1,
          url: "https://cdn.example.com/flux.png",
        },
        {
          index: 2,
        },
      ],
      id: "resp_123",
      model: "black-forest-labs/FLUX.2-pro",
      warnings: ["provider-side safety filters modified the prompt"],
    };

    expect(normalizeTogetherImageGenerationResponse(route, rawResponse)).toEqual({
      assets: [
        {
          base64Data: "abc123",
          filename: "flux-2-pro-1",
          mimeType: "image/png",
        },
        {
          filename: "flux-2-pro-2",
          url: "https://cdn.example.com/flux.png",
        },
      ],
      canonicalModelId: "flux-2-pro",
      model: "flux-2-pro",
      provider: "together",
      rawResponse,
      routeModelId: "black-forest-labs/FLUX.2-pro",
      warnings: ["provider-side safety filters modified the prompt"],
    });
  });

  it("executes requests through the shared http client contract", async () => {
    const provider = createTogetherProvider({
      env: { TOGETHER_API_KEY: "tg-live" },
      httpClient: {
        request: async () => {
          throw new Error("not used");
        },
        requestJson: async <T>(input: string | URL, init?: HttpJsonRequestOptions) => {
          expect(input).toBe("https://api.together.xyz/v1/images/generations");
          expect(init).toEqual({
            body: {
              model: "black-forest-labs/FLUX.2-dev",
              prompt: "A cinematic landscape",
            },
            headers: {
              authorization: "Bearer tg-live",
            },
            method: "POST",
          });

          return {
            data: [{ b64_json: "xyz", type: "image/jpeg" }],
            id: "resp_live",
          } as T;
        },
      },
    });

    await expect(
      provider.generateImage({
        canonicalModelId: "flux-2-dev",
        prompt: "A cinematic landscape",
      }),
    ).resolves.toEqual({
      assets: [
        {
          base64Data: "xyz",
          filename: "flux-2-dev-1",
          mimeType: "image/jpeg",
        },
      ],
      canonicalModelId: "flux-2-dev",
      model: "flux-2-dev",
      provider: "together",
      rawResponse: {
        data: [{ b64_json: "xyz", type: "image/jpeg" }],
        id: "resp_live",
      },
      routeModelId: "black-forest-labs/FLUX.2-dev",
    });
  });

  it("converts Together auth failures into a provider-specific auth error", async () => {
    const provider = createTogetherProvider({
      env: { TOGETHER_API_KEY: "tg-live" },
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
                    message: "Invalid API key.",
                  },
                }),
              },
              method: "POST",
              status: 401,
              statusText: "Unauthorized",
              url: "https://api.together.xyz/v1/images/generations",
            }),
          ) as Promise<T>,
      },
    });

    await expect(
      provider.generateImage({
        canonicalModelId: "flux-1-schnell",
        prompt: "A minimal black-and-white logo sketch",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_AUTH_ERROR",
      details: {
        responseBody: '{"error":{"message":"Invalid API key."}}',
        status: 401,
      },
      message: "Together authentication failed: Invalid API key.",
      provider: "together",
    });
  });
});
