import { describe, expect, it } from "vitest";

import { ConfigError } from "../core/errors.js";
import {
  getProviderApiKeyEnvVar,
  readEnvVar,
  requireProviderApiKey,
  validateProviderApiKey,
} from "./env.js";

describe("config env helpers", () => {
  it("maps providers to the expected environment variables", () => {
    expect(getProviderApiKeyEnvVar("openai")).toBe("OPENAI_API_KEY");
    expect(getProviderApiKeyEnvVar("replicate")).toBe("REPLICATE_API_TOKEN");
  });

  it("trims environment values and treats blank strings as missing", () => {
    expect(readEnvVar({ OPENAI_API_KEY: "  sk-test  " }, "OPENAI_API_KEY")).toBe("sk-test");
    expect(readEnvVar({ OPENAI_API_KEY: "   " }, "OPENAI_API_KEY")).toBeUndefined();
  });

  it("only fails for the provider being used", () => {
    const env = {
      OPENAI_API_KEY: "sk-openai",
      GOOGLE_API_KEY: undefined,
      TOGETHER_API_KEY: undefined,
      REPLICATE_API_TOKEN: undefined,
    };

    expect(requireProviderApiKey("openai", env)).toBe("sk-openai");
    expect(() => requireProviderApiKey("google", env)).toThrowError(
      new ConfigError("CONFIG_ENV_MISSING", 'Provider "google" requires GOOGLE_API_KEY to be set.'),
    );
  });

  it("rejects empty provider API keys with a provider-specific message", () => {
    expect(() => validateProviderApiKey("together", "   ")).toThrowError(
      new ConfigError(
        "CONFIG_ENV_INVALID",
        'Environment variable TOGETHER_API_KEY for provider "together" cannot be empty.',
      ),
    );
  });
});
