<div align="center">
  <p>
    <img src="https://static.put.io/images/putio-boncuk.png" width="72" alt="put.io boncuk">
  </p>

  <h1>putio-sdk-typescript</h1>

  <p>
    TypeScript SDK for the <a href="https://devs.put.io/api">put.io API</a>
  </p>
  <p>
    Domain-first, schema-validated at the boundary, and built on standard Web APIs.
  </p>

  <p>
    <a href="https://github.com/putdotio/putio-sdk-typescript/actions/workflows/ci.yml?query=branch%3Amain" style="text-decoration:none;"><img src="https://img.shields.io/github/actions/workflow/status/putdotio/putio-sdk-typescript/ci.yml?branch=main&style=flat&label=ci&colorA=000000&colorB=000000" alt="CI"></a>
    <a href="https://www.npmjs.com/package/@putdotio/sdk" style="text-decoration:none;"><img src="https://img.shields.io/npm/v/%40putdotio%2Fsdk?style=flat&colorA=000000&colorB=000000" alt="npm version"></a>
    <a href="https://github.com/putdotio/putio-sdk-typescript/blob/main/LICENSE" style="text-decoration:none;"><img src="https://img.shields.io/github/license/putdotio/putio-sdk-typescript?style=flat&colorA=000000&colorB=000000" alt="license"></a>
  </p>
</div>

## Installation

```bash
npm install @putdotio/sdk
```

## Quick Start

`userAccessToken` in these examples is an already-issued user token from your app or auth flow.

```ts
import { createPutioSdkPromiseClient } from "@putdotio/sdk";

const sdk = createPutioSdkPromiseClient({
  accessToken: userAccessToken,
});

const account = await sdk.account.getInfo({
  download_token: 1,
});
```

## Authentication

The client can be created without a token, for flows that obtain or check one:

```ts
const sdk = createPutioSdkPromiseClient();

const validation = await sdk.auth.validateToken(tokenToCheck);
const login = await sdk.auth.login({
  callbackUrl,
  clientId,
  clientSecret,
  password,
  username,
});
```

Server-side callers can add `headers` that every API request the SDK sends carries. Per-request headers win, and an `authorization` entry in config headers is ignored.

```ts
const sdk = createPutioSdkPromiseClient({
  headers: { "x-forwarded-for": viewerIp },
});
```

Long-lived Promise clients can replace or clear their token without recreating the client:

```ts
sdk.setAccessToken(nextUserAccessToken);
const account = await sdk.account.getInfo();

sdk.setAccessToken(undefined);
```

`accessToken` and `setAccessToken(...)` take a string or an Effect `Redacted<string>`. The SDK stores the token as `Redacted`, so `PutioSdkConfig` never prints it, and unwraps it only to build the `Authorization` header.

The token is snapshotted when each Promise-client operation is invoked. Token changes apply to subsequent operations; an operation already in flight keeps the snapshot it started with. Base, upload, and web app URLs and default headers remain fixed from client creation.

Authorization-code clients can exchange a code without configuring a default access token:

```ts
const sdk = createPutioSdkPromiseClient();

const accessToken = await sdk.auth.exchangeAuthorizationCode({
  clientId,
  clientSecret,
  code,
  redirectUri,
});
```

The exchange uses a form-encoded `POST` and never sends a configured bearer token. Known OAuth
failures reject with `OAuthAuthorizationCodeExchangeError`; validation errors omit client secrets
and codes.

## Utilities

Shared formatting, URL, and error-localization helpers are available from the utilities subpath:

```ts
import {
  FileUrlProvider,
  secondsToReadableDuration,
  toHumanFileSize,
} from "@putdotio/sdk/utilities";
```

```ts
const urls = new FileUrlProvider({ baseUrl: "https://api.put.io", downloadToken });
const size = toHumanFileSize(1_572_864);
const duration = secondsToReadableDuration(444);
```

## Effect Example

```ts
import { Effect } from "effect";
import {
  PutioSdk,
  createPutioSdkEffectClient,
  makePutioSdkLiveClientLayer,
  putioSdkLiveLayer,
} from "@putdotio/sdk";

const sdk = createPutioSdkEffectClient();

const program = sdk.files
  .list(0, {
    breadcrumbs: 1,
    per_page: 20,
  })
  .pipe(Effect.provide(putioSdkLiveLayer({ accessToken: userAccessToken })));

const { breadcrumbs, files } = await Effect.runPromise(program);
```

Effect workflows can also depend on the SDK as a service:

```ts
const serviceProgram = Effect.gen(function* () {
  const sdk = yield* PutioSdk;
  return yield* sdk.files.list(0, { per_page: 20 });
}).pipe(Effect.provide(makePutioSdkLiveClientLayer({ accessToken: userAccessToken })));
```

- `makePutioSdkLiveClientLayer(config)` provides the `PutioSdk` service, `PutioSdkConfig`, and default fetch transport.
- `makePutioSdkEffectClientLayer()` builds `PutioSdk` from `PutioSdkConfig` and `PutioHttpClient` once, so tests can replace `PutioSdk` alone (free domain functions and `createPutioSdkEffectClient()` still require both services).
- `putioSdkLiveLayer(config)` provides config and default fetch transport; combine `putioSdkLayer(config)` with `makePutioFetchLayer(...)` or a custom `PutioHttpClient` to override transport.

## Clients

Both client styles expose the same API operations (the Promise client also attaches `files.createUploadFormData`).

| Client                                | Use it for                                        |
| ------------------------------------- | ------------------------------------------------- |
| `createPutioSdkPromiseClient(config)` | React apps, scripts, server handlers, React Query |
| `createPutioSdkEffectClient()`        | Effect-native workflows and service composition   |

Effect is the canonical typed surface; the Promise client adapts it to standard async functions.

- Effect client: keeps errors in the Effect error channel with operation-specific typing.
- Promise client: throws tagged SDK error objects such as `PutioOperationError`, `PutioApiError`, and `PutioRateLimitError`.
- Promise client: owns a managed Effect runtime; call `await sdk.dispose()` when tearing down a long-lived client.

Interrupting an Effect during fetch or body reads aborts the underlying request.

### Conditional Response Fields

A field the query asks for is required in the result type, and the call fails with
`PutioContractError` when the response leaves it out: `breadcrumbs` on `files.list` and
`sharing.publicAccess.listFiles`, `cursor` and `total` on `transfers.list` with `per_page`, and the
flags of `account.getInfo`, `files.get`, and `files.getChild`. One flag is exempt: `intercom` leaves
`user_hash` optional. The Effect client, the `PutioSdk` service, and the Promise client share these
checks and result types.

### Cancelling Promise requests

`sdk.withSignal(signal)` returns the same operations bound to an `AbortSignal`. It shares the
client's runtime and access token, and leaves `dispose` and `setAccessToken` on the client.

```ts
const controller = new AbortController();
const transfers = sdk.withSignal(controller.signal).transfers.list();

controller.abort();
await transfers;

await sdk.withSignal(AbortSignal.timeout(5_000)).account.getInfo();
```

- Aborting cancels the underlying fetch and rejects the promise with `signal.reason`: an
  `AbortError` `DOMException` by default, a `TimeoutError` from `AbortSignal.timeout(...)`, or the
  value passed to `controller.abort(reason)`.
- A signal that is already aborted rejects the same way without sending a request.
- A request that fails before the abort still rejects with its SDK error.

## Namespaces

Both clients expose the namespaces of `sharedOperationTree` in
[src/core/client.ts](./src/core/client.ts), such as `account`, `files`, `transfers`, and
`sharing`. Formatting, URL, and error-localization helpers live in
[@putdotio/sdk/utilities](#utilities).

## Runtime Requirements

Host runtimes must provide:

- `fetch`
- `Headers`
- `TextDecoder` (for text responses such as `files.getHlsMasterPlaylist`)
- `URL` and `URLSearchParams`
- `AbortController`
- `FormData`
- `btoa` for username/password auth flows such as `auth.login(...)`

Upload flows also need `File` or `Blob`. Polyfill missing Web APIs in the host runtime.

## Error Handling

Backend error bodies parse into `PutioErrorEnvelopeSchema` in
[src/core/errors.ts](./src/core/errors.ts); current backend errors carry metadata in `extra`.

Each core SDK error tag names who acts and has an `isPutio*` guard (`auth.exchangeAuthorizationCode` also fails with `OAuthAuthorizationCodeExchangeError`):

| Tag                                                      | Meaning                                                            | Who acts               |
| -------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------- |
| `PutioValidationError`                                   | Your arguments are invalid, or a value fails the schema you passed | You fix the call       |
| `PutioConfigurationError`                                | The client options are missing or invalid, such as no access token | You fix the setup      |
| `PutioContractError`                                     | A 2xx response was not JSON or did not match the expected shape    | Report it; retry later |
| `PutioTransportError`                                    | The request or the response body read failed                       | Retry                  |
| `PutioApiError`, `PutioAuthError`, `PutioRateLimitError` | put.io answered with an error status                               | Read `status`, `body`  |
| `PutioOperationError`                                    | An error status the operation documents                            | Branch on `operation`  |

`PutioContractError.missingField` names a field you requested with a query flag, such as
`stream_url`, that the response left out.

Promise consumers receive tagged SDK error objects:

```ts
import {
  createPutioSdkPromiseClient,
  isPutioOperationError,
  isPutioRateLimitError,
} from "@putdotio/sdk";

const sdk = createPutioSdkPromiseClient({
  accessToken: userAccessToken,
});

try {
  await sdk.files.createFolder({
    name: "Downloads",
    parent_id: 0,
  });
} catch (error) {
  if (isPutioOperationError(error)) {
    if (error.operation === "createFolder") {
      console.log(error.body.error_type);
    }
  }

  if (isPutioRateLimitError(error)) {
    console.log(error.retryAfterSeconds);
  }
}
```

A rate limit with `error.action === "captcha-needed"` can be lifted from the limited visitor's browser with a solved reCAPTCHA token:

```ts
if (isPutioRateLimitError(error) && error.action === "captcha-needed" && error.id) {
  await sdk.rateLimits.removeBan({ captchaToken, id: error.id });
}
```

Effect consumers match errors by tag:

```ts
import { Effect } from "effect";
import { PutioSdk, makePutioSdkLiveClientLayer } from "@putdotio/sdk";

const handled = Effect.gen(function* () {
  const sdk = yield* PutioSdk;
  return yield* sdk.files.createFolder({
    name: "Downloads",
    parent_id: 0,
  });
}).pipe(
  Effect.catchTag("PutioOperationError", (error) => {
    if (error.operation === "createFolder") {
      return Effect.succeed(error.body.error_type);
    }

    return Effect.fail(error);
  }),
  Effect.provide(makePutioSdkLiveClientLayer({ accessToken: userAccessToken })),
);
```

## Direct File Access

Media URLs leave your app (players, casting receivers, shared links, logs). Sign them with the
account download token (`downloadToken`), which grants only file access. The URL and playlist
helpers never fall back to `accessToken`.

```ts
const { download_token: downloadToken } = await sdk.account.getInfo({ download_token: 1 });

const playlistUrl = await sdk.files.getHlsStreamUrl(fileId, {
  downloadToken,
  maxSubtitleCount: 1,
});

const vlcPlaylistUrl = await sdk.files.getXspfPlaylistUrl(fileId, { downloadToken });

const masterPlaylist = await sdk.files.getHlsMasterPlaylist(fileId, {
  downloadToken,
  playOriginal: false,
});
```

### File Uploads

`files.upload` sends requests to `uploadBaseUrl` authenticated with `accessToken` (or an explicit `oauthToken`):

```ts
const upload = await sdk.files.upload({
  file: new File(["hello"], "hello.txt"),
  parentId: 0,
});
```

## Bulk Selections

Bulk operations take file IDs or a list cursor, and reject a selection that has neither before
sending a request:

```ts
await sdk.downloadLinks.create({ ids: [fileId] });
await sdk.sharing.clone({ cursor, excludeIds: [skippedFileId], parentId: 0 });
await sdk.zips.create({ file_ids: [fileId] });
```

## Endpoint Coverage

The SDK covers public put.io API routes and excludes admin, private, service-to-service, browser
page/callback, and alias routes.

## TanStack Query

The Promise client plugs into TanStack Query directly; wrap Effect programs in `Effect.runPromise`:

```ts
import { useQuery } from "@tanstack/react-query";
import { createPutioSdkPromiseClient } from "@putdotio/sdk";

const sdk = createPutioSdkPromiseClient({
  accessToken: token,
});

export const useAccountInfo = () =>
  useQuery({
    queryKey: ["account", "info"],
    queryFn: ({ signal }) => sdk.withSignal(signal).account.getInfo({ download_token: 1 }),
  });
```

## Docs

- [Releases](https://github.com/putdotio/putio-sdk-typescript/releases): what changed in each version, breaking changes included
- [Contributing](./CONTRIBUTING.md): setup, checks, and live tests
- [Security policy](https://github.com/putdotio/.github/blob/main/SECURITY.md): private vulnerability reports

## License

This project is available under the [MIT License](./LICENSE).
