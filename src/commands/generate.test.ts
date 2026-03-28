import { describe, expect, it, vi } from "vitest";

import { ConfigError } from "../core/errors.js";
import type { ImageGenerationProvider } from "../providers/base.js";
import { runGenerateCommand, selectGenerateRoute } from "./generate.js";

function createProviderMock(): ImageGenerationProvider {
  return {
    generateImage: vi.fn(async (request) => ({
      assets: [
        {
          filename: `${request.canonicalModelId}.png`,
          mimeType: "image/png",
        },
      ],
      canonicalModelId: request.canonicalModelId,
      model: request.canonicalModelId,
      provider: "google",
      rawResponse: { ok: true },
      routeModelId: "mock-route",
    })),
    id: "google",
    supportsCanonicalModel: () => true,
  };
}

describe("selectGenerateRoute", () => {
  it("auto-selects the only available route when no provider is given", () => {
    expect(selectGenerateRoute({ model: "gpt-image-1" })).toEqual({
      canonicalModelId: "gpt-image-1",
      ok: true,
      route: expect.objectContaining({
        canonicalModelId: "gpt-image-1",
        provider: "openai",
        routeModelId: "gpt-image-1",
      }),
    });
  });

  it("requires --provider when a model has multiple routes", () => {
    expect(selectGenerateRoute({ model: "flux-2-pro" })).toEqual({
      lines: [
        "Ambiguous provider selection for model flux-2-pro.",
        "Available providers: together, replicate",
        "Pass --provider <provider> to choose a route.",
      ],
      ok: false,
    });
  });

  it("resolves aliases before selecting a route", () => {
    expect(selectGenerateRoute({ model: "kling", provider: "replicate" })).toEqual({
      canonicalModelId: "kling-v1",
      ok: true,
      route: expect.objectContaining({
        canonicalModelId: "kling-v1",
        provider: "replicate",
        routeModelId: "kwaivgi/kling-v1.5-standard",
      }),
    });
  });

  it("fails clearly when the requested provider does not expose the model", () => {
    expect(selectGenerateRoute({ model: "imagen-4", provider: "openai" })).toEqual({
      lines: ["No route found for model imagen-4 and provider openai."],
      ok: false,
    });
  });
});

describe("runGenerateCommand", () => {
  it("runs the selected provider and renders user-visible output", async () => {
    const provider = createProviderMock();
    const createProvider = vi.fn(() => provider);

    await expect(
      runGenerateCommand(
        {
          model: "imagen-4-fast",
          prompt: "A product photo of a glass bottle",
        },
        { createProvider },
      ),
    ).resolves.toEqual({
      lines: [
        "Provider: google",
        "Model: imagen-4-fast",
        "Assets: 1",
        "Asset 1: imagen-4-fast.png | mime=image/png",
      ],
      ok: true,
    });

    expect(createProvider).toHaveBeenCalledWith("google", { env: undefined });
    expect(provider.generateImage).toHaveBeenCalledWith({
      canonicalModelId: "imagen-4-fast",
      prompt: "A product photo of a glass bottle",
    });
  });

  it("returns provider configuration failures as user-visible errors", async () => {
    await expect(
      runGenerateCommand(
        {
          model: "gpt-image-1-mini",
          prompt: "A studio product shot",
        },
        {
          createProvider: () => {
            throw new ConfigError(
              "CONFIG_ENV_MISSING",
              'Provider "openai" requires OPENAI_API_KEY to be set.',
            );
          },
        },
      ),
    ).resolves.toEqual({
      lines: ['Provider "openai" requires OPENAI_API_KEY to be set.'],
      ok: false,
    });
  });
});
