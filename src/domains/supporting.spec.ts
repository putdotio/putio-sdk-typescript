import { PutioOperationError } from "../core/errors.js";
import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import * as configDomain from "./config.js";
import * as downloadLinks from "./download-links.js";
import * as events from "./events.js";
import * as family from "./family.js";
import * as friendInvites from "./friend-invites.js";
import * as friends from "./friends.js";
import * as ifttt from "./ifttt.js";
import * as tunnel from "./tunnel.js";
import {
  arrayBufferResponse,
  expectFailure,
  getFormBody,
  getJsonBody,
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

describe("supporting domain boundaries", () => {
  it("covers config reads and writes", async () => {
    const decodeJsonValue = Schema.decodeUnknownSync(configDomain.JsonValueSchema);
    const decodeJsonObject = Schema.decodeUnknownSync(configDomain.JsonObjectSchema);

    expect(decodeJsonValue(null)).toBeNull();
    expect(decodeJsonValue(["sdk", 1, false])).toEqual(["sdk", 1, false]);
    expect(decodeJsonObject({ nested: { enabled: true } })).toEqual({
      nested: { enabled: true },
    });
    expect(() => decodeJsonValue(() => "nope")).toThrow("Expected a JSON-compatible value");
    expect(() => decodeJsonObject(["nope"])).toThrow("Expected a JSON object");

    expect(
      await runSdkEffect(
        configDomain.readConfig(),
        () =>
          jsonResponse({
            config: {
              nested: {
                enabled: true,
              },
              theme: "dark",
            },
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toEqual({
      nested: {
        enabled: true,
      },
      theme: "dark",
    });

    expect(
      await runSdkEffect(
        configDomain.readConfigWith(configDomain.JsonObjectSchema),
        () =>
          jsonResponse({
            config: {
              locale: "en",
            },
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toEqual({ locale: "en" });

    expect(
      await runSdkEffect(
        configDomain.writeConfig({
          locale: "en",
        }),
        (request) => {
          expect(getJsonBody(request)).toEqual({
            config: {
              locale: "en",
            },
          });
          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(
        configDomain.getConfigKey("theme"),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/config/theme");
          return jsonResponse({ status: "OK", value: "dark" });
        },
        { accessToken: "token-123" },
      ),
    ).toBe("dark");

    expect(
      await runSdkEffect(
        configDomain.getConfigKeyWith("autoplay", configDomain.JsonValueSchema),
        () => jsonResponse({ status: "OK", value: true }),
        { accessToken: "token-123" },
      ),
    ).toBe(true);

    expect(
      await runSdkEffect(
        configDomain.setConfigKey("theme", "light"),
        (request) => {
          expect(getJsonBody(request)).toEqual({
            value: "light",
          });
          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(
        configDomain.deleteConfigKey("theme"),
        () => jsonResponse({ status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toEqual({ status: "OK" });
  });

  it("covers download links and events", async () => {
    expect(
      await runSdkEffect(
        downloadLinks.createDownloadLinks({
          cursor: "cursor-1",
          ids: [7, 8],
        }),
        (request) => {
          const body = getFormBody(request);
          expect(body.get("cursor")).toBe("cursor-1");
          expect(body.get("file_ids")).toBe("7,8");
          return jsonResponse({ id: 17, status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).toEqual({ id: 17 });

    expect(
      await runSdkEffect(
        downloadLinks.getDownloadLinks(17),
        () =>
          jsonResponse({
            links: {
              download_links: ["https://download.put.io/1"],
              media_links: [],
              mp4_links: [],
            },
            links_status: "DONE",
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toMatchObject({
      links_status: "DONE",
    });

    expect(
      await runSdkEffect(
        events.listEvents({
          before: 2,
          per_page: 10,
        }),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/events/list?before=2&per_page=10");

          return jsonResponse({
            events: [
              {
                created_at: "2026-03-17T00:00:00Z",
                file_id: 7,
                file_name: "SDK File",
                file_size: 1,
                id: 1,
                sharing_user_name: "friend",
                type: "file_shared",
                user_id: 5,
              },
            ],
            has_more: false,
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ has_more: false });

    expect(
      await runSdkEffect(events.deleteEvent(1), () => jsonResponse({ status: "OK" }), {
        accessToken: "token-123",
      }),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(events.clearEvents(), () => jsonResponse({ status: "OK" }), {
        accessToken: "token-123",
      }),
    ).toEqual({ status: "OK" });

    expect(
      Array.from(
        await runSdkEffect(
          events.getEventTorrent(1),
          () => arrayBufferResponse([1, 2, 3], { status: 200 }),
          { accessToken: "token-123" },
        ),
      ),
    ).toEqual([1, 2, 3]);
  });

  it("covers family, friend invite, and friends endpoints", async () => {
    expect(
      await runSdkEffect(
        family.listFamilyInvites(),
        () =>
          jsonResponse({
            invites: [{ code: "family-1", created_at: "2026-03-17", user_id: null }],
            limit: 3,
            remaining_limit: 2,
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toEqual({
      invites: [{ code: "family-1", created_at: "2026-03-17", user_id: null }],
      limit: 3,
      remaining_limit: 2,
    });

    expect(
      await runSdkEffect(
        family.listFamilyMembers(),
        () =>
          jsonResponse({
            members: [
              {
                avatar_url: "https://put.io/avatar.png",
                created_at: "2026-03-17",
                disk_used: "12",
                id: 7,
                is_owner: true,
                name: "Owner",
              },
            ],
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toHaveLength(1);

    expect(
      await runSdkEffect(
        family.createFamilyInvite(),
        () => jsonResponse({ code: "family-2", status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toEqual({ code: "family-2" });

    await runSdkEffect(
      family.removeFamilyMember("sdk user"),
      () => jsonResponse({ status: "OK" }),
      { accessToken: "token-123" },
    );

    await runSdkEffect(family.joinFamily("family-code"), () => jsonResponse({ status: "OK" }), {
      accessToken: "token-123",
    });

    expect(
      await runSdkEffect(
        friendInvites.listFriendInvites(),
        () =>
          jsonResponse({
            invites: [{ code: "friend-1", created_at: "2026-03-17", user: null }],
            remaining_limit: 4,
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toEqual({
      invites: [{ code: "friend-1", created_at: "2026-03-17", user: null }],
      remaining_limit: 4,
    });

    expect(
      await runSdkEffect(
        friendInvites.createFriendInvite(),
        () => jsonResponse({ code: "friend-2", status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toEqual({ code: "friend-2" });

    expect(
      await runSdkEffect(
        friends.listFriends(),
        () =>
          jsonResponse({
            friends: [
              {
                avatar_url: "https://put.io/avatar.png",
                has_received_files: true,
                has_shared_files: false,
                id: 1,
                name: "Friend",
              },
            ],
            status: "OK",
            total: 1,
          }),
        { accessToken: "token-123" },
      ),
    ).toEqual({
      friends: [
        {
          avatar_url: "https://put.io/avatar.png",
          has_received_files: true,
          has_shared_files: false,
          id: 1,
          name: "Friend",
        },
      ],
      total: 1,
    });

    expect(
      await runSdkEffect(
        friends.searchFriends("sdk user"),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/friends/user-search/sdk%20user");
          return jsonResponse({
            status: "OK",
            users: [
              {
                avatar_url: "https://put.io/avatar.png",
                id: 2,
                invited: false,
                name: "Search Result",
              },
            ],
          });
        },
        { accessToken: "token-123" },
      ),
    ).toHaveLength(1);

    expect(
      await runSdkEffect(
        friends.listWaitingRequests(),
        () =>
          jsonResponse({
            friends: [{ avatar_url: "https://put.io/avatar.png", id: 3, name: "Waiting" }],
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toHaveLength(1);

    expect(
      await runSdkEffect(
        friends.countWaitingRequests(),
        () => jsonResponse({ count: 2, status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toBe(2);

    expect(
      await runSdkEffect(
        friends.listSentRequests(),
        () =>
          jsonResponse({
            friends: [{ avatar_url: "https://put.io/avatar.png", id: 4, name: "Sent" }],
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toHaveLength(1);

    expect(
      await runSdkEffect(
        friends.sendFriendRequest("sdk user"),
        () => jsonResponse({ status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(friends.removeFriend("sdk user"), () => jsonResponse({ status: "OK" }), {
        accessToken: "token-123",
      }),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(
        friends.approveFriendRequest("sdk user"),
        () => jsonResponse({ status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(
        friends.denyFriendRequest("sdk user"),
        () => jsonResponse({ status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(
        friends.getFriendSharedFolder("sdk user"),
        () => jsonResponse({ file: sharedFile, status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toMatchObject({ id: 7 });
  });

  it("covers ifttt and tunnel routes", async () => {
    expect(
      await runSdkEffect(
        ifttt.getIftttStatus(),
        () => jsonResponse({ enabled: true, status: "OK" }),
        { accessToken: "token-123" },
      ),
    ).toEqual({ enabled: true });

    await runSdkEffect(
      ifttt.sendIftttEvent({
        clientName: "SDK",
        eventType: "playback_started",
        ingredients: {
          file_id: 7,
          file_name: "SDK File",
          file_type: "VIDEO",
        },
      }),
      (request) => {
        const body = getFormBody(request);
        expect(body.get("client_name")).toBe("SDK");
        expect(body.get("event_type")).toBe("playback_started");
        expect(body.get("ingredients")).toContain("file_id");
        return jsonResponse({ status: "OK" });
      },
      { accessToken: "token-123" },
    );

    expect(
      await runSdkEffect(
        tunnel.listTunnelRoutes(),
        () =>
          jsonResponse({
            routes: [
              {
                description: "Default route",
                hosts: ["1.1.1.1"],
                name: "default",
              },
            ],
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toEqual([
      {
        description: "Default route",
        hosts: ["1.1.1.1"],
        name: "default",
      },
    ]);
  });

  it("maps representative operation failures in supporting domains", async () => {
    const failure = await runSdkExit(
      downloadLinks.getDownloadLinks(9),
      () =>
        jsonResponse(
          {
            error_message: "Missing",
            error_type: "LINKS_NOT_FOUND",
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
      domain: "downloadLinks",
      operation: "get",
      status: 404,
    });
  });
});
