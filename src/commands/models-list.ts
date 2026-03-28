import type { ModelFamily, ProviderId } from "../core/types.js";
import { listCanonicalModels } from "../registry/models.js";
import { renderTable } from "./format-table.js";

export type ModelsListOptions = {
  family?: ModelFamily;
  provider?: ProviderId;
};

export function renderModelsList(options: ModelsListOptions = {}): string[] {
  const models = listCanonicalModels(options);

  return [
    "Models",
    "",
    ...renderTable(
      ["Canonical Model ID", "Family", "Vendor", "Status", "Confidence", "Providers"],
      models.map((model) => [
        model.canonicalModelId,
        model.family,
        model.vendor,
        model.status,
        model.confidence,
        model.routes.map((route) => route.provider).join(", "),
      ]),
    ),
  ];
}
