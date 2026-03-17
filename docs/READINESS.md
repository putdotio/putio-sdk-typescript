# SDK Readiness

This document answers one question: how ready is `@putdotio/sdk` by domain right now?

Readiness here is based on four things:

1. the namespace exists in `src/domains`
2. the domain has source-backed planning or contract notes
3. the domain has a runnable live test target
4. the remaining gaps are understood

## Overall Status

- namespace coverage is effectively complete for the current planned public domains
- live coverage exists for every implemented domain
- packed-package consumer verification covers install, type exports, runtime imports, and internal export fencing
- the main remaining work is depth of verification, not breadth of implementation

## Latest Full Sweep

Latest full live sweep on March 13, 2026:

- all domain live targets completed successfully in one run
- `auth-credentials` degrades to a fixture skip when credential bootstrap secrets are not injected
- `config` degrades to a fixture skip when the current third-party token is not attached to an OAuth app
- no remaining full-sweep failures were caused by SDK contract mismatches

## Readiness Levels

| Level    | Meaning                                                                 |
| -------- | ----------------------------------------------------------------------- |
| `high`   | implemented, source-backed, live-covered, and already pressure-tested   |
| `good`   | implemented and live-covered, with known gaps mostly in edge-case depth |
| `medium` | implemented, but still needs more endpoint-by-endpoint verification     |

## Domain Matrix

| Domain           | Implemented | Source-backed contract doc                                | Live target(s)                       | Readiness | Main remaining gaps                                                                                                                             |
| ---------------- | ----------- | --------------------------------------------------------- | ------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`           | yes         | wave 1 matrix                                             | `auth`, `auth-credentials`           | `high`    | destructive reset-password and broader 2FA mutation flows still need a safer dedicated sandbox beyond credentialed bootstrap coverage           |
| `oauth`          | yes         | wave 1 matrix                                             | `oauth`                              | `high`    | main remaining risk is future backend drift in admin-only `popular` shape variance, not basic owned-app CRUD                                    |
| `account`        | yes         | wave 1 matrix                                             | `account`                            | `high`    | destructive account actions, username/mail/password mutations, and broader two-factor settings flows still need careful live coverage           |
| `config`         | yes         | wave 1 matrix                                             | `config`                             | `high`    | mostly solid; remaining work is publication polish, not contract uncertainty                                                                    |
| `files`          | yes         | wave 2 files matrix and wave 10 file-direct/upload matrix | `files`, `file-direct`, `file-tasks` | `high`    | more endpoint-by-endpoint coverage for rarer file flows and more conditional branches                                                           |
| `transfers`      | yes         | wave 2 transfers matrix                                   | `transfers`                          | `high`    | broader status and mutation-path coverage would still help                                                                                      |
| `events`         | yes         | wave 3 events matrix                                      | `events`                             | `high`    | successful `getTorrent(...)` still wants a dedicated upload-backed fixture                                                                      |
| `download-links` | yes         | wave 3 download-links matrix                              | `download-links`                     | `high`    | more unusual media/task payload branches would still help                                                                                       |
| `rss`            | yes         | wave 3 rss matrix                                         | `rss`                                | `high`    | a failed-item live fixture would still help prove `failure_reason` branches                                                                     |
| `friends`        | yes         | wave 3 friends-and-invites matrix                         | `friends`                            | `high`    | positive mutation flows still want safer disposable fixtures                                                                                    |
| `friend-invites` | yes         | wave 3 friends-and-invites matrix                         | `friend-invites`                     | `good`    | the live suite now supports an optional secondary owner fixture, but accepted-user lifecycle still wants a second configured account            |
| `sharing`        | yes         | wave 4 sharing matrix                                     | `sharing`                            | `high`    | broader share/public-share mutation permutations would still help                                                                               |
| `payment`        | yes         | wave 5 payment matrix                                     | `payment`                            | `high`    | real checkout/subscription mutations still need sandbox-only verification                                                                       |
| `trash`          | yes         | wave 6 trash-and-zips matrix                              | `trash`                              | `high`    | larger-scale bulk restore/delete and rarer lock-timeout fixtures would still help, but top-level vs child semantics are now live-covered        |
| `zips`           | yes         | wave 6 trash-and-zips matrix                              | `zips`                               | `high`    | larger-input and rarer terminal/error-state coverage would still help, but cursor-based bulk creation is now live-covered                       |
| `family`         | yes         | wave 7 family matrix                                      | `family`                             | `good`    | the live suite now supports an optional secondary owner fixture, but positive invite/member mutations still need that second account configured |
| `ifttt`          | yes         | wave 8 ifttt-and-tunnel matrix                            | `ifttt`                              | `high`    | payment-disabled and rate-limit behavior still need broader controlled verification                                                             |
| `tunnel`         | yes         | wave 8 ifttt-and-tunnel matrix                            | `tunnel`                             | `high`    | simple surface; main remaining risk is future backend drift, not current contract uncertainty                                                   |

## Priority Gaps

If we want to raise confidence meaningfully from here, the highest-value follow-ups are:

1. deepen `files` verification for more conditional response branches
2. deepen `transfers` verification for more status and mutation paths
3. expand risky Wave 1 auth/account mutation verification with safer dedicated credentials
4. deepen the remaining `good` long-tail domains where positive mutation coverage is still intentionally thin

## Confidence Program

The next confidence gains should come from four sources, in this order:

1. current frontend call-site parity for the most-used domains
2. backend route, serializer, and test verification for conditional fields and errors
3. deeper live coverage for risky mutations and branch-heavy payloads
4. dedicated fixtures for the domains where shared-account probing would leave persistent state behind

## Publication Hardening

These are now in place:

1. the built `dist` artifact is what live verification exercises
2. the external-consumer live test keeps install, type exports, and runtime imports honest outside this repo
3. packed internal-path imports are fenced and verified to fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`
4. runtime expectations and required host Web APIs are documented in `README.md`
