import { correctness, strict } from "@effect/tsgo/oxlint-presets";
import { defineConfig } from "vite-plus";

const agentIgnorePatterns = [
  ".agent/**",
  ".agents/**",
  ".claude/**",
  ".codex/**",
  ".continue/**",
  ".cursor/**",
  ".gemini/**",
  ".opencode/**",
  ".pi/**",
  ".roo/**",
  ".windsurf/**",
  "tools/oxlint/anti-slop/**",
];

export default defineConfig({
  fmt: {
    ignorePatterns: agentIgnorePatterns,
  },
  lint: {
    ignorePatterns: agentIgnorePatterns,
    jsPlugins: [
      { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
      {
        name: "anti-slop-effect",
        specifier: "./tools/oxlint/anti-slop/effect/index.ts",
      },
      { name: "uinaf", specifier: "@uinaf/oxlint-plugin-no-comments" },
    ],
    extends: [correctness, strict],
    overrides: [
      {
        files: ["**/*.spec.ts"],
        rules: {
          "effecttsgo/unstable-api-usage": "off",
        },
      },
      {
        files: ["src/core/client.ts", "src/domains/ops.spec.ts"],
        rules: {
          "effecttsgo/any-unknown-in-error-context": "off",
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      "effecttsgo/any-unknown-in-error-context": "error",
      "effecttsgo/lazy-effect": "off",
      "effecttsgo/schema-class-missing-brand": "off",
      "effecttsgo/schema-number": "error",
      "effecttsgo/unsafe-effect-type-assertion": "error",
      "oxc/no-accumulating-spread": "error",
      "anti-slop/no-array-filter-map": "error",
      "anti-slop/no-reduce-accumulator-copy": "error",
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-readable-spacing": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",
      "anti-slop-effect/no-manual-effect-error-tag": "error",
      "anti-slop-effect/no-manual-tag-comparison": "error",
      "anti-slop-effect/no-manual-tagged-construction": "error",
      "anti-slop-effect/no-service-constructor-imports": "error",
      "anti-slop-effect/prefer-effect-match": "error",
      "uinaf/no-comments": "error",
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
