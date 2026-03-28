import type { Environment } from "../config/env.js";
import { requireProviderApiKey } from "../config/env.js";
import { HttpError, ProviderAuthError, ProviderError } from "../core/errors.js";
import type { CanonicalModelId, ModelRoute } from "../core/types.js";
import { type HttpClient, createHttpClient } from "../http/client.js";
import type { NormalizedOutputAsset } from "../io/outputs.js";
import { getRouteForCanonicalModelIdAndProvider } from "../registry/routes.js";
import type {
  ImageGenerationProvider,
  ImageOutputFormat,
  NormalizedProviderResult,
  ProviderImageGenerationRequest,
} from "./base.js";

const REPLICATE_API_BASE_URL = "https://api.replicate.com/v1";
const REPLICATE_TERMINAL_STATUSES = ["succeeded", "failed", "canceled"] as const;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;
const REPLICATE_AUTH_ERROR_MESSAGE =
  "Replicate authentication failed. Check that REPLICATE_API_TOKEN is set to a valid API token.";

type ReplicateRouteHandler = {
  buildInput: (request: ProviderImageGenerationRequest) => Record<string, unknown>;
};

export type ReplicatePredictionStatus =
  | "starting"
  | "processing"
  | (typeof REPLICATE_TERMINAL_STATUSES)[number];

export type ReplicatePrediction = {
  completed_at?: string | null;
  created_at?: string;
  data_removed?: boolean;
  error?: string | null;
  id: string;
  input?: Record<string, unknown>;
  logs?: string | null;
  metrics?: Record<string, unknown>;
  model?: string;
  output?: unknown;
  started_at?: string | null;
  status: ReplicatePredictionStatus | string;
  urls?: {
    cancel?: string;
    get?: string;
    stream?: string;
  };
  version?: string;
};

export type ReplicatePredictionSubmission = {
  endpoint: string;
  headers: Headers;
  body: {
    input: Record<string, unknown>;
  };
};

export type CreateReplicateProviderOptions = {
  apiBaseUrl?: string;
  env?: Environment;
  httpClient?: HttpClient;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const REPLICATE_ROUTE_HANDLERS: Partial<Record<CanonicalModelId, ReplicateRouteHandler>> = {
  "flux-1-schnell": {
    buildInput: buildFluxSchnellInput,
  },
  "flux-1-kontext-pro": {
    buildInput: buildFluxKontextInput,
  },
  "flux-2-pro": {
    buildInput: buildFlux2Input,
  },
  "flux-2-dev": {
    buildInput: buildFlux2Input,
  },
  "flux-2-flex": {
    buildInput: buildFlux2Input,
  },
  "kling-v1": {
    buildInput: buildKlingInput,
  },
};

function normalizeReplicateOutputFormat(
  outputFormat: ProviderImageGenerationRequest["outputFormat"],
): "jpg" | "png" | "webp" | undefined {
  if (!outputFormat) {
    return undefined;
  }

  if (outputFormat === "jpeg") {
    return "jpg";
  }

  return outputFormat;
}

function normalizeProviderOutputFormat(outputFormat: unknown): ImageOutputFormat | undefined {
  if (outputFormat === "jpg" || outputFormat === "jpeg") {
    return "jpeg";
  }

  if (outputFormat === "png" || outputFormat === "webp") {
    return outputFormat;
  }

  return undefined;
}

function buildFluxSchnellInput(request: ProviderImageGenerationRequest): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: request.prompt,
  };

  if (request.aspectRatio) {
    input.aspect_ratio = request.aspectRatio;
  }

  const outputFormat = normalizeReplicateOutputFormat(request.outputFormat);

  if (outputFormat) {
    input.output_format = outputFormat;
  }

  if (request.outputCompression !== undefined) {
    input.output_quality = request.outputCompression;
  }

  if (request.seed !== undefined) {
    input.seed = request.seed;
  }

  return input;
}

function buildFluxKontextInput(request: ProviderImageGenerationRequest): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: request.prompt,
  };

  if (request.aspectRatio) {
    input.aspect_ratio = request.aspectRatio;
  }

  if (request.inputImage) {
    input.input_image = request.inputImage;
  }

  const outputFormat = normalizeReplicateOutputFormat(request.outputFormat);

  if (outputFormat) {
    input.output_format = outputFormat;
  }

  if (request.seed !== undefined) {
    input.seed = request.seed;
  }

  return input;
}

function buildFlux2Input(request: ProviderImageGenerationRequest): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: request.prompt,
  };

  if (request.aspectRatio) {
    input.aspect_ratio = request.aspectRatio;
  }

  if (request.inputImage) {
    input.input_images = [request.inputImage];
  }

  const outputFormat = normalizeReplicateOutputFormat(request.outputFormat);

  if (outputFormat) {
    input.output_format = outputFormat;
  }

  if (request.outputCompression !== undefined) {
    input.output_quality = request.outputCompression;
  }

  if (request.seed !== undefined) {
    input.seed = request.seed;
  }

  return input;
}

function buildKlingInput(request: ProviderImageGenerationRequest): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: request.prompt,
  };

  if (request.aspectRatio) {
    input.aspect_ratio = request.aspectRatio;
  }

  if (request.durationSeconds !== undefined) {
    input.duration = request.durationSeconds;
  }

  if (request.negativePrompt) {
    input.negative_prompt = request.negativePrompt;
  }

  if (request.inputImage) {
    input.start_image = request.inputImage;
  }

  return input;
}

function getReplicateRouteHandler(
  canonicalModelId: CanonicalModelId,
): ReplicateRouteHandler | undefined {
  return REPLICATE_ROUTE_HANDLERS[canonicalModelId];
}

export function getReplicateRouteForCanonicalModel(
  canonicalModelId: CanonicalModelId,
): ModelRoute | undefined {
  const route = getRouteForCanonicalModelIdAndProvider(canonicalModelId, "replicate");

  if (!route || !getReplicateRouteHandler(canonicalModelId)) {
    return undefined;
  }

  return route;
}

function getRequiredReplicateRoute(canonicalModelId: CanonicalModelId): ModelRoute {
  const route = getReplicateRouteForCanonicalModel(canonicalModelId);

  if (route) {
    return route;
  }

  throw new ProviderError(
    "PROVIDER_UNSUPPORTED_MODEL",
    `Replicate does not support canonical model "${canonicalModelId}".`,
  );
}

function createReplicateHeaders(apiToken: string): Headers {
  return new Headers({
    accept: "application/json",
    authorization: `Bearer ${apiToken}`,
    "content-type": "application/json",
  });
}

function getAuthErrorMessage(error: HttpError): string {
  const responseBody = error.details?.responseBody;

  if (typeof responseBody !== "string") {
    return REPLICATE_AUTH_ERROR_MESSAGE;
  }

  try {
    const parsed = JSON.parse(responseBody);
    const providerMessage =
      typeof parsed.detail === "string"
        ? parsed.detail.trim()
        : typeof parsed.error === "string"
          ? parsed.error.trim()
          : typeof parsed.title === "string"
            ? parsed.title.trim()
            : undefined;

    if (providerMessage) {
      return `Replicate authentication failed: ${providerMessage}`;
    }
  } catch {
    // Keep the fallback message when the provider response is not valid JSON.
  }

  return REPLICATE_AUTH_ERROR_MESSAGE;
}

function isTerminalReplicateStatus(
  status: string,
): status is (typeof REPLICATE_TERMINAL_STATUSES)[number] {
  return REPLICATE_TERMINAL_STATUSES.some((terminalStatus) => terminalStatus === status);
}

function getPredictionPollUrl(
  prediction: ReplicatePrediction,
  apiBaseUrl = REPLICATE_API_BASE_URL,
): string {
  const pollUrl = prediction.urls?.get;

  if (pollUrl) {
    return pollUrl;
  }

  if (prediction.id) {
    return `${apiBaseUrl}/predictions/${prediction.id}`;
  }

  throw new ProviderError(
    "PROVIDER_INVALID_RESPONSE",
    "Replicate prediction response did not include an id or poll URL.",
    { details: { prediction } },
  );
}

export function supportsReplicateCanonicalModel(canonicalModelId: CanonicalModelId): boolean {
  return getReplicateRouteForCanonicalModel(canonicalModelId) !== undefined;
}

export function buildReplicatePredictionSubmission(
  route: ModelRoute,
  request: ProviderImageGenerationRequest,
  apiToken: string,
  apiBaseUrl = REPLICATE_API_BASE_URL,
): ReplicatePredictionSubmission {
  const handler = getReplicateRouteHandler(route.canonicalModelId);

  if (route.provider !== "replicate" || !handler) {
    throw new ProviderError(
      "PROVIDER_UNSUPPORTED_MODEL",
      `Replicate does not support canonical model "${route.canonicalModelId}".`,
      { details: { route } },
    );
  }

  const [owner, modelName, ...rest] = route.routeModelId.split("/");

  if (!owner || !modelName || rest.length > 0) {
    throw new ProviderError(
      "PROVIDER_INVALID_REQUEST",
      `Invalid Replicate route model id "${route.routeModelId}". Expected "<owner>/<model>".`,
      { details: { routeModelId: route.routeModelId } },
    );
  }

  return {
    endpoint: `${apiBaseUrl}/models/${owner}/${modelName}/predictions`,
    headers: createReplicateHeaders(apiToken),
    body: {
      input: handler.buildInput(request),
    },
  };
}

export async function pollReplicatePredictionUntilTerminal(
  prediction: ReplicatePrediction,
  options: {
    apiBaseUrl?: string;
    headers: Headers;
    httpClient: HttpClient;
    maxPollAttempts?: number;
    pollIntervalMs?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<ReplicatePrediction> {
  let currentPrediction = prediction;

  if (isTerminalReplicateStatus(currentPrediction.status)) {
    return currentPrediction;
  }

  const pollUrl = getPredictionPollUrl(currentPrediction, options.apiBaseUrl);
  const maxPollAttempts = options.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    await sleep(pollIntervalMs);
    currentPrediction = await options.httpClient.requestJson<ReplicatePrediction>(pollUrl, {
      headers: options.headers,
      method: "GET",
    });

    if (isTerminalReplicateStatus(currentPrediction.status)) {
      return currentPrediction;
    }
  }

  throw new ProviderError(
    "PROVIDER_PREDICTION_FAILED",
    `Replicate prediction ${currentPrediction.id} did not reach a terminal state after ${maxPollAttempts} polls.`,
    { details: { prediction: currentPrediction } },
  );
}

function normalizeReplicateOutputValue(value: unknown): NormalizedOutputAsset[] {
  if (typeof value === "string") {
    return [{ url: value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeReplicateOutputValue(item));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const outputRecord = value as Record<string, unknown>;
  const url = typeof outputRecord.url === "string" ? outputRecord.url : undefined;
  const mimeType =
    typeof outputRecord.mime_type === "string"
      ? outputRecord.mime_type
      : typeof outputRecord.content_type === "string"
        ? outputRecord.content_type
        : undefined;
  const filename =
    typeof outputRecord.file_name === "string"
      ? outputRecord.file_name
      : typeof outputRecord.filename === "string"
        ? outputRecord.filename
        : undefined;
  const base64Data =
    typeof outputRecord.b64_json === "string"
      ? outputRecord.b64_json
      : typeof outputRecord.base64 === "string"
        ? outputRecord.base64
        : undefined;

  if (!url && !base64Data) {
    return [];
  }

  return [
    {
      ...(base64Data ? { base64Data } : {}),
      ...(filename ? { filename } : {}),
      ...(mimeType ? { mimeType } : {}),
      ...(url ? { url } : {}),
    },
  ];
}

function normalizeCreatedAt(createdAt: string | undefined): number | undefined {
  if (!createdAt) {
    return undefined;
  }

  const timestamp = Date.parse(createdAt);

  return Number.isNaN(timestamp) ? undefined : timestamp;
}

export function normalizeReplicateResult(
  route: ModelRoute,
  prediction: ReplicatePrediction,
): NormalizedProviderResult<ReplicatePrediction> {
  const outputFormat = normalizeProviderOutputFormat(prediction.input?.output_format);
  const createdAt = normalizeCreatedAt(prediction.created_at);

  return {
    assets: normalizeReplicateOutputValue(prediction.output),
    canonicalModelId: route.canonicalModelId,
    ...(createdAt === undefined ? {} : { createdAt }),
    model: route.canonicalModelId,
    ...(outputFormat ? { outputFormat } : {}),
    provider: "replicate",
    rawResponse: prediction,
    routeModelId: route.routeModelId,
  };
}

export function createReplicateProvider(
  options: CreateReplicateProviderOptions = {},
): ImageGenerationProvider<ReplicatePrediction> {
  const apiToken = requireProviderApiKey("replicate", options.env);
  const httpClient = options.httpClient ?? createHttpClient();

  return {
    async generateImage(
      request: ProviderImageGenerationRequest,
    ): Promise<NormalizedProviderResult<ReplicatePrediction>> {
      const route = getRequiredReplicateRoute(request.canonicalModelId);
      const submission = buildReplicatePredictionSubmission(
        route,
        request,
        apiToken,
        options.apiBaseUrl,
      );

      try {
        const initialPrediction = await httpClient.requestJson<ReplicatePrediction>(
          submission.endpoint,
          {
            body: submission.body,
            headers: submission.headers,
            method: "POST",
          },
        );

        const terminalPrediction = await pollReplicatePredictionUntilTerminal(initialPrediction, {
          ...(options.apiBaseUrl === undefined ? {} : { apiBaseUrl: options.apiBaseUrl }),
          headers: submission.headers,
          httpClient,
          ...(options.maxPollAttempts === undefined
            ? {}
            : { maxPollAttempts: options.maxPollAttempts }),
          ...(options.pollIntervalMs === undefined
            ? {}
            : { pollIntervalMs: options.pollIntervalMs }),
          ...(options.sleep === undefined ? {} : { sleep: options.sleep }),
        });

        if (terminalPrediction.status !== "succeeded") {
          throw new ProviderError(
            "PROVIDER_PREDICTION_FAILED",
            `Replicate prediction ${terminalPrediction.id} ended with status "${terminalPrediction.status}".`,
            {
              details: {
                error: terminalPrediction.error,
                prediction: terminalPrediction,
              },
            },
          );
        }

        return normalizeReplicateResult(route, terminalPrediction);
      } catch (error) {
        if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
          throw new ProviderAuthError("replicate", getAuthErrorMessage(error), {
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
    id: "replicate",
    supportsCanonicalModel: supportsReplicateCanonicalModel,
  };
}
