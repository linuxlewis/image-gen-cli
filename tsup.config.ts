import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["cjs"],
  clean: true,
  sourcemap: true,
  target: "node24",
  outDir: "dist",
  outExtension() {
    return {
      js: ".cjs",
    };
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
});
