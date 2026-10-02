# Migrating to v12

Version 12 renames the token option of the file media URL helpers from `oauthToken` to
`downloadToken` and makes it required. The `files.get*Url` methods no longer fall back to
`PutioSdkConfig.accessToken`: omitting `downloadToken` is a type error, and JavaScript callers get a
`PutioValidationError`. The query parameter on the wire stays `oauth_token`.

Media URLs leave the app: players, casting receivers, copied links, and logs all see them. Sign
them with the account download token from `getAccountInfo({ download_token: 1 })`. It is accepted
by the file download, stream, MP4, HLS, subtitle, and XSPF routes and rejected by account, file listing, and transfer
routes, so a leaked URL does not hand out full account access.

Renamed:

- `oauthToken` to `downloadToken` in `FileDirectAccessOptions`, `FileApiDownloadUrlOptions`,
  `FileApiMp4DownloadUrlOptions`, `FileHlsStreamUrlOptions`, and `FileXspfPlaylistUrlOptions`
- this covers `buildFileApiDownloadUrl`, `buildFileApiContentUrl`, `buildFileApiMp4DownloadUrl`,
  `buildFileHlsStreamUrl`, `buildFileXspfPlaylistUrl`, and the `files.getApiDownloadUrl`,
  `files.getApiContentUrl`, `files.getApiMp4DownloadUrl`, `files.getHlsStreamUrl`, and
  `files.getXspfPlaylistUrl` client methods
- `FileURLProvider` takes one `{ baseUrl, downloadToken }` options object instead of positional
  arguments, and `FileURLProvider#token` is now `FileURLProvider#downloadToken`. Missing or empty
  options throw a `PutioValidationError`.

Unchanged: `files.upload` and `files.createUploadRequest` keep `oauthToken`, because upload needs
the full OAuth token.

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

`FileURLProvider` before:

```ts
const urls = new FileURLProvider("https://api.put.io", accessToken);
```

After:

```ts
const urls = new FileURLProvider({ baseUrl: "https://api.put.io", downloadToken });
```
