# Migrating to v12

Version 12 renames the token option of the file media URL helpers from `oauthToken` to
`downloadToken`. The query parameter on the wire stays `oauth_token`.

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
- `FileURLProvider#token` to `FileURLProvider#downloadToken`; the constructor's second argument is
  now documented as the download token

Unchanged: `files.upload` and `files.createUploadRequest` keep `oauthToken`, because upload needs
the full OAuth token.

Before:

```ts
const url = await sdk.files.getHlsStreamUrl(fileId, { oauthToken: accessToken });
```

After:

```ts
const { download_token: downloadToken } = await sdk.account.getInfo({ download_token: 1 });
const url = await sdk.files.getHlsStreamUrl(fileId, { downloadToken });
```
