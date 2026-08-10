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

## Commands

- `vp install`
- `vp check .`
- `vp pack`
- `vp run test`
- `vp run coverage`
- `vp run test:live`
- `vp run verify`
- `vp run bootstrap:tokens`

## Worktrees

`.worktreeinclude` carries `.env` and `.env.local` into managed worktrees. Run
`vp install`, `vp config`, then `vp run verify`. Use
`pnpm secrets:setup` with `PUTIO_SDK_TYPESCRIPT_SOPS_FILE` if live-test env is
missing or stale.

## Repo-Specific Guidance

- Treat `@putdotio/sdk` as a new public package, not a compatibility wrapper around `putio-js`.
- Keep the public surface domain-first and Effect-first.
- Validate external data at the boundary with schemas and keep typed failures explicit.
- Prefer feature/domain modules over layering by technical concern.
- Keep `README.md` consumer-facing; put repo-operator detail in `docs/*` and keep `AGENTS.md` as a routing layer.
- Prefer `vp` for toolchain and package-manager operations; use `vp run <script>` for custom package scripts.
- Keep public package boundaries explicit and open-source-safe.
- Use typed parsing and real checks; change thresholds only with explicit approval.
- Update docs when the public surface, verification workflow, or repo shape changes.
- `CLAUDE.md` should remain a symlink to this file.

## Learning More About Effect

This repository uses the Effect TypeScript library.

Before writing any Effect code, read `node_modules/effect/AGENTS.md` completely
and follow its links when required. If that guide does not cover an API or
concept, search `node_modules/effect/src` for the installed implementation and
types.

## Testing

- Default tests exclude `test/live/**`.
- Use `vp run test:live` or the single-target live commands in [Testing](./docs/TESTING.md) when verifying against the real API.
- Live tests accept maintainer-supplied `PUTIO_SDK_TYPESCRIPT_SOPS_FILE`; `pnpm secrets:setup` validates and writes ignored `.env.local`, and `pnpm secrets:clean` removes it.
- Keep package-surface verification healthy; `lint:package` is the publication safety net for tarball metadata, public types, and ESM entrypoints.
