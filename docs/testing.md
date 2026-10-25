# Testing

Typechecks alone do not prove backend-aligned request and response shapes,
parameter-conditioned fields, or the built client's runtime behavior. Three
layers do:

1. Deterministic unit tests with coverage, including sanitized public
   contract fixtures.
2. Packed-package compatibility checks.
3. An opt-in live suite against the real API, with safe mutations only.

## Local Checks

`vp run verify` is the gate; its steps are the `verify` script in
[package.json](../package.json). `vp run test` excludes `test/live/**`. The
deterministic suite replays sanitized fixtures from
[test/fixtures/public-contracts.ts](../test/fixtures/public-contracts.ts), so
it needs no credentials or private backend evidence.

Coverage counts all production code under `src/**`, barrel entrypoints
included, against the floor in [vite.config.ts](../vite.config.ts). Live tests
stay outside the coverage report.

Knip governs reachability and dependency usage; package checks and explicit
API and type tests govern intentional public exports.

## Compatibility Checks

The compatibility checks pack the SDK, install the tarball into throwaway
external projects, and use the public ESM entrypoints from outside the repo.
They do not call the live API. They cover a strict external TypeScript consumer
(`skipLibCheck: false`), Node and Bun runtime imports, bundled Chromium,
Firefox, and WebKit, and fetch body aborts on Effect interruption.

```bash
vp run test:compat:browser:install   # once, for the Playwright browsers
vp run test:compat
```

Target one runtime:

```bash
vp run test:compat:node
PUTIO_COMPAT_BROWSERS=chromium vp run test:compat:browser
vp run test:compat:bun
```

## Live Environment

Env sources, highest priority first:

1. the process environment
2. `.env.live-tokens`, the ignored `0600` token cache that
   `pnpm bootstrap:tokens` writes
3. `.env.local`, rendered by `pnpm secrets:setup`
4. `.env`, copied from [.env.example](../.env.example) for your own credentials

`RequiredSecretKey` and `OptionalSecretKey` in
[test/live/support/secrets.ts](../test/live/support/secrets.ts) name every
variable the harness reads; [.env.example](../.env.example) groups them.

`pnpm secrets:setup` renders the maintainer SOPS ciphertext named by
`PUTIO_SDK_TYPESCRIPT_SOPS_FILE` into a `0600`, ignored `.env.local`. It needs
SOPS 3.10 or newer and an authorized age identity; run it once per worktree.

Fixture requirements:

- `friends`, `sharing`, `friend-invites`, and `family` need the
  secondary-account variables. The secondary account must hold unused
  pre-seeded friend and family invite codes; routine runs never mint them.
- `sharing`, `files`, `file-direct`, and `file-tasks` need a safe, owned,
  unshared MP4. Pin one with `PUTIO_LIVE_OWNED_VIDEO_FILE_ID`; otherwise the
  harness accepts only the known fixture names in
  [test/live/support/media.ts](../test/live/support/media.ts) and never picks
  an arbitrary private video.
- `rss` needs `PUTIO_LIVE_RSS_SOURCE_URL` to point at a known-good feed.
- Owner payment checks need `PUTIO_TOKEN_PAYMENT_OWNER` from a prepaid owner
  account; unset, they use `PUTIO_TOKEN_FIRST_PARTY` and fail if that token is
  a family sub-account. Sub-account restriction checks need
  `PUTIO_TOKEN_PAYMENT_SUB_ACCOUNT` from a family sub-account.

File and transfer tests create timestamped `putio-typescript-sdk-*` resources
and remove them before they exit. Torrent fixtures use an unreachable
`example.invalid` tracker. Uploaded torrents create no predictable history
event, so the suite tests the missing-event result of `events.getTorrent(...)`
and leaves account history alone.

## Live Commands

Live tests run the built SDK from `dist/**`, so direct live targets must run
after `vp pack`.

```bash
vp run test:live                                    # full live suite
vp pack && vp test run --config vitest.live.config.ts test/live/auth.test.ts
pnpm test:live:targets -- test/live/account.test.ts test/live/tunnel.test.ts
```

`test:live:targets` runs only the named files with `PUTIO_TOKEN_FIRST_PARTY`
and `PUTIO_TOKEN_THIRD_PARTY`, and never calls password login. It rejects the
targets that bootstrap account credentials: `auth-credentials`, `family`,
`friend-invites`, `friends`, `podcast`, and `sharing`.

An unattended runner with a scoped age identity can run a command without
writing secrets to disk:

```bash
sops exec-env --same-process "$PUTIO_SDK_TYPESCRIPT_SOPS_FILE" \
  'pnpm test:live:targets -- test/live/account.test.ts test/live/tunnel.test.ts'
```

Maintainer sequence:

```bash
pnpm secrets:setup             # once per worktree
pnpm bootstrap:tokens          # mints and caches tokens; --refresh replaces the cache
pnpm bootstrap:live-fixtures
pnpm test:live
pnpm secrets:clean             # before `git worktree remove`
```

`bootstrap:live-fixtures` validates and seeds the fixtures the public SDK can
prepare safely: the secondary friendship and shared folder, the RSS URL,
payment roles, the owned MP4, and the pre-seeded invite codes. It does not mint
invite codes, because no public route cleans up unused ones. It does not
preflight public-share quota either, because a share consumes the daily quota
the `sharing` target needs.

To seed missing invite codes while preparing the secondary account:

```bash
pnpm bootstrap:live-fixtures -- --seed-invite-codes
```

This can consume one friend-invite and one family-invite quota on the
secondary account.

## Safety Rules

Live verification may use:

- read-only endpoints
- reversible mutations with probe data
- config read and write roundtrips with cleanup
- disposable OAuth app resources that the script also deletes

Keep these out until a sacrificial account exists:

- password reset
- 2FA enable or disable
- account destroy
- revoke-all sessions
- anything that can lock out or materially alter the account

## Live Targets

Each `test/live/<target>.test.ts` is one target, named after the SDK namespace
it covers. Targets whose scope the name does not show:

- `auth-credentials`: credentialed first-party login, 2FA, and third-party
  token bootstrap
- `file-direct`: direct file URLs, XSPF playlists, and upload
- `file-tasks`: extractions, watch status, and MP4 tasks
- `events`: history events
