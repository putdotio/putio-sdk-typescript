# Agent Guide

## Repo

- Single-package TypeScript repo for `@putdotio/sdk`
- Build and test workflow uses Vite+
- Main areas: `src/*`, `test/live/*`, `docs/*`, `scripts/*`

## Start Here

- package overview: [README.md](./README.md)
- architecture: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- testing and live verification: [docs/TESTING.md](./docs/TESTING.md)
- readiness snapshot: [docs/READINESS.md](./docs/READINESS.md)
- release automation: [docs/RELEASE.md](./docs/RELEASE.md)

## Commands

- `vp install`
- `vp check .`
- `vp pack`
- `vp run test`
- `vp run coverage`
- `vp run test:live`
- `vp run verify`
- `vp run bootstrap:tokens`

## Repo-Specific Guidance

- Treat `@putdotio/sdk` as a new public package, not a compatibility wrapper around `putio-js`.
- Keep the public surface domain-first and Effect-first.
- Validate external data at the boundary with schemas and keep typed failures explicit.
- Prefer feature/domain modules over layering by technical concern.
- Keep `README.md` consumer-facing; put repo-operator detail in `docs/*` and keep `AGENTS.md` as a routing layer.
- Prefer `vp` for toolchain and package-manager operations; use `vp run <script>` for custom package scripts.
- Keep public package boundaries explicit and open-source-safe.
- Avoid unsafe casts, ignored checks, and weakened thresholds unless explicitly approved.
- Update docs when the public surface, verification workflow, or repo shape changes.

## Testing

- Default tests exclude `test/live/**`.
- Use `vp run test:live` or the single-target live commands in [docs/TESTING.md](./docs/TESTING.md) when verifying against the real API.
- Keep consumer-package verification healthy; the `consumer` live test is the publication safety net.

## Skills

- Repo-local development skills live in `.agents/skills/*-dev`.
- `.claude/*` mirrors the same guidance through symlinks for Claude-compatible tooling.
