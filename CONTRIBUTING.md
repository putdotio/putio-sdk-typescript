# Contributing

Thanks for contributing to `@putdotio/sdk`.

## Setup

Install dependencies with Vite+:

```bash
vp install
```

Then install the stock Vite+ hook wiring for this clone:

```bash
vp config
```

## Validation

Run the full repo guardrail before opening or updating a pull request:

```bash
vp run verify
```

That command runs formatting, linting, package build, unit tests, and coverage using the same repo-local entrypoint CI relies on.

The coverage guardrail is unit-only and counts all production files under `src/**`.
Live tests are separate confidence checks outside the coverage threshold.
Package-surface verification runs in CI through `vp run lint:package`.

## Live Verification

Live verification is opt-in and uses the real put.io API.

Start with the example env file:

```bash
cp .env.example .env
```

Run the full live suite:

```bash
vp run test:live
```

Run the package-surface checks:

```bash
vp run lint:package
```

The package-surface checks do not require live credentials. Use live tests when you need backend sanity checks, release confidence, or verification for stateful flows that unit tests cannot prove.

Bootstrap runtime tokens from the rendered live credentials:

```bash
pnpm secrets:setup        # materializes .env.local from the repo-owned Infisical path
pnpm bootstrap:tokens     # mints fresh first/third-party tokens against the live API
```

`secrets:setup` requires the Infisical CLI and access to the put.io frontend
Development environment. Set the onboarding-provided
`PUTIO_SDK_TYPESCRIPT_INFISICAL_*` variables in this repo or worktree shell
before running the command. Run `pnpm secrets:clean` before tearing down the
worktree.

For single-target commands, safety rules, and fixture expectations, see [Testing](./docs/TESTING.md).

## Development Notes

- Prefer `vp` for repo commands.
- Treat `@putdotio/sdk` as a new public package, not a compatibility wrapper around `putio-js`.
- Keep the public surface domain-first and Effect-first.
- Put end-user usage in [Overview](./README.md). Put deeper contributor and architecture notes in `docs/*`.

Useful references:

- [Architecture](./docs/ARCHITECTURE.md)
- [Testing](./docs/TESTING.md)
- [Distribution](./docs/DISTRIBUTION.md)
- [Readiness](./docs/READINESS.md)

## Pull Requests

- Keep changes focused and explicit.
- Add or update tests when behavior changes.
- Update docs when the public surface, contributor workflow, or verification model changes.
- Prefer follow-up pull requests over mixing unrelated cleanup into one batch.
