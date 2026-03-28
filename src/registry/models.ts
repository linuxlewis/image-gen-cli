import type {
  CanonicalModelDefinition,
  CanonicalModelId,
  CanonicalModelRecord,
  ModelRegistryFilter,
} from "../core/types.js";
import { getRouteForCanonicalModelIdAndProvider, getRoutesForCanonicalModelId } from "./routes.js";

const MODEL_DEFINITIONS = [
  {
    canonicalModelId: "gpt-image-1.5",
    family: "gpt-image",
    vendor: "OpenAI",
    aliases: ["gpt-image-latest", "gpt-image-1-5"],
    status: "preview",
    confidence: "high",
  },
  {
    canonicalModelId: "gpt-image-1",
    family: "gpt-image",
    vendor: "OpenAI",
    aliases: ["gpt-image", "openai-image"],
    status: "active",
    confidence: "high",
  },
  {
    canonicalModelId: "gpt-image-1-mini",
    family: "gpt-image",
    vendor: "OpenAI",
    aliases: ["gpt-image-mini", "gpt-image-1-small"],
    status: "preview",
    confidence: "high",
  },
  {
    canonicalModelId: "gemini-2.5-flash-image-preview",
    family: "gemini-image",
    vendor: "Google",
    aliases: ["gemini-image-preview", "gemini-flash-image"],
    status: "preview",
    confidence: "high",
  },
  {
    canonicalModelId: "imagen-4-fast",
    family: "imagen",
    vendor: "Google",
    aliases: ["imagen-fast", "imagen4-fast"],
    status: "active",
    confidence: "high",
  },
  {
    canonicalModelId: "imagen-4",
    family: "imagen",
    vendor: "Google",
    aliases: ["imagen", "imagen4"],
    status: "active",
    confidence: "high",
  },
  {
    canonicalModelId: "imagen-4-ultra",
    family: "imagen",
    vendor: "Google",
    aliases: ["imagen-ultra", "imagen4-ultra"],
    status: "active",
    confidence: "high",
  },
  {
    canonicalModelId: "flux-1-schnell",
    family: "flux",
    vendor: "Black Forest Labs",
    aliases: ["flux-schnell", "flux-1-fast"],
    status: "active",
    confidence: "medium",
  },
  {
    canonicalModelId: "flux-1-kontext-pro",
    family: "flux",
    vendor: "Black Forest Labs",
    aliases: ["flux-kontext-pro", "flux-1-context-pro"],
    status: "preview",
    confidence: "medium",
  },
  {
    canonicalModelId: "flux-2-pro",
    family: "flux",
    vendor: "Black Forest Labs",
    aliases: ["flux-pro", "flux2-pro"],
    status: "preview",
    confidence: "low",
  },
  {
    canonicalModelId: "flux-2-dev",
    family: "flux",
    vendor: "Black Forest Labs",
    aliases: ["flux-dev", "flux2-dev"],
    status: "preview",
    confidence: "low",
  },
  {
    canonicalModelId: "flux-2-flex",
    family: "flux",
    vendor: "Black Forest Labs",
    aliases: ["flux-flex", "flux2-flex"],
    status: "preview",
    confidence: "low",
  },
  {
    canonicalModelId: "kling-v1",
    family: "kling",
    vendor: "Kling",
    aliases: ["kling", "kling-v1"],
    status: "preview",
    confidence: "medium",
  },
] as const satisfies readonly CanonicalModelDefinition[];

export const MODEL_REGISTRY = MODEL_DEFINITIONS.map((model) => ({
  ...model,
  routes: getRoutesForCanonicalModelId(model.canonicalModelId),
})) satisfies readonly CanonicalModelRecord[];

export function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

const MODELS_BY_ID = new Map<CanonicalModelId, CanonicalModelRecord>();
const CANONICAL_ID_BY_LOOKUP_KEY = new Map<string, CanonicalModelId>();

for (const model of MODEL_REGISTRY) {
  MODELS_BY_ID.set(model.canonicalModelId, model);
  CANONICAL_ID_BY_LOOKUP_KEY.set(
    normalizeLookupKey(model.canonicalModelId),
    model.canonicalModelId,
  );

  for (const alias of model.aliases) {
    CANONICAL_ID_BY_LOOKUP_KEY.set(normalizeLookupKey(alias), model.canonicalModelId);
  }
}

export function resolveCanonicalModelId(modelIdOrAlias: string): CanonicalModelId | undefined {
  return CANONICAL_ID_BY_LOOKUP_KEY.get(normalizeLookupKey(modelIdOrAlias));
}

export function getCanonicalModel(modelIdOrAlias: string): CanonicalModelRecord | undefined {
  const canonicalModelId = resolveCanonicalModelId(modelIdOrAlias);

  if (!canonicalModelId) {
    return undefined;
  }

  return MODELS_BY_ID.get(canonicalModelId);
}

export function listCanonicalModels(
  filter: ModelRegistryFilter = {},
): readonly CanonicalModelRecord[] {
  return MODEL_REGISTRY.filter(
    (model) =>
      (!filter.family || model.family === filter.family) &&
      (!filter.provider || model.routes.some((route) => route.provider === filter.provider)),
  );
}

export function getRoutesForModel(modelIdOrAlias: string) {
  const canonicalModelId = resolveCanonicalModelId(modelIdOrAlias);

  if (!canonicalModelId) {
    return [];
  }

  return getRoutesForCanonicalModelId(canonicalModelId);
}

export function getRouteForModelAndProvider(
  modelIdOrAlias: string,
  provider: ModelRegistryFilter["provider"],
) {
  if (!provider) {
    return undefined;
  }

  const canonicalModelId = resolveCanonicalModelId(modelIdOrAlias);

  if (!canonicalModelId) {
    return undefined;
  }

  return getRouteForCanonicalModelIdAndProvider(canonicalModelId, provider);
}
