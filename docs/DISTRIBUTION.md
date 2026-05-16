# Distribution

## Delivery Model

Every merge to `main` should already be releasable.

GitHub Actions owns releases for this repo and the workflow runs on GitHub-hosted Ubuntu runners.

The pipeline does three things on `main`:

1. `vp install`
2. `vp run verify`
3. `vp run test:live:consumer`
4. run `semantic-release` through the release action

The workflow uses `.releaserc.json` as the release source of truth. The release action is SHA-pinned and every `extra_plugins` entry is version-pinned, so the secret-bearing release job does not fetch unversioned semantic-release plugins.

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

The workflow grants `id-token: write` so npm mints short-lived publish credentials and provenance for the release job. The package repository metadata points at `putdotio/putio-sdk-typescript` so npm can match the OIDC publisher identity.

Release GitHub writes use `putio-release-bot` through `PUTIO_RELEASE_BOT_CLIENT_ID` and `PUTIO_RELEASE_BOT_PRIVATE_KEY`.

The workflow keeps dependency caches only on secretless verify jobs. The secret-bearing release job runs a fresh `vp install` with package-manager caching disabled before publishing to npm.

The release-bot remote is configured only after dependencies are installed.

Public-repo branch policy may still allow trusted put.io team members to push directly to `main`, but it should block outsiders, force-pushes, and branch deletes where GitHub plan support allows. Release tag policy restricts `v*` tag creation, update, and deletion to `putio-release-bot` and org admins.

## Local Checks

Before changing distribution wiring, validate the repo-local guardrails the workflow depends on:

```bash
vp install
vp run verify
```

Keep release plugins version-pinned in the workflow when updating `.releaserc.json`.

## Versioning Notes

- This repo keeps the historical release line from the archived `putio-js` package.
- The standalone `@putdotio/sdk` line starts at `v9.0.0`.
- Conventional commits drive automated version selection through `.releaserc.json`.
