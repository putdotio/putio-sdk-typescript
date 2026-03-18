import { Headers, HttpClient, HttpClientResponse } from "@effect/platform";
import type * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import { Cause, Effect, Exit, Option, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  PutioApiError,
  PutioAuthError,
  PutioConfigurationError,
  PutioRateLimitError,
} from "./errors.js";
import {
  OkResponseSchema,
  buildPutioUrl,
  makePutioSdkConfig,
  makePutioSdkLayer,
  makePutioSdkLiveLayer,
  PutioSdkConfig,
  requestArrayBuffer,
  requestJson,
  requestVoid,
  selectJsonField,
  selectJsonFields,
  type PutioSdkContext,
} from "./http.js";

type MockRequestHandler = (request: HttpClientRequest.HttpClientRequest) => Response;

const expectFailure = <E>(exit: Exit.Exit<unknown, E>): E => {
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected the effect to fail.");
  }

  const failure = Cause.failureOption(exit.cause);

  if (Option.isNone(failure)) {
    throw Cause.squash(exit.cause);
  }

  return failure.value;
};

const makeMockHttpClient = (handler: MockRequestHandler) =>
  HttpClient.make((request) =>
    Effect.succeed(HttpClientResponse.fromWeb(request, handler(request))),
  );

const provideSdkTest = <A, E>(
  effect: Effect.Effect<A, E, PutioSdkContext>,
  handler: MockRequestHandler,
  config: Parameters<typeof makePutioSdkConfig>[0] = {},
) =>
  effect.pipe(
    Effect.provideService(HttpClient.HttpClient, makeMockHttpClient(handler)),
    Effect.provide(makePutioSdkLayer(config)),
  );

describe("sdk core http", () => {
  it("applies default sdk configuration values", () => {
    expect(makePutioSdkConfig({ accessToken: "token" })).toEqual({
      accessToken: "token",
      baseUrl: "https://api.put.io",
      uploadBaseUrl: "https://upload.put.io",
      webAppUrl: "https://app.put.io",
    });
  });

  it("provides both config and an http client through the live layer", async () => {
    const result = await Effect.runPromise(
      Effect.all({
        config: PutioSdkConfig,
        httpClient: HttpClient.HttpClient,
      }).pipe(Effect.provide(makePutioSdkLiveLayer({ accessToken: "token-123" }))),
    );

    expect(result.config).toEqual({
      accessToken: "token-123",
      baseUrl: "https://api.put.io",
      uploadBaseUrl: "https://upload.put.io",
      webAppUrl: "https://app.put.io",
    });
    expect(result.httpClient).toBeDefined();
  });

  it("builds URLs and skips nullish query values", () => {
    expect(
      buildPutioUrl("https://api.put.io", "/v2/files/list", {
        offset: 20,
        parent_id: 0,
        reverse: false,
        section: null,
        start_from: undefined,
      }),
    ).toBe("https://api.put.io/v2/files/list?offset=20&parent_id=0&reverse=false");
  });

  it("projects decoded JSON envelopes with shared selectors", async () => {
    const field = await Effect.runPromise(
      Effect.succeed({
        code: "PUTIO1",
        qr_code_url: "https://api.put.io/qrcode/PUTIO1",
        status: "OK" as const,
      }).pipe(selectJsonField("code")),
    );

    const fields = await Effect.runPromise(
      Effect.succeed({
        access_token: "token-123",
        status: "OK" as const,
        user_id: 7,
      }).pipe(selectJsonFields("access_token", "user_id")),
    );

    expect(field).toBe("PUTIO1");
    expect(fields).toEqual({
      access_token: "token-123",
      user_id: 7,
    });
  });

  it("sends token-authenticated requests and decodes successful JSON", async () => {
    const result = await Effect.runPromise(
      provideSdkTest(
        requestJson(OkResponseSchema, {
          method: "GET",
          path: "/v2/test",
          query: { page: 2 },
        }),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/test?page=2");
          expect(Option.getOrUndefined(Headers.get(request.headers, "authorization"))).toBe(
            "Token token-123",
          );

          return new Response(JSON.stringify({ status: "OK" }), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          });
        },
        { accessToken: "token-123" },
      ),
    );

    expect(result).toEqual({ status: "OK" });
  });

  it("fails fast when a config-token request has no configured access token", async () => {
    const exit = await Effect.runPromiseExit(
      provideSdkTest(
        requestJson(OkResponseSchema, {
          method: "GET",
          path: "/v2/test",
        }),
        () => new Response(null, { status: 204 }),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const error = expectFailure(exit);
      expect(error).toBeInstanceOf(PutioConfigurationError);
      expect(error).toMatchObject({
        _tag: "PutioConfigurationError",
      });
    }
  });

  it("maps non-success JSON responses to typed auth errors", async () => {
    const exit = await Effect.runPromiseExit(
      provideSdkTest(
        requestJson(OkResponseSchema, {
          method: "GET",
          path: "/v2/test",
          auth: { type: "token", token: "override-token" },
        }),
        (request) => {
          expect(Option.getOrUndefined(Headers.get(request.headers, "authorization"))).toBe(
            "Token override-token",
          );

          return new Response(
            JSON.stringify({
              error_message: "Unauthorized",
              error_type: "AUTH_FAILED",
              status_code: 401,
            }),
            {
              status: 401,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        },
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      expect(expectFailure(exit)).toBeInstanceOf(PutioAuthError);
    }
  });

  it("maps rate-limited responses with metadata", async () => {
    const exit = await Effect.runPromiseExit(
      provideSdkTest(
        requestJson(OkResponseSchema, {
          method: "GET",
          path: "/v2/test",
          auth: { type: "none" },
        }),
        () =>
          new Response(
            JSON.stringify({
              error_message: "Too many requests",
              error_type: "TooManyRequests",
              status_code: 429,
            }),
            {
              status: 429,
              headers: {
                "content-type": "application/json",
                "x-ratelimit-action": "captcha-needed",
                "x-ratelimit-id": "limit-id",
              },
            },
          ),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const error = expectFailure(exit);
      expect(error).toBeInstanceOf(PutioRateLimitError);
      expect(error).toMatchObject({
        _tag: "PutioRateLimitError",
        action: "captcha-needed",
        id: "limit-id",
      });
    }
  });

  it("returns array buffers for binary responses", async () => {
    const result = await Effect.runPromise(
      provideSdkTest(
        requestArrayBuffer({
          method: "GET",
          path: "/v2/binary",
          auth: { type: "none" },
        }),
        () =>
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
          }),
      ),
    );

    expect(Array.from(result)).toEqual([1, 2, 3]);
  });

  it("maps failed binary responses to sdk errors", async () => {
    const exit = await Effect.runPromiseExit(
      provideSdkTest(
        requestArrayBuffer({
          method: "GET",
          path: "/v2/binary",
          auth: { type: "none" },
        }),
        () =>
          new Response(
            JSON.stringify({
              error_message: "Missing binary",
              status_code: 404,
            }),
            {
              status: 404,
              headers: {
                "content-type": "application/json",
              },
            },
          ),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      expect(expectFailure(exit)).toBeInstanceOf(PutioApiError);
    }
  });

  it("treats successful void responses as success", async () => {
    const result = await Effect.runPromise(
      provideSdkTest(
        requestVoid({
          method: "DELETE",
          path: "/v2/files/1",
          auth: { type: "none" },
        }),
        () => new Response(null, { status: 204 }),
      ),
    );

    expect(result).toBeUndefined();
  });

  it("maps failed void responses to sdk errors", async () => {
    const exit = await Effect.runPromiseExit(
      provideSdkTest(
        requestVoid({
          method: "DELETE",
          path: "/v2/files/1",
          auth: { type: "none" },
        }),
        () =>
          new Response(
            JSON.stringify({
              error_message: "Forbidden",
              status_code: 403,
            }),
            {
              status: 403,
              headers: {
                "content-type": "application/json",
              },
            },
          ),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      expect(expectFailure(exit)).toBeInstanceOf(PutioAuthError);
    }
  });

  it("supports multipart form-data request bodies", async () => {
    const result = await Effect.runPromise(
      provideSdkTest(
        requestJson(OkResponseSchema, {
          method: "POST",
          path: "/v2/files/upload",
          auth: { type: "none" },
          body: {
            type: "form-data",
            value: (() => {
              const body = new FormData();
              body.set("file", new Blob(["hello"]), "hello.txt");
              return body;
            })(),
          },
        }),
        () =>
          new Response(JSON.stringify({ status: "OK" }), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }),
      ),
    );

    expect(result).toEqual({ status: "OK" });
  });

  it("accepts custom schemas for successful JSON bodies", async () => {
    const SchemaWithName = Schema.Struct({
      status: Schema.Literal("OK"),
      user: Schema.Struct({
        name: Schema.String,
      }),
    });

    const result = await Effect.runPromise(
      provideSdkTest(
        requestJson(SchemaWithName, {
          method: "GET",
          path: "/v2/account/info",
          auth: { type: "none" },
        }),
        () =>
          new Response(
            JSON.stringify({
              status: "OK",
              user: { name: "Altay" },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          ),
      ),
    );

    expect(result).toEqual({
      status: "OK",
      user: { name: "Altay" },
    });
  });
});
