import { ConfigError } from "../core/errors.js";
import type { ProviderId } from "../core/types.js";

export type Environment = Record<string, string | undefined>;

export const PROVIDER_API_KEY_ENV_VARS: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
  together: "TOGETHER_API_KEY",
  replicate: "REPLICATE_API_TOKEN",
};

export function getProviderApiKeyEnvVar(provider: ProviderId): string {
  return PROVIDER_API_KEY_ENV_VARS[provider];
}

export function readEnvVar(env: Environment, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function requireEnvVar(env: Environment, key: string): string {
  const value = readEnvVar(env, key);

  if (value) {
    return value;
  }

  throw new ConfigError("CONFIG_ENV_MISSING", `Missing required environment variable ${key}.`);
}

export function validateProviderApiKey(provider: ProviderId, apiKey: string): string {
  const normalizedApiKey = apiKey.trim();

  if (normalizedApiKey.length > 0) {
    return normalizedApiKey;
  }

  throw new ConfigError(
    "CONFIG_ENV_INVALID",
    `Environment variable ${getProviderApiKeyEnvVar(provider)} for provider "${provider}" cannot be empty.`,
  );
}

export function requireProviderApiKey(
  provider: ProviderId,
  env: Environment = process.env,
): string {
  const envVarName = getProviderApiKeyEnvVar(provider);

  const apiKey = readEnvVar(env, envVarName);

  if (!apiKey) {
    throw new ConfigError(
      "CONFIG_ENV_MISSING",
      `Provider "${provider}" requires ${envVarName} to be set.`,
    );
  }

  return validateProviderApiKey(provider, apiKey);
}
