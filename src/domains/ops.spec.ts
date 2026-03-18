import { PutioOperationError } from "../core/errors.js";
import { describe, expect, it } from "vite-plus/test";

import * as oauth from "./oauth.js";
import * as rss from "./rss.js";
import * as sharing from "./sharing.js";
import * as transfers from "./transfers.js";
import * as trash from "./trash.js";
import * as zips from "./zips.js";
import {
  expectFailure,
  getFormBody,
  getFormDataBody,
  jsonResponse,
  runSdkEffect,
  runSdkExit,
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
  it("covers rss endpoints", async () => {
    expect(
      await runSdkEffect(
        rss.listRssFeeds(),
        () => jsonResponse({ feeds: [rssFeed], status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toHaveLength(1);

    expect(
      await runSdkEffect(rss.getRssFeed(1), () => jsonResponse({ feed: rssFeed, status: "OK" }), {
        accessToken: "token-123",
      }),
    ).toMatchObject({ id: 1 });

    expect(
      await runSdkEffect(
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
      await runSdkEffect(
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

    await runSdkEffect(rss.pauseRssFeed(1), () => jsonResponse({ status: "OK" }), {
      accessToken: "token-123",
    });
    await runSdkEffect(rss.resumeRssFeed(1), () => jsonResponse({ status: "OK" }), {
      accessToken: "token-123",
    });
    await runSdkEffect(rss.deleteRssFeed(1), () => jsonResponse({ status: "OK" }), {
      accessToken: "token-123",
    });

    expect(
      await runSdkEffect(
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

    await runSdkEffect(rss.clearRssFeedLogs(1), () => jsonResponse({ status: "OK" }), {
      accessToken: "token-123",
    });
    await runSdkEffect(rss.retryRssFeedItem(1, 2), () => jsonResponse({ status: "OK" }), {
      accessToken: "token-123",
    });
    await runSdkEffect(rss.retryAllRssFeedItems(1), () => jsonResponse({ status: "OK" }), {
      accessToken: "token-123",
    });
  });

  it("covers oauth endpoints and URL helpers", async () => {
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
      await runSdkEffect(
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
      await runSdkEffect(
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

    await runSdkEffect(
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
      await runSdkEffect(
        oauth.createOAuthApp({
          callback: "https://example.com/callback",
          description: "SDK app",
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
      await runSdkEffect(
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
      await runSdkEffect(
        oauth.regenerateOAuthAppToken(9),
        () => jsonResponse({ access_token: "new-token", status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toBe("new-token");

    expect(
      await runSdkEffect(
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

    await runSdkEffect(oauth.deleteOAuthApp(9), () => jsonResponse({ status: "OK" }), {
      accessToken: "token-123",
    });
  });

  it("covers sharing endpoints", async () => {
    expect(
      await runSdkEffect(
        sharing.cloneSharedFiles(),
        (request) => {
          expect(getFormBody(request).get("parent_id")).toBe("0");
          return jsonResponse({ id: 9, status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).toEqual({ id: 9 });

    expect(
      await runSdkEffect(
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
      await runSdkEffect(
        sharing.getSharingCloneInfo(10),
        () => jsonResponse({ shared_file_clone_status: "DONE", status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ shared_file_clone_status: "DONE" });

    expect(
      await runSdkEffect(
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
      await runSdkEffect(
        sharing.shareFiles({
          cursor: "cursor-1",
          ids: [7],
          target: {
            friendNames: ["altay", "sdk"],
            type: "friends",
          },
        }),
        (request) => {
          const body = getFormBody(request);
          expect(body.get("cursor")).toBe("cursor-1");
          expect(body.get("file_ids")).toBe("7");
          expect(body.get("friends")).toBe("altay,sdk");
          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(
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
      await runSdkEffect(
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

    await runSdkEffect(
      sharing.unshareFile({
        fileId: 7,
      }),
      (request) => {
        expect(getFormBody(request).get("shares")).toBe("everyone");
        return jsonResponse({ status: "OK" });
      },
      { accessToken: "token-123" },
    );

    await runSdkEffect(
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
      await runSdkEffect(
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
      await runSdkEffect(
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

    await runSdkEffect(sharing.deletePublicShare(1), () => jsonResponse({ status: "OK" }), {
      accessToken: "token-123",
    });

    expect(
      await runSdkEffect(
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
      await runSdkEffect(
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
      await runSdkEffect(
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
      await runSdkEffect(
        sharing.getPublicShareFileUrl(7),
        () => jsonResponse({ status: "OK", url: "https://download.put.io/public-share" }),
        { accessToken: "token-123" },
      ),
    ).toBe("https://download.put.io/public-share");
  });

  it("covers transfers, trash, and zips", async () => {
    expect(
      await runSdkEffect(
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
      await runSdkEffect(
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
      await runSdkEffect(
        transfers.getTransfer(11),
        () => jsonResponse({ status: "OK", transfer }),
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ id: 11 });

    expect(
      await runSdkEffect(
        transfers.countTransfers(),
        () => jsonResponse({ count: 3, status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toBe(3);

    expect(
      await runSdkEffect(
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
      await runSdkEffect(
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
      await runSdkEffect(
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

    await runSdkEffect(
      transfers.cancelTransfers([11, 12]),
      (request) => {
        expect(getFormBody(request).get("transfer_ids")).toBe("11,12");
        return jsonResponse({ status: "OK" });
      },
      { accessToken: "token-123" },
    );

    expect(
      await runSdkEffect(
        transfers.cleanTransfers([11]),
        (request) => {
          expect(getFormBody(request).get("transfer_ids")).toBe("11");
          return jsonResponse({ deleted_ids: [11], status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).toEqual({ deleted_ids: [11] });

    expect(
      await runSdkEffect(
        transfers.retryTransfer(11),
        (request) => {
          expect(getFormBody(request).get("id")).toBe("11");
          return jsonResponse({ status: "OK", transfer });
        },
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ id: 11 });

    await runSdkEffect(
      transfers.reannounceTransfer(11),
      (request) => {
        expect(getFormBody(request).get("id")).toBe("11");
        return jsonResponse({ status: "OK" });
      },
      { accessToken: "token-123" },
    );

    await runSdkEffect(
      transfers.stopTransferRecording(11),
      (request) => {
        expect(getFormBody(request).get("transfer_id")).toBe("11");
        return jsonResponse({ status: "OK" });
      },
      { accessToken: "token-123" },
    );

    expect(
      await runSdkEffect(
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
      await runSdkEffect(
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

    await runSdkEffect(
      trash.restoreTrash({
        file_ids: [1, 2],
      }),
      (request) => {
        expect(getFormBody(request).get("file_ids")).toBe("1,2");
        return jsonResponse({ status: "OK" });
      },
      { accessToken: "token-123" },
    );

    await runSdkEffect(
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

    await runSdkEffect(trash.emptyTrash(), () => jsonResponse({ status: "OK" }), {
      accessToken: "token-123",
    });

    expect(() => trash.restoreTrash({} as never)).toThrow(
      "trash bulk file_ids are required when useCursor is not set",
    );

    expect(
      await runSdkEffect(
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
      await runSdkEffect(
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
      await runSdkEffect(
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

    await runSdkEffect(zips.cancelZip(9), () => jsonResponse({ status: "OK" }), {
      accessToken: "token-123",
    });
  });

  it("maps representative operation failures in operational domains", async () => {
    const failure = await runSdkExit(
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
    );

    const error = expectFailure(failure);
    expect(error).toBeInstanceOf(PutioOperationError);
    expect(error).toMatchObject({
      _tag: "PutioOperationError",
      domain: "sharing",
      operation: "getPublicShareFileUrl",
      status: 404,
    });
  });
});
