import { readFile } from "node:fs/promises";

import {
  buildGenerateJsonOutput,
  renderGenerateErrorOutput,
  renderGenerateTextOutput,
  renderStableJsonLines,
} from "../io/generate-output.js";
import {
  type GenerateCommandDependencies,
  type GenerateCommandResult,
  type SharedGenerateCommandOptions,
  prepareGenerateExecution,
} from "./generate.js";

export const DEFAULT_BULK_CONCURRENCY = 4;

export type BulkGenerateCommandOptions = Omit<SharedGenerateCommandOptions, "prompt"> & {
  bulkPrompts: string;
  concurrency?: number;
  json?: boolean;
  model: string;
  outputDir?: string;
  provider?: "openai" | "google" | "together" | "replicate";
};

export type BulkGenerateCommandDependencies = GenerateCommandDependencies & {
  readFile?: typeof readFile;
};

export type BulkPromptEntry = {
  index: number;
  prompt: string;
};

export type BulkGenerateItemResult =
  | {
      index: number;
      ok: true;
      outputs: Parameters<typeof buildGenerateJsonOutput>[1];
      prompt: string;
      result: Parameters<typeof buildGenerateJsonOutput>[0];
    }
  | {
      errors: readonly string[];
      index: number;
      ok: false;
      prompt: string;
    };

export async function loadBulkPrompts(
  filePath: string,
  dependencies: Pick<BulkGenerateCommandDependencies, "readFile"> = {},
): Promise<BulkPromptEntry[]> {
  const fileContents = await (dependencies.readFile ?? readFile)(filePath, "utf8");

  return fileContents
    .split(/\r?\n/u)
    .map((prompt) => prompt.trim())
    .filter((prompt) => prompt.length > 0)
    .map((prompt, index) => ({
      index,
      prompt,
    }));
}

export async function mapWithConcurrencyLimit<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  worker: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TOutput>(items.length);
  const limit = Math.max(1, Math.floor(concurrency));
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = items[currentIndex];

      if (item === undefined) {
        return;
      }

      results[currentIndex] = await worker(item, currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));

  return results;
}

function renderBulkGenerateTextOutput(
  items: readonly BulkGenerateItemResult[],
  concurrency: number,
): string[] {
  const failed = items.filter((item) => !item.ok).length;
  const succeeded = items.length - failed;
  const lines = [
    `Bulk prompts: ${items.length}`,
    `Concurrency: ${concurrency}`,
    `Succeeded: ${succeeded}`,
    `Failed: ${failed}`,
  ];

  for (const item of items) {
    lines.push("");
    lines.push(`Item ${item.index + 1}: ${item.ok ? "ok" : "failed"}`);
    lines.push(`Prompt: ${item.prompt}`);

    if (!item.ok) {
      for (const error of item.errors) {
        lines.push(`Error: ${error}`);
      }

      continue;
    }

    lines.push(...renderGenerateTextOutput(item.result, item.outputs));
  }

  return lines;
}

function renderBulkGenerateJsonOutput(
  items: readonly BulkGenerateItemResult[],
  concurrency: number,
): string[] {
  const failed = items.filter((item) => !item.ok).length;

  return renderStableJsonLines({
    concurrency,
    failed,
    results: items.map((item) =>
      item.ok
        ? {
            index: item.index + 1,
            ok: true,
            prompt: item.prompt,
            result: buildGenerateJsonOutput(item.result, item.outputs),
          }
        : {
            errors: item.errors,
            index: item.index + 1,
            ok: false,
            prompt: item.prompt,
          },
    ),
    succeeded: items.length - failed,
    total: items.length,
  });
}

function normalizePromptFileError(error: unknown, filePath: string): readonly string[] {
  if (error instanceof Error) {
    return [`Failed to read bulk prompts file ${filePath}: ${error.message}`];
  }

  return [`Failed to read bulk prompts file ${filePath}.`];
}

export async function runBulkGenerateCommand(
  options: BulkGenerateCommandOptions,
  dependencies: BulkGenerateCommandDependencies = {},
): Promise<GenerateCommandResult> {
  let prompts: BulkPromptEntry[];

  try {
    prompts = await loadBulkPrompts(options.bulkPrompts, dependencies);
  } catch (error) {
    return {
      lines: renderGenerateErrorOutput(
        normalizePromptFileError(error, options.bulkPrompts),
        options.json ?? false,
      ),
      ok: false,
    };
  }

  if (prompts.length === 0) {
    return {
      lines: renderGenerateErrorOutput(
        ["Bulk prompts file did not contain any prompts."],
        options.json ?? false,
      ),
      ok: false,
    };
  }

  const preparedExecution = prepareGenerateExecution(options, dependencies);

  if (!preparedExecution.ok) {
    return {
      lines: renderGenerateErrorOutput(preparedExecution.messages, options.json ?? false),
      ok: false,
    };
  }

  const {
    bulkPrompts: _bulkPrompts,
    concurrency = DEFAULT_BULK_CONCURRENCY,
    json: asJson,
    model: _model,
    provider: _provider,
    ...executionOptions
  } = options;
  const promptNumberWidth = Math.max(2, String(prompts.length).length);

  const items = await mapWithConcurrencyLimit(prompts, concurrency, async (entry) => {
    const execution = await preparedExecution.execute({
      ...executionOptions,
      outputFileStem: `${preparedExecution.route.canonicalModelId}-prompt-${String(
        entry.index + 1,
      ).padStart(promptNumberWidth, "0")}`,
      prompt: entry.prompt,
    });

    if (!execution.ok) {
      return {
        errors: execution.messages,
        index: entry.index,
        ok: false,
        prompt: entry.prompt,
      } satisfies BulkGenerateItemResult;
    }

    return {
      index: entry.index,
      ok: true,
      outputs: execution.outputs,
      prompt: entry.prompt,
      result: execution.result,
    } satisfies BulkGenerateItemResult;
  });
  const failed = items.filter((item) => !item.ok).length;

  return {
    lines:
      asJson === true
        ? renderBulkGenerateJsonOutput(items, concurrency)
        : renderBulkGenerateTextOutput(items, concurrency),
    ok: failed === 0,
  };
}
