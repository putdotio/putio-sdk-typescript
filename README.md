<div align="center">
  <p>
    <img src="https://static.put.io/images/putio-boncuk.png" width="72">
  </p>

  <h1>putio-sdk-typescript</h1>

  <p>
    TypeScript SDK for the <a href="https://api.put.io/v2/docs">put.io API</a>
  </p>
  <p>
    Domain-first, schema-validated at the boundary, and designed for all runtimes.
  </p>

  <p>
    <a href="https://github.com/putdotio/putio-sdk-typescript/actions/workflows/ci.yml?query=branch%3Amain" style="text-decoration:none;"><img src="https://img.shields.io/github/actions/workflow/status/putdotio/putio-sdk-typescript/ci.yml?branch=main&style=flat&label=ci&colorA=000000&colorB=000000" alt="CI"></a>
    <a href="https://www.npmjs.com/package/@putdotio/sdk" style="text-decoration:none;"><img src="https://img.shields.io/npm/v/%40putdotio%2Fsdk?style=flat&colorA=000000&colorB=000000" alt="npm version"></a>
    <a href="https://github.com/putdotio/putio-sdk-typescript/blob/main/LICENSE" style="text-decoration:none;"><img src="https://img.shields.io/github/license/putdotio/putio-sdk-typescript?style=flat&colorA=000000&colorB=000000" alt="license"></a>
  </p>
</div>

## Installation

Install with npm:

```bash
npm install @putdotio/sdk
```

## Quick Start

`userAccessToken` in these examples is an already-issued user token from your app or auth flow.
The SDK itself can be constructed without a token.

```ts
import { createPutioSdkPromiseClient } from "@putdotio/sdk";

const sdk = createPutioSdkPromiseClient({
  accessToken: userAccessToken,
});

const account = await sdk.account.getInfo({
  download_token: 1,
});
```

The SDK can also be created without a default token:

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

## App-Specific Passwords

Create and manage passwords for apps that use put.io basic authentication:

```ts
const created = await sdk.account.appSpecificPasswords.create({
  note: "Media server",
});

savePasswordSecurely(created.password);

const passwords = await sdk.account.appSpecificPasswords.list();
await sdk.account.appSpecificPasswords.delete(created.id);
await sdk.account.appSpecificPasswords.deleteAll();
```

The plaintext `password` is returned only by `create`. List results contain metadata instead, including a nullable `last_used_at` timestamp and a null or masked `ip_address`. The Effect client exposes the same namespace with typed errors in its Effect channel.

Long-lived Promise clients can replace or clear their token without recreating the client:

```ts
sdk.setAccessToken(nextUserAccessToken);
const account = await sdk.account.getInfo({});

sdk.setAccessToken(undefined);
```

The token is snapshotted when each Promise-client operation is invoked. Token changes apply to subsequent operations; an operation already in flight keeps the snapshot it started with. Base, upload, and web app URLs remain fixed from client creation.

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
failures are exposed as `OAuthAuthorizationCodeExchangeError`; client secrets and codes are not
included in validation errors.

Password-reset requests can provide the reset page that the backend should place in the email.
Existing callers can continue to pass only the email address:

```ts
await sdk.auth.forgotPassword("user@example.com");

await sdk.auth.forgotPassword("user@example.com", {
  resetUrl: "https://auth.put.io/reset-password?next=%2Ffiles",
});
```

The backend validates this URL before using it and falls back to its default reset page when the
option is omitted.

## Utilities

Shared formatting, URL, and error-localization helpers are available from the utilities subpath:

```ts
import {
  FileURLProvider,
  secondsToReadableDuration,
  toHumanFileSize,
} from "@putdotio/sdk/utilities";
```

```ts
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
  makePutioSdkLiveLayer,
} from "@putdotio/sdk";

const sdk = createPutioSdkEffectClient();

const program = sdk.files
  .list(0, {
    per_page: 20,
    total: 1,
  })
  .pipe(Effect.provide(makePutioSdkLiveLayer({ accessToken: userAccessToken })));

const result = await Effect.runPromise(program);
```

Effect workflows can also depend on the SDK as a service:

```ts
const serviceProgram = Effect.gen(function* () {
  const sdk = yield* PutioSdk;
  return yield* sdk.files.list(0, { per_page: 20 });
}).pipe(Effect.provide(makePutioSdkLiveClientLayer({ accessToken: userAccessToken })));
```

`makePutioSdkLiveClientLayer(...)` provides the SDK service, SDK config, and default fetch-backed transport.
`makePutioSdkLiveLayer(...)` provides both the SDK config and the default fetch-backed transport.
Use `makePutioSdkLayer(...)` with `makePutioFetchLayer(...)` or your own `PutioHttpClient` service when you want to supply custom transport.

## Side-By-Side Usage

Both client styles expose the same domain surface. The Promise client also exposes
`setAccessToken(...)` for token rotation, `dispose()` for runtime teardown, and
`files.createUploadFormData(...)` for pure FormData construction.

```ts
promiseClient.files.list(0, { per_page: 20 });
effectClient.files.list(0, { per_page: 20 });

promiseClient.setAccessToken(refreshedAccessToken);
promiseClient.setAccessToken(undefined);
```

Choose the Promise client when you want standard async functions.
Choose the Effect client when you want the canonical typed error channel and Effect-native composition.

## Client Shapes

| Client                                | Use it for                                        |
| ------------------------------------- | ------------------------------------------------- |
| `createPutioSdkPromiseClient(config)` | React apps, scripts, server handlers, React Query |
| `createPutioSdkEffectClient()`        | Effect-native workflows and service composition   |

Effect is the canonical typed surface. The Promise client is an adapter for environments that want standard async functions.

- SDK creation does not require an access token
- Authenticated endpoints need a token through client config or the Effect layer config
- Effect client: keeps errors in the Effect error channel with operation-specific typing
- Promise client: throws tagged SDK error objects such as `PutioOperationError`, `PutioApiError`, and `PutioRateLimitError`
- Promise client: rotates or clears credentials synchronously with `setAccessToken(...)`; each operation snapshots the token active when invoked without recreating its runtime
- Promise client: owns a managed Effect runtime and exposes `dispose()` for explicit teardown

If you create a long-lived Promise client in a script, test harness, or server integration, call `await sdk.dispose()` during teardown.

## Namespace Surface

| Namespace       | Purpose                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `account`       | account info, settings, subtitle languages, app-specific passwords, confirmations, clear/destroy |
| `auth`          | token validation, login flows, device/OOB helpers, two-factor flows                              |
| `config`        | app-owned JSON config storage                                                                    |
| `downloadLinks` | download-link bundles                                                                            |
| `events`        | history events and event torrent payloads                                                        |
| `family`        | family members and invites                                                                       |
| `files`         | file listing, search, move/delete/extract, MP4, direct access URLs, upload                       |
| `friendInvites` | friend invitation management                                                                     |
| `friends`       | friend graph and requests                                                                        |
| `ifttt`         | IFTTT integration endpoints                                                                      |
| `oauth`         | OAuth app management                                                                             |
| `payment`       | plans, vouchers, payment flows, payment history                                                  |
| `podcast`       | podcast feed links for folders and media types                                                   |
| `rss`           | RSS feed management                                                                              |
| `sharing`       | friend shares, public shares, clone flows                                                        |
| `transfers`     | transfer list, add/retry/cancel/clean flows                                                      |
| `trash`         | trash listing, restore, delete, empty                                                            |
| `tunnel`        | route listing                                                                                    |
| `utilities`     | file URLs, localized errors, and shared formatting helpers                                       |
| `zips`          | zip creation and lookup                                                                          |

## Design Rules

- schema-first contracts at every external boundary
- typed errors are first-class
- parameter-conditioned responses are modeled explicitly
- no compatibility namespace shims in the public API
- fetch-native core with runtime-portable Web APIs

## Runtime Requirements

The package is designed around standard Web APIs. Host runtimes should provide:

- `fetch`
- `Request`, `Response`, and `Headers`
- `URL` and `URLSearchParams`
- `AbortController`
- `FormData`
- `btoa` for username/password auth flows such as `auth.login(...)`

For upload flows, the host should also provide file-compatible inputs such as `File` or `Blob`.

If a target runtime is missing these APIs, provide them with host-level polyfills or adapters instead of patching the SDK surface.

The package compatibility gate installs the packed tarball into external consumers and runs strict Node type/runtime checks, bundled browser checks in Chromium, Firefox, and WebKit, and a Bun runtime import check.

## Error Handling

Promise consumers receive tagged SDK error objects:

Backend error bodies preserve `status`, `status_code`, `error_type`, `error_message`,
`error_uri`, nullable `error_id`, and structured `extra` metadata. The legacy
`details` field remains available for compatibility, but current backend errors use
`extra`; `details` is planned for removal in the next major release.

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
    name: "",
    parent_id: 0,
  });
} catch (error) {
  if (isPutioOperationError(error)) {
    if (error.operation === "createFolder") {
      console.log(error.body.error_type);
    }
  }

  if (isPutioRateLimitError(error)) {
    console.log(error.retryAfter);
  }
}
```

Effect consumers keep errors in the typed error channel instead of throwing:

```ts
import { Effect } from "effect";
import { PutioSdk, makePutioSdkLiveClientLayer } from "@putdotio/sdk";

const handled = Effect.gen(function* () {
  const sdk = yield* PutioSdk;
  return yield* sdk.files.createFolder({
    name: "",
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

`files` exposes both JSON contracts and direct route helpers:

```ts
const playlistUrl = await sdk.files.getHlsStreamUrl(fileId, {
  maxSubtitleCount: 1,
});

const vlcPlaylistUrl = await sdk.files.getXspfPlaylistUrl(fileId);

const upload = await sdk.files.upload({
  file: new File(["hello"], "hello.txt"),
  parentId: 0,
});
```

Upload targets `upload.put.io` internally because `api.put.io/v2/files/upload` is only a redirect shim.

## Endpoint Coverage

The TypeScript SDK mirrors the supported public put.io API surface. The current audit outcome,
scope, exclusions, and refresh contract are documented in [API Coverage](docs/API-COVERAGE.md).
The portable route matrix is public evidence for selected decisions, not a published backend
inventory.

## File Lookup and Mutations

Named-child lookup avoids listing an entire folder and preserves the same query-conditioned fields as
`files.get`:

```ts
const child = await sdk.files.getChild({
  parentId: folderId,
  name: "movie.mp4",
  query: { stream_url: 1 },
});

await sdk.files.touch({ fileIds: [child.id], updatedAt: new Date() });
const copy = await sdk.files.copy({ fileId: child.id, parentId: 0, name: "movie copy.mp4" });
const writableUserId = await sdk.files.canWrite(copy.id);
```

`canWrite` resolves the user ID returned by the backend when the file is writable. A non-writable,
missing, or payment-gated file rejects with the corresponding typed SDK error rather than returning
`false`.

## Transfer Torrent Operations

Torrent-backed transfers expose their original metainfo bytes and tracker mutation:

```ts
const torrent = await sdk.transfers.getTorrent(transferId);

await sdk.transfers.addTrackers({
  transferId,
  trackers: ["udp://tracker.example:80", "https://tracker.example/announce"],
});
```

`getTorrent` rejects for magnet-backed or non-torrent transfers. Remove accepts exactly one selector,
preventing an ambiguous mix of IDs and filters:

```ts
await sdk.transfers.remove({ ids: [transferId] });
await sdk.transfers.remove({ filter: "completed" });
```

## Folder Sort and Podcast Feeds

Folder sort settings persist per folder and apply to subsequent file listings:

```ts
await sdk.files.setSort({
  fileId: folderId,
  sortBy: "MODIFIED_DESC",
});

await sdk.files.resetSortSettings();
```

`resetSortSettings()` clears the saved sort setting for every folder, including the root folder.

Podcast links can target a folder and an explicit non-empty selection of feed types. Omit
`types` to request the API defaults:

```ts
const { links, token } = await sdk.podcast.getLinks({
  parentId: folderId,
  types: ["audio", "mp4"],
});
```

`links` is a partial map keyed by `all`, `audio`, `video`, and `mp4`, so consumers should
check whether a requested link is present.

## TanStack Query

The Promise client plugs into TanStack Query directly:

```ts
import { useQuery } from "@tanstack/react-query";
import { createPutioSdkPromiseClient } from "@putdotio/sdk";

const sdk = createPutioSdkPromiseClient({
  accessToken: token,
});

export const useAccountInfo = () =>
  useQuery({
    queryKey: ["account", "info"],
    queryFn: () => sdk.account.getInfo({ download_token: 1 }),
  });
```

The Effect client also works well when you want the canonical typed API:

```ts
import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { PutioSdk, makePutioSdkLiveClientLayer } from "@putdotio/sdk";

const sdkLayer = makePutioSdkLiveClientLayer({
  accessToken: token,
});

export const useFiles = (parentId: number) =>
  useQuery({
    queryKey: ["files", parentId],
    queryFn: () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const sdk = yield* PutioSdk;
          return yield* sdk.files.list(parentId, { per_page: 50 });
        }).pipe(Effect.provide(sdkLayer)),
      ),
  });
```

## Docs

- [Migrating to v11](./docs/MIGRATING_V11.md) for the removed Coinbase and file-search contracts
- [Architecture](./docs/ARCHITECTURE.md) for package shape and boundaries
- [Testing](./docs/TESTING.md) for local and live verification
- [Distribution](./docs/DISTRIBUTION.md) for release automation
- [Security](./SECURITY.md) for private-first vulnerability disclosure

## Contributing

Contributor setup, validation, and live-test workflow live in [Contributing](./CONTRIBUTING.md).

## License

This project is available under the [MIT License](./LICENSE).
