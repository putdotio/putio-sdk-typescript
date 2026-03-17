---
name: putio-sdk-dev
description: Use when developing the put.io TypeScript SDK in this repo, including adding or changing namespaces, tightening schemas or typed errors, validating conditional API behavior, running SDK live probes, or checking how the SDK should be documented and verified.
---

# putio-sdk-dev

Use this skill when editing `@putdotio/sdk` or answering questions about the SDK architecture and workflow in this repository.

## Quick Rules

- Treat `@putdotio/sdk` as a new package, not a compatibility layer.
- Keep the public surface domain-first and Effect-first.
- Prefer the Effect way of doing things: `Effect`, `Schema`, layers, and typed failures before ad hoc helpers.
- Validate external shapes with `Schema` at the boundary.
- Model errors as first-class contracts.
- Prefer explicit parameter-aware types and discriminated unions over optional bags.

## Source of Truth Order

When docs, runtime behavior, and consumers disagree, trust sources in this order:

1. the local closed-source backend clone, usually referenced in docs as `backend/...`
2. backend tests from that same clone
3. the local current frontend clone
4. the archived open-source `putio-js` clone or archive branch
5. published Swagger and public API docs

## Start Here

Read only what you need:

- package overview: `README.md`
- SDK architecture: `docs/ARCHITECTURE.md`
- live verification guide: `docs/TESTING.md`
- readiness snapshot: `docs/READINESS.md`

## Main Workflow

1. Inspect the target namespace in `src/domains` and the shared runtime in `src/core` when needed.
2. Check backend behavior, backend tests, current frontend usage, and archived `putio-js` behavior before changing a contract.
3. Update request, response, and error schemas together.
4. Keep the Promise client and Effect client aligned in `src/core/client.ts`.
5. Add or update a live harness in `scripts` or `test/live` when the surface is safe to verify.
6. Update package-facing docs when the public surface changes.

## Effect Rules

- prefer Effect services and layers over one-off globals
- keep transport, parsing, and domain logic separated by small modules
- use `Schema` for request, response, config, and error boundaries
- preserve typed failures instead of collapsing everything to generic exceptions
- reach for Effect combinators first; use escape hatches only when there is a clear reason

## Verification

Run the checks that match the change:

```bash
vp install
vp check .
vp pack
vp test run --passWithNoTests
```

For runtime verification, use `vp test run --config vitest.live.config.ts` or a single-target live command from `docs/TESTING.md`.

## Namespace Rules

- keep each namespace domain-first
- define request, response, and error schemas together
- export explicit public types
- keep transport helpers in shared core files and domain logic in the namespace file
- avoid compatibility aliases and legacy naming

## Direct File Helpers

- prefer explicit names like `getApiDownloadUrl`
- keep URL helpers pure where possible
- keep upload behavior explicit about `upload.put.io`
