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

`vp run test:compat` needs `bun` on `PATH` and a one-time
`vp run test:compat:browser:install`.

## Live Tests

Live tests are opt-in and call the real put.io API. Use them for behavior the
fixtures cannot prove.

```bash
cp .env.example .env
vp run bootstrap:tokens
vp run test:live
vp run test:live:targets -- test/live/<file>.test.ts
```

`vp run bootstrap:tokens` writes `.env.live-tokens`, and
`vp run test:live:targets` runs specific test files.
[.env.example](./.env.example) names the variables. The live accounts are shared
and real:

- Use read-only calls, reversible probe mutations, and roundtrips that clean
  up after themselves.
- Never add password reset, 2FA changes, account destroy, revoke-all sessions,
  or anything else that can lock out or materially alter the account.
- `vp run bootstrap:live-fixtures -- --seed-invite-codes` spends the secondary
  account's invite quota; use it only when the codes run out.

## Pull Requests

Follow the [rules](./AGENTS.md#rules) for the public surface.
