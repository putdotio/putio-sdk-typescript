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

The local suite focuses on the shared runtime in `src/core`.
Unit coverage now includes all production code under `src/**`, including:

- `src/core/*`
- `src/domains/*`
- `src/utilities/*`
- barrel entrypoints such as `src/index.ts` and `src/utilities.ts`

`vp run verify` enforces the repo coverage floor through the unit suite only.
Live tests stay separate on purpose:

- they do not contribute to the coverage report
- they do not gate CI coverage
- they exist to sanity-check real API behavior before releases and deeper changes

The `consumer` target is the exception: it is safe to run without real credentials and is intended to gate CI as the publication-surface check.
GitHub Actions runs both the verify and consumer-surface lanes on `blacksmith-2vcpu-ubuntu-2404`.

## Live Environment

Default local env file:

- `.env`

Example env file:

- `.env.example`

Bootstrap-first variables:

- `PUTIO_TEST_USERNAME`
- `PUTIO_TEST_PASSWORD`
- `PUTIO_CLIENT_ID_FIRST_PARTY`
- `PUTIO_CLIENT_SECRET_FIRST_PARTY`

Optional credential-fixture variables:

- `PUTIO_TEST_TOTP_REFERENCE`
- `PUTIO_TEST_TOTP`
- `PUTIO_TEST_SECONDARY_USERNAME`
- `PUTIO_TEST_SECONDARY_PASSWORD`
- `PUTIO_TEST_SECONDARY_TOTP_REFERENCE`
- `PUTIO_TEST_SECONDARY_TOTP`
- `PUTIO_CLIENT_ID_THIRD_PARTY`
- `PUTIO_1PASSWORD_RUNTIME_ITEM_ID`
- `PUTIO_1PASSWORD_RUNTIME_VAULT`

Optional direct runtime variables:

- `PUTIO_TOKEN_FIRST_PARTY`
- `PUTIO_TOKEN_THIRD_PARTY`
- `PUTIO_CLIENT_ID`

If direct token vars are missing, the live harness can still hydrate them from:

1. a runtime-token 1Password item when `OP_SERVICE_ACCOUNT_TOKEN`, `PUTIO_1PASSWORD_RUNTIME_ITEM_ID`, and `PUTIO_1PASSWORD_RUNTIME_VAULT` are set
2. legacy local aliases

See `.env.example` for the current bootstrap-oriented layout and supported optional aliases.

Never print token values in command output, docs, comments, or commits.

## Live Commands

Full live suite:

```bash
vp run test:live
```

Single target:

```bash
vp pack && vp test run --config vitest.live.config.ts test/live/auth.test.ts
```

Run `pnpm secrets:setup` once per worktree to materialize `.env.local` from `.env.example` via `op inject`. The materialised file is `0600` and gitignored. Subsequent commands read the resolved values from process env after sourcing `.env.local` (or via your shell loader of choice).

```bash
pnpm secrets:setup        # one-time per worktree
pnpm bootstrap:tokens     # mints fresh tokens
pnpm test:live            # runs the broader live suite against pre-existing tokens
pnpm secrets:clean        # before `git worktree remove`
```

`secrets:setup` requires an unlocked 1Password CLI session locally, or `OP_SERVICE_ACCOUNT_TOKEN` exported on shared devboxes / CI. The `.env.example` references are committer-only; external contributors do not need them for unit tests.

## Consumer Verification

The `consumer` live test is the package-publication safety net.

Run:

```bash
vp pack && vp test run --config vitest.live.config.ts test/live/consumer.test.ts
```

Or through the package script:

```bash
vp run test:live:consumer
```

What it checks:

- `vp pack` produces an installable tarball for an external consumer install check
- an external temp project can install that tarball
- TypeScript can typecheck against the published exports
- Node can import the built package at runtime
- the public `@putdotio/sdk/utilities` subpath resolves for external consumers
- internal package paths stay fenced off

## Safety Rules

Allowed for live automatic verification:

- read-only endpoints
- reversible mutations with probe data
- config read/write roundtrips with cleanup
- disposable OAuth app resources if the script also deletes them

Do not run automatically on the shared account:

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
| `file-direct`      | direct file URLs and upload                                          |
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
| `consumer`         | external package-consumer install checks                             |
