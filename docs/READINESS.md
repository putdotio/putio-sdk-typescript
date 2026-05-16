# SDK Readiness

This document answers one question: how ready is `@putdotio/sdk` by domain right now?

Readiness here is based on four things:

1. the namespace exists in `src/domains`
2. the domain has source-backed verification notes and code review
3. the domain has a runnable live test target
4. the remaining gaps are understood

## Overall Status

- namespace coverage is effectively complete for the current planned public domains
- unit verification now covers all production code under `src/**` with a global 90% coverage guardrail
- live coverage exists for every implemented domain
- the main remaining work is depth of verification, not breadth of implementation

## Last Full Sweep

The last recorded full live sweep confirmed:

- all domain live targets completed successfully in a normal live run
- `auth-credentials` requires credential bootstrap secrets instead of silently degrading
- no remaining full-sweep failures were caused by SDK contract mismatches

## Readiness Levels

| Level    | Meaning                                                                 |
| -------- | ----------------------------------------------------------------------- |
| `high`   | implemented, source-backed, live-covered, and already pressure-tested   |
| `good`   | implemented and live-covered, with known gaps mostly in edge-case depth |
| `medium` | implemented, but still needs more endpoint-by-endpoint verification     |

## Domain Matrix

| Domain           | Live target(s)                       | Readiness | Main remaining gaps                                                                                                                           |
| ---------------- | ------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`           | `auth`, `auth-credentials`           | `high`    | destructive reset-password and broader 2FA mutation flows still need a safer dedicated sandbox beyond credentialed bootstrap coverage         |
| `oauth`          | `oauth`                              | `high`    | main remaining risk is future backend drift in admin-only `popular` shape variance, not basic owned-app CRUD                                  |
| `account`        | `account`                            | `high`    | destructive account actions, username/mail/password mutations, and broader two-factor settings flows still need careful live coverage         |
| `config`         | `config`                             | `high`    | mostly solid; remaining work is publication polish, not contract uncertainty                                                                  |
| `files`          | `files`, `file-direct`, `file-tasks` | `high`    | more endpoint-by-endpoint coverage for rarer file flows and more conditional branches                                                         |
| `transfers`      | `transfers`                          | `high`    | broader status and mutation-path coverage would still help                                                                                    |
| `events`         | `events`                             | `high`    | successful `getTorrent(...)` still wants a dedicated upload-backed fixture                                                                    |
| `download-links` | `download-links`                     | `high`    | more unusual media/task payload branches would still help                                                                                     |
| `rss`            | `rss`                                | `high`    | create/update coverage now requires a known-good RSS fixture URL; a failed-item live fixture would still help prove `failure_reason` branches |
| `friends`        | `friends`                            | `high`    | friendship and shared-folder coverage now requires a configured secondary account fixture                                                     |
| `friend-invites` | `friend-invites`                     | `good`    | positive invite lookup now requires a pre-seeded unused secondary invite; accepted-user lifecycle still wants a dedicated second account      |
| `sharing`        | `sharing`                            | `high`    | broader share/public-share mutation permutations would still help; public-share coverage now fails loudly when quota is spent                 |
| `payment`        | `payment`                            | `high`    | owner-only actions now require an owner/prepaid fixture; sub-account restriction checks require an explicit sub-account token                 |
| `trash`          | `trash`                              | `high`    | larger-scale bulk restore/delete and rarer lock-timeout fixtures would still help, but top-level vs child semantics are now live-covered      |
| `zips`           | `zips`                               | `high`    | larger-input and rarer terminal/error-state coverage would still help, but cursor-based bulk creation is now live-covered                     |
| `family`         | `family`                             | `good`    | positive invite lookup now requires a pre-seeded unused secondary invite; positive member lifecycle still needs a dedicated second account    |
| `ifttt`          | `ifttt`                              | `high`    | payment-disabled and rate-limit behavior still need broader controlled verification                                                           |
| `tunnel`         | `tunnel`                             | `high`    | simple surface; main remaining risk is future backend drift, not current contract uncertainty                                                 |

## Priority Gaps

If we want to raise confidence meaningfully from here, the highest-value follow-ups are:

1. deepen `files` verification for more conditional response branches
2. deepen `transfers` verification for more status and mutation paths
3. expand risky auth/account mutation verification with safer dedicated credentials
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
2. `lint:package` runs standard package-surface checks with `publint` and Are The Types Wrong
3. runtime expectations and required host Web APIs are documented in `README.md`
