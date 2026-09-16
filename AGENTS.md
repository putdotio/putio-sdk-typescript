# Agent Guide

## Repo

- Single-package TypeScript repo for `@putdotio/sdk`
- Build and test workflow uses Vite+; prefer `vp` for toolchain and package-manager operations and `vp run <script>` for custom package scripts
- Main areas: `src/*`, `test/live/*`, `docs/*`, `scripts/*`

## Start Here

- [Overview](./README.md): consumer-facing usage; keep it that way and put repo-operator detail in `docs/*`
- [Architecture](./docs/ARCHITECTURE.md)
- [Testing](./docs/TESTING.md): local checks, compatibility gate, live suite, and credential handling
- [Distribution](./docs/DISTRIBUTION.md)
- [API Coverage](./docs/API-COVERAGE.md): endpoint completeness contract and the route matrix
- [Migrating to v11](./docs/MIGRATING_V11.md): removed public contracts and their replacements

## Commands

The `scripts` block in [package.json](./package.json) defines every command. The gate is
`vp run verify`; CI runs the same command. `vp run test` excludes `test/live/**`;
live verification and the `test:live*` targets are in [Testing](./docs/TESTING.md).

## Worktrees

`.worktreeinclude` carries `.env`, `.env.live-tokens`, and `.env.local` into
managed worktrees. Run `vp install`, `vp config`, then `vp run verify`. Use
`pnpm secrets:setup` with `PUTIO_SDK_TYPESCRIPT_SOPS_FILE` if live-test env is
missing or stale; `pnpm secrets:clean` removes it and `vp run clean` removes
generated artifacts before teardown.

## Repo-Specific Guidance

- Treat `@putdotio/sdk` as a standalone public package; do not carry `putio-js` compatibility shapes into its surface.
- Keep the public surface domain-first and Effect-first.
- Validate external data at the boundary with schemas and keep typed failures explicit.
- Prefer feature/domain modules over layering by technical concern.
- Keep public package boundaries explicit and open-source-safe; `lint:package` inside `vp run verify` is the publication safety net for tarball metadata, public types, and ESM entrypoints.
- Change coverage thresholds only with explicit approval.
- Finish edits, `vp run verify`, and fixes without pausing; ask before publishing and before live writes that are not reversible.
- Done means `vp run verify` passed and, when real API behavior matters, the relevant `test:live` target ran or the gap is reported.
- Update docs when the public surface, verification workflow, or repo shape changes.
- `CLAUDE.md` should remain a symlink to this file.

## Effect

This repository uses the Effect TypeScript library. The installed version's own
guide is `node_modules/effect/AGENTS.md`; consult it for the APIs the change
touches, and search `node_modules/effect/src` for anything it does not cover.
