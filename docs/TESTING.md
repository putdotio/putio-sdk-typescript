# Testing

## SDK Verification Strategy

Typechecks alone do not prove backend-aligned request and response shapes, parameter-conditioned fields, or the runtime behavior of the built client. Verification has three layers:

1. deterministic unit tests with coverage, including sanitized public contract fixtures
2. packed-package compatibility checks
3. an opt-in live suite against the real API, with safe mutations only

## Local Checks

The `scripts` block in [package.json](../package.json) defines every command. `vp run verify` is the gate and CI runs the same command:

- `vp check .`
- `lint:package`: packs the package and runs `publint` plus Are The Types Wrong against the published ESM entrypoints
- `knip` over source, tests, live tests, scripts, and config; then `knip --production` over the packed graph. Knip governs reachability and dependency usage; package checks and explicit API/type tests govern intentional public exports
- `validate:routes:packed` against [api-route-matrix.json](./api-route-matrix.json)
- the unit suite once, with coverage

`vp run test` excludes `test/live/**`. The deterministic suite replays sanitized fixtures from
`test/fixtures/public-contracts.ts` to pin unauthenticated and authenticated form requests, query
serialization, JSON decoding, and binary responses without credentials or private backend evidence.

## Runtime Compatibility Checks

Compatibility checks pack the SDK, install the tarball into throwaway external projects, and exercise the public ESM entrypoints from outside the repo. They do not call the live API.

Run all compatibility checks:

```bash
vp run test:compat
```

Target one runtime:

```bash
vp run test:compat:node
PUTIO_COMPAT_BROWSERS=chromium vp run test:compat:browser
vp run test:compat:bun
```

The browser check uses Playwright. Install local browser engines once when needed:

```bash
vp run test:compat:browser:install
```

The compatibility layer proves:

- Node can typecheck a strict external TypeScript consumer with `skipLibCheck: false`
- Node can import and execute the public ESM entrypoints at runtime
- browser bundlers can bundle the package and run it in Chromium, Firefox, and WebKit
- Bun can install the packed SDK and import the public ESM entrypoints at runtime
- native fetch body reads abort on Effect interruption, using a disposable local HTTP server for JSON, binary, and error bodies
- internal package paths remain fenced by the `exports` map through the package checks

Unit coverage counts all production code under `src/**`, including the barrel entrypoints, against the floor in [vite.config.ts](../vite.config.ts). Live tests stay outside the coverage report.

## Live Environment

Env files load in this order, and exported environment variables keep highest priority:

- direct process environment
- `.env.live-tokens` (the ignored `0600` token cache written by `pnpm bootstrap:tokens`)
- `.env.local` (rendered by `pnpm secrets:setup`)
- `.env` (copy [.env.example](../.env.example) when using your own live credentials)

The `RequiredSecretKey` and `OptionalSecretKey` types in [test/live/support/secrets.ts](../test/live/support/secrets.ts) name every variable the harness reads; [.env.example](../.env.example) groups them by bootstrap credentials, runtime tokens, and role-specific fixtures.

The secondary-account variables are required for live targets that need durable
friendship or invite fixtures, including `friends`, `sharing`,
`friend-invites`, and `family`. The secondary account must have unused
pre-seeded friend and family invite codes for the positive public lookup tests;
the live suite does not mint reusable invite codes during routine verification.

`PUTIO_LIVE_OWNED_VIDEO_FILE_ID` can pin media live tests to an explicit safe,
owned, unshared MP4 fixture. If it is unset, the live harness only accepts
owned MP4s with SDK/example fixture names such as `putio-typescript-sdk-*`,
`Mario1_507_512kb.mp4`, `Sintel.mp4`, or `Big Buck Bunny.mp4`; it never selects
an arbitrary private video from the account.

`PUTIO_LIVE_RSS_SOURCE_URL` must point at a known-good RSS feed when running the
`rss` target. `PUTIO_TOKEN_PAYMENT_OWNER` must belong to a prepaid owner account
when running owner payment action checks; if unset, those checks use
`PUTIO_TOKEN_FIRST_PARTY` and fail if that token is a family sub-account.
`PUTIO_TOKEN_PAYMENT_SUB_ACCOUNT` must belong to a family sub-account for the
payment sub-account restriction checks.

The `sharing`, `files`, `file-direct`, and `file-tasks` targets also expect a
safe owned MP4 fixture for media flag, URL, HLS, watch status, and start-from
coverage. The shared-friend clone fixture is seeded from the configured
secondary account.

File and transfer tests create timestamped `putio-typescript-sdk-*` resources.
Each test removes its archive, extracted files, or transfer before it exits.
Torrent fixtures use an unreachable `example.invalid` tracker. URL fixtures
cover the terminal error and retry states.

Uploaded torrents did not create a predictable history event. The suite tests
the missing-event result from `events.getTorrent(...)` and leaves existing
account history alone.

`pnpm secrets:setup` validates the maintainer-provided SOPS ciphertext named by
`PUTIO_SDK_TYPESCRIPT_SOPS_FILE` and renders shared live variables into a `0600`,
gitignored `.env.local` file. It requires SOPS 3.10 or newer and an authorized age
identity; run it once per worktree. The live harness also accepts legacy local
aliases when they are already exported in the shell.

Keep token values out of command output, docs, comments, and commits.

## Live Commands

Live tests execute the built SDK from `dist/**`, so direct live targets must run after `vp pack`.

Full live suite:

```bash
vp run test:live
```

Single target:

```bash
vp pack && vp test run --config vitest.live.config.ts test/live/auth.test.ts
```

Run explicit targets with the provisioned runtime tokens:

```bash
pnpm test:live:targets -- test/live/account.test.ts test/live/tunnel.test.ts
```

`test:live:targets` runs only the named files. It reads
`PUTIO_TOKEN_FIRST_PARTY` and `PUTIO_TOKEN_THIRD_PARTY` and never calls password
login. It rejects `auth-credentials`, `family`, `friend-invites`, `friends`,
`podcast`, and `sharing` because those targets bootstrap account credentials.

`pnpm bootstrap:tokens` writes new tokens to the `.env.live-tokens` cache and
refuses to replace an existing cache unless the `--refresh` flag is passed.

An unattended runner with a scoped age identity can run a command without
materializing secrets:

```bash
sops exec-env --same-process "$PUTIO_SDK_TYPESCRIPT_SOPS_FILE" \
  'pnpm test:live:targets -- test/live/account.test.ts test/live/tunnel.test.ts'
```

Typical maintainer sequence:

```bash
pnpm secrets:setup        # one-time per worktree
pnpm bootstrap:tokens     # mints and caches tokens once
pnpm bootstrap:live-fixtures
pnpm test:live            # runs the broader live suite against pre-existing tokens
pnpm secrets:clean        # before `git worktree remove`
```

`bootstrap:live-fixtures` validates and seeds the live fixtures that are safe to
prepare through the public SDK. It establishes the secondary friendship/shared
folder fixture, validates the RSS URL, payment owner/sub-account roles, owned
MP4 fixture, and pre-seeded unused invite codes. In normal preflight mode it
does not mint reusable friend or family invite codes because there is no public
cleanup route for those unused invites. It also does not preflight public-share
quota because creating a share consumes the same daily quota that the `sharing`
live target needs; use the `sharing` live test itself as the public-share
behavior check.

When the secondary account is intentionally being prepared for live verification,
an operator can seed missing unused invite codes explicitly:

```bash
pnpm bootstrap:live-fixtures -- --seed-invite-codes
```

Use this only for fixture setup. It can consume one friend-invite and one
family-invite quota on the secondary account when those fixtures are missing.

## Safety Rules

Allowed for live automatic verification:

- read-only endpoints
- reversible mutations with probe data
- config read/write roundtrips with cleanup
- disposable OAuth app resources if the script also deletes them

Keep these out of live verification until a sacrificial account exists:

- password reset
- 2FA enable or disable
- account destroy
- revoke-all sessions
- anything that can lock out or materially alter the account

## Live Targets

Each `test/live/<target>.test.ts` is one target, named after the SDK namespace it covers. Targets whose scope the name does not show:

- `auth-credentials`: credentialed first-party login, 2FA, and third-party token bootstrap
- `file-direct`: direct file URLs, XSPF playlists, and upload
- `file-tasks`: extractions, watch status, and MP4 tasks
- `events`: history events
