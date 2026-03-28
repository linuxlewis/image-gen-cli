import { runCli } from "./run-cli.js";

const exitCode = runCli(process.argv.slice(2));

process.exit(exitCode);
