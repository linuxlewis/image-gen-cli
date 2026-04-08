import type { Environment } from "../config/env.js";
import type { ModelRoute, ProviderId } from "../core/types.js";
import {
  type GenerateOutputReference,
  renderGenerateErrorOutput,
  renderGenerateJsonOutput,
  renderGenerateTextOutput,
  saveGenerateOutputs,
} from "../io/generate-output.js";
import type { ImageGenerationProvider, NormalizedProviderResult } from "../providers/base.js";
import type {
  ImageBackground,
  ImageOutputFormat,
  ImageQuality,
  ImageSize,
  ProviderImageGenerationRequest,
} from "../providers/base.js";
import { createGoogleProvider } from "../providers/google.js";
import { createOpenAiProvider } from "../providers/openai.js";
import { createReplicateProvider } from "../providers/replicate.js";
import { createTogetherProvider } from "../providers/together.js";
import { getCanonicalModel, getRoutesForModel } from "../registry/models.js";

export type SharedGenerateCommandOptions = Omit<ProviderImageGenerationRequest, "canonicalModelId">;

export type GenerateCommandOptions = SharedGenerateCommandOptions & {
  json?: boolean;
  model: string;
  outputDir?: string;
  provider?: ProviderId;
};

export type GenerateExecutionOptions = SharedGenerateCommandOptions & {
  outputDir?: string;
  outputFileStem?: string;
};

export type GenerateCommandResult = {
  ok: boolean;
  lines: string[];
};

export type GenerateCommandDependencies = {
  createProvider?: (
    provider: ProviderId,
    options: { env?: Environment },
  ) => ImageGenerationProvider;
  env?: Environment;
  fetchFn?: typeof fetch;
};

export type GenerateExecutionResult =
  | {
      ok: true;
      outputs: readonly GenerateOutputReference[];
      result: NormalizedProviderResult;
    }
  | {
      messages: readonly string[];
      ok: false;
    };

type RouteSelectionResult =
  | {
      canonicalModelId: ModelRoute["canonicalModelId"];
      ok: true;
      route: ModelRoute;
    }
  | {
      lines: string[];
      ok: false;
    };

type PreparedGenerateExecution =
  | {
      execute: (options: GenerateExecutionOptions) => Promise<GenerateExecutionResult>;
      ok: true;
      route: ModelRoute;
    }
  | {
      messages: readonly string[];
      ok: false;
    };

export const GENERATE_OPTION_FORMATS = [
  "png",
  "jpeg",
  "webp",
] as const satisfies readonly ImageOutputFormat[];
export const GENERATE_OPTION_QUALITIES = [
  "auto",
  "low",
  "medium",
  "high",
] as const satisfies readonly ImageQuality[];
export const GENERATE_OPTION_SIZES = [
  "auto",
  "1024x1024",
  "1024x1536",
  "1536x1024",
] as const satisfies readonly ImageSize[];
export const GENERATE_OPTION_BACKGROUNDS = [
  "transparent",
  "opaque",
] as const satisfies readonly ImageBackground[];

function createProvider(
  provider: ProviderId,
  options: { env?: Environment },
): ImageGenerationProvider {
  switch (provider) {
    case "openai":
      return createOpenAiProvider(options);
    case "google":
      return createGoogleProvider(options);
    case "together":
      return createTogetherProvider(options);
    case "replicate":
      return createReplicateProvider(options);
  }
}

export function selectGenerateRoute(
  options: Pick<GenerateCommandOptions, "model" | "provider">,
): RouteSelectionResult {
  const model = getCanonicalModel(options.model);

  if (!model) {
    return {
      lines: [`Unknown model: ${options.model}`],
      ok: false,
    };
  }

  const routes = getRoutesForModel(options.model);

  if (options.provider) {
    const route = routes.find((entry) => entry.provider === options.provider);

    if (!route) {
      return {
        lines: [
          `No route found for model ${model.canonicalModelId} and provider ${options.provider}.`,
        ],
        ok: false,
      };
    }

    return {
      canonicalModelId: model.canonicalModelId,
      ok: true,
      route,
    };
  }

  if (routes.length === 1) {
    const route = routes[0];

    if (!route) {
      return {
        lines: [`No routes are configured for model ${model.canonicalModelId}.`],
        ok: false,
      };
    }

    return {
      canonicalModelId: model.canonicalModelId,
      ok: true,
      route,
    };
  }

  if (routes.length === 0) {
    return {
      lines: [`No routes are configured for model ${model.canonicalModelId}.`],
      ok: false,
    };
  }

  return {
    lines: [
      `Ambiguous provider selection for model ${model.canonicalModelId}.`,
      `Available providers: ${routes.map((route) => route.provider).join(", ")}`,
      "Pass --provider <provider> to choose a route.",
    ],
    ok: false,
  };
}

function errorToLines(error: unknown): string[] {
  if (error instanceof Error) {
    return [error.message];
  }

  return ["An unexpected error occurred during generation."];
}

export function prepareGenerateExecution(
  options: Pick<GenerateCommandOptions, "model" | "provider">,
  dependencies: GenerateCommandDependencies = {},
): PreparedGenerateExecution {
  const routeSelection = selectGenerateRoute(options);

  if (!routeSelection.ok) {
    return {
      messages: routeSelection.lines,
      ok: false,
    };
  }

  try {
    const providerOptions = dependencies.env === undefined ? {} : { env: dependencies.env };
    const provider =
      dependencies.createProvider?.(routeSelection.route.provider, providerOptions) ??
      createProvider(routeSelection.route.provider, providerOptions);

    return {
      async execute(options: GenerateExecutionOptions): Promise<GenerateExecutionResult> {
        const { outputDir, outputFileStem, ...request } = options;

        try {
          const result = await provider.generateImage({
            canonicalModelId: routeSelection.canonicalModelId,
            ...request,
          });
          const outputs = await saveGenerateOutputs(result, {
            ...(dependencies.fetchFn === undefined ? {} : { fetchFn: dependencies.fetchFn }),
            ...(outputDir === undefined ? {} : { outputDir }),
            ...(outputFileStem === undefined ? {} : { fileStemPrefix: outputFileStem }),
          });

          return {
            ok: true,
            outputs,
            result,
          };
        } catch (error) {
          return {
            messages: errorToLines(error),
            ok: false,
          };
        }
      },
      ok: true,
      route: routeSelection.route,
    };
  } catch (error) {
    return {
      messages: errorToLines(error),
      ok: false,
    };
  }
}

export async function runGenerateCommand(
  options: GenerateCommandOptions,
  dependencies: GenerateCommandDependencies = {},
): Promise<GenerateCommandResult> {
  const preparedExecution = prepareGenerateExecution(options, dependencies);

  if (!preparedExecution.ok) {
    return {
      lines: renderGenerateErrorOutput(preparedExecution.messages, options.json ?? false),
      ok: false,
    };
  }

  const { json: asJson, model: _model, provider: _provider, ...executionOptions } = options;
  const execution = await preparedExecution.execute(executionOptions);

  if (!execution.ok) {
    return {
      lines: renderGenerateErrorOutput(execution.messages, asJson ?? false),
      ok: false,
    };
  }

  return {
    lines:
      asJson === true
        ? renderGenerateJsonOutput(execution.result, execution.outputs)
        : renderGenerateTextOutput(execution.result, execution.outputs),
    ok: true,
  };
}
