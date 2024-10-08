import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out/test/**/*.test.js",
  version: "insiders",
  mocha: {
    retries: 5,
    parallel: false,
  },
});
