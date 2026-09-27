# Distribution

## Delivery Model

Every merge to `main` should already be releasable.

GitHub Actions owns releases through [ci.yml](../.github/workflows/ci.yml). On `main`, the `release` job runs after `verify` and the compatibility matrix pass. All jobs use GitHub-hosted runners because npm Trusted Publishing supports only those.

The release job calls the [shared frontend release workflow](https://github.com/putdotio/.github) from `putdotio/.github`, pinned to a tagged commit. That workflow pins the semantic-release action by commit and every plugin by exact version, so the secret-bearing job never fetches unversioned plugins. [`.releaserc.json`](../.releaserc.json) is the release configuration. [`scan.yml`](../.github/workflows/scan.yml) calls the shared frontend scan workflow: Gitleaks, TruffleHog, Actionlint, and Zizmor on pull requests, weekly, and on manual dispatch.

The release lane:

- reads commit history on `main`
- calculates the next version
- publishes `@putdotio/sdk` to npm
- creates the GitHub release
- commits the released `package.json` version back to `main`

## Release Environment

The release job declares the protected GitHub Environment named `release`.

Environment entries:

- secrets: `PUTIO_RELEASE_BOT_PRIVATE_KEY`
- variables: `PUTIO_RELEASE_BOT_CLIENT_ID`
- approval: none; releases are continuous after the `main` gate passes
- refs: release branch/tag policy constrains what can publish
- deployment records: disabled with `deployment: false` because this is package publishing, not an app deploy

The npm package uses Trusted Publishing from GitHub Actions. On npm, configure owner `putdotio`, repository `putio-sdk-typescript`, workflow `ci.yml`, and Environment named `release` for the package.

During the `@semantic-release/npm` publish step, npm detects the GitHub OIDC identity, mints short-lived publish credentials, and publishes provenance for the release job. The package repository metadata points at `putdotio/putio-sdk-typescript` so npm can match the OIDC publisher identity.

Release GitHub writes use `putio-releaser` through `PUTIO_RELEASE_BOT_CLIENT_ID` and `PUTIO_RELEASE_BOT_PRIVATE_KEY`.

Dependency caches stay on the secretless verify jobs. The release job installs fresh with caching disabled and mints the release bot token only after install.

Public-repo branch policy may still allow trusted put.io team members to push directly to `main`, but it should block outsiders, force-pushes, and branch deletes where GitHub plan support allows. Release tag policy restricts `v*` tag creation, update, and deletion to `putio-releaser` and org admins.

## Local Checks

Before changing distribution wiring, validate the repo-local guardrails the workflow depends on:

```bash
vp install
vp run verify
vp run test:compat
```

A plugin added to `.releaserc.json` needs a matching exact-version entry in the caller's `extra-plugins` input.

## Versioning Notes

- This repo keeps the historical release line from the archived `putio-js` package.
- The standalone `@putdotio/sdk` line starts at `v9.0.0`.
- Conventional commits drive automated version selection through `.releaserc.json`.
