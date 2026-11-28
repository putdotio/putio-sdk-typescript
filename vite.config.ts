import { correctness, strict } from "@effect/tsgo/oxlint-presets";
import uinaf, { env, ignorePatterns, options } from "@uinaf/oxlint-config/effect/vite-plus";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns,
  },
  lint: {
    env,
    extends: [uinaf, correctness, strict],
    ignorePatterns,
    options: {
      ...options,
      typeCheck: true,
    },
    overrides: [
      {
        files: ["**/*.spec.ts"],
        rules: {
          "effecttsgo/unstable-api-usage": "off",
        },
      },
      {
        files: ["scripts/bootstrap-live-fixtures.ts", "src/core/contract-errors.spec.ts"],
        rules: {
          "unicorn/catch-error-name": "off",
        },
      },
      {
        files: ["src/core/client.ts", "src/domains/ops.spec.ts"],
        rules: {
          "effecttsgo/any-unknown-in-error-context": "off",
        },
      },
    ],
    rules: {
      "@nkzw/no-instanceof": "off",
      "effecttsgo/any-unknown-in-error-context": "error",
      "effecttsgo/lazy-effect": "off",
      "effecttsgo/schema-class-missing-brand": "error",
      "effecttsgo/schema-number": "error",
      "effecttsgo/unsafe-effect-type-assertion": "error",
      "import/no-namespace": "off",
      "no-console": "off",
      "no-promise-executor-return": "off",
      "react-hooks/rules-of-hooks": "off",
      "typescript/no-empty-object-type": "off",
      "typescript/no-misused-promises": "off",
      "typescript/no-unsafe-assignment": "off",
      "typescript/no-unsafe-call": "off",
      "typescript/no-unsafe-return": "off",
      "typescript/no-unsafe-type-assertion": "off",
      "typescript/use-unknown-in-catch-callback-variable": "off",
      "unicorn/consistent-function-scoping": "off",
    },
  },
  pack: {
    clean: true,
    dts: true,
    entry: ["src/index.ts", "src/utilities.ts"],
    format: ["esm"],
    outDir: "dist",
    platform: "neutral",
    sourcemap: true,
  },
  staged: {
    "*.{js,ts,tsx,mjs,cjs,cts}": "effect-tsgo vp check --fix",
  },
  test: {
    coverage: {
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
    },
    exclude: ["test/live/**"],
    include: ["scripts/**/*.spec.ts", "src/**/*.spec.ts", "src/**/*.test.ts"],
    server: {
      deps: {
        inline: ["@effect/vitest"],
      },
    },
  },
});
