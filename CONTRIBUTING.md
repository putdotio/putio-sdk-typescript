# Contributing

Thanks for contributing to `@putdotio/sdk`.

## Setup

Install dependencies with Vite+, then install the stock Vite+ hook wiring for this clone:

```bash
vp install
vp config
```

## Validation

Run the full repo guardrail before opening or updating a pull request:

```bash
vp run verify
```

That command runs formatting, linting, package build, package-surface checks (`lint:package`), unit tests, and coverage using the same repo-local entrypoint CI relies on.

The coverage guardrail is unit-only and counts all production files under `src/**`.
Live tests are separate confidence checks outside the coverage threshold.

## Live Verification

Live verification is opt-in and uses the real put.io API. Use it for backend sanity checks, release confidence, or stateful flows that unit tests cannot prove.

```bash
cp .env.example .env   # or render maintainer-provided secrets with `pnpm secrets:setup`
vp run test:live
```

Credential rendering, token bootstrap, single-target commands, safety rules, and fixture expectations are in [Testing](./docs/TESTING.md#live-environment).

## Development Notes

- Prefer `vp` for repo commands.
- Follow the [Design Rules](./README.md#design-rules): `@putdotio/sdk` is a new public package, not a compatibility wrapper around `putio-js`, and its surface stays domain-first and Effect-first.
- Put end-user usage in [Overview](./README.md). Put deeper contributor and architecture notes in `docs/*`: [Architecture](./docs/ARCHITECTURE.md), [Testing](./docs/TESTING.md), [Distribution](./docs/DISTRIBUTION.md).

## Pull Requests

- Keep changes focused and explicit.
- Add or update tests when behavior changes.
- Update docs when the public surface, contributor workflow, or verification model changes.
- Prefer follow-up pull requests over mixing unrelated cleanup into one batch.
