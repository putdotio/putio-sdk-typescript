# Distribution

A push to `main` publishes `@putdotio/sdk` to npm and creates the GitHub
release through the `release` job in [ci.yml](../.github/workflows/ci.yml),
after `verify` and the compatibility matrix pass. The job calls the shared
[`frontend-release-npm.yml`](https://github.com/putdotio/.github#frontend-release-npmyml)
workflow, pinned to a reviewed commit SHA. Every merge to `main` must be
releasable.

semantic-release reads [`.releaserc.json`](../.releaserc.json): `feat`, `fix`,
`perf`, reverts, and breaking changes publish; `docs`, `chore`, `test`, and
`ci` publish nothing. A plugin added to `.releaserc.json` needs a matching
exact-version entry in the caller's `extra-plugins` input.

## Release Environment

The protected GitHub Environment `release` supplies the secret
`PUTIO_CI_APP_PRIVATE_KEY` and the variable `PUTIO_CI_APP_CLIENT_ID`. It has
no approval step. The `putio-ci` GitHub App writes the version commit, the
`v*` tag, and the GitHub Release; a tag ruleset limits `v*` tags to `putio-ci`
and org admins.

npm publishes through Trusted Publishing with provenance, which needs
GitHub-hosted runners. The trusted publisher is owner `putdotio`, repository
`putio-sdk-typescript`, workflow `ci.yml`, Environment `release`, and
`package.json` `repository` must keep pointing at
`putdotio/putio-sdk-typescript`. Renaming `ci.yml` breaks publishing until npm
is updated.

## Versioning

The package continues the version line of the archived `putio-js` package;
the standalone `@putdotio/sdk` line starts at `v9.0.0`.
