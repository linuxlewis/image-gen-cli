import { describe, expect, it, vi } from "vitest";

import { ConfigError, ProviderError } from "../core/errors.js";
import type { ModelRoute } from "../core/types.js";
import { createHttpClient } from "../http/client.js";
import { getRouteForCanonicalModelIdAndProvider } from "../registry/routes.js";
import {
  type ReplicatePrediction,
  buildReplicatePredictionSubmission,
  createReplicateProvider,
  isReplicateRouteSupported,
  normalizeReplicateResult,
  pollReplicatePredictionUntilTerminal,
} from "./replicate.js";

function requireRoute(route: ModelRoute | undefined): ModelRoute {
  if (!route) {
    throw new Error("Expected route to be defined.");
  }

  return route;
}

describe("replicate provider", () => {
  it("detects supported replicate routes for planned FLUX models and kling", () => {
    expect(
      isReplicateRouteSupported(
        requireRoute(getRouteForCanonicalModelIdAndProvider("flux-1-schnell", "replicate")),
      ),
    ).toBe(true);
    expect(
      isReplicateRouteSupported(
        requireRoute(getRouteForCanonicalModelIdAndProvider("flux-2-flex", "replicate")),
      ),
    ).toBe(true);
    expect(
      isReplicateRouteSupported(
        requireRoute(getRouteForCanonicalModelIdAndProvider("kling-v1", "replicate")),
      ),
    ).toBe(true);
    expect(
      isReplicateRouteSupported(
        requireRoute(getRouteForCanonicalModelIdAndProvider("flux-2-pro", "together")),
      ),
    ).toBe(false);
  });

  it("translates FLUX requests into Replicate prediction submissions", () => {
    const route = requireRoute(
      getRouteForCanonicalModelIdAndProvider("flux-1-kontext-pro", "replicate"),
    );

    expect(
      buildReplicatePredictionSubmission(
        route,
        {
          canonicalModelId: "flux-1-kontext-pro",
          prompt: "Turn this into a rainy cyberpunk alley",
          aspectRatio: "16:9",
          inputImage: "https://example.com/reference.png",
          negativePrompt: "low quality",
          outputFormat: "png",
          seed: 7,
        },
        "r8_token",
      ),
    ).toEqual({
      endpoint:
        "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions",
      headers: expect.any(Headers),
      body: {
        input: {
          prompt: "Turn this into a rainy cyberpunk alley",
          aspect_ratio: "16:9",
          input_image: "https://example.com/reference.png",
          negative_prompt: "low quality",
          output_format: "png",
          seed: 7,
        },
      },
    });
  });

  it("translates Kling requests into Replicate prediction submissions", () => {
    const route = requireRoute(getRouteForCanonicalModelIdAndProvider("kling-v1", "replicate"));

    expect(
      buildReplicatePredictionSubmission(
        route,
        {
          canonicalModelId: "kling-v1",
          prompt: "A drone shot over a snowy mountain range",
          aspectRatio: "16:9",
          durationSeconds: 10,
          inputImage: "https://example.com/first-frame.png",
          negativePrompt: "blurry",
          seed: 99,
        },
        "r8_token",
      ),
    ).toEqual({
      endpoint: "https://api.replicate.com/v1/models/kwaivgi/kling-v1.5-standard/predictions",
      headers: expect.any(Headers),
      body: {
        input: {
          prompt: "A drone shot over a snowy mountain range",
          aspect_ratio: "16:9",
          duration: 10,
          image: "https://example.com/first-frame.png",
          negative_prompt: "blurry",
          seed: 99,
        },
      },
    });
  });

  it("polls predictions until a terminal status and normalizes the result", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "pred_123",
            status: "starting",
            urls: { get: "https://api.replicate.com/v1/predictions/pred_123" },
          }),
          { headers: { "content-type": "application/json" }, status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "pred_123",
            status: "processing",
            urls: { get: "https://api.replicate.com/v1/predictions/pred_123" },
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "pred_123",
            logs: "generation complete",
            metrics: { predict_time: 1.23 },
            model: "black-forest-labs/flux-schnell",
            output: [
              {
                content_type: "image/png",
                file_name: "flux.png",
                url: "https://cdn.replicate.delivery/flux.png",
              },
            ],
            status: "succeeded",
            urls: { get: "https://api.replicate.com/v1/predictions/pred_123" },
            version: "ver_flux",
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
      );

    const provider = createReplicateProvider({
      httpClient: createHttpClient({ fetchFn }),
      pollIntervalMs: 0,
      sleep: async () => {},
    });

    await expect(
      provider.generate(
        {
          canonicalModelId: "flux-1-schnell",
          prompt: "A neon hummingbird in flight",
          outputFormat: "png",
        },
        { env: { REPLICATE_API_TOKEN: "r8_token" } },
      ),
    ).resolves.toEqual({
      assets: [
        {
          filename: "flux.png",
          mimeType: "image/png",
          url: "https://cdn.replicate.delivery/flux.png",
        },
      ],
      model: "flux-1-schnell",
      provider: "replicate",
      providerMetadata: {
        prediction: expect.objectContaining({
          id: "pred_123",
          logs: "generation complete",
          metrics: { predict_time: 1.23 },
          model: "black-forest-labs/flux-schnell",
          status: "succeeded",
          version: "ver_flux",
        }),
        route: {
          canonicalModelId: "flux-1-schnell",
          rawModelId: "flux-schnell",
          routeModelId: "black-forest-labs/flux-schnell",
          versionId: undefined,
        },
      },
    });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
    });
    expect(new Headers(fetchFn.mock.calls[0]?.[1]?.headers).get("authorization")).toBe(
      "Bearer r8_token",
    );
  });

  it("surfaces prediction failures with raw prediction metadata", async () => {
    const terminalPrediction = await pollReplicatePredictionUntilTerminal(
      {
        id: "pred_failed",
        status: "failed",
        error: "model crashed",
      },
      {
        headers: new Headers(),
        httpClient: {
          request: vi.fn(),
          requestJson: vi.fn(),
        },
        pollIntervalMs: 0,
        sleep: async () => {},
      },
    );

    expect(() =>
      normalizeReplicateResult(
        requireRoute(getRouteForCanonicalModelIdAndProvider("flux-2-dev", "replicate")),
        terminalPrediction,
      ),
    ).not.toThrow();

    const provider = createReplicateProvider({
      httpClient: createHttpClient({
        fetchFn: async () =>
          new Response(
            JSON.stringify({
              error: "model crashed",
              id: "pred_failed",
              status: "failed",
            }),
            { headers: { "content-type": "application/json" }, status: 201 },
          ),
      }),
      pollIntervalMs: 0,
      sleep: async () => {},
    });

    await expect(
      provider.generate(
        {
          canonicalModelId: "flux-2-dev",
          prompt: "A brutalist house in fog",
        },
        { env: { REPLICATE_API_TOKEN: "r8_token" } },
      ),
    ).rejects.toMatchObject({
      code: "PROVIDER_PREDICTION_FAILED",
      details: {
        error: "model crashed",
        prediction: expect.objectContaining({
          id: "pred_failed",
          status: "failed",
        }),
      },
    });
  });

  it("fails clearly when the Replicate API token is missing", async () => {
    const provider = createReplicateProvider();

    await expect(
      provider.generate(
        {
          canonicalModelId: "flux-2-pro",
          prompt: "An abstract glass sculpture",
        },
        { env: {} },
      ),
    ).rejects.toThrowError(
      new ConfigError(
        "CONFIG_ENV_MISSING",
        'Provider "replicate" requires REPLICATE_API_TOKEN to be set.',
      ),
    );
  });

  it("rejects unsupported canonical models before making requests", async () => {
    const provider = createReplicateProvider();

    await expect(
      provider.generate(
        {
          canonicalModelId: "gpt-image-1",
          prompt: "A portrait",
        },
        { env: { REPLICATE_API_TOKEN: "r8_token" } },
      ),
    ).rejects.toThrowError(
      new ProviderError(
        "PROVIDER_UNSUPPORTED_MODEL",
        'Replicate does not support canonical model "gpt-image-1".',
      ),
    );
  });
});
