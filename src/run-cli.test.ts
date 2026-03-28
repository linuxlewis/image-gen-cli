import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageGenerationProvider, NormalizedProviderResult } from "./providers/base.js";
import { renderCliOutput, runCli } from "./run-cli.js";

function createGenerateProviderMock(): ImageGenerationProvider {
  return {
    generateImage: vi.fn(
      async (request): Promise<NormalizedProviderResult<{ ok: true }>> => ({
        assets: [{ filename: `${request.canonicalModelId}.png`, mimeType: "image/png" }],
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("renderCliOutput", () => {
  it("shows help text", async () => {
    await expect(renderCliOutput(["--help"])).resolves.toEqual([
      "Usage:",
      "  image-gen-cli providers list",
      "  image-gen-cli models list [--family <family>] [--provider <provider>]",
      "  image-gen-cli routes list --model <model> [--provider <provider>]",
      "  image-gen-cli generate --model <model> --prompt <prompt> [--provider <provider>] [--json] [--output-dir <dir>]",
      "",
      "Options:",
      "  -h, --help             Show this help message",
      "  --family <family>      Filter models by family (gpt-image, gemini-image, imagen, flux, kling)",
      "  --json                 Render deterministic JSON for generate output",
      "  --provider <provider>  Filter by provider (openai, google, together, replicate)",
      "  --model <model>        Select a canonical model id or alias for route lookup",
      "  --output-dir <dir>     Save generated assets under the target directory",
      "  --prompt <prompt>      Text prompt for image generation",
    ]);
  });

  it("renders providers list output", async () => {
    await expect(renderCliOutput(["providers", "list"])).resolves.toEqual([
      "Providers",
      "",
      "Provider   Type        Name",
      "openai     direct      OpenAI",
      "google     direct      Google",
      "together   aggregated  Together",
      "replicate  aggregated  Replicate",
    ]);
  });

  it("strips a leading pnpm pass-through sentinel before parsing commands", async () => {
    await expect(renderCliOutput(["--", "providers", "list"])).resolves.toEqual([
      "Providers",
      "",
      "Provider   Type        Name",
      "openai     direct      OpenAI",
      "google     direct      Google",
      "together   aggregated  Together",
      "replicate  aggregated  Replicate",
    ]);
  });

  it("renders models list with a family filter", async () => {
    await expect(renderCliOutput(["models", "list", "--family", "flux"])).resolves.toEqual([
      "Models",
      "",
      "Canonical Model ID  Family  Vendor             Status   Confidence  Providers",
      "flux-1-schnell      flux    Black Forest Labs  active   medium      together, replicate",
      "flux-1-kontext-pro  flux    Black Forest Labs  preview  medium      together, replicate",
      "flux-2-pro          flux    Black Forest Labs  preview  low         together, replicate",
      "flux-2-dev          flux    Black Forest Labs  preview  low         together, replicate",
      "flux-2-flex         flux    Black Forest Labs  preview  low         together, replicate",
    ]);
  });

  it("renders models list with a provider filter", async () => {
    await expect(renderCliOutput(["models", "list", "--provider", "google"])).resolves.toEqual([
      "Models",
      "",
      "Canonical Model ID              Family        Vendor  Status   Confidence  Providers",
      "gemini-2.5-flash-image-preview  gemini-image  Google  preview  high        google",
      "imagen-4-fast                   imagen        Google  active   high        google",
      "imagen-4                        imagen        Google  active   high        google",
      "imagen-4-ultra                  imagen        Google  active   high        google",
    ]);
  });

  it("renders routes list for a model lookup", async () => {
    await expect(renderCliOutput(["routes", "list", "--model", "flux-2-pro"])).resolves.toEqual([
      "Routes for flux-2-pro",
      "",
      "Provider   Type        Route Model ID                Raw Model ID  Status   Confidence",
      "together   aggregated  black-forest-labs/FLUX.2-pro  FLUX.2-pro    preview  low",
      "replicate  aggregated  black-forest-labs/flux-2-pro  flux-2-pro    preview  low",
    ]);
  });

  it("renders routes list with a provider filter", async () => {
    await expect(
      renderCliOutput(["routes", "list", "--model", "flux-2-pro", "--provider", "together"]),
    ).resolves.toEqual([
      "Routes for flux-2-pro",
      "",
      "Provider  Type        Route Model ID                Raw Model ID  Status   Confidence",
      "together  aggregated  black-forest-labs/FLUX.2-pro  FLUX.2-pro    preview  low",
    ]);
  });

  it("renders generate output through the command wiring", async () => {
    const createProvider = vi.fn(createGenerateProviderMock);

    await expect(
      renderCliOutput(
        ["generate", "--model", "imagen-4-fast", "--prompt", "A studio product shot"],
        { createProvider },
      ),
    ).resolves.toEqual([
      "Provider: google",
      "Canonical model: imagen-4-fast",
      "Provider model: mock-route",
      "Outputs: 1",
      "Output 1: imagen-4-fast.png | mime=image/png",
    ]);
  });

  it("renders generate JSON output through the command wiring", async () => {
    const createProvider = vi.fn(createGenerateProviderMock);

    await expect(
      renderCliOutput(
        ["generate", "--model", "imagen-4-fast", "--prompt", "A studio product shot", "--json"],
        { createProvider },
      ),
    ).resolves.toEqual([
      "{",
      '  "canonicalModel": "imagen-4-fast",',
      '  "outputs": [',
      "    {",
      '      "filename": "imagen-4-fast.png",',
      '      "mimeType": "image/png"',
      "    }",
      "  ],",
      '  "provider": "google",',
      '  "providerModel": "mock-route",',
      '  "rawResponse": {',
      '    "ok": true',
      "  }",
      "}",
    ]);
  });
});

describe("runCli", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("returns a non-zero exit code for an unknown family", async () => {
    await expect(runCli(["models", "list", "--family", "unknown-family"])).resolves.toBe(1);
  });

  it("returns a non-zero exit code for an unknown provider", async () => {
    await expect(runCli(["models", "list", "--provider", "unknown-provider"])).resolves.toBe(1);
    await expect(
      runCli(["routes", "list", "--model", "flux-2-pro", "--provider", "unknown-provider"]),
    ).resolves.toBe(1);
    await expect(
      runCli([
        "generate",
        "--model",
        "flux-2-pro",
        "--prompt",
        "test",
        "--provider",
        "unknown-provider",
      ]),
    ).resolves.toBe(1);
  });

  it("returns a non-zero exit code for an unknown command", async () => {
    await expect(runCli(["prompt", "test"])).resolves.toBe(1);
  });

  it("returns a non-zero exit code when routes list is missing the model flag", async () => {
    await expect(runCli(["routes", "list"])).resolves.toBe(1);
  });

  it("returns a non-zero exit code when generate is missing required flags", async () => {
    await expect(runCli(["generate", "--model", "imagen-4-fast"])).resolves.toBe(1);
    await expect(runCli(["generate", "--prompt", "A studio product shot"])).resolves.toBe(1);
    await expect(runCli(["generate", "--model", "imagen-4-fast", "--output-dir"])).resolves.toBe(1);
  });

  it("returns a non-zero exit code for an unknown route model", async () => {
    await expect(runCli(["routes", "list", "--model", "missing-model"])).resolves.toBe(1);
  });

  it("returns a non-zero exit code for ambiguous generate route selection", async () => {
    await expect(
      runCli(["generate", "--model", "flux-2-pro", "--prompt", "A studio product shot"]),
    ).resolves.toBe(1);
  });

  it("returns zero for supported commands", async () => {
    await expect(runCli(["providers", "list"])).resolves.toBe(0);
    await expect(runCli(["models", "list"])).resolves.toBe(0);
    await expect(runCli(["routes", "list", "--model", "flux-2-pro"])).resolves.toBe(0);
    await expect(
      runCli(["generate", "--model", "imagen-4-fast", "--prompt", "A studio product shot"], {
        createProvider: createGenerateProviderMock,
      }),
    ).resolves.toBe(0);
  });

  it("returns zero for supported commands when argv includes pnpm pass-through", async () => {
    await expect(runCli(["--", "providers", "list"])).resolves.toBe(0);
    await expect(runCli(["--", "models", "list"])).resolves.toBe(0);
    await expect(runCli(["--", "routes", "list", "--model", "flux-2-pro"])).resolves.toBe(0);
  });
});
