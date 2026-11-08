---
name: verify-request-urls
description: Check that SDK request paths can never send a request, or its access token, off the configured origin or out of its route prefix. Use when a change touches request path building or URL handling in src/core/http.ts, adds a caller that builds paths from input, or upgrades Node or the URL parser.
---

# Verify request URL confinement

**Property:** for any path string, `buildPutioUrl` either rejects it with `PutioConfigurationError` or `PutioValidationError`, or returns a URL on the base origin, without userinfo, under the literal prefix the path started with.

**Harm:** `requestJson` and `buildPutioUrl` are public. A path that escapes sends the caller's `Authorization: Token` to another host, or sends a write to a parent route.

## Covered code

[`src/core/http.ts`](../../../src/core/http.ts):

- `absoluteUrlPattern`, `parserRewrittenPattern`, `dotSegmentPattern`, `normalizeApiPath`, `buildPutioUrl`
- `executeRequest` and `makeRequest`, which attach the authorization header to the URL that `buildPutioUrl` returns
- `encodePathSegment`, which every domain endpoint uses to put input into a path

The check is [`src/core/http.url-confinement.spec.ts`](../../../src/core/http.url-confinement.spec.ts).

**Sync commit:** the latest commit that changed this file. Find it with `git log -1 --format=%h -- .agents/skills/verify-request-urls/SKILL.md`.

## Does the change touch it?

```sh
git diff "$(git log -1 --format=%h -- .agents/skills/verify-request-urls/SKILL.md)" -- src/core/http.ts package.json
```

Rerun the check when that diff changes a covered function, the `engines` or Node version, or the request pipeline. Rerun it also when a domain puts input into a path without `encodePathSegment`.

## Run

```sh
pnpm exec vp test run src/core/http.url-confinement.spec.ts
```

It takes about 2 seconds. `vp run verify` also runs it.

## Read the result

The check has three tests:

1. **Exhaustive sweep.** Every path of up to 4 tokens from `delimiterTokens` goes after each prefix in `prefixes`, on each base in `bases`. A failure lists up to 10 paths in `"<path>" <reason>` form.
2. **Generated paths.** fast-check runs 5000 random tails over the full Unicode range, and token mixes.
3. **Token pipeline.** The real `requestJson` runs 2000 token mixes against a mock transport. The test asserts that every request carrying `authorization` goes to the base origin.

Each reason maps to a step:

- `left origin` or `added userinfo`: the URL parser read the path as an authority. Example: `"/\\evil.test"`, because the parser reads `\` as `/` for http and https.
- `escaped <prefix>`: the parser removed a dot segment and climbed above the prefix. Examples: `"/v2/..\\files"`, and `"/v2/..?x"`, where the segment check saw `..?x`.
- `threw TypeError`: `buildPutioUrl` threw a raw error instead of an SDK error.

fast-check prints `Counterexample`, `seed` and `path`. To replay a failure, pass `{ seed, path }` to that `fc.assert` call.

**Real bug or modeling error?**

- **Real bug:** the printed path, passed to `buildPutioUrl` with that base, reaches another host or a parent route. Confirm with `node -e 'console.log(new URL("<path>", "https://api.put.io").href)'`. Fix `normalizeApiPath`. Never fix it by removing tokens, prefixes or bases from the test.
- **Modeling error:** the URL stays on the origin and under the prefix, but the test flags it. Example: a base you added has a path, and `new URL` drops that path by design. Fix the test and say why in the commit.

## Change the verification on purpose

- `normalizeApiPath` rejects only the characters that the URL parser rewrites: `\`, control characters, and leading or trailing spaces. Callers may still pass `?`, spaces and Unicode. Rejecting more characters is a breaking change to the public `requestJson`.
- Put input into a path only through `encodePathSegment`. Never guard a new endpoint by loosening `normalizeApiPath`.
- Add any new URL delimiter or parser quirk to `delimiterTokens`. Raising `maxTokens` to 5 costs about 20 times the run time.
- After you change covered code, run the check. Also run it with your change broken on purpose, such as the `parserRewrittenPattern` test removed, and confirm it fails. Then update this file so that its sync commit moves forward. Make that edit only after you confirm the check describes the code at the new commit.

## Scope

- **Verified:** every path of up to 4 tokens, on 3 bases and 3 prefixes, plus generated paths. This uses the Node `URL` parser that `vp test` runs.
- **Not verified:**
  - Paths longer than 4 tokens, except by random sampling.
  - Browser and Bun URL parsers.
  - `baseUrl` values that carry a path.
  - Query keys and values.
  - Redirects that the server or `fetch` follows.
