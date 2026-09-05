# Agent Guide

## Repo

- Single-package TypeScript repo for `@putdotio/sdk`
- Build and test workflow uses Vite+
- Main areas: `src/*`, `test/live/*`, `docs/*`, `scripts/*`

## Start Here

- [Overview](./README.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Testing](./docs/TESTING.md)
- [Distribution](./docs/DISTRIBUTION.md)
- [API Coverage](./docs/API-COVERAGE.md) — endpoint completeness contract and the route matrix
- [Migrating to v11](./docs/MIGRATING_V11.md) — removed public contracts and their replacements

## Commands

- `vp install`
- `vp check .`
- `vp pack`
- `vp run test`
- `vp run coverage`
- `vp run test:live`
- `vp run verify`
- `vp run bootstrap:tokens`

## Teardown

- `vp run clean` — remove generated artifacts (`.live-build`, `.turbo`, `coverage`, `dist`)
- `pnpm secrets:clean` — remove the ignored live-test `.env.local` files

## Worktrees

`.worktreeinclude` carries `.env` and `.env.local` into managed worktrees. Run
`vp install`, `vp config`, then `vp run verify`. Use
`pnpm secrets:setup` with `PUTIO_SDK_TYPESCRIPT_SOPS_FILE` if live-test env is
missing or stale.

## Repo-Specific Guidance

- Treat `@putdotio/sdk` as a standalone public package; do not carry `putio-js` compatibility shapes into its surface.
- Keep the public surface domain-first and Effect-first.
- Validate external data at the boundary with schemas and keep typed failures explicit.
- Prefer feature/domain modules over layering by technical concern.
- Keep `README.md` consumer-facing; put repo-operator detail in `docs/*` and keep `AGENTS.md` as a routing layer.
- Prefer `vp` for toolchain and package-manager operations; use `vp run <script>` for custom package scripts.
- Keep public package boundaries explicit and open-source-safe.
- Use typed parsing and real checks; change thresholds only with explicit approval.
- Finish edits, `vp run verify`, and fixes without pausing; ask before publishing and before live writes that are not reversible.
- Done means `vp run verify` passed and, when real API behavior matters, the relevant `test:live` target ran or the gap is reported.
- Update docs when the public surface, verification workflow, or repo shape changes.
- `CLAUDE.md` should remain a symlink to this file.

## Effect

This repository uses the Effect TypeScript library. The installed version's own
guide is `node_modules/effect/AGENTS.md`; consult it for the APIs the change
touches, and search `node_modules/effect/src` for anything it does not cover.

## Testing

- Default tests exclude `test/live/**`.
- Use `vp run test:live` or the single-target live commands in [Testing](./docs/TESTING.md) when verifying against the real API.
- Live tests accept maintainer-supplied `PUTIO_SDK_TYPESCRIPT_SOPS_FILE`; `pnpm secrets:setup` validates and writes ignored `.env.local`, and `pnpm secrets:clean` removes it.
- Keep package-surface verification healthy; `lint:package` is the publication safety net for tarball metadata, public types, and ESM entrypoints.
