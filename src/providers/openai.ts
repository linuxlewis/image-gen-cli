import type { Environment } from "../config/env.js";
import { requireProviderApiKey } from "../config/env.js";
import { HttpError, ProviderAuthError } from "../core/errors.js";
import type { CanonicalModelId, ModelRoute } from "../core/types.js";
import type { HttpClient } from "../http/client.js";
import { createHttpClient } from "../http/client.js";
import { getRouteForCanonicalModelIdAndProvider } from "../registry/routes.js";
import type {
  ImageGenerationProvider,
  ImageOutputFormat,
  NormalizedProviderResult,
  ProviderImageGenerationRequest,
  ProviderImageUsage,
} from "./base.js";

const OPENAI_IMAGES_GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_AUTH_ERROR_MESSAGE =
  "OpenAI authentication failed. Check that OPENAI_API_KEY is set to a valid API key.";

export type OpenAiImageGenerationRequestBody = {
  background?: "transparent" | "opaque";
  model: string;
  n?: number;
  output_compression?: number;
  output_format?: ImageOutputFormat;
  prompt: string;
  quality?: "auto" | "low" | "medium" | "high";
  size?: "auto" | "1024x1024" | "1024x1536" | "1536x1024";
  user?: string;
};

export type OpenAiGeneratedImage = {
  b64_json?: string;
  revised_prompt?: string;
  url?: string;
};

export type OpenAiImagesResponse = {
  background?: "transparent" | "opaque";
  created?: number;
  data?: readonly OpenAiGeneratedImage[];
  output_format?: ImageOutputFormat;
  quality?: "low" | "medium" | "high";
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  usage?: {
    input_tokens: number;
    input_tokens_details?: {
      image_tokens?: number;
      text_tokens?: number;
    };
    output_tokens: number;
    total_tokens: number;
  };
};

export type OpenAiHttpRequest = {
  body: OpenAiImageGenerationRequestBody;
  headers: Record<string, string>;
  method: "POST";
  url: typeof OPENAI_IMAGES_GENERATIONS_URL;
};

export type CreateOpenAiProviderOptions = {
  env?: Environment;
  httpClient?: HttpClient;
};

function getAuthErrorMessage(error: HttpError): string {
  const responseBody = error.details?.responseBody;

  if (typeof responseBody !== "string") {
    return OPENAI_AUTH_ERROR_MESSAGE;
  }

  try {
    const parsed = JSON.parse(responseBody);
    const providerMessage = parsed.error?.message?.trim();

    if (providerMessage) {
      return `OpenAI authentication failed: ${providerMessage}`;
    }
  } catch {
    // Keep the fallback message when the provider response is not valid JSON.
  }

  return OPENAI_AUTH_ERROR_MESSAGE;
}

export function getOpenAiRouteForCanonicalModel(
  canonicalModelId: CanonicalModelId,
): ModelRoute | undefined {
  const route = getRouteForCanonicalModelIdAndProvider(canonicalModelId, "openai");
  if (route?.providerType !== "direct") {
    return undefined;
  }

  return route;
}

export function supportsOpenAiCanonicalModel(canonicalModelId: CanonicalModelId): boolean {
  return getOpenAiRouteForCanonicalModel(canonicalModelId) !== undefined;
}

export function buildOpenAiImageGenerationRequest(
  route: ModelRoute,
  request: ProviderImageGenerationRequest,
  apiKey: string,
): OpenAiHttpRequest {
  const body: OpenAiImageGenerationRequestBody = {
    model: route.rawModelId ?? route.routeModelId,
    prompt: request.prompt,
  };

  if (request.background) {
    body.background = request.background;
  }

  if (request.imageCount !== undefined) {
    body.n = request.imageCount;
  }

  if (request.outputCompression !== undefined) {
    body.output_compression = request.outputCompression;
  }

  if (request.outputFormat) {
    body.output_format = request.outputFormat;
  }

  if (request.quality) {
    body.quality = request.quality;
  }

  if (request.size) {
    body.size = request.size;
  }

  if (request.user) {
    body.user = request.user;
  }

  return {
    body,
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
    method: "POST",
    url: OPENAI_IMAGES_GENERATIONS_URL,
  };
}

function normalizeUsage(usage: OpenAiImagesResponse["usage"]): ProviderImageUsage | undefined {
  if (!usage) {
    return undefined;
  }

  const inputTokensDetails =
    usage.input_tokens_details &&
    Object.fromEntries(
      [
        ["imageTokens", usage.input_tokens_details.image_tokens],
        ["textTokens", usage.input_tokens_details.text_tokens],
      ].filter(([, value]) => value !== undefined),
    );

  return {
    inputTokens: usage.input_tokens,
    ...(inputTokensDetails && Object.keys(inputTokensDetails).length > 0
      ? { inputTokensDetails }
      : {}),
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
  };
}

function normalizeAssets(
  data: readonly OpenAiGeneratedImage[] | undefined,
  outputFormat: ImageOutputFormat | undefined,
): NormalizedProviderResult["assets"] {
  const mimeType = outputFormat ? `image/${outputFormat}` : undefined;

  return (data ?? []).map((image) => ({
    ...(image.b64_json ? { base64Data: image.b64_json } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(image.url ? { url: image.url } : {}),
  }));
}

export function normalizeOpenAiImageGenerationResponse(
  route: ModelRoute,
  response: OpenAiImagesResponse,
): NormalizedProviderResult<OpenAiImagesResponse> {
  const revisedPrompt = response.data?.find((image) => image.revised_prompt)?.revised_prompt;
  const usage = normalizeUsage(response.usage);

  return {
    assets: normalizeAssets(response.data, response.output_format),
    canonicalModelId: route.canonicalModelId,
    ...(response.created !== undefined ? { createdAt: response.created } : {}),
    model: route.canonicalModelId,
    provider: "openai",
    rawResponse: response,
    ...(response.output_format ? { outputFormat: response.output_format } : {}),
    ...(response.quality ? { quality: response.quality } : {}),
    ...(revisedPrompt ? { revisedPrompt } : {}),
    routeModelId: route.routeModelId,
    ...(usage ? { usage } : {}),
  };
}

export function createOpenAiProvider(
  options: CreateOpenAiProviderOptions = {},
): ImageGenerationProvider<OpenAiImagesResponse> {
  const apiKey = requireProviderApiKey("openai", options.env);
  const httpClient = options.httpClient ?? createHttpClient();

  return {
    async generateImage(
      request: ProviderImageGenerationRequest,
    ): Promise<NormalizedProviderResult<OpenAiImagesResponse>> {
      const route = getOpenAiRouteForCanonicalModel(request.canonicalModelId);

      if (!route) {
        throw new Error(
          `Canonical model "${request.canonicalModelId}" is not supported by the OpenAI direct provider.`,
        );
      }

      const httpRequest = buildOpenAiImageGenerationRequest(route, request, apiKey);
      try {
        const response = await httpClient.requestJson<OpenAiImagesResponse>(httpRequest.url, {
          body: httpRequest.body,
          headers: httpRequest.headers,
          method: httpRequest.method,
        });

        return normalizeOpenAiImageGenerationResponse(route, response);
      } catch (error) {
        if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
          throw new ProviderAuthError("openai", getAuthErrorMessage(error), {
            cause: error,
            details: {
              ...(error.details ?? {}),
              status: error.status,
            },
          });
        }

        throw error;
      }
    },
    id: "openai",
    supportsCanonicalModel: supportsOpenAiCanonicalModel,
  };
}
