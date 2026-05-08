# Distribution

## Delivery Model

Every merge to `main` should already be releasable.

GitHub Actions owns releases for this repo and the workflow runs on GitHub-hosted Ubuntu runners.

The pipeline does three things on `main`:

1. `vp install`
2. `vp run verify`
3. run `semantic-release` through the release action

The workflow uses `.releaserc.json` as the release source of truth. The package itself does not carry a local `release` script or `semantic-release` devDependencies.

The release lane:

- reads commit history on `main`
- calculates the next version
- publishes `@putdotio/sdk` to npm
- creates the GitHub release
- commits the released `package.json` version back to `main`

## Release Environment

The release job declares the protected GitHub Environment named `release`.

Environment entries:

- secrets: `NPM_TOKEN`, `PUTIO_RELEASE_BOT_PRIVATE_KEY`
- variables: `PUTIO_RELEASE_BOT_APP_ID`
- approval: none; releases are continuous after the `main` gate passes
- refs: release branch/tag policy constrains what can publish

Release GitHub writes use `putio-release-bot` through `PUTIO_RELEASE_BOT_APP_ID` and `PUTIO_RELEASE_BOT_PRIVATE_KEY`. `NPM_TOKEN` must live in the `release` Environment, not as a plain repository secret, so pull request jobs never receive publish credentials.

Public-repo branch policy may still allow trusted put.io team members to push directly to `main`, but it should block outsiders, force-pushes, and branch deletes where GitHub plan support allows. Release tag policy restricts `v*` tag creation, update, and deletion to `putio-release-bot` and org admins.

## Local Checks

Before changing distribution wiring, validate the repo-local guardrails the workflow depends on:

```bash
vp install
vp run verify
```

## Versioning Notes

- This repo keeps the historical release line from the archived `putio-js` package.
- The standalone `@putdotio/sdk` line starts at `v9.0.0`.
- Conventional commits drive automated version selection through `.releaserc.json`.
