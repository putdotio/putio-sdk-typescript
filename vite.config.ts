import { defineConfig } from "vite-plus";

const coverageConfig = {
  exclude: [
    "src/**/*.test.*",
    "src/**/*.spec.*",
    "src/**/*.d.ts",
    "src/test-support/**",
    "dist/**",
    "coverage/**",
  ],
  include: ["src/**/*.{ts,tsx}"],
  provider: "v8",
  reporter: ["text", "lcov"],
  thresholds: {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90,
  },
} as const;

export default defineConfig({
  pack: {
    clean: true,
    dts: true,
    entry: ["src/index.ts", "src/utilities.ts"],
    format: ["esm"],
    outDir: "dist",
    platform: "neutral",
    sourcemap: true,
  },
  test: {
    coverage: coverageConfig,
    exclude: ["test/live/**"],
    include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
  },
});
