import { type Environment, requireProviderApiKey } from "../config/env.js";
import { ProviderError } from "../core/errors.js";
import type { CanonicalModelId, ModelRoute } from "../core/types.js";
import { type HttpClient, createHttpClient } from "../http/client.js";
import type { NormalizedOutputAsset } from "../io/outputs.js";
import { getRouteForCanonicalModelIdAndProvider } from "../registry/routes.js";
import type {
  ProviderAdapter,
  ProviderGenerateRequest,
  ProviderGenerateResult,
  ProviderInvocationOptions,
} from "./base.js";

const REPLICATE_API_BASE_URL = "https://api.replicate.com/v1";
const REPLICATE_TERMINAL_STATUSES = ["succeeded", "failed", "canceled"] as const;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;

type ReplicateRouteHandler = {
  buildInput: (request: ProviderGenerateRequest) => Record<string, unknown>;
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

export type ReplicateProviderOptions = {
  apiBaseUrl?: string;
  defaultEnv?: Environment;
  httpClient?: HttpClient;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const REPLICATE_ROUTE_HANDLERS: Partial<Record<CanonicalModelId, ReplicateRouteHandler>> = {
  "flux-1-schnell": {
    buildInput: buildFluxInput,
  },
  "flux-1-kontext-pro": {
    buildInput: buildFluxInput,
  },
  "flux-2-pro": {
    buildInput: buildFluxInput,
  },
  "flux-2-dev": {
    buildInput: buildFluxInput,
  },
  "flux-2-flex": {
    buildInput: buildFluxInput,
  },
  "kling-v1": {
    buildInput: buildKlingInput,
  },
};

function buildFluxInput(request: ProviderGenerateRequest): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: request.prompt,
  };

  if (request.aspectRatio) {
    input.aspect_ratio = request.aspectRatio;
  }

  if (request.negativePrompt) {
    input.negative_prompt = request.negativePrompt;
  }

  if (request.outputFormat) {
    input.output_format = request.outputFormat;
  }

  if (request.seed !== undefined) {
    input.seed = request.seed;
  }

  if (request.inputImage) {
    input.input_image = request.inputImage;
  }

  return input;
}

function buildKlingInput(request: ProviderGenerateRequest): Record<string, unknown> {
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

  if (request.seed !== undefined) {
    input.seed = request.seed;
  }

  if (request.inputImage) {
    input.image = request.inputImage;
  }

  return input;
}

function getReplicateRouteHandler(
  canonicalModelId: CanonicalModelId,
): ReplicateRouteHandler | undefined {
  return REPLICATE_ROUTE_HANDLERS[canonicalModelId];
}

function getRequiredReplicateRoute(canonicalModelId: CanonicalModelId): ModelRoute {
  const route = getRouteForCanonicalModelIdAndProvider(canonicalModelId, "replicate");

  if (route && getReplicateRouteHandler(canonicalModelId)) {
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

function isTerminalReplicateStatus(
  status: string,
): status is (typeof REPLICATE_TERMINAL_STATUSES)[number] {
  return REPLICATE_TERMINAL_STATUSES.some((terminalStatus) => terminalStatus === status);
}

function getPredictionPollUrl(prediction: ReplicatePrediction): string {
  const pollUrl = prediction.urls?.get;

  if (pollUrl) {
    return pollUrl;
  }

  if (prediction.id) {
    return `${REPLICATE_API_BASE_URL}/predictions/${prediction.id}`;
  }

  throw new ProviderError(
    "PROVIDER_INVALID_RESPONSE",
    "Replicate prediction response did not include an id or poll URL.",
    { details: { prediction } },
  );
}

export function isReplicateRouteSupported(route: ModelRoute): boolean {
  return (
    route.provider === "replicate" && Boolean(getReplicateRouteHandler(route.canonicalModelId))
  );
}

export function buildReplicatePredictionSubmission(
  route: ModelRoute,
  request: ProviderGenerateRequest,
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

  const pollUrl = getPredictionPollUrl(currentPrediction);
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

export function normalizeReplicateResult(
  route: ModelRoute,
  prediction: ReplicatePrediction,
): ProviderGenerateResult {
  return {
    assets: normalizeReplicateOutputValue(prediction.output),
    model: route.canonicalModelId,
    provider: "replicate",
    providerMetadata: {
      prediction,
      route: {
        canonicalModelId: route.canonicalModelId,
        rawModelId: route.rawModelId,
        routeModelId: route.routeModelId,
        versionId: route.versionId,
      },
    },
  };
}

export function createReplicateProvider(options: ReplicateProviderOptions = {}): ProviderAdapter & {
  resolveRoute: (canonicalModelId: CanonicalModelId) => ModelRoute;
} {
  const defaultHttpClient = options.httpClient ?? createHttpClient();

  return {
    provider: "replicate",
    supportsRoute: isReplicateRouteSupported,
    resolveRoute: getRequiredReplicateRoute,
    async generate(
      request: ProviderGenerateRequest,
      invocationOptions: ProviderInvocationOptions = {},
    ): Promise<ProviderGenerateResult> {
      const env = invocationOptions.env ?? options.defaultEnv ?? process.env;
      const apiToken = requireProviderApiKey("replicate", env);
      const route = getRequiredReplicateRoute(request.canonicalModelId);
      const httpClient = invocationOptions.httpClient ?? defaultHttpClient;
      const submission = buildReplicatePredictionSubmission(
        route,
        request,
        apiToken,
        options.apiBaseUrl,
      );

      const initialPrediction = await httpClient.requestJson<ReplicatePrediction>(
        submission.endpoint,
        {
          body: submission.body,
          headers: submission.headers,
          method: "POST",
        },
      );

      const terminalPrediction = await pollReplicatePredictionUntilTerminal(initialPrediction, {
        headers: submission.headers,
        httpClient,
        ...(options.maxPollAttempts === undefined
          ? {}
          : { maxPollAttempts: options.maxPollAttempts }),
        ...((invocationOptions.pollIntervalMs ?? options.pollIntervalMs) === undefined
          ? {}
          : { pollIntervalMs: invocationOptions.pollIntervalMs ?? options.pollIntervalMs }),
        ...((invocationOptions.sleep ?? options.sleep) === undefined
          ? {}
          : { sleep: invocationOptions.sleep ?? options.sleep }),
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
    },
  };
}
