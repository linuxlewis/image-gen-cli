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
  ImageSize,
  NormalizedProviderResult,
  ProviderImageGenerationRequest,
} from "./base.js";

const TOGETHER_IMAGE_GENERATIONS_URL = "https://api.together.xyz/v1/images/generations";
const TOGETHER_AUTH_ERROR_MESSAGE =
  "Together authentication failed. Check that TOGETHER_API_KEY is set to a valid API key.";

type TogetherOutputFormat = Exclude<ImageOutputFormat, "webp">;

export type TogetherImageGenerationRequestBody = {
  model: string;
  prompt: string;
  height?: number;
  n?: number;
  output_format?: TogetherOutputFormat;
  width?: number;
};

export type TogetherImageResponseData = {
  b64_json?: string;
  index?: number;
  type?: string;
  url?: string;
};

export type TogetherImageResponse = {
  data?: readonly TogetherImageResponseData[];
  id?: string;
  model?: string;
  warnings?: readonly string[];
};

export type TogetherHttpRequest = {
  body: TogetherImageGenerationRequestBody;
  headers: Record<string, string>;
  method: "POST";
  url: typeof TOGETHER_IMAGE_GENERATIONS_URL;
};

export type CreateTogetherProviderOptions = {
  env?: Environment;
  httpClient?: HttpClient;
};

function getAuthErrorMessage(error: HttpError): string {
  const responseBody = error.details?.responseBody;

  if (typeof responseBody !== "string") {
    return TOGETHER_AUTH_ERROR_MESSAGE;
  }

  try {
    const parsed = JSON.parse(responseBody);
    const providerMessage = parsed.error?.message?.trim();

    if (providerMessage) {
      return `Together authentication failed: ${providerMessage}`;
    }
  } catch {
    // Keep the fallback message when the provider response is not valid JSON.
  }

  return TOGETHER_AUTH_ERROR_MESSAGE;
}

function parseSize(size: ImageSize | undefined): { height: number; width: number } | undefined {
  if (!size || size === "auto") {
    return undefined;
  }

  const [widthText, heightText] = size.split("x");
  const width = Number.parseInt(widthText, 10);
  const height = Number.parseInt(heightText, 10);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Unsupported Together size "${size}".`);
  }

  return { height, width };
}

export function getTogetherRouteForCanonicalModel(
  canonicalModelId: CanonicalModelId,
): ModelRoute | undefined {
  return getRouteForCanonicalModelIdAndProvider(canonicalModelId, "together");
}

export function supportsTogetherCanonicalModel(canonicalModelId: CanonicalModelId): boolean {
  return getTogetherRouteForCanonicalModel(canonicalModelId) !== undefined;
}

export function buildTogetherImageGenerationRequest(
  route: ModelRoute,
  request: ProviderImageGenerationRequest,
  apiKey: string,
): TogetherHttpRequest {
  const body: TogetherImageGenerationRequestBody = {
    model: route.routeModelId,
    prompt: request.prompt,
  };

  if (request.imageCount !== undefined) {
    body.n = request.imageCount;
  }

  if (request.outputFormat) {
    if (request.outputFormat === "webp") {
      throw new Error('Together does not support output format "webp".');
    }

    body.output_format = request.outputFormat;
  }

  const dimensions = parseSize(request.size);

  if (dimensions) {
    body.width = dimensions.width;
    body.height = dimensions.height;
  }

  return {
    body,
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
    method: "POST",
    url: TOGETHER_IMAGE_GENERATIONS_URL,
  };
}

export function normalizeTogetherImageGenerationResponse(
  route: ModelRoute,
  response: TogetherImageResponse,
): NormalizedProviderResult<TogetherImageResponse> {
  const assets = (response.data ?? []).reduce<NormalizedProviderResult["assets"]>(
    (normalizedAssets, asset, index) => {
      if (!asset.b64_json && !asset.url) {
        return normalizedAssets;
      }

      normalizedAssets.push({
        ...(asset.b64_json ? { base64Data: asset.b64_json } : {}),
        filename: `${route.canonicalModelId}-${(asset.index ?? index) + 1}`,
        ...(asset.type?.startsWith("image/") ? { mimeType: asset.type } : {}),
        ...(asset.url ? { url: asset.url } : {}),
      });

      return normalizedAssets;
    },
    [],
  );

  return {
    assets,
    canonicalModelId: route.canonicalModelId,
    model: route.canonicalModelId,
    provider: "together",
    rawResponse: response,
    routeModelId: route.routeModelId,
    ...(response.warnings ? { warnings: response.warnings } : {}),
  };
}

export function createTogetherProvider(
  options: CreateTogetherProviderOptions = {},
): ImageGenerationProvider<TogetherImageResponse> {
  const apiKey = requireProviderApiKey("together", options.env);
  const httpClient = options.httpClient ?? createHttpClient();

  return {
    async generateImage(
      request: ProviderImageGenerationRequest,
    ): Promise<NormalizedProviderResult<TogetherImageResponse>> {
      const route = getTogetherRouteForCanonicalModel(request.canonicalModelId);

      if (!route) {
        throw new Error(
          `Canonical model "${request.canonicalModelId}" is not supported by the Together provider.`,
        );
      }

      const httpRequest = buildTogetherImageGenerationRequest(route, request, apiKey);

      try {
        const response = await httpClient.requestJson<TogetherImageResponse>(httpRequest.url, {
          body: httpRequest.body,
          headers: httpRequest.headers,
          method: httpRequest.method,
        });

        return normalizeTogetherImageGenerationResponse(route, response);
      } catch (error) {
        if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
          throw new ProviderAuthError("together", getAuthErrorMessage(error), {
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
    id: "together",
    supportsCanonicalModel: supportsTogetherCanonicalModel,
  };
}
