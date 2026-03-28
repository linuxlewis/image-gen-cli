import type { CanonicalModelId, ProviderId } from "../core/types.js";
import type { NormalizedCommandOutput } from "../io/outputs.js";

export const IMAGE_OUTPUT_FORMATS = ["png", "jpeg", "webp"] as const;

export type ImageOutputFormat = (typeof IMAGE_OUTPUT_FORMATS)[number];

export const IMAGE_QUALITIES = ["auto", "low", "medium", "high"] as const;

export type ImageQuality = (typeof IMAGE_QUALITIES)[number];

export const IMAGE_SIZES = ["auto", "1024x1024", "1024x1536", "1536x1024"] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];

export const IMAGE_BACKGROUNDS = ["transparent", "opaque"] as const;

export type ImageBackground = (typeof IMAGE_BACKGROUNDS)[number];

export type ProviderImageGenerationRequest = {
  aspectRatio?: string;
  durationSeconds?: number;
  inputImage?: string;
  negativePrompt?: string;
  canonicalModelId: CanonicalModelId;
  prompt: string;
  background?: ImageBackground;
  imageCount?: number;
  outputCompression?: number;
  outputFormat?: ImageOutputFormat;
  quality?: ImageQuality;
  seed?: number;
  size?: ImageSize;
  user?: string;
};

export type ProviderImageUsage = {
  inputTokens: number;
  inputTokensDetails?: {
    imageTokens?: number;
    textTokens?: number;
  };
  outputTokens: number;
  totalTokens: number;
};

export type NormalizedProviderResult<TRawResponse = unknown> = NormalizedCommandOutput & {
  canonicalModelId: CanonicalModelId;
  createdAt?: number;
  outputFormat?: ImageOutputFormat;
  quality?: Exclude<ImageQuality, "auto">;
  rawResponse: TRawResponse;
  routeModelId: string;
  usage?: ProviderImageUsage;
};

export type ImageGenerationProvider<TRawResponse = unknown> = {
  generateImage: (
    request: ProviderImageGenerationRequest,
  ) => Promise<NormalizedProviderResult<TRawResponse>>;
  id: ProviderId;
  supportsCanonicalModel: (canonicalModelId: CanonicalModelId) => boolean;
};
