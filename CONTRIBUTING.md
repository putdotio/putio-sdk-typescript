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

`vp run test:compat` needs `bun` on `PATH`, a one-time
`vp run test:compat:browser:install`, and on Linux Playwright OS libraries
(`pnpm exec playwright install-deps`).

## Live Tests

Live tests are opt-in and call the real put.io API. Use them for behavior the
fixtures cannot prove.

```bash
cp .env.example .env
vp run bootstrap:tokens
vp run test:live
vp run test:live:targets -- test/live/<file>.test.ts
```

Supply variables directly through process environment variables or in `.env` /
`.env.local` (see [.env.example](./.env.example)). Most live targets need both
`PUTIO_TOKEN_FIRST_PARTY` and `PUTIO_TOKEN_THIRD_PARTY`: provide them directly,
or set the test account and first-party OAuth client credentials and run
`vp run bootstrap:tokens` to write `.env.live-tokens`. `vp run test:live:targets`
runs specific test files. The live accounts are shared and real:

- Use read-only calls, reversible probe mutations, and roundtrips that clean
  up after themselves.
- Never add password reset, 2FA changes, account destroy, revoke-all sessions,
  or anything else that can lock out or materially alter the account.
- `vp run bootstrap:live-fixtures -- --seed-invite-codes` spends the secondary
  account's invite quota; use it only when the codes run out.

## Pull Requests

Follow the [rules](./AGENTS.md#rules) for the public surface.
