import type { Environment } from "../../config/env.js";
import { requireProviderApiKey } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import type { CanonicalModelId } from "../../core/types.js";
import type { FetchLike, HttpClient, HttpJsonRequestOptions } from "../../http/client.js";
import { createHttpClient } from "../../http/client.js";
import type { NormalizedOutputAsset } from "../../io/outputs.js";
import type {
  ImageGenerationProvider,
  NormalizedProviderResult,
  ProviderImageGenerationRequest,
} from "../base.js";

import {
  type GoogleDirectApiMethod,
  getGoogleDirectModelSpec,
  isGoogleDirectModel,
} from "./models.js";

export const GOOGLE_GENERATIVE_LANGUAGE_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";

export const GOOGLE_IMAGEN_ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"] as const;

export type GoogleImagenAspectRatio = (typeof GOOGLE_IMAGEN_ASPECT_RATIOS)[number];

export const GOOGLE_IMAGEN_IMAGE_SIZES = ["1K", "2K"] as const;

export type GoogleImagenImageSize = (typeof GOOGLE_IMAGEN_IMAGE_SIZES)[number];

export const GOOGLE_IMAGEN_PERSON_GENERATION_VALUES = [
  "dont_allow",
  "allow_adult",
  "allow_all",
] as const;

export type GoogleImagenPersonGeneration = (typeof GOOGLE_IMAGEN_PERSON_GENERATION_VALUES)[number];

export type GoogleGenerateImageInput = ProviderImageGenerationRequest & {
  aspectRatio?: GoogleImagenAspectRatio;
  imageSize?: GoogleImagenImageSize;
  numberOfImages?: number;
  outputMimeType?: string;
  personGeneration?: GoogleImagenPersonGeneration;
};

type GoogleGenerateContentRequestBody = {
  contents: [
    {
      parts: [{ text: string }];
    },
  ];
  generationConfig?: {
    imageConfig?: {
      aspectRatio?: GoogleImagenAspectRatio;
      imageSize?: GoogleImagenImageSize;
    };
    responseMimeType?: string;
  };
};

type GooglePredictRequestBody = {
  instances: [{ prompt: string }];
  parameters?: {
    aspectRatio?: GoogleImagenAspectRatio;
    outputMimeType?: string;
    personGeneration?: GoogleImagenPersonGeneration;
    sampleCount?: number;
  };
};

export type GoogleGenerateRequest = {
  apiMethod: GoogleDirectApiMethod;
  body: GoogleGenerateContentRequestBody | GooglePredictRequestBody;
  rawModelId: string;
  routeModelId: string;
  requestInit: HttpJsonRequestOptions;
  url: string;
};

type GoogleGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
        inline_data?: {
          data?: string;
          mime_type?: string;
          mimeType?: string;
        };
        text?: string;
      }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
};

type GooglePredictResponse = {
  generatedImages?: Array<{
    image?: {
      imageBytes?: string;
      image_bytes?: string;
      mimeType?: string;
      mime_type?: string;
    };
  }>;
  generated_images?: Array<{
    image?: {
      imageBytes?: string;
      image_bytes?: string;
      mimeType?: string;
      mime_type?: string;
    };
  }>;
  predictions?: Array<{
    bytesBase64Encoded?: string;
    mimeType?: string;
    mime_type?: string;
    raiFilteredReason?: string;
  }>;
};

export type GoogleGenerateResponse = GoogleGenerateContentResponse | GooglePredictResponse;

export type GoogleProvider = ImageGenerationProvider<GoogleGenerateResponse>;

export type CreateGoogleProviderOptions = {
  apiBaseUrl?: string;
  env?: Environment;
  fetchFn?: FetchLike;
  httpClient?: HttpClient;
};

export function buildGoogleGenerateRequest(
  input: GoogleGenerateImageInput,
  apiKey: string,
  apiBaseUrl = GOOGLE_GENERATIVE_LANGUAGE_BASE_URL,
): GoogleGenerateRequest {
  const model = requireGoogleDirectModel(input.canonicalModelId);
  const url = `${apiBaseUrl}/models/${model.rawModelId}:${model.apiMethod}`;
  const headers = {
    "x-goog-api-key": apiKey,
  };

  if (model.apiMethod === "generateContent") {
    const imageConfig = compactRecord({
      aspectRatio: input.aspectRatio,
      imageSize: input.imageSize,
    });

    const generationConfig = compactRecord({
      ...(Object.keys(imageConfig).length === 0 ? {} : { imageConfig }),
      responseMimeType: input.outputMimeType,
    });
    const body = {
      contents: [
        {
          parts: [{ text: input.prompt }],
        },
      ],
      ...(Object.keys(generationConfig).length === 0 ? {} : { generationConfig }),
    } satisfies GoogleGenerateContentRequestBody;

    return {
      apiMethod: model.apiMethod,
      body,
      rawModelId: model.rawModelId,
      requestInit: {
        body,
        headers,
        method: "POST",
      },
      routeModelId: model.routeModelId,
      url,
    };
  }

  const parameters = compactRecord({
    aspectRatio: input.aspectRatio,
    outputMimeType: input.outputMimeType,
    personGeneration: input.personGeneration,
    sampleCount: input.numberOfImages,
  });
  const body = {
    instances: [{ prompt: input.prompt }],
    ...(Object.keys(parameters).length === 0 ? {} : { parameters }),
  } satisfies GooglePredictRequestBody;

  return {
    apiMethod: model.apiMethod,
    body,
    rawModelId: model.rawModelId,
    requestInit: {
      body,
      headers,
      method: "POST",
    },
    routeModelId: model.routeModelId,
    url,
  };
}

export function normalizeGoogleGenerateResponse(
  input: GoogleGenerateImageInput,
  response: GoogleGenerateResponse,
): NormalizedProviderResult<GoogleGenerateResponse> {
  const model = requireGoogleDirectModel(input.canonicalModelId);

  if (model.apiMethod === "generateContent") {
    if (!isGoogleGenerateContentResponse(response)) {
      throwInvalidResponse(input.canonicalModelId, "generateContent");
    }

    return normalizeGoogleGenerateContentResponse(
      input.canonicalModelId,
      model.routeModelId,
      response,
    );
  }

  if (!isGooglePredictResponse(response)) {
    throwInvalidResponse(input.canonicalModelId, "predict");
  }

  return normalizeGooglePredictResponse(input.canonicalModelId, model.routeModelId, response);
}

export function createGoogleProvider(options: CreateGoogleProviderOptions = {}): GoogleProvider {
  const httpClient =
    options.httpClient ?? createHttpClient(options.fetchFn ? { fetchFn: options.fetchFn } : {});

  return {
    async generateImage(input) {
      const apiKey = requireProviderApiKey("google", options.env);
      const request = buildGoogleGenerateRequest(input, apiKey, options.apiBaseUrl);
      const response = await httpClient.requestJson<GoogleGenerateResponse>(
        request.url,
        request.requestInit,
      );

      return normalizeGoogleGenerateResponse(input, response);
    },
    id: "google",
    supportsCanonicalModel(canonicalModelId) {
      return isGoogleDirectModel(canonicalModelId);
    },
  };
}

function normalizeGoogleGenerateContentResponse(
  canonicalModelId: CanonicalModelId,
  routeModelId: string,
  response: GoogleGenerateContentResponse,
): NormalizedProviderResult<GoogleGenerateContentResponse> {
  const assets: NormalizedOutputAsset[] = [];
  const textResponses: string[] = [];

  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inlineData = part.inlineData ?? part.inline_data;
      const text = part.text?.trim();

      if (inlineData?.data) {
        assets.push({
          base64Data: inlineData.data,
          mimeType:
            part.inlineData?.mimeType ??
            part.inline_data?.mimeType ??
            part.inline_data?.mime_type ??
            "image/png",
        });
      }

      if (text) {
        textResponses.push(text);
      }
    }
  }

  if (assets.length === 0) {
    throwNoImageAssets(canonicalModelId);
  }

  return {
    assets,
    canonicalModelId,
    model: canonicalModelId,
    provider: "google",
    rawResponse: response,
    ...(textResponses.length === 0 ? {} : { revisedPrompt: textResponses.join("\n") }),
    routeModelId,
    ...(response.promptFeedback?.blockReason
      ? {
          warnings: [`Prompt blocked: ${response.promptFeedback.blockReason}`],
        }
      : {}),
  };
}

function normalizeGooglePredictResponse(
  canonicalModelId: CanonicalModelId,
  routeModelId: string,
  response: GooglePredictResponse,
): NormalizedProviderResult<GooglePredictResponse> {
  const assets: NormalizedOutputAsset[] = [];
  const warnings: string[] = [];

  for (const generatedImage of [
    ...(response.generatedImages ?? []),
    ...(response.generated_images ?? []),
  ]) {
    const image = generatedImage.image;
    const base64Data = image?.imageBytes ?? image?.image_bytes;

    if (!base64Data) {
      continue;
    }

    assets.push({
      base64Data,
      mimeType: image?.mimeType ?? image?.mime_type ?? "image/png",
    });
  }

  for (const prediction of response.predictions ?? []) {
    if (prediction.bytesBase64Encoded) {
      assets.push({
        base64Data: prediction.bytesBase64Encoded,
        mimeType: prediction.mimeType ?? prediction.mime_type ?? "image/png",
      });
    }

    if (prediction.raiFilteredReason) {
      warnings.push(`Google safety filter: ${prediction.raiFilteredReason}`);
    }
  }

  if (assets.length === 0) {
    throwNoImageAssets(canonicalModelId);
  }

  return {
    assets,
    canonicalModelId,
    model: canonicalModelId,
    provider: "google",
    rawResponse: response,
    routeModelId,
    ...(warnings.length === 0 ? {} : { warnings }),
  };
}

function throwNoImageAssets(canonicalModelId: CanonicalModelId): never {
  throw new AppError(
    "PROVIDER_RESPONSE_INVALID",
    `Google direct provider returned no image assets for ${canonicalModelId}.`,
  );
}

function throwInvalidResponse(
  canonicalModelId: CanonicalModelId,
  apiMethod: GoogleDirectApiMethod,
): never {
  throw new AppError(
    "PROVIDER_RESPONSE_INVALID",
    `Google direct provider returned an invalid ${apiMethod} response for ${canonicalModelId}.`,
  );
}

function compactRecord<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function requireGoogleDirectModel(canonicalModelId: CanonicalModelId) {
  const model = getGoogleDirectModelSpec(canonicalModelId);

  if (model) {
    return model;
  }

  throw new AppError(
    "MODEL_UNSUPPORTED",
    `Google direct provider does not support canonical model "${canonicalModelId}".`,
  );
}

function isGoogleGenerateContentResponse(
  response: GoogleGenerateResponse,
): response is GoogleGenerateContentResponse {
  return "candidates" in response || "promptFeedback" in response;
}

function isGooglePredictResponse(
  response: GoogleGenerateResponse,
): response is GooglePredictResponse {
  return (
    "generatedImages" in response || "generated_images" in response || "predictions" in response
  );
}
