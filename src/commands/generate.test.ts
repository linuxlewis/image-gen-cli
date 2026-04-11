import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ConfigError } from "../core/errors.js";
import type { ImageGenerationProvider, NormalizedProviderResult } from "../providers/base.js";
import { runGenerateCommand, selectGenerateRoute } from "./generate.js";

function createProviderMock(): ImageGenerationProvider {
  return {
    generateImage: vi.fn(
      async (request): Promise<NormalizedProviderResult<{ ok: true }>> => ({
        assets: [
          {
            base64Data: Buffer.from("mock-image").toString("base64"),
            filename: `${request.canonicalModelId}.png`,
            mimeType: "image/png",
          },
        ],
        canonicalModelId: request.canonicalModelId,
        model: request.canonicalModelId,
        provider: "google",
        rawResponse: { ok: true },
        routeModelId: "mock-route",
      }),
    ),
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
  it("runs the selected provider, saves into the working directory by default, and renders user-visible output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "image-gen-command-default-"));
    const previousCwd = process.cwd();
    const provider = createProviderMock();
    const createProvider = vi.fn(() => provider);

    process.chdir(directory);

    try {
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
          "Canonical model: imagen-4-fast",
          "Provider model: mock-route",
          "Outputs: 1",
          `Output 1: ${join(directory, "imagen-4-fast-1.png")} | mime=image/png | inline-data=16 chars | saved=${join(directory, "imagen-4-fast-1.png")}`,
        ],
        ok: true,
      });

      await expect(readFile(join(directory, "imagen-4-fast-1.png"), "utf8")).resolves.toBe(
        "mock-image",
      );
    } finally {
      process.chdir(previousCwd);
    }

    expect(createProvider).toHaveBeenCalledWith("google", {});
    expect(provider.generateImage).toHaveBeenCalledWith({
      canonicalModelId: "imagen-4-fast",
      prompt: "A product photo of a glass bottle",
    });
  });

  it("renders deterministic JSON output when requested", async () => {
    const directory = await mkdtemp(join(tmpdir(), "image-gen-command-json-"));
    const previousCwd = process.cwd();

    process.chdir(directory);

    try {
      await expect(
        runGenerateCommand(
          {
            json: true,
            model: "imagen-4-fast",
            prompt: "A product photo of a glass bottle",
          },
          { createProvider: () => createProviderMock() },
        ),
      ).resolves.toEqual({
        lines: [
          "{",
          '  "canonicalModel": "imagen-4-fast",',
          '  "outputs": [',
          "    {",
          '      "filename": "imagen-4-fast.png",',
          `      "filePath": "${join(directory, "imagen-4-fast-1.png")}",`,
          '      "inlineData": {',
          '        "encoding": "base64",',
          '        "length": 16',
          "      },",
          '      "mimeType": "image/png"',
          "    }",
          "  ],",
          '  "provider": "google",',
          '  "providerModel": "mock-route",',
          '  "rawResponse": {',
          '    "ok": true',
          "  }",
          "}",
        ],
        ok: true,
      });
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("saves generated files when an output directory is provided", async () => {
    const directory = await mkdtemp(join(tmpdir(), "image-gen-command-"));

    await expect(
      runGenerateCommand(
        {
          model: "imagen-4-fast",
          outputDir: directory,
          prompt: "A product photo of a glass bottle",
        },
        { createProvider: () => createProviderMock() },
      ),
    ).resolves.toEqual({
      lines: [
        "Provider: google",
        "Canonical model: imagen-4-fast",
        "Provider model: mock-route",
        "Outputs: 1",
        `Output 1: ${join(directory, "imagen-4-fast-1.png")} | mime=image/png | inline-data=16 chars | saved=${join(directory, "imagen-4-fast-1.png")}`,
      ],
      ok: true,
    });

    await expect(readFile(join(directory, "imagen-4-fast-1.png"), "utf8")).resolves.toBe(
      "mock-image",
    );
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

  it("returns deterministic JSON errors when requested", async () => {
    await expect(
      runGenerateCommand(
        {
          json: true,
          model: "flux-2-pro",
          prompt: "A studio product shot",
        },
        { createProvider: () => createProviderMock() },
      ),
    ).resolves.toEqual({
      lines: [
        "{",
        '  "error": {',
        '    "messages": [',
        '      "Ambiguous provider selection for model flux-2-pro.",',
        '      "Available providers: together, replicate",',
        '      "Pass --provider <provider> to choose a route."',
        "    ]",
        "  }",
        "}",
      ],
      ok: false,
    });
  });
});
