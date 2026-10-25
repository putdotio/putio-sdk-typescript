# Agent Guide

`@putdotio/sdk` is the canonical put.io API client, a single TypeScript
package. put.io's own apps and `putio-cli` install it from npm. Code lives in
`src/`, live tests in `test/live/`, and tooling in `scripts/`.

- [README](./README.md): consumer usage. Keep repo-operator detail out of it.

## Commands

[package.json](./package.json) `scripts` defines every command. Run Vite+
through the pinned devDependency: `pnpm exec vp` after `pnpm install`. Use
`vp run <script>` for package scripts. The gate is `vp run verify`; CI runs the
same command. `vp run test` excludes `test/live/**`.

## Worktrees

`.worktreeinclude` carries `.env`, `.env.live-tokens`, and `.env.local` into
managed worktrees. Run `vp install`, `vp config`, then `vp run verify`. If the
live-test env is missing or stale, run `pnpm secrets:setup` with
`PUTIO_SDK_TYPESCRIPT_SOPS_FILE` set. Before teardown, `pnpm secrets:clean`
removes the env files and `vp run clean` removes generated artifacts.

## Rules

- `@putdotio/sdk` is a standalone public package. Carry no `putio-js`
  compatibility shapes or namespace shims into its surface.
- Keep the public surface domain-first and Effect-first; group code by domain,
  not by technical layer.
- Validate external data at the boundary with schemas, model
  parameter-conditioned responses explicitly, and keep typed failures
  explicit.
- Keep the core fetch-native and portable across standard Web APIs.
- Keep package boundaries explicit and open-source-safe; `lint:package` inside
  `vp run verify` checks tarball metadata, public types, and ESM entrypoints.
- A breaking change gets a `docs/migrating-v*.md` entry.

## Proof

- Docs only: `vp check .`.
- Source, schema, or error-mapping change: `vp run verify`. It enforces the
  coverage floor in [vite.config.ts](./vite.config.ts); cover new code instead
  of lowering the floor.
- Exports, entrypoints, or packaging: also `vp run test:compat`. Locally it
  needs `bun` on `PATH` and, once, `vp run test:compat:browser:install`.
- Endpoint behavior the sanitized fixtures cannot prove: the matching live
  target, such as `pnpm test:live:targets -- test/live/files.test.ts`. Report
  a live gap you could not run.

## Hazards

- Live targets run against shared, real put.io accounts. Stay inside the
  [live-test safety rules](./CONTRIBUTING.md#live-tests).
- The backend route inventory and private route classifications stay out of
  this public repo; `docs/api-route-matrix.json` holds only public-safe
  evidence.
- `.env`, `.env.local`, and `.env.live-tokens` hold live credentials and
  tokens; keep their values out of output, docs, and commits.

## Delivery

Pull requests squash-merge to `main`; the `release` job in
[ci.yml](./.github/workflows/ci.yml) publishes `@putdotio/sdk` to npm when
[`.releaserc.json`](./.releaserc.json) says the commits release.

- The squashed commit's type decides the version, and npm never accepts a
  published version number again.
- npm Trusted Publishing names workflow `ci.yml` and Environment `release`.
  Renaming either breaks publishing until a maintainer updates the npm
  package settings.
- `package.json` `repository` must keep pointing at
  `putdotio/putio-sdk-typescript`; npm matches it against the trusted publisher.

## Effect

The installed Effect version's guide is `node_modules/effect/AGENTS.md`;
consult it for the APIs the change touches, and search `node_modules/effect/src`
for anything it does not cover.
