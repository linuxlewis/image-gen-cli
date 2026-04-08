import {
  type BulkGenerateCommandDependencies,
  runBulkGenerateCommand,
} from "./commands/generate-bulk.js";
import {
  GENERATE_OPTION_BACKGROUNDS,
  GENERATE_OPTION_FORMATS,
  GENERATE_OPTION_QUALITIES,
  GENERATE_OPTION_SIZES,
  type GenerateCommandDependencies,
  type SharedGenerateCommandOptions,
  runGenerateCommand,
} from "./commands/generate.js";
import { renderModelsList } from "./commands/models-list.js";
import { renderProvidersList } from "./commands/providers-list.js";
import { renderRoutesList } from "./commands/routes-list.js";
import { MODEL_FAMILIES, PROVIDER_IDS } from "./core/types.js";
import { renderGenerateErrorOutput } from "./io/generate-output.js";

type CliResult = {
  exitCode: number;
  lines: string[];
};

export type CliDependencies = GenerateCommandDependencies & BulkGenerateCommandDependencies;

function normalizeArgs(args: readonly string[]): string[] {
  if (args[0] !== "--") {
    return [...args];
  }

  let firstCommandIndex = 0;

  while (args[firstCommandIndex] === "--") {
    firstCommandIndex += 1;
  }

  return args.slice(firstCommandIndex);
}

function renderHelp(): string[] {
  return [
    "Usage:",
    "  image-gen-cli providers list",
    "  image-gen-cli models list [--family <family>] [--provider <provider>]",
    "  image-gen-cli routes list --model <model> [--provider <provider>]",
    "  image-gen-cli generate --model <model> (--prompt <prompt> | --bulk-prompts <file>) [--provider <provider>] [--json] [--output-dir <dir>]",
    "",
    "Options:",
    "  -h, --help                  Show this help message",
    "  --aspect-ratio <ratio>      Provider-specific aspect ratio value",
    `  --background <background>   Background mode for supported providers (${GENERATE_OPTION_BACKGROUNDS.join(", ")})`,
    "  --bulk-prompts <file>       Newline-delimited prompts file for bulk generate mode",
    "  --concurrency <n>           Maximum in-flight bulk generate requests",
    "  --duration-seconds <n>      Video duration for supported models",
    `  --family <family>           Filter models by family (${MODEL_FAMILIES.join(", ")})`,
    `  --format <format>           Output format for supported providers (${GENERATE_OPTION_FORMATS.join(", ")})`,
    "  --image-count <n>           Number of images to request when supported",
    "  --input-image <value>       Input image URL or path for supported providers",
    "  --json                      Render deterministic JSON for generate output",
    "  --model <model>             Select a canonical model id or alias for route lookup",
    "  --negative-prompt <text>    Negative prompt for supported providers",
    "  --output-compression <n>    Output compression/quality setting for supported providers",
    "  --output-dir <dir>          Save generated assets under the target directory",
    `  --provider <provider>       Filter by provider (${PROVIDER_IDS.join(", ")})`,
    "  --prompt <prompt>           Text prompt for single generate mode",
    `  --quality <quality>         Requested quality for supported providers (${GENERATE_OPTION_QUALITIES.join(", ")})`,
    "  --seed <n>                  Random seed for supported providers",
    `  --size <size>               Output size for supported providers (${GENERATE_OPTION_SIZES.join(", ")})`,
    "  --user <value>              User identifier for supported providers",
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

function parseIntegerFlag(
  args: readonly string[],
  flag: string,
  options: {
    minimum?: number;
  } = {},
): { ok: true; value?: number } | { message: string; ok: false } {
  if (!args.includes(flag)) {
    return {
      ok: true,
    };
  }

  const value = readFlagValue(args, flag);

  if (!value) {
    return {
      message: `Missing required value for flag: ${flag}`,
      ok: false,
    };
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    return {
      message: `Invalid integer value for flag ${flag}: ${value}`,
      ok: false,
    };
  }

  if (options.minimum !== undefined && parsed < options.minimum) {
    return {
      message: `Flag ${flag} must be greater than or equal to ${options.minimum}.`,
      ok: false,
    };
  }

  return {
    ok: true,
    value: parsed,
  };
}

function parseStringFlag<T extends string>(
  args: readonly string[],
  flag: string,
  values: readonly T[],
  label: string,
): { ok: true; value?: T } | { message: string; ok: false } {
  if (!args.includes(flag)) {
    return {
      ok: true,
    };
  }

  const rawValue = readFlagValue(args, flag);

  if (!rawValue) {
    return {
      message: `Missing required value for flag: ${flag}`,
      ok: false,
    };
  }

  const value = findAllowedValue(values, rawValue);

  if (!value) {
    return {
      message: `Unknown ${label}: ${rawValue}. Available ${label}s: ${values.join(", ")}`,
      ok: false,
    };
  }

  return {
    ok: true,
    value,
  };
}

function parseGenerateRequestOptions(
  args: readonly string[],
):
  | { ok: true; value: Omit<SharedGenerateCommandOptions, "prompt"> }
  | { message: string; ok: false } {
  const outputFormat = parseStringFlag(args, "--format", GENERATE_OPTION_FORMATS, "format");

  if (!outputFormat.ok) {
    return outputFormat;
  }

  const quality = parseStringFlag(args, "--quality", GENERATE_OPTION_QUALITIES, "quality");

  if (!quality.ok) {
    return quality;
  }

  const size = parseStringFlag(args, "--size", GENERATE_OPTION_SIZES, "size");

  if (!size.ok) {
    return size;
  }

  const background = parseStringFlag(
    args,
    "--background",
    GENERATE_OPTION_BACKGROUNDS,
    "background",
  );

  if (!background.ok) {
    return background;
  }

  const imageCount = parseIntegerFlag(args, "--image-count", { minimum: 1 });

  if (!imageCount.ok) {
    return imageCount;
  }

  const outputCompression = parseIntegerFlag(args, "--output-compression", { minimum: 0 });

  if (!outputCompression.ok) {
    return outputCompression;
  }

  const seed = parseIntegerFlag(args, "--seed");

  if (!seed.ok) {
    return seed;
  }

  const durationSeconds = parseIntegerFlag(args, "--duration-seconds", { minimum: 1 });

  if (!durationSeconds.ok) {
    return durationSeconds;
  }

  const outputDir = readFlagValue(args, "--output-dir");
  const aspectRatio = readFlagValue(args, "--aspect-ratio");
  const inputImage = readFlagValue(args, "--input-image");
  const negativePrompt = readFlagValue(args, "--negative-prompt");
  const user = readFlagValue(args, "--user");

  if (args.includes("--output-dir") && !outputDir) {
    return {
      message: "Missing required value for flag: --output-dir",
      ok: false,
    };
  }

  return {
    ok: true,
    value: {
      ...(aspectRatio ? { aspectRatio } : {}),
      ...(background.value ? { background: background.value } : {}),
      ...(durationSeconds.value !== undefined ? { durationSeconds: durationSeconds.value } : {}),
      ...(imageCount.value !== undefined ? { imageCount: imageCount.value } : {}),
      ...(inputImage ? { inputImage } : {}),
      ...(negativePrompt ? { negativePrompt } : {}),
      ...(outputCompression.value !== undefined
        ? { outputCompression: outputCompression.value }
        : {}),
      ...(outputDir ? { outputDir } : {}),
      ...(outputFormat.value ? { outputFormat: outputFormat.value } : {}),
      ...(quality.value ? { quality: quality.value } : {}),
      ...(seed.value !== undefined ? { seed: seed.value } : {}),
      ...(size.value ? { size: size.value } : {}),
      ...(user ? { user } : {}),
    },
  };
}

async function parseGenerate(
  args: readonly string[],
  dependencies: CliDependencies,
): Promise<CliResult> {
  const asJson = args.includes("--json");
  const model = readFlagValue(args, "--model");
  const prompt = readFlagValue(args, "--prompt");
  const bulkPrompts = readFlagValue(args, "--bulk-prompts");
  const providerValue = readFlagValue(args, "--provider");
  const provider = findAllowedValue(PROVIDER_IDS, providerValue);
  const errorResult = (messages: readonly string[]): CliResult => ({
    exitCode: 1,
    lines: renderGenerateErrorOutput(messages, asJson),
  });

  if (!model) {
    return errorResult(["Missing required flag: --model"]);
  }

  if (!prompt && !bulkPrompts) {
    return errorResult(["Missing required flag: --prompt or --bulk-prompts"]);
  }

  if (prompt && bulkPrompts) {
    return errorResult(["Pass either --prompt or --bulk-prompts, not both."]);
  }

  if (providerValue && !provider) {
    return errorResult(invalidProviderResult(providerValue).lines);
  }

  const parsedRequestOptions = parseGenerateRequestOptions(args);

  if (!parsedRequestOptions.ok) {
    return errorResult([parsedRequestOptions.message]);
  }

  if (bulkPrompts) {
    const concurrency = parseIntegerFlag(args, "--concurrency", { minimum: 1 });

    if (!concurrency.ok) {
      return errorResult([concurrency.message]);
    }

    const result = await runBulkGenerateCommand(
      {
        ...(asJson ? { json: true } : {}),
        ...(concurrency.value !== undefined ? { concurrency: concurrency.value } : {}),
        bulkPrompts,
        model,
        ...(provider ? { provider } : {}),
        ...parsedRequestOptions.value,
      },
      dependencies,
    );

    return {
      exitCode: result.ok ? 0 : 1,
      lines: result.lines,
    };
  }

  if (args.includes("--concurrency")) {
    return errorResult(["Flag --concurrency requires --bulk-prompts."]);
  }

  const result = await runGenerateCommand(
    {
      ...(asJson ? { json: true } : {}),
      model,
      ...(provider ? { provider } : {}),
      ...parsedRequestOptions.value,
      prompt: prompt ?? "",
    },
    dependencies,
  );

  return {
    exitCode: result.ok ? 0 : 1,
    lines: result.lines,
  };
}

async function resolveCliResult(
  args: string[],
  dependencies: CliDependencies = {},
): Promise<CliResult> {
  const normalizedArgs = normalizeArgs(args);

  if (
    normalizedArgs.length === 0 ||
    normalizedArgs.includes("--help") ||
    normalizedArgs.includes("-h")
  ) {
    return {
      exitCode: 0,
      lines: renderHelp(),
    };
  }

  const [group, command, ...rest] = normalizedArgs;

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

  if (group === "generate") {
    return parseGenerate(normalizedArgs.slice(1), dependencies);
  }

  return {
    exitCode: 1,
    lines: [`Unknown command: ${normalizedArgs.join(" ")}`, "", ...renderHelp()],
  };
}

export async function renderCliOutput(
  args: string[],
  dependencies: CliDependencies = {},
): Promise<string[]> {
  return (await resolveCliResult(args, dependencies)).lines;
}

export async function runCli(args: string[], dependencies: CliDependencies = {}): Promise<number> {
  const result = await resolveCliResult(args, dependencies);

  for (const line of result.lines) {
    console.log(line);
  }

  return result.exitCode;
}
