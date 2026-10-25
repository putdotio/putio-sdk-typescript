# Contributing

## Setup

```bash
vp install
vp config
```

`vp config` installs the Git hooks in `.vite-hooks/`. Without a global Vite+,
run `pnpm install` first and call it as `pnpm exec vp`.

## Checks

```bash
vp run verify
vp run test:compat
```

`verify` is the pull request gate; CI runs it and the compatibility matrix on
every pull request. [Testing](./docs/testing.md) covers what each layer
proves.

## Live Tests

Live tests are opt-in and call the real put.io API. Use them for behavior the
fixtures cannot prove.

```bash
cp .env.example .env   # or render maintainer secrets with `pnpm secrets:setup`
vp run test:live
```

Credentials, single targets, and safety rules:
[Testing](./docs/testing.md#live-environment).

## Pull Requests

- Follow the [rules](./AGENTS.md#rules) for the public surface.
- Add or update tests when behavior changes.
- Update docs when the public surface, contributor workflow, or checks change.
- Keep unrelated cleanup in follow-up pull requests.
