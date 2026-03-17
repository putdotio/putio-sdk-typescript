import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 60_000,
    include: ["test/live/**/*.test.ts"],
    sequence: {
      concurrent: false,
    },
    testTimeout: 60_000,
  },
});
