import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { ImageGenerationProvider, NormalizedProviderResult } from "../providers/base.js";
import {
  DEFAULT_BULK_CONCURRENCY,
  loadBulkPrompts,
  mapWithConcurrencyLimit,
  runBulkGenerateCommand,
} from "./generate-bulk.js";

function createBulkProviderMock(
  options: {
    delayMs?: number;
    failPrompt?: string;
    onStart?: () => void;
    onStop?: () => void;
  } = {},
): ImageGenerationProvider {
  return {
    generateImage: vi.fn(async (request): Promise<NormalizedProviderResult<{ prompt: string }>> => {
      options.onStart?.();

      try {
        if (options.delayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        }

        if (options.failPrompt && request.prompt === options.failPrompt) {
          throw new Error(`Generation failed for prompt: ${request.prompt}`);
        }

        return {
          assets: [
            {
              base64Data: Buffer.from("mock-image").toString("base64"),
              filename: "provider-image.png",
              mimeType: "image/png",
            },
          ],
          canonicalModelId: request.canonicalModelId,
          model: request.canonicalModelId,
          provider: "google",
          rawResponse: { prompt: request.prompt },
          routeModelId: "mock-route",
        };
      } finally {
        options.onStop?.();
      }
    }),
    id: "google",
    supportsCanonicalModel: () => true,
  };
}

describe("loadBulkPrompts", () => {
  it("loads newline-delimited prompts and ignores blank lines", async () => {
    const directory = await mkdtemp(join(tmpdir(), "image-gen-bulk-prompts-"));
    const promptsFile = join(directory, "prompts.txt");

    await writeFile(promptsFile, "\n First prompt \n\nSecond prompt\n");

    await expect(loadBulkPrompts(promptsFile)).resolves.toEqual([
      {
        index: 0,
        prompt: "First prompt",
      },
      {
        index: 1,
        prompt: "Second prompt",
      },
    ]);
  });
});

describe("mapWithConcurrencyLimit", () => {
  it("keeps in-flight work bounded by the requested concurrency", async () => {
    let active = 0;
    let maxActive = 0;

    const results = await mapWithConcurrencyLimit([1, 2, 3, 4], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;

      return value * 2;
    });

    expect(results).toEqual([2, 4, 6, 8]);
    expect(maxActive).toBe(2);
  });
});

describe("runBulkGenerateCommand", () => {
  it("uses the default concurrency when no value is provided", async () => {
    const directory = await mkdtemp(join(tmpdir(), "image-gen-bulk-default-"));
    const promptsFile = join(directory, "prompts.txt");

    await writeFile(promptsFile, "First prompt\nSecond prompt\n");

    await expect(
      runBulkGenerateCommand(
        {
          bulkPrompts: promptsFile,
          model: "imagen-4-fast",
        },
        {
          createProvider: () => createBulkProviderMock(),
        },
      ),
    ).resolves.toEqual({
      lines: [
        "Bulk prompts: 2",
        `Concurrency: ${DEFAULT_BULK_CONCURRENCY}`,
        "Succeeded: 2",
        "Failed: 0",
        "",
        "Item 1: ok",
        "Prompt: First prompt",
        "Provider: google",
        "Canonical model: imagen-4-fast",
        "Provider model: mock-route",
        "Outputs: 1",
        "Output 1: provider-image.png | mime=image/png | inline-data=16 chars",
        "",
        "Item 2: ok",
        "Prompt: Second prompt",
        "Provider: google",
        "Canonical model: imagen-4-fast",
        "Provider model: mock-route",
        "Outputs: 1",
        "Output 1: provider-image.png | mime=image/png | inline-data=16 chars",
      ],
      ok: true,
    });
  });

  it("saves bulk outputs to unique file names for each prompt", async () => {
    const directory = await mkdtemp(join(tmpdir(), "image-gen-bulk-files-"));
    const outputDirectory = join(directory, "generated");
    const promptsFile = join(directory, "prompts.txt");

    await writeFile(promptsFile, "First prompt\nSecond prompt\n");

    await expect(
      runBulkGenerateCommand(
        {
          bulkPrompts: promptsFile,
          model: "imagen-4-fast",
          outputDir: outputDirectory,
        },
        {
          createProvider: () => createBulkProviderMock(),
        },
      ),
    ).resolves.toEqual({
      lines: [
        "Bulk prompts: 2",
        `Concurrency: ${DEFAULT_BULK_CONCURRENCY}`,
        "Succeeded: 2",
        "Failed: 0",
        "",
        "Item 1: ok",
        "Prompt: First prompt",
        "Provider: google",
        "Canonical model: imagen-4-fast",
        "Provider model: mock-route",
        "Outputs: 1",
        `Output 1: ${join(outputDirectory, "imagen-4-fast-prompt-01-1.png")} | mime=image/png | inline-data=16 chars | saved=${join(outputDirectory, "imagen-4-fast-prompt-01-1.png")}`,
        "",
        "Item 2: ok",
        "Prompt: Second prompt",
        "Provider: google",
        "Canonical model: imagen-4-fast",
        "Provider model: mock-route",
        "Outputs: 1",
        `Output 1: ${join(outputDirectory, "imagen-4-fast-prompt-02-1.png")} | mime=image/png | inline-data=16 chars | saved=${join(outputDirectory, "imagen-4-fast-prompt-02-1.png")}`,
      ],
      ok: true,
    });

    await expect(
      readFile(join(outputDirectory, "imagen-4-fast-prompt-01-1.png"), "utf8"),
    ).resolves.toBe("mock-image");
    await expect(
      readFile(join(outputDirectory, "imagen-4-fast-prompt-02-1.png"), "utf8"),
    ).resolves.toBe("mock-image");
  });

  it("reports partial failures without discarding successful results", async () => {
    const directory = await mkdtemp(join(tmpdir(), "image-gen-bulk-failures-"));
    const promptsFile = join(directory, "prompts.txt");

    await writeFile(promptsFile, "First prompt\nBroken prompt\nThird prompt\n");

    await expect(
      runBulkGenerateCommand(
        {
          bulkPrompts: promptsFile,
          concurrency: 2,
          json: true,
          model: "imagen-4-fast",
        },
        {
          createProvider: () => createBulkProviderMock({ failPrompt: "Broken prompt" }),
        },
      ),
    ).resolves.toEqual({
      lines: [
        "{",
        '  "concurrency": 2,',
        '  "failed": 1,',
        '  "results": [',
        "    {",
        '      "index": 1,',
        '      "ok": true,',
        '      "prompt": "First prompt",',
        '      "result": {',
        '        "canonicalModel": "imagen-4-fast",',
        '        "outputs": [',
        "          {",
        '            "filename": "provider-image.png",',
        '            "inlineData": {',
        '              "encoding": "base64",',
        '              "length": 16',
        "            },",
        '            "mimeType": "image/png"',
        "          }",
        "        ],",
        '        "provider": "google",',
        '        "providerModel": "mock-route",',
        '        "rawResponse": {',
        '          "prompt": "First prompt"',
        "        }",
        "      }",
        "    },",
        "    {",
        '      "errors": [',
        '        "Generation failed for prompt: Broken prompt"',
        "      ],",
        '      "index": 2,',
        '      "ok": false,',
        '      "prompt": "Broken prompt"',
        "    },",
        "    {",
        '      "index": 3,',
        '      "ok": true,',
        '      "prompt": "Third prompt",',
        '      "result": {',
        '        "canonicalModel": "imagen-4-fast",',
        '        "outputs": [',
        "          {",
        '            "filename": "provider-image.png",',
        '            "inlineData": {',
        '              "encoding": "base64",',
        '              "length": 16',
        "            },",
        '            "mimeType": "image/png"',
        "          }",
        "        ],",
        '        "provider": "google",',
        '        "providerModel": "mock-route",',
        '        "rawResponse": {',
        '          "prompt": "Third prompt"',
        "        }",
        "      }",
        "    }",
        "  ],",
        '  "succeeded": 2,',
        '  "total": 3',
        "}",
      ],
      ok: false,
    });
  });

  it("reuses the generate lifecycle while respecting the concurrency limit", async () => {
    const directory = await mkdtemp(join(tmpdir(), "image-gen-bulk-concurrency-"));
    const promptsFile = join(directory, "prompts.txt");
    let active = 0;
    let maxActive = 0;

    await writeFile(promptsFile, "First prompt\nSecond prompt\nThird prompt\n");

    const provider = createBulkProviderMock({
      delayMs: 10,
      onStart: () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
      },
      onStop: () => {
        active -= 1;
      },
    });

    await expect(
      runBulkGenerateCommand(
        {
          bulkPrompts: promptsFile,
          concurrency: 2,
          model: "imagen-4-fast",
        },
        {
          createProvider: () => provider,
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
    });

    expect(provider.generateImage).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(2);
  });
});
