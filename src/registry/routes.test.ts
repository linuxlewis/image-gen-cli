import { describe, expect, it } from "vitest";

import { getRouteForCanonicalModelIdAndProvider, getRoutesForCanonicalModelId } from "./routes.js";

describe("route registry", () => {
  it("lists available routes for a canonical model", () => {
    expect(getRoutesForCanonicalModelId("flux-1-schnell")).toEqual([
      expect.objectContaining({
        provider: "together",
        providerType: "aggregated",
        routeModelId: "black-forest-labs/FLUX.1-schnell",
      }),
      expect.objectContaining({
        provider: "replicate",
        providerType: "aggregated",
        routeModelId: "black-forest-labs/flux-schnell",
      }),
    ]);
  });

  it("returns a route for a specific provider", () => {
    expect(getRouteForCanonicalModelIdAndProvider("imagen-4-ultra", "google")).toEqual(
      expect.objectContaining({
        canonicalModelId: "imagen-4-ultra",
        provider: "google",
        providerType: "direct",
        routeModelId: "imagen-4.0-ultra-generate-001",
      }),
    );
  });

  it("returns undefined when no provider route exists", () => {
    expect(getRouteForCanonicalModelIdAndProvider("gpt-image-1", "replicate")).toBeUndefined();
  });
});
