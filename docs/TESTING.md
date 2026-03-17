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

## Local Checks

Default test runs intentionally exclude `test/live/**`.

Run:

```bash
vp install
vp check .
vp pack
vp test run --passWithNoTests
vp test run --coverage --passWithNoTests
```

The local suite focuses on the shared runtime in `src/core`.
Schema-heavy `src/domains/*` files are validated primarily through:

- `vp check .`
- package build output
- local unit tests for shared runtime behavior
- live SDK verification in `test/live/**`

## Live Environment

Default local env file:

- `.env`

Example env file:

- `.env.example`

Expected variables:

- `PUTIO_TOKEN_FIRST_PARTY`
- `PUTIO_TOKEN_THIRD_PARTY`
- `PUTIO_CLIENT_ID`
- `PUTIO_CLIENT_ID_FIRST_PARTY`
- `PUTIO_CLIENT_SECRET_FIRST_PARTY`

Optional credential-fixture variables:

- `PUTIO_TEST_USERNAME`
- `PUTIO_TEST_PASSWORD`
- `PUTIO_TEST_TOTP_REFERENCE`
- `PUTIO_TEST_TOTP`
- `PUTIO_TEST_SECONDARY_USERNAME`
- `PUTIO_TEST_SECONDARY_PASSWORD`
- `PUTIO_TEST_SECONDARY_TOTP_REFERENCE`
- `PUTIO_TEST_SECONDARY_TOTP`
- `PUTIO_1PASSWORD_RUNTIME_ITEM_ID`

If the explicit token vars are missing, the live harness can still hydrate them from:

1. legacy local aliases
2. a runtime-token 1Password item when `OP_SERVICE_ACCOUNT_TOKEN` and `PUTIO_1PASSWORD_RUNTIME_ITEM_ID` are set

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

Bootstrap runtime tokens with 1Password:

```bash
export OP_SERVICE_ACCOUNT_TOKEN="$OP_SERVICE_ACCOUNT_PUTIO_FRONTEND_CI"
op run --env-file=.env.example -- vp run bootstrap:tokens
```

Run a credentialed live target with 1Password:

```bash
export OP_SERVICE_ACCOUNT_TOKEN="$OP_SERVICE_ACCOUNT_PUTIO_FRONTEND_CI"
op run --env-file=.env.example -- \
  vp pack && vp test run --config vitest.live.config.ts test/live/auth-credentials.test.ts
```

## Consumer Verification

The `consumer` live test is the package-publication safety net.

Run:

```bash
vp pack && vp test run --config vitest.live.config.ts test/live/consumer.test.ts
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
