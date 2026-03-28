import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderCliOutput, runCli } from "./run-cli.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("renderCliOutput", () => {
  it("shows help text", () => {
    expect(renderCliOutput(["--help"])).toEqual([
      "Usage:",
      "  image-gen-cli providers list",
      "  image-gen-cli models list [--family <family>] [--provider <provider>]",
      "  image-gen-cli routes list --model <model> [--provider <provider>]",
      "",
      "Options:",
      "  -h, --help             Show this help message",
      "  --family <family>      Filter models by family (gpt-image, gemini-image, imagen, flux, kling)",
      "  --provider <provider>  Filter by provider (openai, google, together, replicate)",
      "  --model <model>        Select a canonical model id or alias for route lookup",
    ]);
  });

  it("renders providers list output", () => {
    expect(renderCliOutput(["providers", "list"])).toEqual([
      "Providers",
      "",
      "Provider   Type        Name",
      "openai     direct      OpenAI",
      "google     direct      Google",
      "together   aggregated  Together",
      "replicate  aggregated  Replicate",
    ]);
  });

  it("strips a leading pnpm pass-through sentinel before parsing commands", () => {
    expect(renderCliOutput(["--", "providers", "list"])).toEqual([
      "Providers",
      "",
      "Provider   Type        Name",
      "openai     direct      OpenAI",
      "google     direct      Google",
      "together   aggregated  Together",
      "replicate  aggregated  Replicate",
    ]);
  });

  it("renders models list with a family filter", () => {
    expect(renderCliOutput(["models", "list", "--family", "flux"])).toEqual([
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

  it("renders models list with a provider filter", () => {
    expect(renderCliOutput(["models", "list", "--provider", "google"])).toEqual([
      "Models",
      "",
      "Canonical Model ID              Family        Vendor  Status   Confidence  Providers",
      "gemini-2.5-flash-image-preview  gemini-image  Google  preview  high        google",
      "imagen-4-fast                   imagen        Google  active   high        google",
      "imagen-4                        imagen        Google  active   high        google",
      "imagen-4-ultra                  imagen        Google  active   high        google",
    ]);
  });

  it("renders routes list for a model lookup", () => {
    expect(renderCliOutput(["routes", "list", "--model", "flux-2-pro"])).toEqual([
      "Routes for flux-2-pro",
      "",
      "Provider   Type        Route Model ID                Raw Model ID  Status   Confidence",
      "together   aggregated  black-forest-labs/FLUX.2-pro  FLUX.2-pro    preview  low",
      "replicate  aggregated  black-forest-labs/flux-2-pro  flux-2-pro    preview  low",
    ]);
  });

  it("renders routes list with a provider filter", () => {
    expect(
      renderCliOutput(["routes", "list", "--model", "flux-2-pro", "--provider", "together"]),
    ).toEqual([
      "Routes for flux-2-pro",
      "",
      "Provider  Type        Route Model ID                Raw Model ID  Status   Confidence",
      "together  aggregated  black-forest-labs/FLUX.2-pro  FLUX.2-pro    preview  low",
    ]);
  });
});

describe("runCli", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("returns a non-zero exit code for an unknown family", () => {
    expect(runCli(["models", "list", "--family", "unknown-family"])).toBe(1);
  });

  it("returns a non-zero exit code for an unknown provider", () => {
    expect(runCli(["models", "list", "--provider", "unknown-provider"])).toBe(1);
    expect(
      runCli(["routes", "list", "--model", "flux-2-pro", "--provider", "unknown-provider"]),
    ).toBe(1);
  });

  it("returns a non-zero exit code for an unknown command", () => {
    expect(runCli(["prompt", "test"])).toBe(1);
  });

  it("returns a non-zero exit code when routes list is missing the model flag", () => {
    expect(runCli(["routes", "list"])).toBe(1);
  });

  it("returns a non-zero exit code for an unknown route model", () => {
    expect(runCli(["routes", "list", "--model", "missing-model"])).toBe(1);
  });

  it("returns zero for supported discovery commands", () => {
    expect(runCli(["providers", "list"])).toBe(0);
    expect(runCli(["models", "list"])).toBe(0);
    expect(runCli(["routes", "list", "--model", "flux-2-pro"])).toBe(0);
  });

  it("returns zero for supported discovery commands when argv includes pnpm pass-through", () => {
    expect(runCli(["--", "providers", "list"])).toBe(0);
    expect(runCli(["--", "models", "list"])).toBe(0);
    expect(runCli(["--", "routes", "list", "--model", "flux-2-pro"])).toBe(0);
  });
});
