import { describe, expect, it } from "vitest";

import { getOutputAssetLabel, renderNormalizedOutput } from "./outputs.js";

describe("output helpers", () => {
  it("prefers filenames when labeling assets", () => {
    expect(getOutputAssetLabel({ filename: "image-1.png", url: "https://example.com/1" }, 0)).toBe(
      "Asset 1: image-1.png",
    );
  });

  it("renders normalized provider output", () => {
    expect(
      renderNormalizedOutput({
        assets: [
          {
            filename: "image-1.png",
            mimeType: "image/png",
          },
          {
            base64Data: "abc123",
            mimeType: "image/jpeg",
          },
        ],
        model: "gpt-image-1",
        provider: "openai",
        revisedPrompt: "studio portrait",
        warnings: ["content-filtered prompt terms were removed"],
      }),
    ).toEqual([
      "Provider: openai",
      "Model: gpt-image-1",
      "Assets: 2",
      "Revised prompt: studio portrait",
      "Asset 1: image-1.png | mime=image/png",
      "Asset 2 | mime=image/jpeg | inline-data=6 chars",
      "Warning: content-filtered prompt terms were removed",
    ]);
  });
});
