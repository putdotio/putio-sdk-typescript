import { PutioOperationError, PutioValidationError, PutioContractError } from "../core/errors.js";
import { Cause, Effect, Exit, Schema, SchemaIssue, SchemaParser } from "effect";
import { runInNewContext } from "node:vm";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";

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
  provideSdk,
} from "../../test/support/sdk-test.js";

const inMemoryJsonResponse = <Body>(body: Body): Response => {
  const response = new Response(null, {
    headers: { "content-type": "application/json" },
  });

  Object.defineProperty(response, "json", {
    value: async () => body,
  });

  return response;
};

type CyclicValue = {
  self?: CyclicValue;
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

const decodeJsonValue = Schema.decodeUnknownSync(configDomain.JsonValueSchema);

const decodeJsonObject = Schema.decodeUnknownSync(configDomain.JsonObjectSchema);

describe("supporting domain boundaries", () => {
  it("requires a selector in download-link selections", () => {
    type Input = downloadLinks.DownloadLinksCreateInput;

    expectTypeOf<{ readonly cursor: string }>().toExtend<Input>();
    expectTypeOf<{ readonly ids: ReadonlyArray<number> }>().toExtend<Input>();
    expectTypeOf<{
      readonly cursor: string;
      readonly excludeIds: ReadonlyArray<number>;
    }>().toExtend<Input>();
    expectTypeOf<{}>().not.toExtend<Input>();
    expectTypeOf<{ readonly excludeIds: ReadonlyArray<number> }>().not.toExtend<Input>();
    expectTypeOf(downloadLinks.createDownloadLinks).parameters.toEqualTypeOf<[input: Input]>();
  });

  it.effect("covers config reads and writes", () =>
    Effect.gen(function* () {
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
      const cyclicValue: CyclicValue = {};
      cyclicValue.self = cyclicValue;
      expect(() => decodeJsonValue(cyclicValue)).toThrow("Expected a JSON-compatible value");
      const sparseValue: Array<configDomain.PutioJsonValue> = [];
      sparseValue.length = 1;
      expect(() => decodeJsonValue(sparseValue)).toThrow("Expected a JSON-compatible value");
      let lengthReads = 0;

      const lengthSpoof = new Proxy([Number.NaN], {
        get: () => {
          lengthReads += 1;

          return 0;
        },
      });

      expect(() => decodeJsonValue(lengthSpoof)).toThrow("Expected a JSON-compatible value");
      expect(lengthReads).toBe(0);
      const customArrayPrototype = Object.create(Array.prototype);
      const customPrototypeArray = ["sdk"];
      Object.setPrototypeOf(customPrototypeArray, customArrayPrototype);
      expect(() => decodeJsonValue(customPrototypeArray)).toThrow(
        "Expected a JSON-compatible value",
      );
      const forgedArrayPrototype: Record<string, configDomain.PutioJsonValue> = Object.create(null);
      Object.defineProperty(forgedArrayPrototype, "constructor", { value: Array });
      const forgedPrototypeArray = ["sdk"];
      Object.setPrototypeOf(forgedPrototypeArray, forgedArrayPrototype);
      expect(() => decodeJsonValue(forgedPrototypeArray)).toThrow(
        "Expected a JSON-compatible value",
      );
      const nullPrototypeArray = ["sdk"];
      Object.setPrototypeOf(nullPrototypeArray, null);
      expect(() => decodeJsonValue(nullPrototypeArray)).toThrow("Expected a JSON-compatible value");
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

      const accessorExit = yield* Effect.exit(
        Schema.decodeEffect(configDomain.JsonObjectSchema)(accessorValue),
      );

      expect(accessorExit._tag).toBe("Failure");
      expect(getterCalls).toBe(0);
      const crossRealmConfig: unknown = runInNewContext(`({ locale: "en" })`);
      expect(decodeJsonObject(crossRealmConfig)).toEqual({ locale: "en" });
      const customPrototype: Record<string, configDomain.PutioJsonValue> = Object.create(null);
      customPrototype.inherited = true;

      const customPrototypeConfig: Record<string, configDomain.PutioJsonValue> =
        Object.create(customPrototype);

      customPrototypeConfig.locale = "en";
      expect(() => decodeJsonObject(customPrototypeConfig)).toThrow("Expected a JSON object");
      const forgedPrototype: Record<string, configDomain.PutioJsonValue> = Object.create(null);
      Object.defineProperty(forgedPrototype, "constructor", { value: Object });

      const forgedPrototypeConfig: Record<string, configDomain.PutioJsonValue> =
        Object.create(forgedPrototype);

      forgedPrototypeConfig.locale = "en";
      expect(() => decodeJsonObject(forgedPrototypeConfig)).toThrow("Expected a JSON object");
      expect(() => decodeJsonObject(["nope"])).toThrow("Expected a JSON object");

      const reportedInput = ["not-an-object"];

      const reportedExit = SchemaParser.decodeUnknownExit(configDomain.JsonObjectSchema, {
        reportInput: true,
      })(reportedInput);

      expect(reportedExit._tag).toBe("Failure");

      if (Exit.isFailure(reportedExit)) {
        const failure = reportedExit.cause.reasons.find(Cause.isFailReason);
        expect(failure && SchemaIssue.hasInput(failure.error)).toBe(true);

        if (failure && SchemaIssue.hasInput(failure.error)) {
          expect(failure.error.input).toBe(reportedInput);
        }
      }

      const responseConfig = {
        nested: {
          enabled: true,
        },
        theme: "dark",
      };

      const configResponse = inMemoryJsonResponse({ config: responseConfig, status: "OK" });

      const decodedConfig = yield* provideSdk(configDomain.readConfig(), () => configResponse, {
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
        yield* provideSdk(
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
        yield* provideSdk(
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
        yield* provideSdk(
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

      const decodedValue = yield* provideSdk(
        configDomain.getConfigKey("feature"),
        () => valueResponse,
        { accessToken: "token-123" },
      );

      expect(decodedValue).toBe(responseValue);

      const responseArray = ["sdk", 1, false, null];

      const decodedArray = yield* provideSdk(
        configDomain.getConfigKey("array"),
        () => inMemoryJsonResponse({ status: "OK", value: responseArray }),
        { accessToken: "token-123" },
      );

      expect(decodedArray).toBe(responseArray);

      expect(
        yield* provideSdk(
          configDomain.getConfigKey("../account/info"),
          (request) => {
            expect(request.url).toBe("https://api.put.io/v2/config/..%2Faccount%2Finfo");

            return jsonResponse({ status: "OK", value: "encoded" });
          },
          { accessToken: "token-123" },
        ),
      ).toBe("encoded");

      expect(
        yield* provideSdk(
          configDomain.getConfigKey("https://evil.test/path"),
          (request) => {
            expect(request.url).toBe("https://api.put.io/v2/config/https%3A%2F%2Fevil.test%2Fpath");

            return jsonResponse({ status: "OK", value: "encoded" });
          },
          { accessToken: "token-123" },
        ),
      ).toBe("encoded");

      expect(
        yield* provideSdk(
          configDomain.getConfigKeyWith("autoplay", configDomain.JsonValueSchema),
          () => jsonResponse({ status: "OK", value: true }),
          { accessToken: "token-123" },
        ),
      ).toBe(true);

      expect(
        yield* provideSdk(
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
        yield* provideSdk(
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
        yield* Effect.exit(
          provideSdk(configDomain.writeConfig({ count: Number.NaN }), invalidHandler),
        ),
      );

      const cyclicConfig = expectFailure(
        yield* Effect.exit(provideSdk(configDomain.writeConfig(cyclicValue), invalidHandler)),
      );

      const revokedConfig = Proxy.revocable<configDomain.PutioJsonObject>({}, {});
      revokedConfig.revoke();

      const revokedConfigFailure = expectFailure(
        yield* Effect.exit(
          provideSdk(configDomain.writeConfig(revokedConfig.proxy), invalidHandler),
        ),
      );

      const emptyGetKey = expectFailure(
        yield* Effect.exit(provideSdk(configDomain.getConfigKey(""), invalidHandler)),
      );

      const dotGetKey = expectFailure(
        yield* Effect.exit(provideSdk(configDomain.getConfigKey(".."), invalidHandler)),
      );

      const malformedGetKey = expectFailure(
        yield* Effect.exit(provideSdk(configDomain.getConfigKey("\uD800"), invalidHandler)),
      );

      const emptyTypedGetKey = expectFailure(
        yield* Effect.exit(
          provideSdk(
            configDomain.getConfigKeyWith("", configDomain.JsonValueSchema),
            invalidHandler,
          ),
        ),
      );

      const invalidSetValue = expectFailure(
        yield* Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can supply non-JSON values.
            configDomain.setConfigKey("theme", undefined),
            invalidHandler,
          ),
        ),
      );

      const fakeSecret = "sdk-fake-secret-for-redaction";
      const sensitiveInvalidValue = { invalid: undefined, token: fakeSecret };

      const sensitiveInvalidError = expectFailure(
        yield* Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can supply objects containing non-JSON values.
            configDomain.setConfigKey("credentials", sensitiveInvalidValue),
            invalidHandler,
          ),
        ),
      );

      const sparseSetValue = expectFailure(
        yield* Effect.exit(
          provideSdk(configDomain.setConfigKey("sparse", sparseValue), invalidHandler),
        ),
      );

      const accessorConfig = expectFailure(
        yield* Effect.exit(provideSdk(configDomain.writeConfig(accessorValue), invalidHandler)),
      );

      const emptySetKey = expectFailure(
        yield* Effect.exit(provideSdk(configDomain.setConfigKey("", "light"), invalidHandler)),
      );

      const dotSetKey = expectFailure(
        yield* Effect.exit(provideSdk(configDomain.setConfigKey(".", "light"), invalidHandler)),
      );

      const emptyDeleteKey = expectFailure(
        yield* Effect.exit(provideSdk(configDomain.deleteConfigKey(""), invalidHandler)),
      );

      const dotDeleteKey = expectFailure(
        yield* Effect.exit(provideSdk(configDomain.deleteConfigKey(".."), invalidHandler)),
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
    }),
  );

  it.effect("rejects invalid config response values", () =>
    Effect.gen(function* () {
      const cyclicValue: CyclicValue = {};
      cyclicValue.self = cyclicValue;
      const sparseValue: Array<unknown> = [];
      sparseValue.length = 1;
      const accessorValue = {};
      Object.defineProperty(accessorValue, "value", {
        enumerable: true,
        get: () => 1,
      });
      const forgedPrototype: Record<string, configDomain.PutioJsonValue> = Object.create(null);
      Object.defineProperty(forgedPrototype, "constructor", { value: Object });

      const forgedValue: Record<string, configDomain.PutioJsonValue> =
        Object.create(forgedPrototype);

      forgedValue.enabled = true;

      const lengthSpoof = new Proxy([Number.NaN], {
        get: () => 0,
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

      const failures = yield* Effect.forEach(invalidValues, (value) =>
        Effect.exit(
          provideSdk(
            configDomain.getConfigKey("invalid"),
            () => inMemoryJsonResponse({ status: "OK", value }),
            { accessToken: "token-123" },
          ),
        ),
      );

      expect(failures.map((exit) => expectFailure<unknown>(exit))).toEqual(
        failures.map(() => expect.any(PutioContractError)),
      );

      let fullConfigRequestCount = 0;

      const fullConfigFailure = expectFailure(
        yield* Effect.exit(
          provideSdk(
            configDomain.readConfig(),
            () => {
              fullConfigRequestCount += 1;

              return inMemoryJsonResponse({ config: new Date(), status: "OK" });
            },
            { accessToken: "token-123" },
          ),
        ),
      );

      expect(fullConfigFailure).toBeInstanceOf(PutioContractError);
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
        yield* Effect.exit(
          provideSdk(
            configDomain.getConfigKey("accessor"),
            () => inMemoryJsonResponse(valueEnvelope),
            { accessToken: "token-123" },
          ),
        ),
      );

      const configEnvelopeFailure = expectFailure(
        yield* Effect.exit(
          provideSdk(configDomain.readConfig(), () => inMemoryJsonResponse(configEnvelope), {
            accessToken: "token-123",
          }),
        ),
      );

      const typedValueFailure = expectFailure(
        yield* Effect.exit(
          provideSdk(
            configDomain.getConfigKeyWith("typed-invalid", Schema.Unknown),
            () => inMemoryJsonResponse({ status: "OK", value: new Date() }),
            { accessToken: "token-123" },
          ),
        ),
      );

      const typedConfigFailure = expectFailure(
        yield* Effect.exit(
          provideSdk(
            configDomain.readConfigWith(Schema.Unknown),
            () => inMemoryJsonResponse({ config: new Date(), status: "OK" }),
            { accessToken: "token-123" },
          ),
        ),
      );

      expect(valueEnvelopeFailure).toBeInstanceOf(PutioContractError);
      expect(configEnvelopeFailure).toBeInstanceOf(PutioContractError);
      expect(typedValueFailure).toBeInstanceOf(PutioContractError);
      expect(typedConfigFailure).toBeInstanceOf(PutioContractError);
      expect(envelopeGetterCalls).toBe(0);
    }),
  );

  it.effect("covers download links and events", () =>
    Effect.gen(function* () {
      expect(
        yield* provideSdk(
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
        yield* provideSdk(
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
        yield* provideSdk(
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
        yield* provideSdk(events.deleteEvent(1), () => jsonResponse({ status: "OK" }), {
          accessToken: "token-123",
        }),
      ).toEqual({ status: "OK" });

      expect(
        yield* provideSdk(events.clearEvents(), () => jsonResponse({ status: "OK" }), {
          accessToken: "token-123",
        }),
      ).toEqual({ status: "OK" });

      expect(
        Array.from(
          yield* provideSdk(
            events.getEventTorrent(1),
            () => arrayBufferResponse([1, 2, 3], { status: 200 }),
            { accessToken: "token-123" },
          ),
        ),
      ).toEqual([1, 2, 3]);
    }),
  );

  it.effect("rejects invalid event inputs before transport", () =>
    Effect.gen(function* () {
      let requestCount = 0;

      const handler = () => {
        requestCount += 1;

        return jsonResponse({ status: "OK" });
      };

      const failures = yield* Effect.all([
        // @ts-expect-error JavaScript callers can provide null instead of a query object.
        Effect.exit(provideSdk(events.listEvents(null), handler)),
        Effect.exit(provideSdk(events.listEvents({ before: 0 }), handler)),
        Effect.exit(provideSdk(events.listEvents({ per_page: 0 }), handler)),
        Effect.exit(provideSdk(events.deleteEvent(0), handler)),
        Effect.exit(provideSdk(events.getEventTorrent(0), handler)),
      ]);

      expect(failures.map((exit) => expectFailure<unknown>(exit))).toEqual(
        failures.map(() => expect.any(PutioValidationError)),
      );
      expect(requestCount).toBe(0);
    }),
  );

  it.effect("rejects invalid download-link inputs before transport", () =>
    Effect.gen(function* () {
      let requestCount = 0;

      const handler = () => {
        requestCount += 1;

        return jsonResponse({ status: "OK" });
      };

      const failures = yield* Effect.all([
        // @ts-expect-error A download-link task needs a cursor or file IDs.
        Effect.exit(provideSdk(downloadLinks.createDownloadLinks(), handler)),
        // @ts-expect-error A download-link task needs a cursor or file IDs.
        Effect.exit(provideSdk(downloadLinks.createDownloadLinks({}), handler)),
        // @ts-expect-error Excluded IDs alone select nothing.
        Effect.exit(provideSdk(downloadLinks.createDownloadLinks({ excludeIds: [7] }), handler)),
        Effect.exit(provideSdk(downloadLinks.createDownloadLinks({ cursor: "" }), handler)),
        Effect.exit(provideSdk(downloadLinks.createDownloadLinks({ ids: [] }), handler)),
        Effect.exit(provideSdk(downloadLinks.createDownloadLinks({ ids: [0] }), handler)),
        Effect.exit(
          provideSdk(
            downloadLinks.createDownloadLinks({ cursor: "cursor", excludeIds: [0] }),
            handler,
          ),
        ),
        Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can provide non-numeric task IDs.
            downloadLinks.getDownloadLinks("abc/def"),
            handler,
          ),
        ),
        Effect.exit(provideSdk(downloadLinks.getDownloadLinks(0), handler)),
      ]);

      expect(failures.map((exit) => expectFailure<unknown>(exit))).toEqual(
        failures.map(() => expect.any(PutioValidationError)),
      );
      expect(requestCount).toBe(0);
    }),
  );

  it.effect("covers family, friend invite, and friends endpoints", () =>
    Effect.gen(function* () {
      expect(
        yield* provideSdk(
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
        yield* provideSdk(
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
        yield* provideSdk(
          family.createFamilyInvite(),
          () => jsonResponse({ code: "family-2", status: "OK" }),
          { accessToken: "token-123" },
        ),
      ).toEqual({ code: "family-2" });

      yield* provideSdk(
        family.removeFamilyMember("sdk user"),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/family/sub_account/sdk%20user");

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      yield* provideSdk(
        family.joinFamily("family/code"),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/family/join/family%2Fcode");

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      expect(
        yield* provideSdk(
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
        yield* provideSdk(
          friendInvites.createFriendInvite(),
          () => jsonResponse({ code: "friend-2", status: "OK" }),
          { accessToken: "token-123" },
        ),
      ).toEqual({ code: "friend-2" });

      expect(
        yield* provideSdk(
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
        yield* provideSdk(
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
        yield* provideSdk(
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
        yield* provideSdk(
          friends.countWaitingRequests(),
          () => jsonResponse({ count: 2, status: "OK" }),
          { accessToken: "token-123" },
        ),
      ).toBe(2);

      expect(
        yield* provideSdk(
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
        yield* provideSdk(
          friends.sendFriendRequest("sdk user"),
          () => jsonResponse({ status: "OK" }),
          { accessToken: "token-123" },
        ),
      ).toEqual({ status: "OK" });

      expect(
        yield* provideSdk(friends.removeFriend("sdk user"), () => jsonResponse({ status: "OK" }), {
          accessToken: "token-123",
        }),
      ).toEqual({ status: "OK" });

      expect(
        yield* provideSdk(
          friends.approveFriendRequest("sdk user"),
          () => jsonResponse({ status: "OK" }),
          { accessToken: "token-123" },
        ),
      ).toEqual({ status: "OK" });

      expect(
        yield* provideSdk(
          friends.denyFriendRequest("sdk user"),
          () => jsonResponse({ status: "OK" }),
          { accessToken: "token-123" },
        ),
      ).toEqual({ status: "OK" });

      expect(
        yield* provideSdk(
          friends.getFriendSharedFolder("sdk user"),
          () => jsonResponse({ file: sharedFile, status: "OK" }),
          { accessToken: "token-123" },
        ),
      ).toMatchObject({ id: 7 });
    }),
  );

  it.effect("rejects invalid family and friends requests before transport", () =>
    Effect.gen(function* () {
      let requestCount = 0;

      const invalidHandler = () => {
        requestCount += 1;

        return jsonResponse({ status: "OK" });
      };

      const failures = yield* Effect.all([
        Effect.exit(provideSdk(family.removeFamilyMember(""), invalidHandler)),
        Effect.exit(
          provideSdk(family.removeFamilyMember(".."), invalidHandler, { accessToken: "token-123" }),
        ),
        Effect.exit(
          provideSdk(family.removeFamilyMember("."), invalidHandler, { accessToken: "token-123" }),
        ),
        Effect.exit(provideSdk(family.joinFamily(""), invalidHandler)),
        Effect.exit(provideSdk(friends.searchFriends(""), invalidHandler)),
        Effect.exit(provideSdk(friends.sendFriendRequest(""), invalidHandler)),
        Effect.exit(provideSdk(friends.removeFriend(""), invalidHandler)),
        Effect.exit(provideSdk(friends.approveFriendRequest(""), invalidHandler)),
        Effect.exit(provideSdk(friends.denyFriendRequest(""), invalidHandler)),
        Effect.exit(provideSdk(friends.getFriendSharedFolder(""), invalidHandler)),
        Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can supply non-string usernames.
            friends.searchFriends(null),
            invalidHandler,
          ),
        ),
      ]);

      expect(failures.map((exit) => expectFailure<unknown>(exit))).toEqual(
        failures.map(() => expect.any(PutioValidationError)),
      );
      expect(requestCount).toBe(0);
    }),
  );

  it.effect("covers ifttt and tunnel routes", () =>
    Effect.gen(function* () {
      expect(
        yield* provideSdk(
          ifttt.getIftttStatus(),
          () => jsonResponse({ enabled: true, status: "OK" }),
          { accessToken: "token-123" },
        ),
      ).toEqual({ enabled: true });

      yield* provideSdk(
        ifttt.sendIftttEvent({
          clientName: "SDK",
          eventType: "playback_started",
          ingredients: {
            client_id: "sdk",
            client_name: "SDK",
            created_at: "2026-08-02T00:00:00Z",
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
          expect(body.get("ingredients")).toContain("created_at");

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      yield* provideSdk(
        ifttt.sendIftttEvent({
          eventType: "custom_event",
          ingredients: { nested: { enabled: true } },
        }),
        (request) => {
          const body = getFormBody(request);
          expect(body.get("event_type")).toBe("custom_event");
          expect(body.get("ingredients")).toContain('"nested"');

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      expect(
        yield* provideSdk(
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
    }),
  );

  it.effect("rejects invalid ifttt inputs before transport", () =>
    Effect.gen(function* () {
      let requestCount = 0;

      const handler = () => {
        requestCount += 1;

        return jsonResponse({ status: "OK" });
      };

      const failures = yield* Effect.all([
        // @ts-expect-error JavaScript callers can provide null instead of a request object.
        Effect.exit(provideSdk(ifttt.sendIftttEvent(null), handler)),
        Effect.exit(provideSdk(ifttt.sendIftttEvent({ eventType: "", ingredients: {} }), handler)),
        Effect.exit(
          provideSdk(
            ifttt.sendIftttEvent({
              eventType: "playback_started",
              ingredients: { file_id: 7, file_name: "SDK File" },
            }),
            handler,
          ),
        ),
        Effect.exit(
          provideSdk(
            ifttt.sendIftttEvent({
              eventType: "playback_stopped",
              ingredients: { file_id: 0, file_name: "SDK File", file_type: "VIDEO" },
            }),
            handler,
          ),
        ),
        Effect.exit(
          provideSdk(
            ifttt.sendIftttEvent({
              eventType: "custom_event",
              // @ts-expect-error JavaScript callers can provide non-JSON ingredient values.
              ingredients: { created_at: new Date() },
            }),
            handler,
          ),
        ),
        Effect.exit(
          provideSdk(
            ifttt.sendIftttEvent({
              eventType: "custom_event",
              ingredients: {},
              // @ts-expect-error JavaScript callers can provide unknown request properties.
              unexpected: true,
            }),
            handler,
          ),
        ),
      ]);

      expect(failures.map((exit) => expectFailure<unknown>(exit))).toEqual(
        failures.map(() => expect.any(PutioValidationError)),
      );
      expect(requestCount).toBe(0);
    }),
  );

  it.effect("maps representative operation failures in supporting domains", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.exit(
        provideSdk(
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
        ),
      );

      const error = expectFailure(failure);
      expect(error).toBeInstanceOf(PutioOperationError);
      expect(error).toMatchObject({
        domain: "downloadLinks",
        operation: "get",
        status: 404,
      });

      const iftttFailure = yield* Effect.exit(
        provideSdk(
          ifttt.sendIftttEvent({
            eventType: "playback_started",
            ingredients: {
              file_id: 7,
              file_name: "SDK File",
              file_type: "VIDEO",
            },
          }),
          () =>
            jsonResponse(
              {
                error_message: "Missing ingredients",
                error_type: "MISSING_INGREDIENTS",
                status_code: 400,
              },
              { status: 400 },
            ),
          { accessToken: "token-123" },
        ),
      );

      const iftttError = expectFailure(iftttFailure);
      expect(iftttError).toBeInstanceOf(PutioOperationError);
      expect(iftttError).toMatchObject({
        domain: "ifttt",
        operation: "sendEvent",
        reason: {
          errorType: "MISSING_INGREDIENTS",
          kind: "error_type",
        },
        status: 400,
      });
    }),
  );

  it.effect("fails with PutioValidationError when a config value breaks the caller's schema", () =>
    Effect.gen(function* () {
      const callerSchema = Schema.Struct({ theme: Schema.Literal("dark") });

      const failures = yield* Effect.all([
        Effect.exit(
          provideSdk(
            configDomain.readConfigWith(callerSchema),
            () => jsonResponse({ config: { theme: "light" }, status: "OK" }),
            { accessToken: "token-123" },
          ),
        ),
        Effect.exit(
          provideSdk(
            configDomain.getConfigKeyWith("theme", Schema.Literal("dark")),
            () => jsonResponse({ status: "OK", value: "light" }),
            { accessToken: "token-123" },
          ),
        ),
      ]);

      expect(failures.map((exit) => expectFailure<unknown>(exit))).toEqual(
        failures.map(() => expect.any(PutioValidationError)),
      );
    }),
  );

  it.effect("fails with PutioContractError when a typed config read gets a broken envelope", () =>
    Effect.gen(function* () {
      const failures = yield* Effect.all([
        Effect.exit(
          provideSdk(
            configDomain.readConfigWith(Schema.Struct({ theme: Schema.Literal("dark") })),
            () => jsonResponse({ config: { theme: "dark" }, status: "ERROR" }),
            { accessToken: "token-123" },
          ),
        ),
        Effect.exit(
          provideSdk(
            configDomain.getConfigKeyWith("theme", Schema.Literal("dark")),
            () => jsonResponse({ status: "OK" }),
            { accessToken: "token-123" },
          ),
        ),
      ]);

      expect(failures.map((exit) => expectFailure<unknown>(exit))).toEqual(
        failures.map(() => expect.any(PutioContractError)),
      );
    }),
  );
});
