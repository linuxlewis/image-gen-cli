import { describe, expect, it } from "vitest";

import { renderModelsList } from "./models-list.js";

describe("renderModelsList", () => {
  it("renders a stable models table", () => {
    expect(renderModelsList()).toEqual([
      "Models",
      "",
      "Canonical Model ID              Family        Vendor             Status   Confidence  Providers",
      "gpt-image-1.5                   gpt-image     OpenAI             preview  high        openai",
      "gpt-image-1                     gpt-image     OpenAI             active   high        openai",
      "gpt-image-1-mini                gpt-image     OpenAI             preview  high        openai",
      "gemini-2.5-flash-image-preview  gemini-image  Google             preview  high        google",
      "imagen-4-fast                   imagen        Google             active   high        google",
      "imagen-4                        imagen        Google             active   high        google",
      "imagen-4-ultra                  imagen        Google             active   high        google",
      "flux-1-schnell                  flux          Black Forest Labs  active   medium      together",
      "flux-1-kontext-pro              flux          Black Forest Labs  preview  medium      together",
      "flux-2-pro                      flux          Black Forest Labs  preview  low         together",
      "flux-2-dev                      flux          Black Forest Labs  preview  low         together",
      "flux-2-flex                     flux          Black Forest Labs  preview  low         together",
      "kling-v1                        kling         Kling              preview  medium      replicate",
    ]);
  });

  it("filters models by family", () => {
    expect(renderModelsList({ family: "flux" })).toEqual([
      "Models",
      "",
      "Canonical Model ID  Family  Vendor             Status   Confidence  Providers",
      "flux-1-schnell      flux    Black Forest Labs  active   medium      together",
      "flux-1-kontext-pro  flux    Black Forest Labs  preview  medium      together",
      "flux-2-pro          flux    Black Forest Labs  preview  low         together",
      "flux-2-dev          flux    Black Forest Labs  preview  low         together",
      "flux-2-flex         flux    Black Forest Labs  preview  low         together",
    ]);
  });

  it("filters models by provider", () => {
    expect(renderModelsList({ provider: "google" })).toEqual([
      "Models",
      "",
      "Canonical Model ID              Family        Vendor  Status   Confidence  Providers",
      "gemini-2.5-flash-image-preview  gemini-image  Google  preview  high        google",
      "imagen-4-fast                   imagen        Google  active   high        google",
      "imagen-4                        imagen        Google  active   high        google",
      "imagen-4-ultra                  imagen        Google  active   high        google",
    ]);
  });
});
