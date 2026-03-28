import { describe, expect, it } from "vitest";

import {
  GOOGLE_DIRECT_MODEL_SPECS,
  getGoogleDirectModelSpec,
  getGoogleRawModelId,
  isGoogleDirectModel,
} from "./models.js";

describe("google direct model mapping", () => {
  it("keeps canonical-to-raw model ids explicit in one place", () => {
    expect(GOOGLE_DIRECT_MODEL_SPECS).toEqual([
      {
        apiMethod: "generateContent",
        canonicalModelId: "gemini-2.5-flash-image-preview",
        rawModelId: "gemini-2.5-flash-image-preview",
        routeModelId: "gemini-2.5-flash-image-preview",
      },
      {
        apiMethod: "predict",
        canonicalModelId: "imagen-4-fast",
        rawModelId: "imagen-4.0-fast-generate-001",
        routeModelId: "imagen-4.0-fast-generate-001",
      },
      {
        apiMethod: "predict",
        canonicalModelId: "imagen-4",
        rawModelId: "imagen-4.0-generate-001",
        routeModelId: "imagen-4.0-generate-001",
      },
      {
        apiMethod: "predict",
        canonicalModelId: "imagen-4-ultra",
        rawModelId: "imagen-4.0-ultra-generate-001",
        routeModelId: "imagen-4.0-ultra-generate-001",
      },
    ]);
  });

  it("looks up a Google model spec by canonical id", () => {
    expect(getGoogleDirectModelSpec("imagen-4-ultra")).toEqual({
      apiMethod: "predict",
      canonicalModelId: "imagen-4-ultra",
      rawModelId: "imagen-4.0-ultra-generate-001",
      routeModelId: "imagen-4.0-ultra-generate-001",
    });
  });

  it("returns raw Google model ids from the centralized mapping", () => {
    expect(getGoogleRawModelId("gemini-2.5-flash-image-preview")).toBe(
      "gemini-2.5-flash-image-preview",
    );
    expect(getGoogleRawModelId("imagen-4-fast")).toBe("imagen-4.0-fast-generate-001");
    expect(getGoogleRawModelId("gpt-image-1")).toBeUndefined();
  });

  it("reports whether a canonical model is supported by the Google direct provider", () => {
    expect(isGoogleDirectModel("imagen-4-fast")).toBe(true);
    expect(isGoogleDirectModel("flux-2-pro")).toBe(false);
  });
});
