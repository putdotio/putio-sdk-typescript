# Agent Guide

## Repo

- Single-package TypeScript repo for `@putdotio/sdk`, the canonical put.io API client; put.io's own apps and `putio-cli` install it from npm
- Build and test workflow uses Vite+; prefer `vp` for toolchain and package-manager operations and `vp run <script>` for custom package scripts. `vp` is the `vite-plus` devDependency; without a global install, run it as `pnpm exec vp`
- Main areas: `src/*`, `test/live/*`, `docs/*`, `scripts/*`

## Start Here

- [Overview](./README.md): consumer-facing usage; keep it that way and put repo-operator detail in `docs/*`
- [Architecture](./docs/ARCHITECTURE.md)
- [Testing](./docs/TESTING.md): local checks, compatibility gate, live suite, and credential handling
- [Distribution](./docs/DISTRIBUTION.md)
- [API Coverage](./docs/API-COVERAGE.md): endpoint completeness contract and the route matrix
- [Migrating to v12](./docs/MIGRATING_V12.md): required `downloadToken` media URLs and the `FileUrlProvider` renames
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
- Update docs when the public surface, verification workflow, or repo shape changes; breaking changes get a `docs/MIGRATING_V*.md` entry.

## Proof

- Docs only: `vp check .`; no runtime proof.
- Source, schema, or error-mapping change: `vp run verify`. It enforces the 90% coverage floor in [vite.config.ts](./vite.config.ts); cover new code instead of lowering the floor.
- Exports, entrypoints, or packaging: also `vp run test:compat`. CI runs it as a Node, browser, and Bun matrix.
- Endpoint behavior the sanitized fixtures cannot prove: the matching live target, such as `pnpm test:live:targets -- test/live/files.test.ts`; target rules are in [Testing](./docs/TESTING.md#live-commands). Report a live gap you could not run.

## Hazards

- Live targets run against shared, real put.io accounts. Stay inside the [safety rules](./docs/TESTING.md#safety-rules): read-only calls and reversible mutations that clean up; never password reset, 2FA changes, account destroy, or revoke-all sessions.
- `.env.local` and `.env.live-tokens` hold live tokens; keep their values out of output, docs, and commits.

## Delivery

Pull requests squash-merge to `main`. A push to `main` runs `verify` and the compatibility matrix, then semantic-release publishes `@putdotio/sdk` to npm and creates the GitHub release when the commits since the last release include `feat`, `fix`, `perf`, a revert, or a breaking change; `docs`, `chore`, `test`, and `ci` publish nothing. The squashed commit's type is the version decision, and npm never accepts a published version number again. Release wiring: [Distribution](./docs/DISTRIBUTION.md).

## Effect

This repository uses the Effect TypeScript library. The installed version's own
guide is `node_modules/effect/AGENTS.md`; consult it for the APIs the change
touches, and search `node_modules/effect/src` for anything it does not cover.
