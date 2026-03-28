export function renderCliOutput(args: string[]): string[] {
  if (args.includes("--help") || args.includes("-h")) {
    return [
      "Usage: image-gen-cli [options]",
      "",
      "Options:",
      "  -h, --help     Show this help message",
    ];
  }

  return ["image-gen-cli is ready.", `Args: ${args.length > 0 ? args.join(", ") : "(none)"}`];
}

export function runCli(args: string[]): number {
  for (const line of renderCliOutput(args)) {
    console.log(line);
  }

  return 0;
}
