import { describe, expect, it } from "vitest";

import { renderRoutesList } from "./routes-list.js";

describe("renderRoutesList", () => {
  it("renders routes for a canonical model", () => {
    expect(renderRoutesList({ model: "flux-2-pro" })).toEqual({
      ok: true,
      lines: [
        "Routes for flux-2-pro",
        "",
        "Provider   Type        Route Model ID                Raw Model ID  Status   Confidence",
        "together   aggregated  black-forest-labs/FLUX.2-pro  FLUX.2-pro    preview  low",
        "replicate  aggregated  black-forest-labs/flux-2-pro  flux-2-pro    preview  low",
      ],
    });
  });

  it("accepts aliases when resolving route lookups", () => {
    expect(renderRoutesList({ model: "flux-pro" })).toEqual({
      ok: true,
      lines: [
        "Routes for flux-2-pro",
        "",
        "Provider   Type        Route Model ID                Raw Model ID  Status   Confidence",
        "together   aggregated  black-forest-labs/FLUX.2-pro  FLUX.2-pro    preview  low",
        "replicate  aggregated  black-forest-labs/flux-2-pro  flux-2-pro    preview  low",
      ],
    });
  });

  it("filters routes by provider", () => {
    expect(renderRoutesList({ model: "flux-2-pro", provider: "together" })).toEqual({
      ok: true,
      lines: [
        "Routes for flux-2-pro",
        "",
        "Provider  Type        Route Model ID                Raw Model ID  Status   Confidence",
        "together  aggregated  black-forest-labs/FLUX.2-pro  FLUX.2-pro    preview  low",
      ],
    });
  });

  it("returns a structured error when no routes match the provider filter", () => {
    expect(renderRoutesList({ model: "flux-2-pro", provider: "openai" })).toEqual({
      ok: false,
      lines: ["No routes found for model flux-2-pro and provider openai."],
    });
  });

  it("returns a structured error for an unknown model", () => {
    expect(renderRoutesList({ model: "missing-model" })).toEqual({
      ok: false,
      lines: ["Unknown model: missing-model"],
    });
  });
});
