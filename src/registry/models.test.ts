import { describe, expect, it } from "vitest";

import {
  getCanonicalModel,
  getRouteForModelAndProvider,
  getRoutesForModel,
  listCanonicalModels,
  resolveCanonicalModelId,
} from "./models.js";

describe("model registry", () => {
  it("resolves a canonical model id from an alias", () => {
    expect(resolveCanonicalModelId("  imagen4-fast  ")).toBe("imagen-4-fast");
  });

  it("looks up canonical models with attached routes", () => {
    expect(getCanonicalModel("gpt-image-latest")).toEqual(
      expect.objectContaining({
        canonicalModelId: "gpt-image-1.5",
        family: "gpt-image",
        vendor: "OpenAI",
        routes: [
          expect.objectContaining({
            provider: "openai",
            routeModelId: "gpt-image-1.5",
          }),
        ],
      }),
    );
  });

  it("filters models by family", () => {
    expect(listCanonicalModels({ family: "flux" }).map((model) => model.canonicalModelId)).toEqual([
      "flux-1-schnell",
      "flux-1-kontext-pro",
      "flux-2-pro",
      "flux-2-dev",
      "flux-2-flex",
    ]);
  });

  it("filters models by provider", () => {
    expect(
      listCanonicalModels({ provider: "replicate" }).map((model) => model.canonicalModelId),
    ).toEqual(["kling-v1"]);
  });

  it("resolves routes from an alias lookup", () => {
    expect(getRoutesForModel("flux-pro")).toEqual([
      expect.objectContaining({
        canonicalModelId: "flux-2-pro",
        provider: "together",
        routeModelId: "black-forest-labs/FLUX.2-pro",
      }),
    ]);
  });

  it("looks up a single route for a canonical model and provider", () => {
    expect(getRouteForModelAndProvider("kling", "replicate")).toEqual(
      expect.objectContaining({
        canonicalModelId: "kling-v1",
        provider: "replicate",
        routeModelId: "kwaivgi/kling-v1",
        rawModelId: "kling-v1",
      }),
    );
  });
});
