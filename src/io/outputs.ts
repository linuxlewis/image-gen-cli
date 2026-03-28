import type { ProviderId } from "../core/types.js";

export type NormalizedOutputAsset = {
  base64Data?: string;
  filename?: string;
  mimeType?: string;
  url?: string;
};

export type NormalizedCommandOutput = {
  assets: readonly NormalizedOutputAsset[];
  model: string;
  provider: ProviderId;
  providerMetadata?: Record<string, unknown>;
  revisedPrompt?: string;
  warnings?: readonly string[];
};

export function getOutputAssetLabel(asset: NormalizedOutputAsset, index: number): string {
  const prefix = `Asset ${index + 1}`;

  return asset.filename
    ? `${prefix}: ${asset.filename}`
    : asset.url
      ? `${prefix}: ${asset.url}`
      : prefix;
}

export function renderNormalizedOutput(output: NormalizedCommandOutput): string[] {
  const lines = [
    `Provider: ${output.provider}`,
    `Model: ${output.model}`,
    `Assets: ${output.assets.length}`,
  ];

  if (output.revisedPrompt) {
    lines.push(`Revised prompt: ${output.revisedPrompt}`);
  }

  for (const [index, asset] of output.assets.entries()) {
    const parts = [getOutputAssetLabel(asset, index)];

    if (asset.mimeType) {
      parts.push(`mime=${asset.mimeType}`);
    }

    if (asset.base64Data) {
      parts.push(`inline-data=${asset.base64Data.length} chars`);
    }

    lines.push(parts.join(" | "));
  }

  for (const warning of output.warnings ?? []) {
    lines.push(`Warning: ${warning}`);
  }

  return lines;
}
