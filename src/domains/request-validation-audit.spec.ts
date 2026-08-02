import { PutioValidationError } from "../core/errors.js";
import { describe, expect, it } from "vite-plus/test";

import * as appSpecificPasswords from "./app-specific-passwords.js";
import * as downloadLinks from "./download-links.js";
import * as events from "./events.js";
import * as files from "./files.js";
import * as oauth from "./oauth.js";
import * as podcast from "./podcast.js";
import * as rss from "./rss.js";
import * as sharing from "./sharing.js";
import { expectFailure, jsonResponse, runSdkExit } from "../../test/support/sdk-test.js";

describe("request validation audit", () => {
  it("rejects excess properties at every legacy object-decoding boundary", async () => {
    let requestCount = 0;
    const handler = () => {
      requestCount += 1;
      return jsonResponse({ status: "OK" });
    };
    const config = { accessToken: "token-123" };

    const failures = await Promise.all([
      runSdkExit(
        appSpecificPasswords.createAppSpecificPassword({
          note: "Audit device",
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        downloadLinks.createDownloadLinks({
          ids: [1],
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        events.listEvents({
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        files.getFileChild({
          name: "audit.txt",
          parentId: 0,
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        files.copyFile({
          fileId: 1,
          parentId: 0,
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        files.touchFiles({
          fileIds: [1],
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        files.searchFiles({
          query: "audit",
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        files.setFileSort({
          fileId: 0,
          sortBy: "NAME_ASC",
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        oauth.getOAuthApp(1, {
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        oauth.setOAuthAppIcon(1, {
          icon: new Blob(["icon"]),
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        oauth.createOAuthApp({
          callback: "https://example.test/callback",
          description: "Audit application",
          name: "Audit app",
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
          website: "https://example.test",
        }),
        handler,
        config,
      ),
      runSdkExit(
        oauth.updateOAuthApp({
          callback: "https://example.test/callback",
          description: "Audit application",
          id: 1,
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
          website: "https://example.test",
        }),
        handler,
        config,
      ),
      runSdkExit(
        podcast.getPodcastLinks({
          parentId: 0,
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        rss.createRssFeed({
          rss_source_url: "https://example.test/feed.xml",
          title: "Audit feed",
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        rss.updateRssFeed(1, {
          rss_source_url: "https://example.test/feed.xml",
          title: "Audit feed",
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        sharing.cloneSharedFiles({
          ids: [1],
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        sharing.shareFiles({
          ids: [1],
          target: { type: "everyone" },
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        sharing.unshareFile({
          fileId: 1,
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        sharing.listPublicShareFiles({
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
      runSdkExit(
        sharing.continuePublicShareFiles("cursor", {
          // @ts-expect-error JavaScript callers can supply excess properties.
          unexpected: true,
        }),
        handler,
        config,
      ),
    ]);

    expect(failures.map(expectFailure)).toEqual(
      failures.map(() => expect.any(PutioValidationError)),
    );
    expect(requestCount).toBe(0);
  });
});
