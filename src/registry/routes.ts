import type { CanonicalModelId, ModelRoute, ProviderId } from "../core/types.js";
import { getProvider } from "./providers.js";

type RouteInput = Omit<ModelRoute, "providerType">;
type ReplicateFluxRouteInput = Pick<
  RouteInput,
  "canonicalModelId" | "routeModelId" | "rawModelId" | "status" | "confidence"
>;

const INFERRED_TOGETHER_FLUX_NOTE =
  "Route naming is inferred from vendor lineage and should be verified against provider docs.";
const REPLICATE_FLUX_NOTE =
  "Replicate route slug is provider-specific metadata and remains separate from the canonical model id.";

function defineRoute(route: RouteInput): ModelRoute {
  return {
    ...route,
    providerType: getProvider(route.provider).type,
  };
}

function defineReplicateFluxRoute(route: ReplicateFluxRouteInput): ModelRoute {
  return defineRoute({
    ...route,
    provider: "replicate",
    notes: REPLICATE_FLUX_NOTE,
  });
}

export const MODEL_ROUTES = [
  defineRoute({
    canonicalModelId: "gpt-image-1.5",
    provider: "openai",
    routeModelId: "gpt-image-1.5",
    rawModelId: "gpt-image-1.5",
    status: "preview",
    confidence: "high",
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
    confidence: "high",
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
  defineReplicateFluxRoute({
    canonicalModelId: "flux-1-schnell",
    routeModelId: "black-forest-labs/flux-schnell",
    rawModelId: "flux-schnell",
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
  defineReplicateFluxRoute({
    canonicalModelId: "flux-1-kontext-pro",
    routeModelId: "black-forest-labs/flux-kontext-pro",
    rawModelId: "flux-kontext-pro",
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
  defineReplicateFluxRoute({
    canonicalModelId: "flux-2-pro",
    routeModelId: "black-forest-labs/flux-2-pro",
    rawModelId: "flux-2-pro",
    status: "preview",
    confidence: "low",
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
  defineReplicateFluxRoute({
    canonicalModelId: "flux-2-dev",
    routeModelId: "black-forest-labs/flux-2-dev",
    rawModelId: "flux-2-dev",
    status: "preview",
    confidence: "low",
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
  defineReplicateFluxRoute({
    canonicalModelId: "flux-2-flex",
    routeModelId: "black-forest-labs/flux-2-flex",
    rawModelId: "flux-2-flex",
    status: "preview",
    confidence: "low",
  }),
  defineRoute({
    canonicalModelId: "kling-v1",
    provider: "replicate",
    routeModelId: "kwaivgi/kling-v1.5-standard",
    rawModelId: "kling-v1.5-standard",
    status: "preview",
    confidence: "medium",
    notes:
      "Replicate currently exposes kling-v1.5-standard for this route; the canonical model id stays provider-neutral.",
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
