import { describe, expect, it, vi } from "vitest";

import { ConfigError, HttpError, ProviderAuthError, ProviderError } from "../core/errors.js";
import type { ModelRoute } from "../core/types.js";
import { createHttpClient } from "../http/client.js";
import { getRouteForCanonicalModelIdAndProvider } from "../registry/routes.js";
import {
  type ReplicatePrediction,
  buildReplicatePredictionSubmission,
  createReplicateProvider,
  normalizeReplicateResult,
  pollReplicatePredictionUntilTerminal,
  supportsReplicateCanonicalModel,
} from "./replicate.js";

function requireRoute(route: ModelRoute | undefined): ModelRoute {
  if (!route) {
    throw new Error("Expected route to be defined.");
  }

  return route;
}

describe("replicate provider", () => {
  it("detects supported canonical models through the registry route metadata", () => {
    expect(supportsReplicateCanonicalModel("flux-1-schnell")).toBe(true);
    expect(supportsReplicateCanonicalModel("flux-2-flex")).toBe(true);
    expect(supportsReplicateCanonicalModel("kling-v1")).toBe(true);
    expect(supportsReplicateCanonicalModel("gpt-image-1")).toBe(false);
  });

  it("maps route-specific Replicate payloads to the current model schemas", () => {
    const fluxKontextRoute = requireRoute(
      getRouteForCanonicalModelIdAndProvider("flux-1-kontext-pro", "replicate"),
    );
    const flux2Route = requireRoute(
      getRouteForCanonicalModelIdAndProvider("flux-2-pro", "replicate"),
    );
    const klingRoute = requireRoute(
      getRouteForCanonicalModelIdAndProvider("kling-v1", "replicate"),
    );

    expect(
      buildReplicatePredictionSubmission(
        fluxKontextRoute,
        {
          canonicalModelId: "flux-1-kontext-pro",
          prompt: "Turn this into a rainy cyberpunk alley",
          aspectRatio: "16:9",
          inputImage: "https://example.com/reference.png",
          negativePrompt: "ignored by schema",
          outputCompression: 60,
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
          output_format: "png",
          seed: 7,
        },
      },
    });

    expect(
      buildReplicatePredictionSubmission(
        flux2Route,
        {
          canonicalModelId: "flux-2-pro",
          prompt: "A moody product render",
          aspectRatio: "3:2",
          inputImage: "https://example.com/reference.png",
          outputCompression: 72,
          outputFormat: "jpeg",
          seed: 11,
        },
        "r8_token",
      ),
    ).toEqual({
      endpoint: "https://api.replicate.com/v1/models/black-forest-labs/flux-2-pro/predictions",
      headers: expect.any(Headers),
      body: {
        input: {
          prompt: "A moody product render",
          aspect_ratio: "3:2",
          input_images: ["https://example.com/reference.png"],
          output_format: "jpg",
          output_quality: 72,
          seed: 11,
        },
      },
    });

    expect(
      buildReplicatePredictionSubmission(
        klingRoute,
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
          negative_prompt: "blurry",
          start_image: "https://example.com/first-frame.png",
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
            created_at: "2026-03-28T21:45:00Z",
            id: "pred_123",
            input: {
              output_format: "jpg",
            },
            status: "starting",
          }),
          { headers: { "content-type": "application/json" }, status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "pred_123",
            status: "processing",
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            created_at: "2026-03-28T21:45:00Z",
            id: "pred_123",
            input: {
              output_format: "jpg",
            },
            logs: "generation complete",
            metrics: { predict_time: 1.23 },
            model: "black-forest-labs/flux-schnell",
            output: [
              {
                content_type: "image/jpeg",
                file_name: "flux.jpg",
                url: "https://cdn.replicate.delivery/flux.jpg",
              },
            ],
            status: "succeeded",
            version: "ver_flux",
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
      );

    const provider = createReplicateProvider({
      apiBaseUrl: "https://replicate.example/v1",
      env: { REPLICATE_API_TOKEN: "r8_token" },
      httpClient: createHttpClient({ fetchFn }),
      pollIntervalMs: 0,
      sleep: async () => {},
    });

    await expect(
      provider.generateImage({
        canonicalModelId: "flux-1-schnell",
        outputCompression: 80,
        outputFormat: "jpeg",
        prompt: "A neon hummingbird in flight",
      }),
    ).resolves.toEqual({
      assets: [
        {
          filename: "flux.jpg",
          mimeType: "image/jpeg",
          url: "https://cdn.replicate.delivery/flux.jpg",
        },
      ],
      canonicalModelId: "flux-1-schnell",
      createdAt: Date.parse("2026-03-28T21:45:00Z"),
      model: "flux-1-schnell",
      outputFormat: "jpeg",
      provider: "replicate",
      rawResponse: {
        created_at: "2026-03-28T21:45:00Z",
        id: "pred_123",
        input: {
          output_format: "jpg",
        },
        logs: "generation complete",
        metrics: { predict_time: 1.23 },
        model: "black-forest-labs/flux-schnell",
        output: [
          {
            content_type: "image/jpeg",
            file_name: "flux.jpg",
            url: "https://cdn.replicate.delivery/flux.jpg",
          },
        ],
        status: "succeeded",
        version: "ver_flux",
      },
      routeModelId: "black-forest-labs/flux-schnell",
    });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "https://replicate.example/v1/models/black-forest-labs/flux-schnell/predictions",
    );
    expect(fetchFn.mock.calls[1]?.[0]).toBe("https://replicate.example/v1/predictions/pred_123");
    expect(new Headers(fetchFn.mock.calls[0]?.[1]?.headers).get("authorization")).toBe(
      "Bearer r8_token",
    );
  });

  it("uses the configured apiBaseUrl for polling when the prediction omits urls.get", async () => {
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        id: "pred_custom",
        status: "processing",
      } satisfies ReplicatePrediction)
      .mockResolvedValueOnce({
        id: "pred_custom",
        status: "succeeded",
      } satisfies ReplicatePrediction);

    await expect(
      pollReplicatePredictionUntilTerminal(
        {
          id: "pred_custom",
          status: "starting",
        },
        {
          apiBaseUrl: "https://replicate.example/v1",
          headers: new Headers({ authorization: "Bearer r8_token" }),
          httpClient: {
            request: vi.fn(),
            requestJson,
          },
          pollIntervalMs: 0,
          sleep: async () => {},
        },
      ),
    ).resolves.toEqual({
      id: "pred_custom",
      status: "succeeded",
    });

    expect(requestJson).toHaveBeenCalledWith(
      "https://replicate.example/v1/predictions/pred_custom",
      {
        headers: expect.any(Headers),
        method: "GET",
      },
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
      env: { REPLICATE_API_TOKEN: "r8_token" },
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
      provider.generateImage({
        canonicalModelId: "flux-2-dev",
        prompt: "A brutalist house in fog",
      }),
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

  it("fails clearly when the Replicate API token is missing", () => {
    expect(supportsReplicateCanonicalModel("flux-2-pro")).toBe(true);

    expect(() => createReplicateProvider({ env: {} })).toThrowError(
      new ConfigError(
        "CONFIG_ENV_MISSING",
        'Provider "replicate" requires REPLICATE_API_TOKEN to be set.',
      ),
    );
  });

  it("rejects unsupported canonical models before making requests", async () => {
    const provider = createReplicateProvider({
      env: { REPLICATE_API_TOKEN: "r8_token" },
    });

    await expect(
      provider.generateImage({
        canonicalModelId: "gpt-image-1",
        prompt: "A portrait",
      }),
    ).rejects.toThrowError(
      new ProviderError(
        "PROVIDER_UNSUPPORTED_MODEL",
        'Replicate does not support canonical model "gpt-image-1".',
      ),
    );
  });

  it("converts Replicate auth failures into a provider-specific auth error", async () => {
    const provider = createReplicateProvider({
      env: { REPLICATE_API_TOKEN: "r8_token" },
      httpClient: {
        request: async () => {
          throw new Error("not used");
        },
        requestJson: async <T>() =>
          Promise.reject(
            new HttpError("HTTP_ERROR", "HTTP 401 Unauthorized", {
              details: {
                responseBody: JSON.stringify({
                  detail: "Invalid token.",
                }),
              },
              method: "POST",
              status: 401,
              statusText: "Unauthorized",
              url: "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
            }),
          ) as Promise<T>,
      },
    });

    await expect(
      provider.generateImage({
        canonicalModelId: "flux-1-schnell",
        prompt: "A desert landscape",
      }),
    ).rejects.toThrowError(
      new ProviderAuthError("replicate", "Replicate authentication failed: Invalid token.", {
        details: {
          responseBody: '{"detail":"Invalid token."}',
          status: 401,
        },
      }),
    );
  });
});
