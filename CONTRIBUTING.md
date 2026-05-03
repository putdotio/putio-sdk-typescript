# Contributing

Thanks for contributing to `@putdotio/sdk`.

## Setup

Install dependencies with Vite+:

```bash
vp install
```

Then install the stock VitePlus hook wiring for this clone:

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
Live tests are intentionally separate confidence checks and do not count toward the coverage threshold.
The low-risk `consumer` publication-surface target is the exception and runs in CI on every push and pull request.

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

Run just the publication-surface target:

```bash
vp run test:live:consumer
```

This is optional for normal contributions and requires real credentials. Use it when you need backend sanity checks, release confidence, or verification for stateful flows that unit tests cannot prove.

Bootstrap runtime tokens with 1Password:

1. Copy `.env.example` to `.env.local` and replace the `<vault>` and account placeholders with concrete `op://Vault/Item/field` references for your team's 1Password items (or with plain literal values).
2. Run with an unlocked 1Password CLI session locally, or `OP_SERVICE_ACCOUNT_TOKEN` exported on shared devboxes / CI:

```bash
op run --env-file=.env.local -- vp run bootstrap:tokens
```

For single-target commands, safety rules, and fixture expectations, see [Testing](./docs/TESTING.md).

## Development Notes

- Prefer `vp` for repo commands.
- Treat `@putdotio/sdk` as a new public package, not a compatibility wrapper around `putio-js`.
- Keep the public surface domain-first and Effect-first.
- Put end-user usage in [Overview](./README.md). Put deeper contributor and architecture notes in `docs/*`.

Useful references:

- [Architecture](./docs/ARCHITECTURE.md)
- [Testing](./docs/TESTING.md)
- [Release](./docs/RELEASE.md)
- [Readiness](./docs/READINESS.md)

## Pull Requests

- Keep changes focused and explicit.
- Add or update tests when behavior changes.
- Update docs when the public surface, contributor workflow, or verification model changes.
- Prefer follow-up pull requests over mixing unrelated cleanup into one batch.
