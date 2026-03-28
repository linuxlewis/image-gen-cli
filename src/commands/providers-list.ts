import { listProviders } from "../registry/providers.js";
import { renderTable } from "./format-table.js";

export function renderProvidersList(): string[] {
  const providers = listProviders();

  return [
    "Providers",
    "",
    ...renderTable(
      ["Provider", "Type", "Name"],
      providers.map((provider) => [provider.id, provider.type, provider.displayName]),
    ),
  ];
}
