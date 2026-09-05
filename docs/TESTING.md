# Testing

## SDK Verification Strategy

The SDK needs more than local typechecks. We want confidence in:

- backend-aligned request and response shapes
- conditional fields that only appear for certain params or scopes
- runtime behavior of the actual SDK client, not just raw curl calls
- safe live verification without damaging shared accounts

Use four layers of verification:

1. source verification
2. runtime shape verification
3. controlled mutation verification
4. SDK live verification through the Vitest live suite

The live verification layer lives in:

- `test/live/*.test.ts`
- `test/live/domains/*.ts`
- `test/live/support/*`

Live tests execute the built SDK from `dist/**`, so direct live targets should always run after `vp pack`.

## Local Checks

Default test runs intentionally exclude `test/live/**`.

Run:

```bash
vp install
vp check .
vp pack
vp test
vp test --coverage
```

Additional package and cleanup checks:

```bash
vp run lint:unused
vp run lint:unused:prod
vp run lint:package
vp run test:compat
```

`lint:unused` runs Knip against source, tests, live tests, scripts, and config files to detect unused files, dependencies, and exports.
`lint:unused:prod` packs the package, then runs Knip's production-only graph with ignored build output visible. Knip's explicit entry and project patterns keep that analysis limited to the package, tests, scripts, and root config rather than unrelated ignored files.
`lint:package` packs the package and runs `publint` plus Are The Types Wrong against the published ESM entrypoints.
`vp run verify` blocks on both Knip graphs, runs `lint:package`, and executes the covered unit suite once; CI runs the same command. Knip governs source reachability and dependency usage, while package checks and explicit API/type tests govern intentional public exports.

The deterministic suite also replays sanitized public contract fixtures from
`test/fixtures/public-contracts.ts`. They pin representative unauthenticated and
authenticated form requests, query serialization, JSON response decoding, and
binary response handling without credentials or private backend evidence.

## Runtime Compatibility Checks

Compatibility checks are package-consumer smoke tests, not live API tests. They pack the SDK, install the tarball into throwaway external projects, and verify the public ESM entrypoints from outside the repo.

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

The local suite focuses on the shared runtime in `src/core`.
Unit coverage now includes all production code under `src/**`, including:

- `src/core/*`
- `src/domains/*`
- `src/utilities/*`
- barrel entrypoints such as `src/index.ts` and `src/utilities.ts`

`vp run verify` enforces the repo coverage floor through the unit suite only.
Live tests stay separate on purpose:

- they stay outside the coverage report
- CI coverage gates only the unit suite
- they exist to sanity-check real API behavior before releases and deeper changes

## Live Environment

Default local env files, loaded in order:

- direct process environment
- `.env.live-tokens`
- `.env.local`
- `.env`

Example env file:

- `.env.example`

Bootstrap-first variables:

- `PUTIO_TEST_USERNAME`
- `PUTIO_TEST_PASSWORD`
- `PUTIO_CLIENT_ID_FIRST_PARTY`
- `PUTIO_CLIENT_SECRET_FIRST_PARTY`

Credential-fixture variables:

- `PUTIO_TEST_TOTP_REFERENCE`
- `PUTIO_TEST_TOTP`
- `PUTIO_TEST_SECONDARY_USERNAME`
- `PUTIO_TEST_SECONDARY_PASSWORD`
- `PUTIO_TEST_SECONDARY_TOTP_REFERENCE`
- `PUTIO_TEST_SECONDARY_TOTP`
- `PUTIO_CLIENT_ID_THIRD_PARTY`

The secondary-account variables are required for live targets that need durable
friendship or invite fixtures, including `friends`, `sharing`,
`friend-invites`, and `family`. The secondary account must have unused
pre-seeded friend and family invite codes for the positive public lookup tests;
the live suite does not mint reusable invite codes during routine verification.

Optional direct runtime variables:

- `PUTIO_TOKEN_FIRST_PARTY`
- `PUTIO_TOKEN_THIRD_PARTY`
- `PUTIO_CLIENT_ID`
- `PUTIO_LIVE_OWNED_VIDEO_FILE_ID`
- `PUTIO_LIVE_RSS_SOURCE_URL`
- `PUTIO_TOKEN_PAYMENT_OWNER`
- `PUTIO_TOKEN_PAYMENT_SUB_ACCOUNT`

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

Use `pnpm secrets:setup` to validate the maintainer-provided SOPS ciphertext and
render shared live variables into `.env.local`. The live harness also accepts
legacy local aliases when they are already exported in the shell.

Keep token values out of command output, docs, comments, and commits.

## Live Commands

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

`pnpm bootstrap:tokens` writes new tokens to the ignored `0600`
`.env.live-tokens` cache. Live commands load it before `.env.local`. Bootstrap
refuses to replace the cache unless you pass `--refresh`.

An unattended runner with a scoped age identity can run a command without
materializing secrets:

```bash
sops exec-env --same-process "$PUTIO_SDK_TYPESCRIPT_SOPS_FILE" \
  'pnpm test:live:targets -- test/live/account.test.ts test/live/tunnel.test.ts'
```

Run `pnpm secrets:setup` once per worktree with
`PUTIO_SDK_TYPESCRIPT_SOPS_FILE` pointing to the supplied ciphertext. The
materialized file is `0600` and gitignored. Live commands load
`.env.live-tokens`, `.env.local`, and `.env` in that order. Exported environment
variables keep highest priority.

```bash
pnpm secrets:setup        # one-time per worktree
pnpm bootstrap:tokens     # mints and caches tokens once
pnpm bootstrap:live-fixtures
pnpm test:live            # runs the broader live suite against pre-existing tokens
pnpm secrets:clean        # before `git worktree remove`
```

`secrets:setup` requires SOPS 3.10 or newer and an authorized age identity. You can
copy `.env.example` manually when using your own live credentials, and unit
tests do not require live credentials.

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

Keep these checks sandbox-only until a sacrificial account exists:

- password reset
- 2FA enable or disable
- account destroy
- revoke-all sessions
- anything that can lock out or materially alter the account

Those stay source-backed or sandbox-only until we have a sacrificial account specifically for destructive auth checks.

## Live Targets

| Target             | Domain coverage                                                      |
| ------------------ | -------------------------------------------------------------------- |
| `auth`             | auth flows, token validation, grants                                 |
| `auth-credentials` | credentialed first-party login, 2FA, and third-party token bootstrap |
| `oauth`            | OAuth app management                                                 |
| `account`          | account info, settings, confirmations                                |
| `config`           | app-owned JSON config storage                                        |
| `files`            | core file listing, search, and mutations                             |
| `file-direct`      | direct file URLs, XSPF playlists, and upload                         |
| `file-tasks`       | extractions, watch status, MP4 tasks                                 |
| `transfers`        | transfer orchestration                                               |
| `events`           | event history                                                        |
| `download-links`   | download-link bundles                                                |
| `rss`              | RSS feeds                                                            |
| `friends`          | friends graph and friend requests                                    |
| `friend-invites`   | friend invitation management                                         |
| `sharing`          | friend shares and public shares                                      |
| `payment`          | plans, vouchers, and payment flows                                   |
| `trash`            | trash management                                                     |
| `zips`             | zip creation and lookup                                              |
| `family`           | family members and invites                                           |
| `ifttt`            | IFTTT integration                                                    |
| `tunnel`           | tunnel routes                                                        |
