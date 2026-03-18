import { defineConfig } from "vite-plus";

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
