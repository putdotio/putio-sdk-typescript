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
every pull request.

## Live Tests

Live tests are opt-in and call the real put.io API. Use them for behavior the
fixtures cannot prove.

```bash
cp .env.example .env   # or render maintainer secrets with `pnpm secrets:setup`
vp run test:live
```

[.env.example](./.env.example) names the variables. The live accounts are
shared and real:

- Use read-only calls, reversible probe mutations, and roundtrips that clean
  up after themselves.
- Never add password reset, 2FA changes, account destroy, revoke-all sessions,
  or anything else that can lock out or materially alter the account.
- `bootstrap:live-fixtures --seed-invite-codes` spends the secondary account's
  invite quota; use it only when the codes run out.

## Pull Requests

- Follow the [rules](./AGENTS.md#rules) for the public surface.
- Add or update tests when behavior changes.
- Update docs when the public surface, contributor workflow, or checks change.
- Keep unrelated cleanup in follow-up pull requests.
