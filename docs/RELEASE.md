# Release

## Delivery Model

Every merge to `main` should already be releasable.

GitHub Actions owns releases for this repo. Verify jobs run on Blacksmith-hosted Ubuntu runners, while the release job stays on GitHub-hosted Ubuntu.

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

## Required Secrets

- `NPM_TOKEN`
- `GITHUB_TOKEN`

`GITHUB_TOKEN` is provided by GitHub Actions automatically.
`NPM_TOKEN` must be configured in the repository or organization secrets before the release job can publish.

## Local Checks

Before changing release wiring, validate the repo-local guardrails the workflow depends on:

```bash
vp install
vp run verify
```

## Versioning Notes

- This repo keeps the historical release line from the archived `putio-js` package.
- The standalone `@putdotio/sdk` line starts at `v9.0.0`.
- Conventional commits drive automated version selection through `.releaserc.json`.
