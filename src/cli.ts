import { runCli } from "./run-cli.js";

async function main() {
  const exitCode = await runCli(process.argv.slice(2));
  process.exit(exitCode);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Unexpected CLI failure.");
  }

  process.exit(1);
});
