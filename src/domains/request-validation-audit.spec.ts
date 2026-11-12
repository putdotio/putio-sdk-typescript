import { Effect } from "effect";
import { PutioValidationError } from "../core/errors.js";
import { describe, expect, it } from "@effect/vitest";

import * as appSpecificPasswords from "./app-specific-passwords.js";
import * as downloadLinks from "./download-links.js";
import * as events from "./events.js";
import * as files from "./files.js";
import * as oauth from "./oauth.js";
import * as podcast from "./podcast.js";
import * as rss from "./rss.js";
import * as sharing from "./sharing.js";
import { expectFailure, jsonResponse, provideSdk } from "../../test/support/sdk-test.js";

describe("request input validation", () => {
  it.effect("rejects excess input properties before sending a request", () =>
    Effect.gen(function* () {
      let requestCount = 0;

      const handler = () => {
        requestCount += 1;

        return jsonResponse({ status: "OK" });
      };

      const config = { accessToken: "token-123" };

      const failures = yield* Effect.all([
        Effect.exit(
          provideSdk(
            appSpecificPasswords.createAppSpecificPassword({
              note: "Audit device",
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            downloadLinks.createDownloadLinks({
              ids: [1],
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            events.listEvents({
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            files.getFileChild({
              name: "audit.txt",
              parentId: 0,
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            files.copyFile({
              fileId: 1,
              parentId: 0,
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            files.touchFiles({
              fileIds: [1],
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            files.searchFiles({
              query: "audit",
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            files.setFileSort({
              fileId: 0,
              sortBy: "NAME_ASC",
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            oauth.getOAuthApp(1, {
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            oauth.getOAuthApp(1, {
              // @ts-expect-error JavaScript callers can collide with positional fields.
              id: 2,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            oauth.setOAuthAppIcon(1, {
              icon: new Blob(["icon"]),
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
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
        ),
        Effect.exit(
          provideSdk(
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
        ),
        Effect.exit(
          provideSdk(
            podcast.getPodcastLinks({
              parentId: 0,
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            rss.createRssFeed({
              rss_source_url: "https://example.test/feed.xml",
              title: "Audit feed",
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            rss.updateRssFeed(1, {
              rss_source_url: "https://example.test/feed.xml",
              title: "Audit feed",
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            sharing.cloneSharedFiles({
              ids: [1],
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            sharing.shareFiles({
              ids: [1],
              target: { type: "everyone" },
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            sharing.unshareFile({
              fileId: 1,
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            sharing.listPublicShareFiles({
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
        Effect.exit(
          provideSdk(
            sharing.continuePublicShareFiles("cursor", {
              // @ts-expect-error JavaScript callers can supply excess properties.
              unexpected: true,
            }),
            handler,
            config,
          ),
        ),
      ]);

      expect(failures.map((exit) => expectFailure<unknown>(exit))).toEqual(
        failures.map(() => expect.any(PutioValidationError)),
      );
      expect(requestCount).toBe(0);
    }),
  );
});
