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
    branches: 80,
    functions: 80,
    lines: 85,
    statements: 85,
  },
} as const;

export default defineConfig({
  pack: {
    clean: true,
    dts: true,
    entry: ["src/index.ts"],
    format: ["esm"],
    outDir: "dist",
    platform: "neutral",
    sourcemap: true,
  },
  test: {
    coverage: {
      ...coverageConfig,
      exclude: [...coverageConfig.exclude, "src/domains/**", "src/index.ts"],
    },
    exclude: ["test/live/**"],
  },
});
