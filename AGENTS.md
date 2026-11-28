# Agent Guide

`@putdotio/sdk` is the canonical put.io API client, a single TypeScript
package. put.io's own apps and `putio-cli` install it from npm. Code lives in
`src/`, live tests in `test/live/`, and tooling in `scripts/`.

- [README](./README.md): consumer usage. Keep repo-operator detail out of it.

## Commands

Run Vite+ via `pnpm exec vp` (or global `vp`) after `pnpm install`. Every script
lives in [package.json](./package.json); the gate is `vp run verify`.

## Worktrees

[.worktreeinclude](./.worktreeinclude) copies local env files into managed
worktrees. Run `pnpm install`, `pnpm exec vp config`, then
`pnpm exec vp run verify`. Before teardown, delete copied `.env*` files and run
`pnpm exec vp run clean`.

## Rules

- Keep the public surface domain-first and Effect-first; place domain modules in
  `src/domains/`.
- Validate external data with schemas, model parameter-conditioned responses
  explicitly, and keep typed failures explicit.
- Keep the core fetch-native and portable across standard Web APIs.

## Proof

- Docs only: `vp run check`. Bare `vp check` cannot load the Effect diagnostics
  and stops at `Unknown plugin: effecttsgo`.
- Source, schema, or error-mapping change: `vp run verify`. Cover new code and
  keep the thresholds in [vite.config.ts](./vite.config.ts).
- Exports, entrypoints, or packaging: also `vp run test:compat`. Locally it
  needs `bun` on `PATH`, a one-time `vp run test:compat:browser:install`, and
  on Linux Playwright OS libraries (`pnpm exec playwright install-deps`).
- Endpoint behavior the sanitized fixtures cannot prove: the matching live
  target, such as `vp run test:live:targets -- test/live/files.test.ts`. Report
  a live gap you could not run.

## Hazards

- Live targets run against shared, real put.io accounts. Stay inside the
  [live-test safety rules](./CONTRIBUTING.md#live-tests).
- The backend route inventory, internal source paths, and private route
  classifications stay out of this public repo; `docs/api-route-matrix.json`
  holds only public-safe evidence.
- Env files in [.worktreeinclude](./.worktreeinclude) hold live credentials and
  tokens; keep their values out of output, docs, and commits.

## Delivery

Releases run automatically from [ci.yml](./.github/workflows/ci.yml) and
[.releaserc.json](./.releaserc.json).

- Explain required caller changes in the commit body for any breaking change.
- Keep workflow name `ci.yml`, Environment `release`, and `package.json`
  `repository` (`putdotio/putio-sdk-typescript`) unchanged; npm Trusted
  Publishing matches all three.

## Effect

The installed Effect version's guide is `node_modules/effect/AGENTS.md`;
consult it for the APIs the change touches, and search `node_modules/effect/src`
for anything it does not cover. Keep the pinned `effect` version.
