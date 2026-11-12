import { Effect, Fiber, Redacted, Tracer } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { expectFailure, provideSdk } from "../../test/support/sdk-test.js";

import {
  PutioApiError,
  PutioAuthError,
  PutioConfigurationError,
  PutioTransportError,
  PutioRateLimitError,
} from "./errors.js";
import {
  OkResponseSchema,
  PutioHttpClient,
  buildPutioUrl,
  makePutioFetchClient,
  normalizePutioSdkOptions,
  putioSdkLayer,
  putioSdkLiveLayer,
  type PutioHttpClientService,
  PutioSdkConfig,
  requestArrayBuffer,
  requestText,
  requestJson,
  requestVoid,
  selectJsonField,
  selectJsonFields,
  type PutioAuth,
  type PutioSdkContext,
} from "./http.js";

describe("sdk core http", () => {
  it("applies default sdk configuration values", () => {
    expect(normalizePutioSdkOptions({ accessToken: "token" })).toEqual({
      accessToken: Redacted.make("token"),
      baseUrl: "https://api.put.io",
      headers: undefined,
      uploadBaseUrl: "https://upload.put.io",
      webAppUrl: "https://app.put.io",
    });
  });

  it("stores the access token redacted, whichever form the caller passes", () => {
    const fromString = normalizePutioSdkOptions({ accessToken: "secret-token" });
    const fromRedacted = normalizePutioSdkOptions({ accessToken: Redacted.make("secret-token") });

    expect(fromString.accessToken).toEqual(fromRedacted.accessToken);
    expect(JSON.stringify(fromString)).not.toContain("secret-token");
    expect(normalizePutioSdkOptions({ accessToken: "" }).accessToken).toBeUndefined();
    expect(normalizePutioSdkOptions({}).accessToken).toBeUndefined();
  });

  it.effect("unwraps redacted credentials only into the Authorization header", () =>
    Effect.gen(function* () {
      const authorizations: Array<string | null> = [];

      const respond = (request: { readonly headers: Headers }) => {
        authorizations.push(request.headers.get("authorization"));

        return new Response(JSON.stringify({ status: "OK" }), { status: 200 });
      };

      yield* provideSdk(
        requestJson(OkResponseSchema, { method: "GET", path: "/v2/test" }),
        respond,
        {
          accessToken: Redacted.make("config-secret"),
        },
      );
      yield* provideSdk(
        requestJson(OkResponseSchema, {
          auth: { type: "token", token: Redacted.make("override-secret") },
          method: "GET",
          path: "/v2/test",
        }),
        respond,
      );
      yield* provideSdk(
        requestJson(OkResponseSchema, {
          auth: { type: "basic", username: "user", password: Redacted.make("basic-secret") },
          method: "GET",
          path: "/v2/test",
        }),
        respond,
      );
      yield* provideSdk(
        requestJson(OkResponseSchema, {
          auth: { type: "basic", username: "user", password: "plain-secret" },
          method: "GET",
          path: "/v2/test",
        }),
        respond,
      );

      expect(authorizations).toEqual([
        "Token config-secret",
        "Token override-secret",
        `Basic ${btoa("user:basic-secret")}`,
        `Basic ${btoa("user:plain-secret")}`,
      ]);
    }),
  );

  it.effect("provides both config and an http client through the live layer", () =>
    Effect.gen(function* () {
      const result = yield* Effect.all({
        config: PutioSdkConfig,
        httpClient: PutioHttpClient,
      }).pipe(Effect.provide(putioSdkLiveLayer({ accessToken: "token-123" })));

      expect(result.config).toEqual({
        accessToken: Redacted.make("token-123"),
        baseUrl: "https://api.put.io",
        headers: undefined,
        uploadBaseUrl: "https://upload.put.io",
        webAppUrl: "https://app.put.io",
      });
    }),
  );

  it("aborts fetch transport when the Effect is interrupted", async () => {
    let observedSignal: AbortSignal | undefined;
    let markStarted: (() => void) | undefined;

    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });

    const httpClient = makePutioFetchClient((_input, init) => {
      observedSignal = init?.signal ?? undefined;

      return new Promise<Response>((_resolve, reject) => {
        observedSignal?.addEventListener("abort", () => reject(observedSignal?.reason), {
          once: true,
        });
        markStarted?.();
      });
    });

    const fiber = Effect.runFork(
      httpClient.execute({
        headers: new Headers(),
        method: "GET",
        url: "https://api.put.io/v2/test",
      }),
    );

    await started;
    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(observedSignal).toBeInstanceOf(AbortSignal);
    expect(observedSignal?.aborted).toBe(true);
  });

  it.each(["json", "arrayBuffer", "error"] as const)(
    "aborts fetch while reading the %s body",
    async (kind) => {
      const started = Promise.withResolvers<void>();
      let observedSignal: AbortSignal | undefined;

      const client = makePutioFetchClient(async (_input, init) => {
        observedSignal = init?.signal ?? undefined;

        class PendingResponse extends Response {
          override json() {
            started.resolve();

            return super.json();
          }
          override arrayBuffer() {
            started.resolve();

            return super.arrayBuffer();
          }
          override text() {
            started.resolve();

            return super.text();
          }
        }

        return new PendingResponse(
          new ReadableStream({
            start(controller) {
              observedSignal?.addEventListener(
                "abort",
                () => controller.error(observedSignal?.reason),
                { once: true },
              );
            },
          }),
          { status: kind === "error" ? 429 : 200 },
        );
      });

      const fiber = Effect.runFork(
        client
          .execute({ headers: new Headers(), method: "GET", url: "https://example.invalid/test" })
          .pipe(
            Effect.flatMap((response) =>
              kind === "arrayBuffer" ? response.arrayBuffer : response.json,
            ),
          ),
      );

      await started.promise;
      expect(observedSignal?.aborted).toBe(false);
      await Effect.runPromise(Fiber.interrupt(fiber));
      expect(observedSignal?.aborted).toBe(true);
    },
  );

  it.effect.each(["json", "arrayBuffer"] as const)(
    "does not abort successful %s reads or reuse request controllers",
    (kind) =>
      Effect.gen(function* () {
        const signals: Array<AbortSignal> = [];

        const client = makePutioFetchClient(async (_input, init) => {
          if (init?.signal) signals.push(init.signal);

          return Response.json({ status: "OK" });
        });

        const request = client.execute({
          headers: new Headers(),
          method: "GET",
          url: "https://example.invalid/test",
        });

        for (let index = 0; index < 2; index++) {
          const response = yield* request;
          expect(signals[index]?.aborted).toBe(false);
          yield* kind === "json" ? response.json : response.arrayBuffer;
          expect(signals[index]?.aborted).toBe(false);
        }

        expect(signals[0]).not.toBe(signals[1]);
      }),
  );

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

    expect(buildPutioUrl("https://api.put.io", "v2/files/list")).toBe(
      "https://api.put.io/v2/files/list",
    );
  });

  it.effect("rejects absolute request paths", () =>
    Effect.gen(function* () {
      expect(() => buildPutioUrl("https://api.put.io", "https://evil.test/path")).toThrow(
        PutioConfigurationError,
      );
      expect(() => buildPutioUrl("https://api.put.io", "//evil.test/path")).toThrow(
        PutioConfigurationError,
      );

      const exit = yield* Effect.exit(
        provideSdk(
          requestJson(OkResponseSchema, {
            method: "GET",
            path: "https://evil.test/path",
          }),
          () => {
            throw new Error("request should not execute");
          },
          { accessToken: "token-123" },
        ),
      );

      expect(expectFailure(exit)).toBeInstanceOf(PutioConfigurationError);
    }),
  );

  it.effect("projects decoded JSON envelopes with shared selectors", () =>
    Effect.gen(function* () {
      const field = yield* Effect.succeed({
        code: "PUTIO1",
        qr_code_url: "https://api.put.io/qrcode/PUTIO1",
        status: "OK" as const,
      }).pipe(selectJsonField("code"));

      const fields = yield* Effect.succeed({
        access_token: "token-123",
        status: "OK" as const,
        user_id: 7,
      }).pipe(selectJsonFields("access_token", "user_id"));

      expect(field).toBe("PUTIO1");
      expect(fields).toEqual({
        access_token: "token-123",
        user_id: 7,
      });
    }),
  );

  it.effect("sends token-authenticated requests and decodes successful JSON", () =>
    Effect.gen(function* () {
      const result = yield* provideSdk(
        requestJson(OkResponseSchema, {
          method: "GET",
          path: "/v2/test",
          query: { page: 2 },
        }),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/test?page=2");
          expect(request.headers.get("authorization")).toBe("Token token-123");

          return new Response(JSON.stringify({ status: "OK" }), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          });
        },
        { accessToken: "token-123" },
      );

      expect(result).toEqual({ status: "OK" });
    }),
  );

  it.effect("sends configured headers under request headers and the sdk authorization", () =>
    provideSdk(
      requestVoid({
        method: "POST",
        path: "/v2/test",
        headers: { "x-request-id": "request" },
      }),
      (request) => {
        expect(request.headers.get("x-forwarded-for")).toBe("203.0.113.7");
        expect(request.headers.get("x-request-id")).toBe("request");
        expect(request.headers.get("authorization")).toBe("Token token-123");

        return new Response(JSON.stringify({ status: "OK" }), { status: 200 });
      },
      {
        accessToken: "token-123",
        headers: {
          authorization: "Token spoofed",
          "x-forwarded-for": "203.0.113.7",
          "x-request-id": "config",
        },
      },
    ),
  );

  it.effect("never sends a configured authorization header on unauthenticated requests", () =>
    provideSdk(
      requestVoid({ method: "POST", path: "/v2/test", auth: { type: "none" } }),
      (request) => {
        expect(request.headers.has("authorization")).toBe(false);
        expect(request.headers.get("x-forwarded-for")).toBe("203.0.113.7");

        return new Response(JSON.stringify({ status: "OK" }), { status: 200 });
      },
      { headers: { authorization: "Token leaked", "x-forwarded-for": "203.0.113.7" } },
    ),
  );

  it.effect("fails fast when a config-token request has no configured access token", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        provideSdk(
          requestJson(OkResponseSchema, {
            method: "GET",
            path: "/v2/test",
          }),
          () => new Response(null, { status: 204 }),
        ),
      );

      const error = expectFailure(exit);
      expect(error).toBeInstanceOf(PutioConfigurationError);
    }),
  );

  it.effect("maps non-success JSON responses to typed auth errors", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        provideSdk(
          requestJson(OkResponseSchema, {
            method: "GET",
            path: "/v2/test",
            auth: { type: "token", token: "override-token" },
          }),
          (request) => {
            expect(request.headers.get("authorization")).toBe("Token override-token");

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

      expect(expectFailure(exit)).toBeInstanceOf(PutioAuthError);
    }),
  );

  it.effect("maps rate-limited responses with metadata", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        provideSdk(
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

      const error = expectFailure(exit);
      expect(error).toBeInstanceOf(PutioRateLimitError);
      expect(error).toMatchObject({
        action: "captcha-needed",
        id: "limit-id",
      });
    }),
  );

  it.effect.each([
    [401, PutioAuthError],
    [403, PutioAuthError],
    [429, PutioRateLimitError],
    [502, PutioApiError],
  ] as const)("retains HTTP metadata for invalid error bodies (%i)", ([status, ErrorClass]) =>
    Effect.gen(function* () {
      for (const body of ["<html>private response</html>", "", "{invalid"]) {
        const client = makePutioFetchClient(
          async () =>
            new Response(body, {
              status,
              headers: { "retry-after": "60", "x-ratelimit-id": "test-limit" },
            }),
        );

        const error = expectFailure(
          yield* Effect.exit(
            requestJson(OkResponseSchema, {
              method: "GET",
              path: "/test",
              auth: { type: "none" },
            }).pipe(
              Effect.provideService(PutioHttpClient, client),
              Effect.provide(putioSdkLayer({})),
            ),
          ),
        );

        expect(error).toBeInstanceOf(ErrorClass);
        expect(error).toMatchObject({
          status,
          body: { status_code: status },
          cause: expect.any(SyntaxError),
        });
        expect(JSON.stringify(error)).not.toContain("private response");

        if (status === 429) expect(error).toMatchObject({ retryAfter: "60", id: "test-limit" });
      }
    }),
  );

  it.effect.each([new TypeError("body connection lost"), new SyntaxError("body source failed")])(
    "preserves genuine error body I/O failures: %s",
    (cause) =>
      Effect.gen(function* () {
        const client = makePutioFetchClient(
          async () =>
            new Response(
              new ReadableStream({
                start(controller) {
                  controller.error(cause);
                },
              }),
              { status: 429 },
            ),
        );

        const error = expectFailure(
          yield* Effect.exit(
            requestVoid({ method: "GET", path: "/test", auth: { type: "none" } }).pipe(
              Effect.provideService(PutioHttpClient, client),
              Effect.provide(putioSdkLayer({})),
            ),
          ),
        );

        expect(error).toBeInstanceOf(PutioTransportError);
        expect(error).toHaveProperty("cause", cause);
      }),
  );

  it.effect("returns array buffers for binary responses", () =>
    Effect.gen(function* () {
      const result = yield* provideSdk(
        requestArrayBuffer({
          method: "GET",
          path: "/v2/binary",
          auth: { type: "none" },
        }),
        () =>
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
          }),
      );

      expect(Array.from(result)).toEqual([1, 2, 3]);
    }),
  );

  it.effect("returns text for non-JSON responses and keeps a caller-supplied accept header", () =>
    Effect.gen(function* () {
      const result = yield* provideSdk(
        requestText({
          method: "GET",
          path: "/v2/playlist.m3u8",
          auth: { type: "none" },
          headers: { accept: "application/vnd.apple.mpegurl" },
        }),
        (request) => {
          expect(request.headers.get("accept")).toBe("application/vnd.apple.mpegurl");

          return new Response("#EXTM3U\n#EXT-X-VERSION:3\n", { status: 200 });
        },
      );

      expect(result).toBe("#EXTM3U\n#EXT-X-VERSION:3\n");
    }),
  );

  it.effect("preserves typed response body read failures", () =>
    Effect.gen(function* () {
      const jsonFailure = new PutioTransportError({ cause: "json read failed" });
      const errorJsonFailure = new PutioTransportError({ cause: "error json read failed" });
      const binaryFailure = new PutioTransportError({ cause: "binary read failed" });

      const httpClient: PutioHttpClientService = {
        execute: (request) => {
          const isErrorResponse = request.url.endsWith("/v2/error");

          return Effect.succeed({
            arrayBuffer: Effect.fail(binaryFailure),
            headers: new Headers(),
            json: Effect.fail(isErrorResponse ? errorJsonFailure : jsonFailure),
            status: isErrorResponse ? 500 : 200,
          });
        },
      };

      const provideClient = <A, E>(effect: Effect.Effect<A, E, PutioSdkContext>) =>
        effect.pipe(
          Effect.provideService(PutioHttpClient, httpClient),
          Effect.provide(putioSdkLayer({})),
        );

      const [jsonExit, errorJsonExit, binaryExit] = yield* Effect.all([
        Effect.exit(
          provideClient(
            requestJson(OkResponseSchema, {
              auth: { type: "none" },
              method: "GET",
              path: "/v2/json",
            }),
          ),
        ),
        Effect.exit(
          provideClient(
            requestVoid({
              auth: { type: "none" },
              method: "GET",
              path: "/v2/error",
            }),
          ),
        ),
        Effect.exit(
          provideClient(
            requestArrayBuffer({
              auth: { type: "none" },
              method: "GET",
              path: "/v2/binary",
            }),
          ),
        ),
      ]);

      expect(expectFailure(jsonExit)).toBe(jsonFailure);
      expect(expectFailure(errorJsonExit)).toBe(errorJsonFailure);
      expect(expectFailure(binaryExit)).toBe(binaryFailure);
    }),
  );

  it.effect("maps failed binary responses to sdk errors", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        provideSdk(
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

      expect(expectFailure(exit)).toBeInstanceOf(PutioApiError);
    }),
  );

  it.effect("treats successful void responses as success", () =>
    Effect.gen(function* () {
      const result = yield* provideSdk(
        requestVoid({
          method: "DELETE",
          path: "/v2/files/1",
          auth: { type: "none" },
        }),
        () => new Response(null, { status: 204 }),
      );

      expect(result).toBeUndefined();
    }),
  );

  it.effect("discards the body of a successful void response", () =>
    Effect.gen(function* () {
      const response = new Response(JSON.stringify({ status: "OK" }), { status: 200 });

      yield* provideSdk(
        requestVoid({ method: "POST", path: "/v2/test", auth: { type: "none" } }),
        () => response,
      );

      expect(response.bodyUsed).toBe(true);
    }),
  );

  it.effect("treats a void response whose body cannot be read as success", () =>
    Effect.gen(function* () {
      const response = new Response(JSON.stringify({ status: "OK" }), { status: 200 });
      yield* Effect.promise(() => response.arrayBuffer());

      const result = yield* provideSdk(
        requestVoid({ method: "POST", path: "/v2/test", auth: { type: "none" } }),
        () => response,
      );

      expect(result).toBeUndefined();
    }),
  );

  it.effect("traces requests under a static span that carries only the HTTP method", () =>
    Effect.gen(function* () {
      const spans: Array<Tracer.NativeSpan> = [];

      const tracer = Tracer.make({
        span: (options) => {
          const span = new Tracer.NativeSpan(options);
          spans.push(span);

          return span;
        },
      });

      yield* provideSdk(
        requestJson(OkResponseSchema, {
          body: { type: "form", value: { code: "body-secret" } },
          headers: { "x-test": "header-secret" },
          method: "POST",
          path: "/v2/account/voucher/path-secret",
          query: { oauth_token: "query-secret" },
        }).pipe(Effect.withTracer(tracer)),
        () => new Response(JSON.stringify({ status: "OK" }), { status: 200 }),
        { accessToken: "token-secret" },
      );

      expect(spans.map((span) => [span.name, Object.fromEntries(span.attributes)])).toEqual([
        ["PutioSdk.executeRequest", { "http.request.method": "POST" }],
      ]);
    }),
  );

  it.effect("maps failed void responses to sdk errors", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        provideSdk(
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

      expect(expectFailure(exit)).toBeInstanceOf(PutioAuthError);
    }),
  );

  it.effect("sends multipart form-data bodies unchanged", () =>
    Effect.gen(function* () {
      const body = new FormData();
      body.set("file", new Blob(["hello"]), "hello.txt");

      yield* provideSdk(
        requestVoid({
          method: "POST",
          path: "/v2/files/upload",
          auth: { type: "none" },
          body: { type: "form-data", value: body },
        }),
        (request) => {
          expect(request.body).toBe(body);

          return new Response(null, { status: 204 });
        },
      );
    }),
  );

  it("normalises a redacted access token without unwrapping it", () => {
    const wiped = Redacted.make("wiped-secret");
    Redacted.wipeUnsafe(wiped);

    expect(normalizePutioSdkOptions({ accessToken: wiped }).accessToken).toBe(wiped);
  });

  it.effect.each<{
    readonly auth: (secret: Redacted.Redacted<string>) => PutioAuth;
    readonly name: string;
  }>([
    { auth: () => ({ type: "config-token" }), name: "the configured access token" },
    { auth: (token) => ({ type: "token", token }), name: "a token override" },
    {
      auth: (password) => ({ type: "basic", username: "user", password }),
      name: "a basic password",
    },
  ])("fails with PutioConfigurationError when $name is a wiped Redacted", (scenario) =>
    Effect.gen(function* () {
      const wiped = Redacted.make("wiped-secret");
      Redacted.wipeUnsafe(wiped);
      let requestCount = 0;
      const auth = scenario.auth(wiped);

      const exit = yield* Effect.exit(
        requestJson(OkResponseSchema, { auth, method: "GET", path: "/v2/test" }).pipe(
          Effect.provideService(PutioHttpClient, {
            execute: () => {
              requestCount += 1;

              return Effect.die("unexpected request");
            },
          }),
          Effect.provideService(PutioSdkConfig, {
            ...normalizePutioSdkOptions({}),
            accessToken: wiped,
          }),
        ),
      );

      expect(expectFailure(exit)).toBeInstanceOf(PutioConfigurationError);
      expect(requestCount).toBe(0);
    }),
  );

  it.effect("treats an empty configured access token as a missing token", () =>
    Effect.gen(function* () {
      let requestCount = 0;

      const exit = yield* Effect.exit(
        requestJson(OkResponseSchema, { method: "GET", path: "/v2/test" }).pipe(
          Effect.provideService(PutioHttpClient, {
            execute: () => {
              requestCount += 1;

              return Effect.die("unexpected request");
            },
          }),
          Effect.provideService(PutioSdkConfig, {
            ...normalizePutioSdkOptions({}),
            accessToken: Redacted.make(""),
          }),
        ),
      );

      expect(expectFailure(exit)).toBeInstanceOf(PutioConfigurationError);
      expect(requestCount).toBe(0);
    }),
  );
});
