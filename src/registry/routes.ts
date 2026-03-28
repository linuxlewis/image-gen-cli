import type { CanonicalModelId, ModelRoute, ProviderId } from "../core/types.js";
import { getProvider } from "./providers.js";

type RouteInput = Omit<ModelRoute, "providerType">;

const PROVISIONAL_OPENAI_NOTE = "Provisional canonical mapping pending provider confirmation.";
const INFERRED_TOGETHER_FLUX_NOTE =
  "Route naming is inferred from vendor lineage and should be verified against provider docs.";

function defineRoute(route: RouteInput): ModelRoute {
  return {
    ...route,
    providerType: getProvider(route.provider).type,
  };
}

export const MODEL_ROUTES = [
  defineRoute({
    canonicalModelId: "gpt-image-1.5",
    provider: "openai",
    routeModelId: "gpt-image-1.5",
    rawModelId: "gpt-image-1.5",
    status: "preview",
    confidence: "medium",
    notes: PROVISIONAL_OPENAI_NOTE,
  }),
  defineRoute({
    canonicalModelId: "gpt-image-1",
    provider: "openai",
    routeModelId: "gpt-image-1",
    rawModelId: "gpt-image-1",
    status: "active",
    confidence: "high",
  }),
  defineRoute({
    canonicalModelId: "gpt-image-1-mini",
    provider: "openai",
    routeModelId: "gpt-image-1-mini",
    rawModelId: "gpt-image-1-mini",
    status: "preview",
    confidence: "medium",
    notes: PROVISIONAL_OPENAI_NOTE,
  }),
  defineRoute({
    canonicalModelId: "gemini-2.5-flash-image-preview",
    provider: "google",
    routeModelId: "gemini-2.5-flash-image-preview",
    rawModelId: "gemini-2.5-flash-image-preview",
    status: "preview",
    confidence: "high",
  }),
  defineRoute({
    canonicalModelId: "imagen-4-fast",
    provider: "google",
    routeModelId: "imagen-4.0-fast-generate-001",
    rawModelId: "imagen-4.0-fast-generate-001",
    status: "active",
    confidence: "high",
  }),
  defineRoute({
    canonicalModelId: "imagen-4",
    provider: "google",
    routeModelId: "imagen-4.0-generate-001",
    rawModelId: "imagen-4.0-generate-001",
    status: "active",
    confidence: "high",
  }),
  defineRoute({
    canonicalModelId: "imagen-4-ultra",
    provider: "google",
    routeModelId: "imagen-4.0-ultra-generate-001",
    rawModelId: "imagen-4.0-ultra-generate-001",
    status: "active",
    confidence: "high",
  }),
  defineRoute({
    canonicalModelId: "flux-1-schnell",
    provider: "together",
    routeModelId: "black-forest-labs/FLUX.1-schnell",
    rawModelId: "FLUX.1-schnell",
    status: "active",
    confidence: "medium",
  }),
  defineRoute({
    canonicalModelId: "flux-1-kontext-pro",
    provider: "together",
    routeModelId: "black-forest-labs/FLUX.1-kontext-pro",
    rawModelId: "FLUX.1-kontext-pro",
    status: "preview",
    confidence: "medium",
  }),
  defineRoute({
    canonicalModelId: "flux-2-pro",
    provider: "together",
    routeModelId: "black-forest-labs/FLUX.2-pro",
    rawModelId: "FLUX.2-pro",
    status: "preview",
    confidence: "low",
    notes: INFERRED_TOGETHER_FLUX_NOTE,
  }),
  defineRoute({
    canonicalModelId: "flux-2-dev",
    provider: "together",
    routeModelId: "black-forest-labs/FLUX.2-dev",
    rawModelId: "FLUX.2-dev",
    status: "preview",
    confidence: "low",
    notes: INFERRED_TOGETHER_FLUX_NOTE,
  }),
  defineRoute({
    canonicalModelId: "flux-2-flex",
    provider: "together",
    routeModelId: "black-forest-labs/FLUX.2-flex",
    rawModelId: "FLUX.2-flex",
    status: "preview",
    confidence: "low",
    notes: INFERRED_TOGETHER_FLUX_NOTE,
  }),
  defineRoute({
    canonicalModelId: "kling-v1",
    provider: "replicate",
    routeModelId: "kwaivgi/kling-v1",
    rawModelId: "kling-v1",
    status: "preview",
    confidence: "medium",
    notes: "Replicate route keeps the provider slug separate from the canonical model id.",
  }),
] as const satisfies readonly ModelRoute[];

const ROUTES_BY_MODEL_ID = new Map<CanonicalModelId, ModelRoute[]>();

for (const route of MODEL_ROUTES) {
  const modelRoutes = ROUTES_BY_MODEL_ID.get(route.canonicalModelId);

  if (modelRoutes) {
    modelRoutes.push(route);
    continue;
  }

  ROUTES_BY_MODEL_ID.set(route.canonicalModelId, [route]);
}

export function getRoutesForCanonicalModelId(
  canonicalModelId: CanonicalModelId,
): readonly ModelRoute[] {
  return ROUTES_BY_MODEL_ID.get(canonicalModelId) ?? [];
}

export function getRouteForCanonicalModelIdAndProvider(
  canonicalModelId: CanonicalModelId,
  provider: ProviderId,
): ModelRoute | undefined {
  return getRoutesForCanonicalModelId(canonicalModelId).find(
    (route) => route.provider === provider,
  );
}
