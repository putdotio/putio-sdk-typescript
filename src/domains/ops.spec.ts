import { Effect, type Schema } from "effect";
import { PutioOperationError, PutioValidationError } from "../core/errors.js";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";

import type { PutioSdkContext } from "../core/http.js";

import * as oauth from "./oauth.js";
import * as rss from "./rss.js";
import * as sharing from "./sharing.js";
import * as transfers from "./transfers.js";
import * as trash from "./trash.js";
import * as zips from "./zips.js";
import {
  arrayBufferResponse,
  expectFailure,
  getFormBody,
  getFormDataBody,
  jsonResponse,
  provideSdk,
} from "../../test/support/sdk-test.js";

const sharedFile = {
  content_type: null,
  created_at: "2026-03-17T00:00:00Z",
  crc32: null,
  extension: null,
  file_type: "FOLDER" as const,
  first_accessed_at: null,
  folder_type: "REGULAR" as const,
  icon: null,
  id: 7,
  is_hidden: false,
  is_mp4_available: false,
  is_shared: true,
  name: "Shared",
  opensubtitles_hash: null,
  parent_id: null,
  screenshot: null,
  size: 0,
  updated_at: "2026-03-17T00:00:00Z",
};

const transfer = {
  availability: null,
  callback_url: null,
  client_ip: null,
  completion_percent: 50,
  created_at: "2026-03-17T00:00:00Z",
  created_torrent: false,
  current_ratio: null,
  download_id: null,
  down_speed: 10,
  downloaded: 100,
  error_message: null,
  estimated_time: null,
  file_id: null,
  finished_at: null,
  hash: null,
  id: 11,
  is_private: false,
  name: "SDK Transfer",
  peers_connected: null,
  peers_getting_from_us: null,
  peers_sending_to_us: null,
  percent_done: 50,
  save_parent_id: 0,
  seconds_seeding: null,
  simulated: false,
  size: 200,
  source: "https://example.com/file",
  started_at: null,
  status: "DOWNLOADING" as const,
  subscription_id: null,
  torrent_link: null,
  tracker: null,
  tracker_message: null,
  type: "URL" as const,
  uploaded: null,
  up_speed: null,
};

const rssFeed = {
  created_at: "2026-03-17T00:00:00Z",
  delete_old_files: false,
  extract: false,
  id: 1,
  keyword: null,
  last_error: null,
  last_fetch: null,
  parent_dir_id: 0,
  parentdirid: 0,
  paused: false,
  paused_at: null,
  rss_source_url: "https://example.com/feed.xml",
  start_at: null,
  title: "SDK Feed",
  unwanted_keywords: "",
  updated_at: "2026-03-17T00:00:00Z",
};

describe("operational domain boundaries", () => {
  const okRoutes: ReadonlyArray<
    readonly [string, string, Effect.Effect<unknown, unknown, PutioSdkContext>]
  > = [
    ["POST", "/v2/rss/1/pause", rss.pauseRssFeed(1)],
    ["POST", "/v2/rss/1/resume", rss.resumeRssFeed(1)],
    ["POST", "/v2/rss/1/delete", rss.deleteRssFeed(1)],
    ["POST", "/v2/rss/1/clear-log", rss.clearRssFeedLogs(1)],
    ["POST", "/v2/rss/1/items/2/retry", rss.retryRssFeedItem(1, 2)],
    ["POST", "/v2/rss/1/retry-all", rss.retryAllRssFeedItems(1)],
    ["POST", "/v2/oauth/apps/9/delete", oauth.deleteOAuthApp(9)],
    ["DELETE", "/v2/public_share/1", sharing.deletePublicShare(1)],
    ["POST", "/v2/trash/empty", trash.emptyTrash()],
    ["GET", "/v2/zips/9/cancel", zips.cancelZip(9)],
  ];

  it.effect.each(okRoutes)("sends an OK-only operation to %s %s", ([method, path, effect]) =>
    provideSdk(
      effect,
      (request) => {
        expect(request.method).toBe(method);
        expect(new URL(request.url).pathname).toBe(path);

        return jsonResponse({ status: "OK" });
      },
      { accessToken: "token-123" },
    ),
  );

  it.effect("covers rss endpoints", () =>
    Effect.gen(function* () {
      expect(
        yield* provideSdk(
          rss.listRssFeeds(),
          () => jsonResponse({ feeds: [rssFeed], status: "OK" }),
          { accessToken: "token-123" },
        ),
      ).toHaveLength(1);

      expect(
        yield* provideSdk(rss.getRssFeed(1), () => jsonResponse({ feed: rssFeed, status: "OK" }), {
          accessToken: "token-123",
        }),
      ).toMatchObject({ id: 1 });

      expect(
        yield* provideSdk(
          rss.createRssFeed({
            delete_old_files: true,
            keyword: null,
            parent_dir_id: "newf",
            rss_source_url: "https://example.com/feed.xml",
            title: "SDK Feed",
          }),
          (request) => {
            const body = getFormBody(request);
            expect(body.get("delete_old_files")).toBe("on");
            expect(body.get("parent_dir_id")).toBe("newf");
            expect(body.get("unwanted_keywords")).toBe("");

            return jsonResponse({ feed: rssFeed, status: "OK" });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ title: "SDK Feed" });

      expect(
        yield* provideSdk(
          rss.updateRssFeed(1, {
            dont_process_whole_feed: true,
            rss_source_url: "https://example.com/feed.xml",
            title: "SDK Feed",
            unwanted_keywords: "spam",
          }),
          (request) => {
            const body = getFormBody(request);
            expect(body.get("dont_process_whole_feed")).toBe("true");
            expect(body.get("unwanted_keywords")).toBe("spam");

            return jsonResponse({ status: "OK" });
          },
          { accessToken: "token-123" },
        ),
      ).toEqual({ status: "OK" });

      expect(
        yield* provideSdk(
          rss.listRssFeedItems(1),
          () =>
            jsonResponse({
              feed: rssFeed,
              items: [
                {
                  detected_date: "2026-03-17",
                  id: 1,
                  is_failed: true,
                  failure_reason: "bad feed",
                  processed_at: "2026-03-17",
                  publish_date: null,
                  title: "Episode 1",
                },
              ],
              status: "OK",
            }),
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ items: [expect.objectContaining({ id: 1 })] });
    }),
  );

  it.effect("rejects invalid rss inputs before transport", () =>
    Effect.gen(function* () {
      let requestCount = 0;

      const handler = () => {
        requestCount += 1;

        return jsonResponse({ status: "OK" });
      };

      const validParams = {
        rss_source_url: "https://example.com/feed.xml",
        title: "SDK Feed",
      };

      const failures = yield* Effect.all([
        Effect.exit(provideSdk(rss.getRssFeed(0), handler)),
        // @ts-expect-error JavaScript callers can provide null instead of feed parameters.
        Effect.exit(provideSdk(rss.createRssFeed(null), handler)),
        Effect.exit(provideSdk(rss.createRssFeed({ ...validParams, rss_source_url: "" }), handler)),
        Effect.exit(provideSdk(rss.createRssFeed({ ...validParams, title: "" }), handler)),
        Effect.exit(provideSdk(rss.createRssFeed({ ...validParams, parent_dir_id: -1 }), handler)),
        Effect.exit(
          provideSdk(
            rss.createRssFeed({
              ...validParams,
              // @ts-expect-error JavaScript callers can provide non-boolean flags.
              delete_old_files: "yes",
            }),
            handler,
          ),
        ),
        Effect.exit(provideSdk(rss.updateRssFeed(0, validParams), handler)),
        // @ts-expect-error JavaScript callers can provide null instead of feed parameters.
        Effect.exit(provideSdk(rss.updateRssFeed(1, null), handler)),
        Effect.exit(provideSdk(rss.pauseRssFeed(0), handler)),
        Effect.exit(provideSdk(rss.resumeRssFeed(0), handler)),
        Effect.exit(provideSdk(rss.deleteRssFeed(0), handler)),
        Effect.exit(provideSdk(rss.listRssFeedItems(0), handler)),
        Effect.exit(provideSdk(rss.clearRssFeedLogs(0), handler)),
        Effect.exit(provideSdk(rss.retryRssFeedItem(0, 1), handler)),
        Effect.exit(provideSdk(rss.retryRssFeedItem(1, 0), handler)),
        Effect.exit(provideSdk(rss.retryAllRssFeedItems(0), handler)),
      ]);

      expect(failures.map((exit) => expectFailure<unknown>(exit))).toEqual(
        failures.map(() => expect.any(PutioValidationError)),
      );
      expect(requestCount).toBe(0);
    }),
  );

  it.effect("covers oauth endpoints and URL helpers", () =>
    Effect.gen(function* () {
      expect(
        oauth.buildOAuthAuthorizeUrl({
          oauthToken: "token-123",
          query: { redirect_uri: "https://example.com/callback" },
        }),
      ).toBe(
        "https://api.put.io/v2/oauth2/authorize?redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&oauth_token=token-123",
      );

      expect(
        oauth.buildOAuthAppIconUrl({
          id: 9,
          oauthToken: "token-123",
        }),
      ).toBe("https://api.put.io/v2/oauth/apps/9/icon?oauth_token=token-123");

      expect(
        yield* provideSdk(
          oauth.queryOAuthApps(),
          () =>
            jsonResponse({
              apps: [
                {
                  callback: "https://example.com/callback",
                  description: "SDK app",
                  has_icon: false,
                  hidden: false,
                  id: 9,
                  name: "SDK app",
                  secret: "secret",
                  users: 10,
                  website: "https://example.com",
                },
              ],
              status: "OK",
            }),
          { accessToken: "token-123" },
        ),
      ).toHaveLength(1);

      expect(
        yield* provideSdk(
          oauth.getOAuthApp(9, { edit: true }),
          (request) => {
            expect(request.url).toBe("https://api.put.io/v2/oauth/apps/9/edit");

            return jsonResponse({
              app: {
                callback: "https://example.com/callback",
                description: "SDK app",
                has_icon: false,
                hidden: false,
                id: 9,
                name: "SDK app",
                secret: "secret",
                website: "https://example.com",
              },
              status: "OK",
              token: "token-123",
            });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ token: "token-123" });

      expect(
        yield* provideSdk(
          oauth.getOAuthApp(9),
          (request) => {
            expect(request.url).toBe("https://api.put.io/v2/oauth/apps/9");

            return jsonResponse({
              app: {
                callback: "https://example.com/callback",
                description: "SDK app",
                has_icon: false,
                hidden: false,
                id: 9,
                name: "SDK app",
                secret: "secret",
                website: "https://example.com",
              },
              status: "OK",
              token: "token-123",
            });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ token: "token-123" });

      yield* provideSdk(
        oauth.setOAuthAppIcon(9, {
          icon: new Blob(["icon"], { type: "image/png" }),
        }),
        (request) => {
          expect(getFormDataBody(request).get("icon")).toBeInstanceOf(Blob);

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      expect(
        yield* provideSdk(
          oauth.createOAuthApp({
            callback: "https://example.com/callback",
            description: "SDK app test",
            hidden: true,
            icon: new Blob(["icon"], { type: "image/png" }),
            name: "SDK app",
            website: "https://example.com",
          }),
          (request) => {
            const body = getFormDataBody(request);
            expect(body.get("icon")).toBeInstanceOf(Blob);
            expect(body.get("name")).toBe("SDK app");
            expect(body.get("hidden")).toBe("true");

            return jsonResponse({
              app: {
                callback: "https://example.com/callback",
                description: "SDK app",
                has_icon: false,
                hidden: true,
                id: 9,
                name: "SDK app",
                secret: "secret",
                website: "https://example.com",
              },
              status: "OK",
            });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ app: expect.objectContaining({ id: 9 }) });

      expect(
        yield* provideSdk(
          oauth.updateOAuthApp({
            callback: "https://example.com/callback",
            description: "Updated SDK app",
            id: 9,
            website: "https://example.com",
          }),
          (request) => {
            const body = getFormDataBody(request);
            expect(body.get("description")).toBe("Updated SDK app");

            return jsonResponse({
              app: {
                callback: "https://example.com/callback",
                description: "Updated SDK app",
                has_icon: false,
                id: 9,
                name: "SDK app",
                website: "https://example.com",
              },
              status: "OK",
              token: null,
            });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ token: null });

      expect(
        yield* provideSdk(
          oauth.regenerateOAuthAppToken(9),
          () => jsonResponse({ access_token: "new-token", status: "OK" }),
          { accessToken: "token-123" },
        ),
      ).toBe("new-token");

      expect(
        yield* provideSdk(
          oauth.getPopularOAuthApps(),
          () =>
            jsonResponse({
              apps: [
                {
                  description: "Popular SDK app",
                  has_icon: false,
                  hidden: false,
                  id: 10,
                  maker: "put.io",
                  name: "Popular SDK app",
                  users: 99,
                  website: "https://example.com",
                },
              ],
              status: "OK",
            }),
          { accessToken: "token-123" },
        ),
      ).toHaveLength(1);
    }),
  );

  it.effect("rejects invalid oauth app inputs before transport", () =>
    Effect.gen(function* () {
      let requestCount = 0;

      const handler = () => {
        requestCount += 1;

        return jsonResponse({ status: "OK" });
      };

      const validCreateInput = {
        callback: "https://example.com/callback",
        description: "A valid SDK application",
        name: "SDK app",
        website: "https://example.com",
      };

      const failures = yield* Effect.all([
        Effect.exit(provideSdk(oauth.getOAuthApp(0), handler)),
        Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can provide invalid option values.
            oauth.getOAuthApp(1, { edit: "yes" }),
            handler,
          ),
        ),
        Effect.exit(
          provideSdk(
            oauth.setOAuthAppIcon(0, { icon: new Blob(["icon"], { type: "image/png" }) }),
            handler,
          ),
        ),
        Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can provide non-Blob icon values.
            oauth.setOAuthAppIcon(1, { icon: "icon" }),
            handler,
          ),
        ),
        Effect.exit(
          provideSdk(oauth.createOAuthApp({ ...validCreateInput, name: "app" }), handler),
        ),
        Effect.exit(
          provideSdk(
            oauth.createOAuthApp({ ...validCreateInput, description: "too short" }),
            handler,
          ),
        ),
        Effect.exit(
          provideSdk(
            oauth.createOAuthApp({ ...validCreateInput, website: "x".repeat(256) }),
            handler,
          ),
        ),
        Effect.exit(
          provideSdk(
            oauth.createOAuthApp({ ...validCreateInput, callback: "x".repeat(256) }),
            handler,
          ),
        ),
        Effect.exit(
          provideSdk(
            oauth.updateOAuthApp({
              callback: validCreateInput.callback,
              description: "too short",
              id: 1,
              website: validCreateInput.website,
            }),
            handler,
          ),
        ),
        Effect.exit(provideSdk(oauth.deleteOAuthApp(0), handler)),
        Effect.exit(provideSdk(oauth.regenerateOAuthAppToken(0), handler)),
      ]);

      expect(failures.map((exit) => expectFailure<unknown>(exit))).toEqual(
        failures.map(() => expect.any(PutioValidationError)),
      );
      expect(requestCount).toBe(0);
    }),
  );

  it.effect("covers sharing endpoints", () =>
    Effect.gen(function* () {
      expect(
        yield* provideSdk(
          sharing.cloneSharedFiles({ ids: [7] }),
          (request) => {
            expect(getFormBody(request).get("file_ids")).toBe("7");
            expect(getFormBody(request).get("parent_id")).toBe("0");

            return jsonResponse({ id: 9, status: "OK" });
          },
          { accessToken: "token-123" },
        ),
      ).toEqual({ id: 9 });

      expect(
        yield* provideSdk(
          sharing.cloneSharedFiles({
            cursor: "cursor-1",
            ids: [7],
            parentId: 5,
          }),
          (request) => {
            const body = getFormBody(request);
            expect(body.get("cursor")).toBe("cursor-1");
            expect(body.get("file_ids")).toBe("7");
            expect(body.get("parent_id")).toBe("5");

            return jsonResponse({ id: 10, status: "OK" });
          },
          { accessToken: "token-123" },
        ),
      ).toEqual({ id: 10 });

      expect(
        yield* provideSdk(
          sharing.getSharingCloneInfo(10),
          () => jsonResponse({ shared_file_clone_status: "DONE", status: "OK" }),
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ shared_file_clone_status: "DONE" });

      expect(
        yield* provideSdk(
          sharing.shareFiles({
            ids: [7],
            target: {
              type: "everyone",
            },
          }),
          (request) => {
            expect(getFormBody(request).get("friends")).toBe("everyone");

            return jsonResponse({ status: "OK" });
          },
          { accessToken: "token-123" },
        ),
      ).toEqual({ status: "OK" });

      expect(
        yield* provideSdk(
          sharing.shareFiles({
            cursor: "cursor-1",
            ids: [7],
            target: {
              friendNames: ["sdk-user", "sdk"],
              type: "friends",
            },
          }),
          (request) => {
            const body = getFormBody(request);
            expect(body.get("cursor")).toBe("cursor-1");
            expect(body.get("file_ids")).toBe("7");
            expect(body.get("friends")).toBe("sdk-user,sdk");

            return jsonResponse({ status: "OK" });
          },
          { accessToken: "token-123" },
        ),
      ).toEqual({ status: "OK" });

      const emptyFriendsExit = yield* Effect.exit(
        provideSdk(
          sharing.shareFiles({
            ids: [7],
            target: {
              friendNames: [],
              type: "friends",
            },
          }),
          () => {
            throw new Error("request should not execute");
          },
          { accessToken: "token-123" },
        ),
      );

      expect(expectFailure(emptyFriendsExit)).toBeInstanceOf(PutioValidationError);

      expect(
        yield* provideSdk(
          sharing.listSharedFiles(),
          () =>
            jsonResponse({
              shared: [{ ...sharedFile, shared_with: "everyone" }],
              status: "OK",
            }),
          { accessToken: "token-123" },
        ),
      ).toHaveLength(1);

      expect(
        yield* provideSdk(
          sharing.getSharedWith(7),
          () =>
            jsonResponse({
              share_type: "friends",
              shares: [
                { share_id: 1, user_avatar_url: "https://put.io/avatar.png", user_name: "Altay" },
              ],
              status: "OK",
            }),
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ share_type: "friends" });

      yield* provideSdk(
        sharing.unshareFile({
          fileId: 7,
        }),
        (request) => {
          expect(getFormBody(request).get("shares")).toBe("everyone");

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      yield* provideSdk(
        sharing.unshareFile({
          fileId: 7,
          shares: [1, "everyone"],
        }),
        (request) => {
          expect(getFormBody(request).get("shares")).toBe("1,everyone");

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      expect(
        yield* provideSdk(
          sharing.createPublicShare(7),
          () =>
            jsonResponse({
              public_share: {
                created_at: "2026-03-17",
                expiration_date: "2026-04-17",
                id: 1,
                owner: { name: "put.io" },
                push_token: "push",
                token: "public-token",
                user_file: {
                  file_type: "FOLDER",
                  id: 7,
                  name: "Shared",
                },
              },
              status: "OK",
            }),
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ id: 1 });

      expect(
        yield* provideSdk(
          sharing.listPublicShares(),
          () =>
            jsonResponse({
              public_shares: [
                {
                  created_at: "2026-03-17",
                  expiration_date: "2026-04-17",
                  id: 1,
                  owner: { name: "put.io" },
                  push_token: "push",
                  token: "public-token",
                  user_file: {
                    file_type: "FOLDER",
                    id: 7,
                    name: "Shared",
                  },
                },
              ],
              status: "OK",
            }),
          { accessToken: "token-123" },
        ),
      ).toHaveLength(1);

      expect(
        yield* provideSdk(
          sharing.getPublicShare(),
          () =>
            jsonResponse({
              public_share: {
                created_at: "2026-03-17",
                expiration_date: "2026-04-17",
                id: 1,
                owner: { name: "put.io" },
                push_token: "push",
                token: "public-token",
                user_file: {
                  file_type: "FOLDER",
                  id: 7,
                  name: "Shared",
                },
              },
              status: "OK",
            }),
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ token: "public-token" });

      expect(
        yield* provideSdk(
          sharing.listPublicShareFiles({
            parent_id: 7,
            total: 1,
          }),
          (request) => {
            expect(request.url).toBe(
              "https://api.put.io/v2/public_share/files/list?parent_id=7&total=1",
            );

            return jsonResponse({
              breadcrumbs: [[0, "Root"]],
              cursor: null,
              files: [sharedFile],
              parent: sharedFile,
              status: "OK",
              total: 1,
            });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ total: 1 });

      expect(
        yield* provideSdk(
          sharing.continuePublicShareFiles("cursor-1", { per_page: 2 }),
          (request) => {
            expect(request.url).toBe(
              "https://api.put.io/v2/public_share/files/list/continue?per_page=2",
            );
            expect(getFormBody(request).get("cursor")).toBe("cursor-1");

            return jsonResponse({
              cursor: null,
              files: [sharedFile],
              parent: sharedFile,
              status: "OK",
              total: 1,
            });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ files: [expect.objectContaining({ id: 7 })] });

      expect(
        yield* provideSdk(
          sharing.getPublicShareFileUrl(7),
          () => jsonResponse({ status: "OK", url: "https://download.put.io/public-share" }),
          { accessToken: "token-123" },
        ),
      ).toBe("https://download.put.io/public-share");
    }),
  );

  it.effect("rejects invalid sharing inputs before transport", () =>
    Effect.gen(function* () {
      let requestCount = 0;

      const handler = () => {
        requestCount += 1;

        return jsonResponse({ status: "OK" });
      };

      const failures = yield* Effect.all([
        // @ts-expect-error JavaScript callers can provide null instead of a request object.
        Effect.exit(provideSdk(sharing.cloneSharedFiles(null), handler)),
        Effect.exit(provideSdk(sharing.cloneSharedFiles({ cursor: "" }), handler)),
        Effect.exit(provideSdk(sharing.cloneSharedFiles({ ids: [0] }), handler)),
        Effect.exit(provideSdk(sharing.cloneSharedFiles({ ids: [7], parentId: -1 }), handler)),
        // @ts-expect-error A clone needs a cursor or file IDs.
        Effect.exit(provideSdk(sharing.cloneSharedFiles({}), handler)),
        // @ts-expect-error Excluded IDs alone select nothing.
        Effect.exit(provideSdk(sharing.cloneSharedFiles({ excludeIds: [7] }), handler)),
        Effect.exit(provideSdk(sharing.cloneSharedFiles({ ids: [] }), handler)),
        // @ts-expect-error A share needs a cursor or file IDs.
        Effect.exit(provideSdk(sharing.shareFiles({ target: { type: "everyone" } }), handler)),
        Effect.exit(
          provideSdk(sharing.shareFiles({ ids: [], target: { type: "everyone" } }), handler),
        ),
        // @ts-expect-error Public share lists sort by the file sort values.
        Effect.exit(provideSdk(sharing.listPublicShareFiles({ sort_by: "NEWEST" }), handler)),
        // @ts-expect-error Public share lists sort by the file sort values.
        Effect.exit(provideSdk(sharing.listPublicShareFiles({ sort: "NEWEST" }), handler)),
        Effect.exit(provideSdk(sharing.getSharingCloneInfo(0), handler)),
        // @ts-expect-error JavaScript callers can provide null instead of a request object.
        Effect.exit(provideSdk(sharing.shareFiles(null), handler)),
        Effect.exit(
          provideSdk(sharing.shareFiles({ ids: [0], target: { type: "everyone" } }), handler),
        ),
        Effect.exit(
          provideSdk(
            sharing.shareFiles({
              ids: [7],
              target: { friendNames: [""], type: "friends" },
            }),
            handler,
          ),
        ),
        Effect.exit(provideSdk(sharing.getSharedWith(0), handler)),
        Effect.exit(provideSdk(sharing.unshareFile({ fileId: 0 }), handler)),
        Effect.exit(provideSdk(sharing.unshareFile({ fileId: 7, shares: [0] }), handler)),
        Effect.exit(provideSdk(sharing.createPublicShare(0), handler)),
        Effect.exit(provideSdk(sharing.deletePublicShare(0), handler)),
        // @ts-expect-error JavaScript callers can provide null instead of a query object.
        Effect.exit(provideSdk(sharing.listPublicShareFiles(null), handler)),
        Effect.exit(provideSdk(sharing.listPublicShareFiles({ parent_id: -1 }), handler)),
        Effect.exit(provideSdk(sharing.listPublicShareFiles({ per_page: 0 }), handler)),
        Effect.exit(provideSdk(sharing.continuePublicShareFiles(""), handler)),
        // @ts-expect-error JavaScript callers can provide null instead of a query object.
        Effect.exit(provideSdk(sharing.continuePublicShareFiles("cursor", null), handler)),
        Effect.exit(
          provideSdk(sharing.continuePublicShareFiles("cursor", { per_page: 0 }), handler),
        ),
        Effect.exit(provideSdk(sharing.getPublicShareFileUrl(0), handler)),
      ]);

      expect(failures.map((exit) => expectFailure<unknown>(exit))).toEqual(
        failures.map(() => expect.any(PutioValidationError)),
      );
      expect(requestCount).toBe(0);
    }),
  );

  it.effect("covers transfers, trash, and zips", () =>
    Effect.gen(function* () {
      expect(
        yield* provideSdk(
          transfers.listTransfers({
            per_page: 2,
          }),
          (request) => {
            expect(request.url).toBe("https://api.put.io/v2/transfers/list?per_page=2");

            return jsonResponse({
              cursor: "cursor-1",
              status: "OK",
              total: 1,
              transfers: [transfer],
            });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ total: 1 });

      expect(
        yield* provideSdk(
          transfers.continueTransfers("cursor-1", { per_page: 3 }),
          (request) => {
            expect(request.url).toBe("https://api.put.io/v2/transfers/list/continue?per_page=3");
            expect(getFormBody(request).get("cursor")).toBe("cursor-1");

            return jsonResponse({
              cursor: null,
              status: "OK",
              transfers: [transfer],
            });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ transfers: [expect.objectContaining({ id: 11 })] });

      expect(
        yield* provideSdk(
          transfers.getTransfer(11),
          () => jsonResponse({ status: "OK", transfer }),
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ id: 11 });

      expect(
        Array.from(
          yield* provideSdk(
            transfers.getTransferTorrent(11),
            (request) => {
              expect(request.method).toBe("GET");
              expect(request.url).toBe("https://api.put.io/v2/transfers/11/torrent");

              return arrayBufferResponse([0x64, 0x38, 0x3a]);
            },
            { accessToken: "token-123" },
          ),
        ),
      ).toEqual([0x64, 0x38, 0x3a]);

      expect(
        yield* provideSdk(
          transfers.countTransfers(),
          () => jsonResponse({ count: 3, status: "OK" }),
          { accessToken: "token-123" },
        ),
      ).toBe(3);

      expect(
        yield* provideSdk(
          transfers.getTransferInfo(["https://example.com/a", "https://example.com/b"]),
          (request) => {
            expect(getFormBody(request).get("urls")).toBe(
              "https://example.com/a\nhttps://example.com/b",
            );

            return jsonResponse({
              disk_avail: 100,
              ret: [
                {
                  file_size: 100,
                  human_size: "100 B",
                  name: "A",
                  type_name: "file",
                  url: "https://example.com/a",
                },
              ],
              status: "OK",
            });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ disk_avail: 100 });

      expect(
        yield* provideSdk(
          transfers.addTransfer({
            callback_url: "https://example.com/callback",
            save_parent_id: 5,
            url: "https://example.com/file",
          }),
          (request) => {
            const body = getFormBody(request);
            expect(body.get("callback_url")).toBe("https://example.com/callback");
            expect(body.get("save_parent_id")).toBe("5");
            expect(body.get("url")).toBe("https://example.com/file");

            return jsonResponse({ status: "OK", transfer });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ id: 11 });

      expect(
        yield* provideSdk(
          transfers.addManyTransfers([
            {
              url: "https://example.com/a",
            },
            {
              save_parent_id: 5,
              url: "https://example.com/b",
            },
          ]),
          (request) => {
            expect(getFormBody(request).get("urls")).toBe(
              JSON.stringify([
                { url: "https://example.com/a" },
                { save_parent_id: 5, url: "https://example.com/b" },
              ]),
            );

            return jsonResponse({
              errors: [],
              status: "OK",
              transfers: [transfer],
            });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ transfers: [expect.objectContaining({ id: 11 })] });

      expect(
        yield* provideSdk(
          transfers.addTransferTrackers({
            trackers: ["udp://tracker.example:80", "https://tracker.example/announce"],
            transferId: 11,
          }),
          (request) => {
            expect(request.url).toBe("https://api.put.io/v2/transfers/add-trackers/11");
            expect(getFormBody(request).get("trackers")).toBe(
              "udp://tracker.example:80,https://tracker.example/announce",
            );

            return jsonResponse({ status: "OK" });
          },
          { accessToken: "token-123" },
        ),
      ).toBeUndefined();

      yield* provideSdk(
        transfers.removeTransfers({ ids: [11, 12] }),
        (request) => {
          const body = getFormBody(request);
          expect(request.url).toBe("https://api.put.io/v2/transfers/remove");
          expect(body.get("transfer_ids")).toBe("11,12");
          expect(body.has("remove_filter")).toBe(false);

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      yield* provideSdk(
        transfers.removeTransfers({ filter: "completed" }),
        (request) => {
          const body = getFormBody(request);
          expect(body.get("remove_filter")).toBe("completed");
          expect(body.has("transfer_ids")).toBe(false);

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      yield* provideSdk(
        transfers.removeTransfers({ filter: "all", ids: undefined }),
        (request) => {
          const body = getFormBody(request);
          expect(body.get("remove_filter")).toBe("all");
          expect(body.has("transfer_ids")).toBe(false);

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      yield* provideSdk(
        transfers.cancelTransfers([11, 12]),
        (request) => {
          expect(getFormBody(request).get("transfer_ids")).toBe("11,12");

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      expect(
        yield* provideSdk(
          transfers.cleanTransfers([11]),
          (request) => {
            expect(getFormBody(request).get("transfer_ids")).toBe("11");

            return jsonResponse({ deleted_ids: [11], status: "OK" });
          },
          { accessToken: "token-123" },
        ),
      ).toEqual({ deleted_ids: [11] });

      expect(
        yield* provideSdk(
          transfers.retryTransfer(11),
          (request) => {
            expect(getFormBody(request).get("id")).toBe("11");

            return jsonResponse({ status: "OK", transfer });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ id: 11 });

      yield* provideSdk(
        transfers.reannounceTransfer(11),
        (request) => {
          expect(getFormBody(request).get("id")).toBe("11");

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      yield* provideSdk(
        transfers.stopTransferRecording(11),
        (request) => {
          expect(getFormBody(request).get("transfer_id")).toBe("11");

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      expect(
        yield* provideSdk(
          trash.listTrash({
            per_page: 2,
          }),
          (request) => {
            expect(request.url).toBe("https://api.put.io/v2/trash/list?per_page=2");

            return jsonResponse({
              cursor: "cursor-1",
              files: [
                {
                  content_type: null,
                  created_at: "2026-03-17",
                  deleted_at: "2026-03-17",
                  expiration_date: "2026-04-17",
                  extension: null,
                  file_type: "FILE",
                  first_accessed_at: null,
                  folder_type: "REGULAR",
                  icon: null,
                  id: 1,
                  name: "trash.txt",
                  parent_id: null,
                  screenshot: null,
                  size: 1,
                },
              ],
              status: "OK",
              total: 1,
              trash_size: 1,
            });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ total: 1 });

      expect(
        yield* provideSdk(
          trash.continueTrash("cursor-1", { per_page: 2 }),
          (request) => {
            expect(request.url).toBe("https://api.put.io/v2/trash/list/continue?per_page=2");
            expect(getFormBody(request).get("cursor")).toBe("cursor-1");

            return jsonResponse({
              cursor: null,
              files: [],
              status: "OK",
            });
          },
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ files: [] });

      yield* provideSdk(
        trash.restoreTrash({
          file_ids: [1, 2],
        }),
        (request) => {
          expect(getFormBody(request).get("file_ids")).toBe("1,2");

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      yield* provideSdk(
        trash.deleteTrash({
          cursor: "cursor-1",
          useCursor: true,
        }),
        (request) => {
          expect(getFormBody(request).get("cursor")).toBe("cursor-1");

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      expect(
        yield* provideSdk(
          zips.listZips(),
          () =>
            jsonResponse({
              status: "OK",
              zips: [{ created_at: "2026-03-17", id: 1 }],
            }),
          { accessToken: "token-123" },
        ),
      ).toHaveLength(1);

      expect(
        yield* provideSdk(
          zips.createZip({
            cursor: "cursor-1",
            exclude_ids: [2],
            file_ids: [1],
          }),
          (request) => {
            const body = getFormBody(request);
            expect(body.get("cursor")).toBe("cursor-1");
            expect(body.get("exclude_ids")).toBe("2");
            expect(body.get("file_ids")).toBe("1");

            return jsonResponse({ status: "OK", zip_id: 9 });
          },
          { accessToken: "token-123" },
        ),
      ).toBe(9);

      expect(
        yield* provideSdk(
          zips.getZip(9),
          () =>
            jsonResponse({
              id: 9,
              missing_files: [],
              size: 100,
              status: "OK",
              url: "https://download.put.io/zip",
              zip_status: "DONE",
            }),
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ zip_status: "DONE" });

      expect(
        yield* provideSdk(
          zips.getZip(9),
          () =>
            jsonResponse({
              id: 9,
              missing_files: [{ id: 10, missing: true, name: "missing.zip" }],
              size: 100,
              status: "OK",
              url: "https://download.put.io/zip",
              zip_status: "DONE",
            }),
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ missing_files: [{ missing: true }] });
    }),
  );

  it.effect("rejects invalid transfer utility inputs before transport", () =>
    Effect.gen(function* () {
      let requestCount = 0;

      const handler = () => {
        requestCount += 1;

        return jsonResponse({ status: "OK" });
      };

      const failures = yield* Effect.all([
        Effect.exit(
          // @ts-expect-error JavaScript callers can provide null instead of a query object.
          provideSdk(transfers.listTransfers(null), handler, { accessToken: "token-123" }),
        ),
        Effect.exit(
          provideSdk(transfers.listTransfers({ per_page: 0 }), handler, {
            accessToken: "token-123",
          }),
        ),
        Effect.exit(
          provideSdk(transfers.listTransfers({ per_page: 1.5 }), handler, {
            accessToken: "token-123",
          }),
        ),
        Effect.exit(
          provideSdk(transfers.continueTransfers(""), handler, { accessToken: "token-123" }),
        ),
        Effect.exit(
          // @ts-expect-error JavaScript callers can provide null instead of a query object.
          provideSdk(transfers.continueTransfers("cursor", null), handler, {
            accessToken: "token-123",
          }),
        ),
        Effect.exit(
          provideSdk(transfers.continueTransfers("cursor", { per_page: 0 }), handler, {
            accessToken: "token-123",
          }),
        ),
        Effect.exit(provideSdk(transfers.getTransfer(0), handler, { accessToken: "token-123" })),
        Effect.exit(
          provideSdk(transfers.getTransferTorrent(0), handler, { accessToken: "token-123" }),
        ),
        Effect.exit(
          provideSdk(transfers.getTransferInfo([]), handler, { accessToken: "token-123" }),
        ),
        Effect.exit(
          provideSdk(
            transfers.getTransferInfo(["https://example.com/a\nhttps://example.com/b"]),
            handler,
            {
              accessToken: "token-123",
            },
          ),
        ),
        Effect.exit(
          provideSdk(transfers.addTransfer({ url: "" }), handler, { accessToken: "token-123" }),
        ),
        Effect.exit(
          provideSdk(
            transfers.addTransfer({ save_parent_id: -1, url: "https://example.com" }),
            handler,
            {
              accessToken: "token-123",
            },
          ),
        ),
        Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can provide unknown request properties.
            transfers.addTransfer({ unexpected: true, url: "https://example.com" }),
            handler,
            { accessToken: "token-123" },
          ),
        ),
        Effect.exit(
          provideSdk(transfers.addManyTransfers([]), handler, { accessToken: "token-123" }),
        ),
        Effect.exit(
          provideSdk(transfers.addManyTransfers([{ url: "" }]), handler, {
            accessToken: "token-123",
          }),
        ),
        Effect.exit(
          provideSdk(transfers.addTransferTrackers({ trackers: [], transferId: 1 }), handler, {
            accessToken: "token-123",
          }),
        ),
        Effect.exit(
          provideSdk(
            transfers.addTransferTrackers({ trackers: ["one,two"], transferId: 1 }),
            handler,
            {
              accessToken: "token-123",
            },
          ),
        ),
        Effect.exit(
          provideSdk(
            transfers.addTransferTrackers({ trackers: ["udp://tracker example"], transferId: 1 }),
            handler,
            { accessToken: "token-123" },
          ),
        ),
        Effect.exit(
          provideSdk(transfers.cancelTransfers([]), handler, { accessToken: "token-123" }),
        ),
        Effect.exit(
          provideSdk(transfers.cancelTransfers([0]), handler, { accessToken: "token-123" }),
        ),
        Effect.exit(
          provideSdk(transfers.cleanTransfers([-1]), handler, { accessToken: "token-123" }),
        ),
        Effect.exit(
          provideSdk(transfers.removeTransfers({ ids: [] }), handler, {
            accessToken: "token-123",
          }),
        ),
        Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can omit both required selectors.
            transfers.removeTransfers({}),
            handler,
            { accessToken: "token-123" },
          ),
        ),
        Effect.exit(
          provideSdk(transfers.removeTransfers({ ids: [-1] }), handler, {
            accessToken: "token-123",
          }),
        ),
        Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can provide both mutually exclusive selectors.
            transfers.removeTransfers({ filter: "all", ids: [1] }),
            handler,
            { accessToken: "token-123" },
          ),
        ),
        Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can provide unsupported filter literals.
            transfers.removeTransfers({ filter: "pending" }),
            handler,
            { accessToken: "token-123" },
          ),
        ),
        Effect.exit(provideSdk(transfers.retryTransfer(0), handler, { accessToken: "token-123" })),
        Effect.exit(
          provideSdk(transfers.reannounceTransfer(0), handler, { accessToken: "token-123" }),
        ),
        Effect.exit(
          provideSdk(transfers.stopTransferRecording(0), handler, { accessToken: "token-123" }),
        ),
      ]);

      expect(failures.map((exit) => expectFailure<unknown>(exit))).toEqual(
        failures.map(() => expect.any(PutioValidationError)),
      );
      expect(requestCount).toBe(0);
    }),
  );

  it.effect("rejects invalid trash and zip inputs before transport", () =>
    Effect.gen(function* () {
      let requestCount = 0;

      const handler = () => {
        requestCount += 1;

        return jsonResponse({ status: "OK" });
      };

      const failures = yield* Effect.all([
        // @ts-expect-error JavaScript callers can provide null instead of a query object.
        Effect.exit(provideSdk(trash.listTrash(null), handler)),
        Effect.exit(provideSdk(trash.listTrash({ per_page: 0 }), handler)),
        // @ts-expect-error JavaScript callers can provide unknown query properties.
        Effect.exit(provideSdk(trash.listTrash({ unexpected: true }), handler)),
        Effect.exit(provideSdk(trash.continueTrash(""), handler)),
        Effect.exit(provideSdk(trash.continueTrash("cursor", { per_page: 0 }), handler)),
        // @ts-expect-error JavaScript callers can provide null instead of a query object.
        Effect.exit(provideSdk(trash.continueTrash("cursor", null), handler)),
        // @ts-expect-error JavaScript callers can omit both bulk selectors.
        Effect.exit(provideSdk(trash.restoreTrash({}), handler)),
        Effect.exit(provideSdk(trash.restoreTrash({ cursor: "", useCursor: true }), handler)),
        Effect.exit(provideSdk(trash.restoreTrash({ file_ids: [] }), handler)),
        Effect.exit(
          provideSdk(
            // @ts-expect-error Cursor mode cannot also carry explicit file IDs.
            trash.restoreTrash({ cursor: "cursor", file_ids: [1], useCursor: true }),
            handler,
          ),
        ),
        Effect.exit(provideSdk(trash.deleteTrash({ file_ids: [0] }), handler)),
        Effect.exit(
          provideSdk(
            // @ts-expect-error File-ID mode cannot also carry a cursor.
            trash.deleteTrash({ cursor: "cursor", file_ids: [1], useCursor: false }),
            handler,
          ),
        ),
        // @ts-expect-error Cursor selection must opt into cursor serialization.
        Effect.exit(provideSdk(trash.deleteTrash({ cursor: "cursor" }), handler)),
        // @ts-expect-error JavaScript callers can provide null instead of a request object.
        Effect.exit(provideSdk(zips.createZip(null), handler)),
        // @ts-expect-error A zip needs a cursor or file IDs.
        Effect.exit(provideSdk(zips.createZip({}), handler)),
        // @ts-expect-error Excluded IDs alone select nothing.
        Effect.exit(provideSdk(zips.createZip({ exclude_ids: [7] }), handler)),
        Effect.exit(provideSdk(zips.createZip({ cursor: "" }), handler)),
        Effect.exit(provideSdk(zips.createZip({ file_ids: [] }), handler)),
        Effect.exit(provideSdk(zips.createZip({ file_ids: [0] }), handler)),
        Effect.exit(provideSdk(zips.createZip({ cursor: "cursor", exclude_ids: [0] }), handler)),
        // @ts-expect-error JavaScript callers can provide unknown request properties.
        Effect.exit(provideSdk(zips.createZip({ file_ids: [1], unexpected: true }), handler)),
        Effect.exit(provideSdk(zips.getZip(0), handler)),
        Effect.exit(provideSdk(zips.cancelZip(0), handler)),
      ]);

      expect(failures.map((exit) => expectFailure<unknown>(exit))).toEqual(
        failures.map(() => expect.any(PutioValidationError)),
      );
      expect(requestCount).toBe(0);
    }),
  );

  it.effect("names continue failures after the continue operation", () =>
    Effect.gen(function* () {
      const badCursor = () =>
        jsonResponse({ error_message: "Bad cursor", status_code: 400 }, { status: 400 });

      const transfersFailure = yield* Effect.exit(
        provideSdk(transfers.continueTransfers("cursor-1"), badCursor, {
          accessToken: "token-123",
        }),
      );

      expect(expectFailure(transfersFailure)).toBeInstanceOf(PutioOperationError);
      expect(expectFailure(transfersFailure)).toMatchObject({
        domain: "transfers",
        operation: "continue",
        status: 400,
      });
    }),
  );

  it.effect("requires the cursor and total a paged transfer list returns", () =>
    Effect.gen(function* () {
      const paged = yield* provideSdk(
        transfers.listTransfers({ per_page: 2 }),
        () => jsonResponse({ cursor: null, status: "OK", total: 1, transfers: [transfer] }),
        { accessToken: "token-123" },
      );

      expectTypeOf(paged.total).toEqualTypeOf<number>();
      expectTypeOf(paged.cursor).toEqualTypeOf<string | null>();
      expect(paged.total).toBe(1);

      const unpaged = yield* provideSdk(
        transfers.listTransfers(),
        () => jsonResponse({ status: "OK", transfers: [transfer] }),
        { accessToken: "token-123" },
      );

      expectTypeOf(unpaged.total).toEqualTypeOf<number | undefined>();
      expect(unpaged.transfers).toHaveLength(1);

      const widenedQuery: transfers.TransfersListQuery = {};

      expectTypeOf(transfers.listTransfers(widenedQuery)).toEqualTypeOf(transfers.listTransfers());

      for (const [body, field] of [
        [{ status: "OK", total: 1, transfers: [transfer] }, "cursor"],
        [{ cursor: null, status: "OK", transfers: [transfer] }, "total"],
      ] as const) {
        const exit = yield* Effect.exit(
          provideSdk(transfers.listTransfers({ per_page: 2 }), () => jsonResponse(body), {
            accessToken: "token-123",
          }),
        );

        expect(expectFailure(exit)).toBeInstanceOf(PutioValidationError);
        expect(expectFailure(exit)).toMatchObject({
          cause: `Expected put.io to include "${field}" because it was requested`,
        });
      }
    }),
  );

  it.effect("requires the breadcrumbs a public share list asked for", () =>
    Effect.gen(function* () {
      const listing = yield* provideSdk(
        sharing.listPublicShareFiles({ breadcrumbs: 1 }),
        () =>
          jsonResponse({
            breadcrumbs: [[7, "Shared"]],
            cursor: null,
            files: [],
            parent: sharedFile,
            status: "OK",
          }),
        { accessToken: "token-123" },
      );

      expectTypeOf(listing.breadcrumbs).toEqualTypeOf<ReadonlyArray<readonly [number, string]>>();
      expect(listing.breadcrumbs).toEqual([[7, "Shared"]]);

      const exit = yield* Effect.exit(
        provideSdk(
          sharing.listPublicShareFiles({ breadcrumbs: 1 }),
          () => jsonResponse({ cursor: null, files: [], parent: sharedFile, status: "OK" }),
          { accessToken: "token-123" },
        ),
      );

      expect(expectFailure(exit)).toBeInstanceOf(PutioValidationError);
      expect(expectFailure(exit)).toMatchObject({
        cause: 'Expected put.io to include "breadcrumbs" because it was requested',
      });
    }),
  );

  it.effect("decodes the trash screenshot shapes and rejects anything else", () =>
    Effect.gen(function* () {
      const trashFile = {
        content_type: "video/mp4",
        created_at: "2026-03-17T00:00:00Z",
        deleted_at: "2026-03-18T00:00:00Z",
        expiration_date: "2026-04-18T00:00:00Z",
        extension: "mp4",
        file_type: "VIDEO",
        first_accessed_at: null,
        folder_type: "REGULAR",
        icon: null,
        id: 11,
        name: "trash.mp4",
        parent_id: 0,
        size: 1,
      };

      const listWith = (screenshot: Schema.Json) =>
        provideSdk(
          trash.continueTrash("cursor-1"),
          () => jsonResponse({ cursor: null, files: [{ ...trashFile, screenshot }], status: "OK" }),
          { accessToken: "token-123" },
        );

      const url = "https://api.put.io/screenshots/abc.jpg";

      for (const screenshot of [[url], [null], url, null]) {
        expect((yield* listWith(screenshot)).files[0]?.screenshot).toEqual(screenshot);
      }

      for (const screenshot of [[], [url, url], [7], { url }, 7]) {
        expect(expectFailure(yield* Effect.exit(listWith(screenshot)))).toBeInstanceOf(
          PutioValidationError,
        );
      }
    }),
  );

  it.effect("rejects a public share whose file type is outside the file types", () =>
    Effect.gen(function* () {
      const publicShare = (fileType: string) =>
        provideSdk(
          sharing.getPublicShare(),
          () =>
            jsonResponse({
              public_share: {
                created_at: "2026-03-17T00:00:00Z",
                expiration_date: "2026-03-18T00:00:00Z",
                id: 3,
                owner: { name: "sdk" },
                push_token: "push-token",
                token: "public-token",
                user_file: { file_type: fileType, id: 7, name: "Shared" },
              },
              status: "OK",
            }),
          { accessToken: "token-123" },
        );

      expect((yield* publicShare("FOLDER")).user_file.file_type).toBe("FOLDER");
      expect(expectFailure(yield* Effect.exit(publicShare("folder")))).toBeInstanceOf(
        PutioValidationError,
      );
    }),
  );

  it.effect("rejects sizes that are not finite", () =>
    Effect.gen(function* () {
      const listTrashWithSize = (trashSize: string) =>
        provideSdk(
          trash.listTrash(),
          () =>
            new Response(
              `{"cursor":null,"files":[],"status":"OK","total":0,"trash_size":${trashSize}}`,
              { headers: { "content-type": "application/json" } },
            ),
          { accessToken: "token-123" },
        );

      expect((yield* listTrashWithSize("1e15")).trash_size).toBe(1e15);
      expect(expectFailure(yield* Effect.exit(listTrashWithSize("1e999")))).toBeInstanceOf(
        PutioValidationError,
      );
    }),
  );

  it.effect("maps representative operation failures in operational domains", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.exit(
        provideSdk(
          sharing.getPublicShareFileUrl(7),
          () =>
            jsonResponse(
              {
                error_message: "Missing",
                status_code: 404,
              },
              { status: 404 },
            ),
          { accessToken: "token-123" },
        ),
      );

      const error = expectFailure(failure);
      expect(error).toBeInstanceOf(PutioOperationError);
      expect(error).toMatchObject({
        domain: "sharing",
        operation: "getPublicShareFileUrl",
        status: 404,
      });

      const torrentFailure = yield* Effect.exit(
        provideSdk(
          transfers.getTransferTorrent(11),
          () =>
            jsonResponse(
              {
                error_message: "Transfer is from a magnet link",
                error_type: "IS_MAGNET",
                status_code: 400,
              },
              { status: 400 },
            ),
          { accessToken: "token-123" },
        ),
      );

      expect(expectFailure(torrentFailure)).toBeInstanceOf(PutioOperationError);
      expect(expectFailure(torrentFailure)).toMatchObject({
        domain: "transfers",
        operation: "getTorrent",
        reason: {
          errorType: "IS_MAGNET",
          kind: "error_type",
        },
        status: 400,
      });

      const addTrackersFailure = yield* Effect.exit(
        provideSdk(
          transfers.addTransferTrackers({
            trackers: ["udp://tracker.example:80"],
            transferId: 11,
          }),
          () =>
            jsonResponse(
              {
                error_message: "No trackers were accepted",
                error_type: "NO_TRACKERS",
                status_code: 400,
              },
              { status: 400 },
            ),
          { accessToken: "token-123" },
        ),
      );

      expect(expectFailure(addTrackersFailure)).toBeInstanceOf(PutioOperationError);
      expect(expectFailure(addTrackersFailure)).toMatchObject({
        domain: "transfers",
        operation: "addTrackers",
        reason: {
          errorType: "NO_TRACKERS",
          kind: "error_type",
        },
        status: 400,
      });

      const reannounceFailure = yield* Effect.exit(
        provideSdk(
          transfers.reannounceTransfer(11),
          () =>
            jsonResponse(
              {
                error_message: "No such user download",
                error_type: "TRANSFER_NOT_FOUND",
                status_code: 404,
              },
              { status: 404 },
            ),
          { accessToken: "token-123" },
        ),
      );

      expect(expectFailure(reannounceFailure)).toMatchObject({
        domain: "transfers",
        operation: "reannounce",
        reason: {
          errorType: "TRANSFER_NOT_FOUND",
          kind: "error_type",
        },
        status: 404,
      });

      const removeFailure = yield* Effect.exit(
        provideSdk(
          transfers.removeTransfers({ ids: [11] }),
          () =>
            jsonResponse(
              {
                error_message: "Transfer cannot be removed",
                status_code: 400,
              },
              { status: 400 },
            ),
          { accessToken: "token-123" },
        ),
      );

      expect(expectFailure(removeFailure)).toBeInstanceOf(PutioOperationError);
      expect(expectFailure(removeFailure)).toMatchObject({
        domain: "transfers",
        operation: "remove",
        status: 400,
      });
    }),
  );
});
