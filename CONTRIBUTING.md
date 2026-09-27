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

CI runs the same command. [Testing](./docs/TESTING.md#local-checks) lists what it covers; live tests stay outside the coverage threshold.

## Live Verification

Live verification is opt-in and uses the real put.io API. Use it for backend sanity checks, release confidence, or stateful flows that unit tests cannot prove.

```bash
cp .env.example .env   # or render maintainer-provided secrets with `pnpm secrets:setup`
vp run test:live
```

Credential rendering, token bootstrap, single-target commands, safety rules, and fixture expectations are in [Testing](./docs/TESTING.md#live-environment).

## Development Notes

- Follow the [Design Rules](./README.md#design-rules): `@putdotio/sdk` is a standalone public package, not a compatibility wrapper around `putio-js`, and its surface stays domain-first and Effect-first.
- Keep [README](./README.md) for end-user usage; contributor and architecture notes go in `docs/*`.

## Pull Requests

- Add or update tests when behavior changes.
- Update docs when the public surface, contributor workflow, or verification model changes.
- Keep unrelated cleanup in follow-up pull requests.
