import { describe, expect, it } from "vitest";

import { renderCliOutput } from "./run-cli.js";

describe("renderCliOutput", () => {
  it("shows help text", () => {
    expect(renderCliOutput(["--help"])).toEqual([
      "Usage: image-gen-cli [options]",
      "",
      "Options:",
      "  -h, --help     Show this help message",
    ]);
  });

  it("shows the default output", () => {
    expect(renderCliOutput(["prompt", "test"])).toEqual([
      "image-gen-cli is ready.",
      "Args: prompt, test",
    ]);
  });
});
