import type { Environment } from "../config/env.js";
import type { ModelRoute, ProviderId } from "../core/types.js";
import { renderNormalizedOutput } from "../io/outputs.js";
import type { ImageGenerationProvider, ProviderImageGenerationRequest } from "../providers/base.js";
import { createGoogleProvider } from "../providers/google.js";
import { createOpenAiProvider } from "../providers/openai.js";
import { createReplicateProvider } from "../providers/replicate.js";
import { createTogetherProvider } from "../providers/together.js";
import { getCanonicalModel, getRoutesForModel } from "../registry/models.js";

export type GenerateCommandOptions = Omit<ProviderImageGenerationRequest, "canonicalModelId"> & {
  model: string;
  provider?: ProviderId;
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
    return {
      canonicalModelId: model.canonicalModelId,
      ok: true,
      route: routes[0],
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

export async function runGenerateCommand(
  options: GenerateCommandOptions,
  dependencies: GenerateCommandDependencies = {},
): Promise<GenerateCommandResult> {
  const routeSelection = selectGenerateRoute(options);

  if (!routeSelection.ok) {
    return routeSelection;
  }

  try {
    const { model: _model, provider: _provider, ...request } = options;
    const provider =
      dependencies.createProvider?.(routeSelection.route.provider, { env: dependencies.env }) ??
      createProvider(routeSelection.route.provider, { env: dependencies.env });
    const result = await provider.generateImage({
      canonicalModelId: routeSelection.canonicalModelId,
      ...request,
    });

    return {
      lines: renderNormalizedOutput(result),
      ok: true,
    };
  } catch (error) {
    return {
      lines: errorToLines(error),
      ok: false,
    };
  }
}
