import { PutioOperationError, PutioValidationError } from "../core/errors.js";
import { Effect, Schema } from "effect";
import { runInNewContext } from "node:vm";
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

const inMemoryJsonResponse = (body: unknown): Response => {
  const response = new Response(null, {
    headers: { "content-type": "application/json" },
  });
  Object.defineProperty(response, "json", {
    value: async () => body,
  });
  return response;
};

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
    expect(() => decodeJsonValue(Number.NaN)).toThrow("Expected a JSON-compatible value");
    expect(() => decodeJsonValue(Number.POSITIVE_INFINITY)).toThrow(
      "Expected a JSON-compatible value",
    );
    expect(() => decodeJsonObject(new Date())).toThrow("Expected a JSON object");
    const cyclicValue: { self?: unknown } = {};
    cyclicValue.self = cyclicValue;
    expect(() => decodeJsonValue(cyclicValue)).toThrow("Expected a JSON-compatible value");
    const sparseValue: Array<configDomain.PutioJsonValue> = [];
    sparseValue.length = 1;
    expect(() => decodeJsonValue(sparseValue)).toThrow("Expected a JSON-compatible value");
    let lengthReads = 0;
    const lengthSpoof = new Proxy([Number.NaN], {
      get: (target, key, receiver) => {
        if (key === "length") {
          lengthReads += 1;
          return 0;
        }
        return Reflect.get(target, key, receiver);
      },
    });
    expect(() => decodeJsonValue(lengthSpoof)).toThrow("Expected a JSON-compatible value");
    expect(lengthReads).toBe(0);
    const customArrayPrototype = Object.create(Array.prototype);
    const customPrototypeArray = ["sdk"];
    Object.setPrototypeOf(customPrototypeArray, customArrayPrototype);
    expect(() => decodeJsonValue(customPrototypeArray)).toThrow("Expected a JSON-compatible value");
    const forgedArrayPrototype: Record<string, unknown> = Object.create(null);
    Object.defineProperty(forgedArrayPrototype, "constructor", { value: Array });
    const forgedPrototypeArray = ["sdk"];
    Object.setPrototypeOf(forgedPrototypeArray, forgedArrayPrototype);
    expect(() => decodeJsonValue(forgedPrototypeArray)).toThrow("Expected a JSON-compatible value");
    const crossRealmArray: unknown = runInNewContext(`["sdk", 1, false]`);
    expect(decodeJsonValue(crossRealmArray)).toEqual(["sdk", 1, false]);
    let getterCalls = 0;
    const accessorValue: configDomain.PutioJsonObject = {};
    Object.defineProperty(accessorValue, "count", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 1;
      },
    });
    const accessorExit = Effect.runSyncExit(
      Schema.decodeUnknownEffect(configDomain.JsonObjectSchema)(accessorValue),
    );
    expect(accessorExit._tag).toBe("Failure");
    expect(getterCalls).toBe(0);
    const crossRealmConfig: unknown = runInNewContext(`({ locale: "en" })`);
    expect(decodeJsonObject(crossRealmConfig)).toEqual({ locale: "en" });
    const customPrototype: Record<string, unknown> = Object.create(null);
    customPrototype.inherited = true;
    const customPrototypeConfig: Record<string, unknown> = Object.create(customPrototype);
    customPrototypeConfig.locale = "en";
    expect(() => decodeJsonObject(customPrototypeConfig)).toThrow("Expected a JSON object");
    const forgedPrototype: Record<string, unknown> = Object.create(null);
    Object.defineProperty(forgedPrototype, "constructor", { value: Object });
    const forgedPrototypeConfig: Record<string, unknown> = Object.create(forgedPrototype);
    forgedPrototypeConfig.locale = "en";
    expect(() => decodeJsonObject(forgedPrototypeConfig)).toThrow("Expected a JSON object");
    expect(() => decodeJsonObject(["nope"])).toThrow("Expected a JSON object");

    const responseConfig = {
      nested: {
        enabled: true,
      },
      theme: "dark",
    };
    const configResponse = inMemoryJsonResponse({ config: responseConfig, status: "OK" });
    const decodedConfig = await runSdkEffect(configDomain.readConfig(), () => configResponse, {
      accessToken: "token-123",
    });

    expect(decodedConfig).toBe(responseConfig);
    expect(decodedConfig).toEqual({
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

    const configInput: configDomain.PutioJsonObject = { locale: "en" };
    let descriptorWalks = 0;
    const trackedConfig = new Proxy(configInput, {
      ownKeys: (target) => {
        descriptorWalks += 1;
        return Reflect.ownKeys(target);
      },
    });
    expect(
      await runSdkEffect(
        configDomain.writeConfig(trackedConfig),
        (request) => {
          Object.defineProperty(configInput, "locale", { value: "tr" });
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
    expect(descriptorWalks).toBe(1);

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

    const responseValue = { enabled: true };
    const valueResponse = inMemoryJsonResponse({ status: "OK", value: responseValue });
    const decodedValue = await runSdkEffect(
      configDomain.getConfigKey("feature"),
      () => valueResponse,
      { accessToken: "token-123" },
    );

    expect(decodedValue).toBe(responseValue);

    const responseArray = ["sdk", 1, false, null];
    const decodedArray = await runSdkEffect(
      configDomain.getConfigKey("array"),
      () => inMemoryJsonResponse({ status: "OK", value: responseArray }),
      { accessToken: "token-123" },
    );

    expect(decodedArray).toBe(responseArray);

    expect(
      await runSdkEffect(
        configDomain.getConfigKey("../account/info"),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/config/..%2Faccount%2Finfo");
          return jsonResponse({ status: "OK", value: "encoded" });
        },
        { accessToken: "token-123" },
      ),
    ).toBe("encoded");

    expect(
      await runSdkEffect(
        configDomain.getConfigKey("https://evil.test/path"),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/config/https%3A%2F%2Fevil.test%2Fpath");
          return jsonResponse({ status: "OK", value: "encoded" });
        },
        { accessToken: "token-123" },
      ),
    ).toBe("encoded");

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

    let requestCount = 0;
    const invalidHandler = () => {
      requestCount += 1;
      return jsonResponse({ status: "OK" });
    };
    const invalidConfig = expectFailure(
      await runSdkExit(configDomain.writeConfig({ count: Number.NaN }), invalidHandler),
    );
    const cyclicConfig = expectFailure(
      await runSdkExit(
        // @ts-expect-error JavaScript callers can supply cyclic objects.
        configDomain.writeConfig(cyclicValue),
        invalidHandler,
      ),
    );
    const revokedConfig = Proxy.revocable<configDomain.PutioJsonObject>({}, {});
    revokedConfig.revoke();
    const revokedConfigFailure = expectFailure(
      await runSdkExit(configDomain.writeConfig(revokedConfig.proxy), invalidHandler),
    );
    const emptyGetKey = expectFailure(
      await runSdkExit(configDomain.getConfigKey(""), invalidHandler),
    );
    const dotGetKey = expectFailure(
      await runSdkExit(configDomain.getConfigKey(".."), invalidHandler),
    );
    const malformedGetKey = expectFailure(
      await runSdkExit(configDomain.getConfigKey("\uD800"), invalidHandler),
    );
    const emptyTypedGetKey = expectFailure(
      await runSdkExit(
        configDomain.getConfigKeyWith("", configDomain.JsonValueSchema),
        invalidHandler,
      ),
    );
    const invalidSetValue = expectFailure(
      await runSdkExit(
        // @ts-expect-error JavaScript callers can supply non-JSON values.
        configDomain.setConfigKey("theme", undefined),
        invalidHandler,
      ),
    );
    const fakeSecret = "sdk-fake-secret-for-redaction";
    const sensitiveInvalidValue = { invalid: undefined, token: fakeSecret };
    const sensitiveInvalidError = expectFailure(
      await runSdkExit(
        // @ts-expect-error JavaScript callers can supply objects containing non-JSON values.
        configDomain.setConfigKey("credentials", sensitiveInvalidValue),
        invalidHandler,
      ),
    );
    const sparseSetValue = expectFailure(
      await runSdkExit(configDomain.setConfigKey("sparse", sparseValue), invalidHandler),
    );
    const accessorConfig = expectFailure(
      await runSdkExit(configDomain.writeConfig(accessorValue), invalidHandler),
    );
    const emptySetKey = expectFailure(
      await runSdkExit(configDomain.setConfigKey("", "light"), invalidHandler),
    );
    const dotSetKey = expectFailure(
      await runSdkExit(configDomain.setConfigKey(".", "light"), invalidHandler),
    );
    const emptyDeleteKey = expectFailure(
      await runSdkExit(configDomain.deleteConfigKey(""), invalidHandler),
    );
    const dotDeleteKey = expectFailure(
      await runSdkExit(configDomain.deleteConfigKey(".."), invalidHandler),
    );

    expect(invalidConfig).toBeInstanceOf(PutioValidationError);
    expect(cyclicConfig).toBeInstanceOf(PutioValidationError);
    expect(revokedConfigFailure).toBeInstanceOf(PutioValidationError);
    expect(emptyGetKey).toBeInstanceOf(PutioValidationError);
    expect(dotGetKey).toBeInstanceOf(PutioValidationError);
    expect(malformedGetKey).toBeInstanceOf(PutioValidationError);
    expect(emptyTypedGetKey).toBeInstanceOf(PutioValidationError);
    expect(invalidSetValue).toBeInstanceOf(PutioValidationError);
    expect(sensitiveInvalidError).toBeInstanceOf(PutioValidationError);
    expect(String(sensitiveInvalidError.cause)).not.toContain(fakeSecret);
    expect(sparseSetValue).toBeInstanceOf(PutioValidationError);
    expect(accessorConfig).toBeInstanceOf(PutioValidationError);
    expect(emptySetKey).toBeInstanceOf(PutioValidationError);
    expect(dotSetKey).toBeInstanceOf(PutioValidationError);
    expect(emptyDeleteKey).toBeInstanceOf(PutioValidationError);
    expect(dotDeleteKey).toBeInstanceOf(PutioValidationError);
    expect(getterCalls).toBe(0);
    expect(requestCount).toBe(0);
  });

  it("rejects invalid config response values", async () => {
    const cyclicValue: { self?: unknown } = {};
    cyclicValue.self = cyclicValue;
    const sparseValue: Array<unknown> = [];
    sparseValue.length = 1;
    const accessorValue = {};
    Object.defineProperty(accessorValue, "value", {
      enumerable: true,
      get: () => 1,
    });
    const forgedPrototype: Record<string, unknown> = Object.create(null);
    Object.defineProperty(forgedPrototype, "constructor", { value: Object });
    const forgedValue: Record<string, unknown> = Object.create(forgedPrototype);
    forgedValue.enabled = true;
    const lengthSpoof = new Proxy([Number.NaN], {
      get: (target, key, receiver) => (key === "length" ? 0 : Reflect.get(target, key, receiver)),
    });
    const customPrototypeArray = ["sdk"];
    Object.setPrototypeOf(customPrototypeArray, Object.create(Array.prototype));
    const invalidValues = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      () => "nope",
      cyclicValue,
      sparseValue,
      accessorValue,
      forgedValue,
      lengthSpoof,
      customPrototypeArray,
      new Date(),
    ];
    const failures = await Promise.all(
      invalidValues.map((value) =>
        runSdkExit(
          configDomain.getConfigKey("invalid"),
          () => inMemoryJsonResponse({ status: "OK", value }),
          { accessToken: "token-123" },
        ),
      ),
    );

    expect(
      failures.map(expectFailure).every((error) => error instanceof PutioValidationError),
    ).toBe(true);

    let fullConfigRequestCount = 0;
    const fullConfigFailure = expectFailure(
      await runSdkExit(
        configDomain.readConfig(),
        () => {
          fullConfigRequestCount += 1;
          return inMemoryJsonResponse({ config: new Date(), status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    );

    expect(fullConfigFailure).toBeInstanceOf(PutioValidationError);
    expect(fullConfigRequestCount).toBe(1);

    let envelopeGetterCalls = 0;
    const valueEnvelope = { status: "OK" };
    Object.defineProperty(valueEnvelope, "value", {
      enumerable: true,
      get: () => {
        envelopeGetterCalls += 1;
        return "unsafe";
      },
    });
    const configEnvelope = { status: "OK" };
    Object.defineProperty(configEnvelope, "config", {
      enumerable: true,
      get: () => {
        envelopeGetterCalls += 1;
        return {};
      },
    });
    const valueEnvelopeFailure = expectFailure(
      await runSdkExit(
        configDomain.getConfigKey("accessor"),
        () => inMemoryJsonResponse(valueEnvelope),
        { accessToken: "token-123" },
      ),
    );
    const configEnvelopeFailure = expectFailure(
      await runSdkExit(configDomain.readConfig(), () => inMemoryJsonResponse(configEnvelope), {
        accessToken: "token-123",
      }),
    );
    const typedValueFailure = expectFailure(
      await runSdkExit(
        configDomain.getConfigKeyWith("typed-invalid", Schema.Unknown),
        () => inMemoryJsonResponse({ status: "OK", value: new Date() }),
        { accessToken: "token-123" },
      ),
    );
    const typedConfigFailure = expectFailure(
      await runSdkExit(
        configDomain.readConfigWith(Schema.Unknown),
        () => inMemoryJsonResponse({ config: new Date(), status: "OK" }),
        { accessToken: "token-123" },
      ),
    );

    expect(valueEnvelopeFailure).toBeInstanceOf(PutioValidationError);
    expect(configEnvelopeFailure).toBeInstanceOf(PutioValidationError);
    expect(typedValueFailure).toBeInstanceOf(PutioValidationError);
    expect(typedConfigFailure).toBeInstanceOf(PutioValidationError);
    expect(envelopeGetterCalls).toBe(0);
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

  it("rejects invalid download-link inputs before transport", async () => {
    let requestCount = 0;
    const handler = () => {
      requestCount += 1;
      return jsonResponse({ status: "OK" });
    };
    const failures = await Promise.all([
      runSdkExit(downloadLinks.createDownloadLinks(), handler),
      runSdkExit(downloadLinks.createDownloadLinks({ cursor: "" }), handler),
      runSdkExit(downloadLinks.createDownloadLinks({ ids: [] }), handler),
      runSdkExit(downloadLinks.createDownloadLinks({ ids: [0] }), handler),
      runSdkExit(downloadLinks.createDownloadLinks({ cursor: "cursor", excludeIds: [0] }), handler),
      runSdkExit(
        // @ts-expect-error JavaScript callers can provide non-numeric task IDs.
        downloadLinks.getDownloadLinks("abc/def"),
        handler,
      ),
      runSdkExit(downloadLinks.getDownloadLinks(0), handler),
    ]);

    expect(
      failures.map(expectFailure).every((error) => error instanceof PutioValidationError),
    ).toBe(true);
    expect(requestCount).toBe(0);
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
