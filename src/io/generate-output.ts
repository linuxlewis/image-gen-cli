import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

import type { NormalizedProviderResult } from "../providers/base.js";

export type GenerateOutputReference = {
  filePath?: string;
  filename?: string;
  inlineData?: {
    encoding: "base64";
    length: number;
  };
  mimeType?: string;
  url?: string;
};

export type GenerateJsonOutput = {
  canonicalModel: string;
  createdAt?: number;
  outputFormat?: string;
  outputs: readonly GenerateOutputReference[];
  provider: string;
  providerMetadata?: Record<string, unknown>;
  providerModel: string;
  quality?: string;
  rawResponse: unknown;
  revisedPrompt?: string;
  usage?: Record<string, unknown>;
  warnings?: readonly string[];
};

export type SaveGenerateOutputsOptions = {
  fetchFn?: typeof fetch;
  fileStemPrefix?: string;
  outputDir?: string;
};

type SavedAsset = {
  filePath?: string;
  mimeType?: string;
};

const MIME_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpeg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function renderGenerateTextOutput(
  result: NormalizedProviderResult,
  outputs: readonly GenerateOutputReference[],
): string[] {
  const lines = [
    `Provider: ${result.provider}`,
    `Canonical model: ${result.canonicalModelId}`,
    `Provider model: ${result.routeModelId}`,
    `Outputs: ${outputs.length}`,
  ];

  if (result.revisedPrompt) {
    lines.push(`Revised prompt: ${result.revisedPrompt}`);
  }

  for (const [index, output] of outputs.entries()) {
    const parts = [getGenerateOutputLabel(output, index)];

    if (output.mimeType) {
      parts.push(`mime=${output.mimeType}`);
    }

    if (output.inlineData) {
      parts.push(`inline-data=${output.inlineData.length} chars`);
    }

    if (output.filePath) {
      parts.push(`saved=${output.filePath}`);
    }

    lines.push(parts.join(" | "));
  }

  for (const warning of result.warnings ?? []) {
    lines.push(`Warning: ${warning}`);
  }

  return lines;
}

export function renderGenerateJsonOutput(
  result: NormalizedProviderResult,
  outputs: readonly GenerateOutputReference[],
): string[] {
  return renderStableJsonLines(buildGenerateJsonOutput(result, outputs));
}

export function renderGenerateErrorOutput(messages: readonly string[], asJson: boolean): string[] {
  if (!asJson) {
    return [...messages];
  }

  return renderStableJsonLines({
    error: {
      messages: [...messages],
    },
  });
}

export function buildGenerateJsonOutput(
  result: NormalizedProviderResult,
  outputs: readonly GenerateOutputReference[],
): GenerateJsonOutput {
  return {
    canonicalModel: result.canonicalModelId,
    ...(result.createdAt === undefined ? {} : { createdAt: result.createdAt }),
    ...(result.outputFormat === undefined ? {} : { outputFormat: result.outputFormat }),
    outputs,
    provider: result.provider,
    ...(result.providerMetadata === undefined ? {} : { providerMetadata: result.providerMetadata }),
    providerModel: result.routeModelId,
    ...(result.quality === undefined ? {} : { quality: result.quality }),
    rawResponse: result.rawResponse,
    ...(result.revisedPrompt === undefined ? {} : { revisedPrompt: result.revisedPrompt }),
    ...(result.usage === undefined ? {} : { usage: result.usage }),
    ...(result.warnings === undefined ? {} : { warnings: result.warnings }),
  };
}

export async function saveGenerateOutputs(
  result: NormalizedProviderResult,
  options: SaveGenerateOutputsOptions = {},
): Promise<GenerateOutputReference[]> {
  const outputDir = options.outputDir;

  if (!outputDir) {
    return result.assets.map((asset) => buildOutputReference(asset));
  }

  const fetchFn = options.fetchFn ?? globalThis.fetch;

  await mkdir(outputDir, { recursive: true });

  const savedOutputs: GenerateOutputReference[] = [];

  for (const [index, asset] of result.assets.entries()) {
    const savedAsset = await saveAsset(
      result,
      asset,
      index,
      outputDir,
      fetchFn,
      options.fileStemPrefix,
    );
    savedOutputs.push(buildOutputReference(asset, savedAsset));
  }

  return savedOutputs;
}

function getGenerateOutputLabel(output: GenerateOutputReference, index: number): string {
  const prefix = `Output ${index + 1}`;

  if (output.filePath) {
    return `${prefix}: ${output.filePath}`;
  }

  if (output.filename) {
    return `${prefix}: ${output.filename}`;
  }

  if (output.url) {
    return `${prefix}: ${output.url}`;
  }

  return prefix;
}

function buildOutputReference(
  asset: NormalizedProviderResult["assets"][number],
  savedAsset: SavedAsset = {},
): GenerateOutputReference {
  return {
    ...(savedAsset.filePath === undefined ? {} : { filePath: savedAsset.filePath }),
    ...(asset.filename === undefined ? {} : { filename: asset.filename }),
    ...(asset.base64Data === undefined
      ? {}
      : {
          inlineData: {
            encoding: "base64" as const,
            length: asset.base64Data.length,
          },
        }),
    ...(savedAsset.mimeType === undefined
      ? asset.mimeType === undefined
        ? {}
        : { mimeType: asset.mimeType }
      : { mimeType: savedAsset.mimeType }),
    ...(asset.url === undefined ? {} : { url: asset.url }),
  };
}

async function saveAsset(
  result: NormalizedProviderResult,
  asset: NormalizedProviderResult["assets"][number],
  index: number,
  outputDir: string,
  fetchFn: typeof fetch,
  fileStemPrefix?: string,
): Promise<SavedAsset> {
  const filePath = resolve(
    outputDir,
    `${sanitizePathSegment(fileStemPrefix ?? result.canonicalModelId)}-${index + 1}${resolveOutputExtension(
      asset,
      result.outputFormat,
    )}`,
  );

  if (asset.base64Data) {
    await writeFile(filePath, Buffer.from(asset.base64Data, "base64"));

    return {
      filePath,
      ...(asset.mimeType === undefined ? {} : { mimeType: asset.mimeType }),
    };
  }

  if (asset.url) {
    const response = await fetchFn(asset.url);

    if (!response.ok) {
      throw new Error(
        `Failed to download generated asset ${index + 1} from ${asset.url}: ${response.status} ${response.statusText}`,
      );
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    const mimeType = normalizeMimeType(response.headers.get("content-type")) ?? asset.mimeType;

    await writeFile(filePath, bytes);

    return {
      filePath,
      ...(mimeType === undefined ? {} : { mimeType }),
    };
  }

  throw new Error(
    `Generated asset ${index + 1} for ${result.canonicalModelId} has no inline data or URL to save.`,
  );
}

function resolveOutputExtension(
  asset: NormalizedProviderResult["assets"][number],
  outputFormat: string | undefined,
): string {
  const filenameExtension = asset.filename ? extname(basename(asset.filename)) : "";

  if (filenameExtension) {
    return filenameExtension.toLowerCase();
  }

  const mimeExtension =
    (asset.mimeType ? MIME_TYPE_EXTENSIONS[normalizeMimeType(asset.mimeType) ?? ""] : undefined) ??
    undefined;

  if (mimeExtension) {
    return mimeExtension;
  }

  if (outputFormat) {
    return `.${outputFormat}`;
  }

  if (asset.url) {
    try {
      const url = new URL(asset.url);
      const urlExtension = extname(url.pathname);

      if (urlExtension) {
        return urlExtension.toLowerCase();
      }
    } catch {
      return ".bin";
    }
  }

  return ".bin";
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function normalizeMimeType(mimeType: string | null | undefined): string | undefined {
  if (!mimeType) {
    return undefined;
  }

  return mimeType.split(";", 1)[0]?.trim().toLowerCase();
}

export function renderStableJsonLines(value: unknown): string[] {
  return JSON.stringify(sortJsonValue(value), null, 2).split("\n");
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, sortJsonValue(entryValue)]),
    );
  }

  return value;
}
