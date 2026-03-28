import type { ProviderId } from "../core/types.js";
import { getCanonicalModel, getRoutesForModel } from "../registry/models.js";
import { renderTable } from "./format-table.js";

export type RoutesListOptions = {
  model: string;
  provider?: ProviderId;
};

export type RoutesListResult = {
  ok: boolean;
  lines: string[];
};

export function renderRoutesList(options: RoutesListOptions): RoutesListResult {
  const model = getCanonicalModel(options.model);

  if (!model) {
    return {
      ok: false,
      lines: [`Unknown model: ${options.model}`],
    };
  }

  const routes = getRoutesForModel(options.model).filter(
    (route) => !options.provider || route.provider === options.provider,
  );

  if (routes.length === 0) {
    return {
      ok: false,
      lines: [
        `No routes found for model ${model.canonicalModelId}${
          options.provider ? ` and provider ${options.provider}` : ""
        }.`,
      ],
    };
  }

  return {
    ok: true,
    lines: [
      `Routes for ${model.canonicalModelId}`,
      "",
      ...renderTable(
        ["Provider", "Type", "Route Model ID", "Raw Model ID", "Status", "Confidence"],
        routes.map((route) => [
          route.provider,
          route.providerType,
          route.routeModelId,
          route.rawModelId ?? "-",
          route.status,
          route.confidence,
        ]),
      ),
    ],
  };
}
