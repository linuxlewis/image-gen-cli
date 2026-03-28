import type { ProviderDefinition, ProviderId } from "../core/types.js";

export const PROVIDERS = [
  {
    id: "openai",
    type: "direct",
    displayName: "OpenAI",
  },
  {
    id: "google",
    type: "direct",
    displayName: "Google",
  },
  {
    id: "together",
    type: "aggregated",
    displayName: "Together",
  },
  {
    id: "replicate",
    type: "aggregated",
    displayName: "Replicate",
  },
] as const satisfies readonly ProviderDefinition[];

const PROVIDERS_BY_ID = new Map<ProviderId, ProviderDefinition>();

for (const provider of PROVIDERS) {
  PROVIDERS_BY_ID.set(provider.id, provider);
}

export function listProviders(): readonly ProviderDefinition[] {
  return PROVIDERS;
}

export function getProvider(providerId: ProviderId): ProviderDefinition {
  const provider = PROVIDERS_BY_ID.get(providerId);

  if (provider) {
    return provider;
  }

  throw new Error(`Unknown provider id: ${providerId}`);
}
