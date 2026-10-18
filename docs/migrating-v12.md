# Migrating to v12

Version 12 changes how media URLs are signed and renames the file URL utility to the SDK's
`Url` casing. There are no aliases or deprecated re-exports.

## Media URLs take a required `downloadToken`

The file media URL helpers take a required `downloadToken` instead of an optional `oauthToken`.
The `files.get*Url` methods no longer fall back to `PutioSdkConfig.accessToken`: omitting
`downloadToken` is a type error, and JavaScript callers get a `PutioValidationError`. The query
parameter on the wire stays `oauth_token`.

Media URLs leave the app: players, casting receivers, copied links, and logs all see them. Sign
them with the account download token from `getAccountInfo({ download_token: 1 })`. It is accepted
by the file download, stream, MP4, HLS, subtitle, and XSPF routes and rejected by account, file
listing, and transfer routes, so a leaked URL does not hand out full account access.

Upload is unchanged: `files.upload` and `files.createUploadRequest` keep `oauthToken`, because
upload needs the full OAuth token.

Before:

```ts
// Signed with the client's accessToken by default.
const url = await sdk.files.getHlsStreamUrl(fileId);
```

After:

```ts
const { download_token: downloadToken } = await sdk.account.getInfo({ download_token: 1 });
const url = await sdk.files.getHlsStreamUrl(fileId, { downloadToken });
```

## `FileUrlProvider`

`FileURLProvider` is now `FileUrlProvider`. It takes one `{ baseUrl, downloadToken }` options
object instead of positional arguments; missing or empty options throw a `PutioValidationError`.

Before:

```ts
const urls = new FileURLProvider("https://api.put.io", accessToken);
urls.getHLSStreamURL(file);
```

After:

```ts
const urls = new FileUrlProvider({ baseUrl: "https://api.put.io", downloadToken });
urls.getHlsStreamUrl(file);
```

## Rename table

| Old                                                   | New                                               |
| ----------------------------------------------------- | ------------------------------------------------- |
| `oauthToken` option on `FileDirectAccessOptions`      | `downloadToken` (required)                        |
| `oauthToken` option on `FileApiDownloadUrlOptions`    | `downloadToken` (required)                        |
| `oauthToken` option on `FileApiMp4DownloadUrlOptions` | `downloadToken` (required)                        |
| `oauthToken` option on `FileHlsStreamUrlOptions`      | `downloadToken` (required)                        |
| `oauthToken` option on `FileXspfPlaylistUrlOptions`   | `downloadToken` (required)                        |
| `FileURLProvider`                                     | `FileUrlProvider`                                 |
| `new FileURLProvider(apiURL, token)`                  | `new FileUrlProvider({ baseUrl, downloadToken })` |
| `FileURLProvider#token`                               | `FileUrlProvider#downloadToken`                   |
| `FileURLProvider#baseURL`                             | `FileUrlProvider#baseUrl`                         |
| `FileURLProvider#apiURL`                              | `FileUrlProvider#apiUrl`                          |
| `FileURLProvider#getDownloadURL`                      | `FileUrlProvider#getDownloadUrl`                  |
| `FileURLProvider#getHLSStreamURL`                     | `FileUrlProvider#getHlsStreamUrl`                 |
| `FileURLProvider#getMP4DownloadURL`                   | `FileUrlProvider#getMp4DownloadUrl`               |
| `FileURLProvider#getMP4StreamURL`                     | `FileUrlProvider#getMp4StreamUrl`                 |
| `FileURLProvider#getStreamURL`                        | `FileUrlProvider#getStreamUrl`                    |
| `FileURLProvider#getXSPFURL`                          | `FileUrlProvider#getXspfUrl`                      |
| —                                                     | `FileUrlProviderOptions` (new type)               |

The option rename applies to `buildFileApiDownloadUrl`, `buildFileApiContentUrl`,
`buildFileApiMp4DownloadUrl`, `buildFileHlsStreamUrl`, `buildFileXspfPlaylistUrl`, and the
`files.getApiDownloadUrl`, `files.getApiContentUrl`, `files.getApiMp4DownloadUrl`,
`files.getHlsStreamUrl`, and `files.getXspfPlaylistUrl` client methods.
