import { Effect, Fiber, Tracer } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { expectFailure, runSdkEffect, runSdkExit } from "../../test/support/sdk-test.js";

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
  type PutioSdkContext,
} from "./http.js";

describe("sdk core http", () => {
  it("applies default sdk configuration values", () => {
    expect(normalizePutioSdkOptions({ accessToken: "token" })).toEqual({
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
        httpClient: PutioHttpClient,
      }).pipe(Effect.provide(putioSdkLiveLayer({ accessToken: "token-123" }))),
    );

    expect(result.config).toEqual({
      accessToken: "token-123",
      baseUrl: "https://api.put.io",
      uploadBaseUrl: "https://upload.put.io",
      webAppUrl: "https://app.put.io",
    });
  });

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

  it.each(["json", "arrayBuffer"] as const)(
    "does not abort successful %s reads or reuse request controllers",
    async (kind) => {
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
        const response = await Effect.runPromise(request);
        expect(signals[index]?.aborted).toBe(false);
        await Effect.runPromise(kind === "json" ? response.json : response.arrayBuffer);
        expect(signals[index]?.aborted).toBe(false);
      }

      expect(signals[0]).not.toBe(signals[1]);
    },
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

  it("rejects absolute request paths", async () => {
    expect(() => buildPutioUrl("https://api.put.io", "https://evil.test/path")).toThrow(
      PutioConfigurationError,
    );
    expect(() => buildPutioUrl("https://api.put.io", "//evil.test/path")).toThrow(
      PutioConfigurationError,
    );

    const exit = await runSdkExit(
      requestJson(OkResponseSchema, {
        method: "GET",
        path: "https://evil.test/path",
      }),
      () => {
        throw new Error("request should not execute");
      },
      { accessToken: "token-123" },
    );

    expect(expectFailure(exit)).toBeInstanceOf(PutioConfigurationError);
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
    const result = await runSdkEffect(
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
  });

  it("sends configured headers under request headers and the sdk authorization", async () => {
    await runSdkEffect(
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
    );
  });

  it("never sends a configured authorization header on unauthenticated requests", async () => {
    await runSdkEffect(
      requestVoid({ method: "POST", path: "/v2/test", auth: { type: "none" } }),
      (request) => {
        expect(request.headers.has("authorization")).toBe(false);
        expect(request.headers.get("x-forwarded-for")).toBe("203.0.113.7");

        return new Response(JSON.stringify({ status: "OK" }), { status: 200 });
      },
      { headers: { authorization: "Token leaked", "x-forwarded-for": "203.0.113.7" } },
    );
  });

  it("fails fast when a config-token request has no configured access token", async () => {
    const exit = await runSdkExit(
      requestJson(OkResponseSchema, {
        method: "GET",
        path: "/v2/test",
      }),
      () => new Response(null, { status: 204 }),
    );

    const error = expectFailure(exit);
    expect(error).toBeInstanceOf(PutioConfigurationError);
  });

  it("maps non-success JSON responses to typed auth errors", async () => {
    const exit = await runSdkExit(
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
    );

    expect(expectFailure(exit)).toBeInstanceOf(PutioAuthError);
  });

  it("maps rate-limited responses with metadata", async () => {
    const exit = await runSdkExit(
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
    );

    const error = expectFailure(exit);
    expect(error).toBeInstanceOf(PutioRateLimitError);
    expect(error).toMatchObject({
      action: "captcha-needed",
      id: "limit-id",
    });
  });

  it.each([
    [401, PutioAuthError],
    [403, PutioAuthError],
    [429, PutioRateLimitError],
    [502, PutioApiError],
  ])("retains HTTP metadata for invalid error bodies (%i)", async (status, ErrorClass) => {
    for (const body of ["<html>private response</html>", "", "{invalid"]) {
      const client = makePutioFetchClient(
        async () =>
          new Response(body, {
            status,
            headers: { "retry-after": "60", "x-ratelimit-id": "test-limit" },
          }),
      );

      const error = expectFailure(
        await Effect.runPromiseExit(
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
  });

  it.each([new TypeError("body connection lost"), new SyntaxError("body source failed")])(
    "preserves genuine error body I/O failures: %s",
    async (cause) => {
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
        await Effect.runPromiseExit(
          requestVoid({ method: "GET", path: "/test", auth: { type: "none" } }).pipe(
            Effect.provideService(PutioHttpClient, client),
            Effect.provide(putioSdkLayer({})),
          ),
        ),
      );

      expect(error).toBeInstanceOf(PutioTransportError);
      expect(error).toHaveProperty("cause", cause);
    },
  );

  it("returns array buffers for binary responses", async () => {
    const result = await runSdkEffect(
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
  });

  it("returns text for non-JSON responses and keeps a caller-supplied accept header", async () => {
    const result = await runSdkEffect(
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
  });

  it("preserves typed response body read failures", async () => {
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

    const [jsonExit, errorJsonExit, binaryExit] = await Promise.all([
      Effect.runPromiseExit(
        provideClient(
          requestJson(OkResponseSchema, {
            auth: { type: "none" },
            method: "GET",
            path: "/v2/json",
          }),
        ),
      ),
      Effect.runPromiseExit(
        provideClient(
          requestVoid({
            auth: { type: "none" },
            method: "GET",
            path: "/v2/error",
          }),
        ),
      ),
      Effect.runPromiseExit(
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
  });

  it("maps failed binary responses to sdk errors", async () => {
    const exit = await runSdkExit(
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
    );

    expect(expectFailure(exit)).toBeInstanceOf(PutioApiError);
  });

  it("treats successful void responses as success", async () => {
    const result = await runSdkEffect(
      requestVoid({
        method: "DELETE",
        path: "/v2/files/1",
        auth: { type: "none" },
      }),
      () => new Response(null, { status: 204 }),
    );

    expect(result).toBeUndefined();
  });

  it("discards the body of a successful void response", async () => {
    const response = new Response(JSON.stringify({ status: "OK" }), { status: 200 });

    await runSdkEffect(
      requestVoid({ method: "POST", path: "/v2/test", auth: { type: "none" } }),
      () => response,
    );

    expect(response.bodyUsed).toBe(true);
  });

  it("treats a void response whose body cannot be read as success", async () => {
    const response = new Response(JSON.stringify({ status: "OK" }), { status: 200 });
    await response.arrayBuffer();

    const result = await runSdkEffect(
      requestVoid({ method: "POST", path: "/v2/test", auth: { type: "none" } }),
      () => response,
    );

    expect(result).toBeUndefined();
  });

  it("traces requests under a static span that carries only the HTTP method", async () => {
    const spans: Array<Tracer.NativeSpan> = [];

    const tracer = Tracer.make({
      span: (options) => {
        const span = new Tracer.NativeSpan(options);
        spans.push(span);

        return span;
      },
    });

    await runSdkEffect(
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
  });

  it("maps failed void responses to sdk errors", async () => {
    const exit = await runSdkExit(
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
    );

    expect(expectFailure(exit)).toBeInstanceOf(PutioAuthError);
  });

  it("sends multipart form-data bodies unchanged", async () => {
    const body = new FormData();
    body.set("file", new Blob(["hello"]), "hello.txt");

    await runSdkEffect(
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
  });
});
