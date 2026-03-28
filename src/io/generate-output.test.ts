import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { NormalizedProviderResult } from "../providers/base.js";
import {
  renderGenerateErrorOutput,
  renderGenerateJsonOutput,
  renderGenerateTextOutput,
  saveGenerateOutputs,
} from "./generate-output.js";

function createResult(): NormalizedProviderResult<{
  zebra: { bravo: number; alpha: number };
  alpha: number;
}> {
  return {
    assets: [
      {
        base64Data: Buffer.from("image-one").toString("base64"),
        mimeType: "image/png",
      },
      {
        filename: "provider-name.jpeg",
        mimeType: "image/jpeg",
        url: "https://example.com/asset-2.jpeg",
      },
    ],
    canonicalModelId: "gpt-image-1",
    createdAt: 123,
    model: "gpt-image-1",
    outputFormat: "png",
    provider: "openai",
    providerMetadata: {
      zebra: true,
      alpha: true,
    },
    quality: "high",
    rawResponse: {
      zebra: {
        bravo: 2,
        alpha: 1,
      },
      alpha: 0,
    },
    revisedPrompt: "clean studio lighting",
    routeModelId: "openai/gpt-image-1",
    usage: {
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
    },
    warnings: ["provider warning"],
  };
}

describe("generate output helpers", () => {
  it("renders deterministic JSON output", () => {
    const result = createResult();

    expect(
      renderGenerateJsonOutput(result, [
        {
          inlineData: {
            encoding: "base64",
            length: result.assets[0]?.base64Data?.length ?? 0,
          },
          mimeType: "image/png",
        },
        {
          filename: "provider-name.jpeg",
          mimeType: "image/jpeg",
          url: "https://example.com/asset-2.jpeg",
        },
      ]),
    ).toEqual([
      "{",
      '  "canonicalModel": "gpt-image-1",',
      '  "createdAt": 123,',
      '  "outputFormat": "png",',
      '  "outputs": [',
      "    {",
      '      "inlineData": {',
      '        "encoding": "base64",',
      '        "length": 12',
      "      },",
      '      "mimeType": "image/png"',
      "    },",
      "    {",
      '      "filename": "provider-name.jpeg",',
      '      "mimeType": "image/jpeg",',
      '      "url": "https://example.com/asset-2.jpeg"',
      "    }",
      "  ],",
      '  "provider": "openai",',
      '  "providerMetadata": {',
      '    "alpha": true,',
      '    "zebra": true',
      "  },",
      '  "providerModel": "openai/gpt-image-1",',
      '  "quality": "high",',
      '  "rawResponse": {',
      '    "alpha": 0,',
      '    "zebra": {',
      '      "alpha": 1,',
      '      "bravo": 2',
      "    }",
      "  },",
      '  "revisedPrompt": "clean studio lighting",',
      '  "usage": {',
      '    "inputTokens": 1,',
      '    "outputTokens": 2,',
      '    "totalTokens": 3',
      "  },",
      '  "warnings": [',
      '    "provider warning"',
      "  ]",
      "}",
    ]);
  });

  it("renders saved file paths in text output", () => {
    expect(
      renderGenerateTextOutput(createResult(), [
        {
          filePath: "/tmp/gpt-image-1-1.png",
          inlineData: {
            encoding: "base64",
            length: 12,
          },
          mimeType: "image/png",
        },
      ]),
    ).toEqual([
      "Provider: openai",
      "Canonical model: gpt-image-1",
      "Provider model: openai/gpt-image-1",
      "Outputs: 1",
      "Revised prompt: clean studio lighting",
      "Output 1: /tmp/gpt-image-1-1.png | mime=image/png | inline-data=12 chars | saved=/tmp/gpt-image-1-1.png",
      "Warning: provider warning",
    ]);
  });

  it("renders deterministic JSON errors when requested", () => {
    expect(renderGenerateErrorOutput(["first", "second"], true)).toEqual([
      "{",
      '  "error": {',
      '    "messages": [',
      '      "first",',
      '      "second"',
      "    ]",
      "  }",
      "}",
    ]);
  });

  it("saves inline and URL-backed assets to deterministic file paths", async () => {
    const directory = await mkdtemp(join(tmpdir(), "image-gen-cli-"));
    const result = createResult();

    const outputs = await saveGenerateOutputs(result, {
      fetchFn: async () =>
        new Response(Uint8Array.from([1, 2, 3]), {
          headers: {
            "content-type": "image/jpeg; charset=utf-8",
          },
          status: 200,
        }),
      outputDir: directory,
    });

    expect(outputs).toEqual([
      {
        filePath: join(directory, "gpt-image-1-1.png"),
        inlineData: {
          encoding: "base64",
          length: result.assets[0]?.base64Data?.length ?? 0,
        },
        mimeType: "image/png",
      },
      {
        filePath: join(directory, "gpt-image-1-2.jpeg"),
        filename: "provider-name.jpeg",
        mimeType: "image/jpeg",
        url: "https://example.com/asset-2.jpeg",
      },
    ]);

    await expect(readFile(join(directory, "gpt-image-1-1.png"), "utf8")).resolves.toBe("image-one");
    await expect(readFile(join(directory, "gpt-image-1-2.jpeg"))).resolves.toEqual(
      Buffer.from([1, 2, 3]),
    );
  });
});
