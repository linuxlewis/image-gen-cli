import { renderModelsList } from "./commands/models-list.js";
import { renderProvidersList } from "./commands/providers-list.js";
import { renderRoutesList } from "./commands/routes-list.js";
import { MODEL_FAMILIES, type ModelFamily, PROVIDER_IDS, type ProviderId } from "./core/types.js";

type CliResult = {
  exitCode: number;
  lines: string[];
};

function renderHelp(): string[] {
  return [
    "Usage:",
    "  image-gen-cli providers list",
    "  image-gen-cli models list [--family <family>] [--provider <provider>]",
    "  image-gen-cli routes list --model <model> [--provider <provider>]",
    "",
    "Options:",
    "  -h, --help             Show this help message",
    `  --family <family>      Filter models by family (${MODEL_FAMILIES.join(", ")})`,
    `  --provider <provider>  Filter by provider (${PROVIDER_IDS.join(", ")})`,
    "  --model <model>        Select a canonical model id or alias for route lookup",
  ];
}

function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function findAllowedValue<T extends string>(
  values: readonly T[],
  value: string | undefined,
): T | undefined {
  if (!value) {
    return undefined;
  }

  return values.find((entry) => entry === value);
}

function invalidProviderResult(provider: string): CliResult {
  return {
    exitCode: 1,
    lines: [`Unknown provider: ${provider}`, `Available providers: ${PROVIDER_IDS.join(", ")}`],
  };
}

function parseModelsList(args: readonly string[]): CliResult {
  const familyValue = readFlagValue(args, "--family");
  const providerValue = readFlagValue(args, "--provider");
  const family = findAllowedValue(MODEL_FAMILIES, familyValue);
  const provider = findAllowedValue(PROVIDER_IDS, providerValue);

  if (familyValue && !family) {
    return {
      exitCode: 1,
      lines: [`Unknown family: ${familyValue}`, `Available families: ${MODEL_FAMILIES.join(", ")}`],
    };
  }

  if (providerValue && !provider) {
    return invalidProviderResult(providerValue);
  }

  return {
    exitCode: 0,
    lines: renderModelsList({
      ...(family ? { family } : {}),
      ...(provider ? { provider } : {}),
    }),
  };
}

function parseRoutesList(args: readonly string[]): CliResult {
  const model = readFlagValue(args, "--model");
  const providerValue = readFlagValue(args, "--provider");
  const provider = findAllowedValue(PROVIDER_IDS, providerValue);

  if (!model) {
    return {
      exitCode: 1,
      lines: ["Missing required flag: --model"],
    };
  }

  if (providerValue && !provider) {
    return invalidProviderResult(providerValue);
  }

  const result = renderRoutesList({
    model,
    ...(provider ? { provider } : {}),
  });

  return {
    exitCode: result.ok ? 0 : 1,
    lines: result.lines,
  };
}

function resolveCliResult(args: string[]): CliResult {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return {
      exitCode: 0,
      lines: renderHelp(),
    };
  }

  const [group, command, ...rest] = args;

  if (group === "providers" && command === "list") {
    return {
      exitCode: 0,
      lines: renderProvidersList(),
    };
  }

  if (group === "models" && command === "list") {
    return parseModelsList(rest);
  }

  if (group === "routes" && command === "list") {
    return parseRoutesList(rest);
  }

  return {
    exitCode: 1,
    lines: [`Unknown command: ${args.join(" ")}`, "", ...renderHelp()],
  };
}

export function renderCliOutput(args: string[]): string[] {
  return resolveCliResult(args).lines;
}

export function runCli(args: string[]): number {
  const result = resolveCliResult(args);

  for (const line of result.lines) {
    console.log(line);
  }

  return result.exitCode;
}
