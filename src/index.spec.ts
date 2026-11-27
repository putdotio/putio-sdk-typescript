import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import * as sdk from "./index.js";

describe("sdk root entry", () => {
  it("exports the expected top-level public surface", () => {
    expect(Object.keys(sdk).sort()).toMatchSnapshot();
  });

  it("keeps oauth_token out of API request builder URLs", async () => {
    const exportedBuilders = Object.keys(sdk)
      .filter((name) => /^(?:build|create).*(?:Url|Request)$/.test(name))
      .sort();

    expect(exportedBuilders).toEqual([
      "buildAuthLoginUrl",
      "buildFileApiContentUrl",
      "buildFileApiDownloadUrl",
      "buildFileApiMp4DownloadUrl",
      "buildFileHlsStreamUrl",
      "buildFileXspfPlaylistUrl",
      "buildOAuthAppIconRequest",
      "buildOAuthAuthorizeUrl",
      "buildPutioUrl",
      "createFileUploadRequest",
    ]);

    const loginUrl = sdk.buildAuthLoginUrl({
      clientId: 1,
      redirectUri: "https://example.com/callback",
      state: "state-1",
    });

    expect(new URL(loginUrl).searchParams.has("oauth_token")).toBe(false);

    const iconRequest = sdk.buildOAuthAppIconRequest({
      id: 9,
      oauthToken: "oauth-secret",
    });

    expect(new URL(iconRequest.url).searchParams.has("oauth_token")).toBe(false);
    expect(iconRequest.headers.Authorization).toBe("Token oauth-secret");

    const uploadRequest = await Effect.runPromise(
      sdk
        .createFileUploadRequest({ file: new Blob(["hello"]) })
        .pipe(Effect.provide(sdk.putioSdkLayer({ accessToken: "oauth-secret" }))),
    );

    expect(new URL(uploadRequest.url).searchParams.has("oauth_token")).toBe(false);
    expect(uploadRequest.headers.Authorization).toBe("Token oauth-secret");
  });
});
