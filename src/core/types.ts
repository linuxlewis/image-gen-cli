export const PROVIDER_IDS = ["openai", "google", "together", "replicate"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_TYPES = ["direct", "aggregated"] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const MODEL_FAMILIES = ["gpt-image", "gemini-image", "imagen", "flux", "kling"] as const;

export type ModelFamily = (typeof MODEL_FAMILIES)[number];

export const REGISTRY_STATUSES = ["active", "preview", "deprecated", "disabled"] as const;

export type RegistryStatus = (typeof REGISTRY_STATUSES)[number];

export const REGISTRY_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export type RegistryConfidence = (typeof REGISTRY_CONFIDENCE_LEVELS)[number];

export const CANONICAL_MODEL_IDS = [
  "gpt-image-1.5",
  "gpt-image-1",
  "gpt-image-1-mini",
  "gemini-2.5-flash-image-preview",
  "imagen-4-fast",
  "imagen-4",
  "imagen-4-ultra",
  "flux-1-schnell",
  "flux-1-kontext-pro",
  "flux-2-pro",
  "flux-2-dev",
  "flux-2-flex",
  "kling-v1",
] as const;

export type CanonicalModelId = (typeof CANONICAL_MODEL_IDS)[number];

export type ProviderDefinition = {
  id: ProviderId;
  type: ProviderType;
  displayName: string;
};

export type ModelRoute = {
  canonicalModelId: CanonicalModelId;
  provider: ProviderId;
  providerType: ProviderType;
  routeModelId: string;
  rawModelId?: string;
  versionId?: string;
  status: RegistryStatus;
  confidence: RegistryConfidence;
  notes?: string;
};

export type CanonicalModelDefinition = {
  canonicalModelId: CanonicalModelId;
  family: ModelFamily;
  vendor: string;
  aliases: readonly string[];
  status: RegistryStatus;
  confidence: RegistryConfidence;
};

export type CanonicalModelRecord = CanonicalModelDefinition & {
  routes: readonly ModelRoute[];
};

export type ModelRegistryFilter = {
  family?: ModelFamily;
  provider?: ProviderId;
};
