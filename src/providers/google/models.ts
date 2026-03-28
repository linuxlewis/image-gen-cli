import type { CanonicalModelId } from "../../core/types.js";

export type GoogleDirectApiMethod = "generateContent" | "predict";

export type GoogleDirectModelSpec = {
  apiMethod: GoogleDirectApiMethod;
  canonicalModelId: CanonicalModelId;
  rawModelId: string;
  routeModelId: string;
};

// Keep Google direct model naming here so provider code and registry code share one source of truth.
export const GOOGLE_DIRECT_MODEL_SPECS = [
  {
    apiMethod: "generateContent",
    canonicalModelId: "gemini-2.5-flash-image-preview",
    rawModelId: "gemini-2.5-flash-image-preview",
    routeModelId: "gemini-2.5-flash-image-preview",
  },
  {
    apiMethod: "predict",
    canonicalModelId: "imagen-4-fast",
    rawModelId: "imagen-4.0-fast-generate-001",
    routeModelId: "imagen-4.0-fast-generate-001",
  },
  {
    apiMethod: "predict",
    canonicalModelId: "imagen-4",
    rawModelId: "imagen-4.0-generate-001",
    routeModelId: "imagen-4.0-generate-001",
  },
  {
    apiMethod: "predict",
    canonicalModelId: "imagen-4-ultra",
    rawModelId: "imagen-4.0-ultra-generate-001",
    routeModelId: "imagen-4.0-ultra-generate-001",
  },
] as const satisfies readonly GoogleDirectModelSpec[];

const GOOGLE_DIRECT_MODEL_SPECS_BY_CANONICAL_ID = new Map<CanonicalModelId, GoogleDirectModelSpec>(
  GOOGLE_DIRECT_MODEL_SPECS.map((spec) => [spec.canonicalModelId, spec]),
);

export function getGoogleDirectModelSpec(
  canonicalModelId: CanonicalModelId,
): GoogleDirectModelSpec | undefined {
  return GOOGLE_DIRECT_MODEL_SPECS_BY_CANONICAL_ID.get(canonicalModelId);
}

export function isGoogleDirectModel(canonicalModelId: CanonicalModelId): boolean {
  return GOOGLE_DIRECT_MODEL_SPECS_BY_CANONICAL_ID.has(canonicalModelId);
}

export function getGoogleRawModelId(canonicalModelId: CanonicalModelId): string | undefined {
  return getGoogleDirectModelSpec(canonicalModelId)?.rawModelId;
}
