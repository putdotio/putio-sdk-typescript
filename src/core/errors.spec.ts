import { Effect, Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "@effect/vitest";

import { expectFailure } from "../../test/support/sdk-test.js";

import {
  PutioApiError,
  PutioAuthError,
  PutioRateLimitError,
  PutioTransportError,
  PutioOperationError,
  definePutioOperationErrorSpec,
  fallbackPutioErrorEnvelope,
  isPutioApiError,
  isPutioAuthError,
  isPutioErrorEnvelope,
  isPutioOperationError,
  isPutioRateLimitError,
  toPutioResponseError,
  parseErrorBody,
  responseRateLimitHeaders,
  withOperationErrors,
} from "./errors.js";

describe("sdk core errors", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a fallback error envelope from the status code", () => {
    expect(fallbackPutioErrorEnvelope(503)).toEqual({
      error_message: "put.io API request failed with status 503",
      status_code: 503,
    });
  });

  it("extracts rate-limit metadata from response headers", () => {
    const headers = new Headers({
      "retry-after": "12",
      "x-ratelimit-action": "captcha-needed",
      "x-ratelimit-id": "abc123",
      "x-ratelimit-limit": "10",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": "1773496255",
    });

    expect(responseRateLimitHeaders(headers)).toEqual({
      action: "captcha-needed",
      id: "abc123",
      limit: "10",
      remaining: "0",
      retryAfter: "12",
      retryAfterSeconds: 12,
      reset: "1773496255",
    });
  });

  it("parses Retry-After as delta-seconds or an HTTP-date and keeps the raw header", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-17T00:00:00Z"));

    const parse = (retryAfter: string) => {
      const error = toPutioResponseError(429, new Headers({ "retry-after": retryAfter }), {});

      return error instanceof PutioRateLimitError
        ? { retryAfter: error.retryAfter, retryAfterSeconds: error.retryAfterSeconds }
        : undefined;
    };

    expect(parse("0")).toEqual({ retryAfter: "0", retryAfterSeconds: 0 });
    expect(parse(" 120 ")).toEqual({ retryAfter: "120", retryAfterSeconds: 120 });
    expect(parse("Tue, 17 Mar 2026 00:01:30 GMT")).toEqual({
      retryAfter: "Tue, 17 Mar 2026 00:01:30 GMT",
      retryAfterSeconds: 90,
    });
    expect(parse("Mon, 16 Mar 2026 23:59:00 GMT")).toEqual({
      retryAfter: "Mon, 16 Mar 2026 23:59:00 GMT",
      retryAfterSeconds: 0,
    });

    for (const unparseable of [
      "-5",
      "1.5",
      "soon",
      "retry in 5",
      "5 GMT",
      "Tue, 17 Mar 2026 00:01:30",
      "99999999999999999999",
    ]) {
      expect(parse(unparseable)).toEqual({
        retryAfter: unparseable,
        retryAfterSeconds: undefined,
      });
    }

    expect(toPutioResponseError(429, new Headers(), {})).toMatchObject({
      retryAfter: undefined,
      retryAfterSeconds: undefined,
    });
  });

  it("maps 429 responses to PutioRateLimitError", () => {
    const error = toPutioResponseError(
      429,
      new Headers({
        "x-ratelimit-action": "captcha-needed",
        "x-ratelimit-id": "limit-id",
      }),
      {
        error_message: "Too many requests",
        error_type: "TooManyRequests",
        status_code: 429,
      },
    );

    expect(error).toBeInstanceOf(PutioRateLimitError);
    expect(error).toMatchObject({
      action: "captcha-needed",
      id: "limit-id",
      status: 429,
    });
  });

  it("maps auth and generic API errors to the right classes", () => {
    const authError = toPutioResponseError(401, new Headers(), {
      error_message: "Unauthorized",
      status_code: 401,
    });

    const apiError = toPutioResponseError(500, new Headers(), {
      error_message: "Server error",
      status_code: 500,
    });

    expect(authError).toBeInstanceOf(PutioAuthError);
    expect(apiError).toBeInstanceOf(PutioApiError);
  });

  it("narrows public SDK response errors with exported type guards", () => {
    const apiError = new PutioApiError({
      status: 500,
      body: {
        error_message: "Server error",
        status_code: 500,
      },
    });

    const authError = new PutioAuthError({
      status: 403,
      body: {
        error_type: "invalid_scope",
        status_code: 403,
      },
    });

    const rateLimitError = new PutioRateLimitError({
      status: 429,
      body: {
        error_type: "TooManyRequests",
        status_code: 429,
      },
      retryAfter: "12",
    });

    expect(isPutioErrorEnvelope(apiError.body)).toBe(true);
    expect(isPutioErrorEnvelope({})).toBe(true);
    expect(isPutioErrorEnvelope([])).toBe(false);
    expect(isPutioErrorEnvelope({ error: "access_denied" })).toBe(true);
    expect(isPutioErrorEnvelope({ error: 400 })).toBe(false);
    expect(isPutioErrorEnvelope({ error_message: 500 })).toBe(false);
    expect(isPutioApiError(apiError)).toBe(true);
    expect(isPutioAuthError(authError)).toBe(true);
    expect(isPutioRateLimitError(rateLimitError)).toBe(true);
    expect(isPutioRateLimitError(apiError)).toBe(false);
    expect(
      isPutioRateLimitError(
        Object.assign(new PutioRateLimitError({ body: {}, status: 429 }), { retryAfter: 12 }),
      ),
    ).toBe(false);
  });

  it.effect("keeps protocol response errors schema-decodable", () =>
    Effect.gen(function* () {
      const encoded = yield* Schema.encodeEffect(PutioRateLimitError)(
        new PutioRateLimitError({
          action: "captcha-needed",
          body: {
            error_message: "Too many requests",
            error_type: "TooManyRequests",
            status_code: 429,
          },
          retryAfter: "12",
          retryAfterSeconds: 12,
          status: 429,
        }),
      );

      const decoded = yield* Schema.decodeUnknownEffect(PutioRateLimitError)(
        JSON.parse(JSON.stringify(encoded)),
      );

      expect(decoded).toBeInstanceOf(PutioRateLimitError);
      expect(decoded).toMatchObject({
        action: "captcha-needed",
        retryAfter: "12",
        retryAfterSeconds: 12,
        status: 429,
      });
    }),
  );

  it.effect("parses a valid API error body", () =>
    Effect.gen(function* () {
      const body = yield* parseErrorBody(400)({
        details: { field: "name" },
        error_id: null,
        error_message: "Bad request",
        error_type: "BadRequest",
        error_uri: "http://api.put.io/v2/docs",
        extra: { field: "name", limit: 10 },
        status: "ERROR",
        status_code: 400,
      });

      expect(body).toEqual({
        details: { field: "name" },
        error_id: null,
        error_message: "Bad request",
        error_type: "BadRequest",
        error_uri: "http://api.put.io/v2/docs",
        extra: { field: "name", limit: 10 },
        status: "ERROR",
        status_code: 400,
      });
    }),
  );

  it.effect("falls back when the API error body is invalid", () =>
    Effect.gen(function* () {
      const body = yield* parseErrorBody(418)("not-an-envelope");

      expect(body).toEqual({
        error_message: "put.io API request failed with status 418",
        status_code: 418,
      });
    }),
  );

  it.effect("wraps matched API errors in a typed operation error by error_type", () =>
    Effect.gen(function* () {
      const spec = definePutioOperationErrorSpec({
        domain: "files",
        operation: "move",
        knownErrors: [{ errorType: "FILE_LOST" }] as const,
      });

      const exit = yield* Effect.exit(
        withOperationErrors(
          Effect.fail(
            new PutioApiError({
              status: 400,
              body: {
                error_message: "File was lost",
                error_type: "FILE_LOST",
                status_code: 400,
              },
            }),
          ),
          spec,
        ),
      );

      const error = expectFailure(exit);
      expect(error).toBeInstanceOf(PutioOperationError);
      expect(isPutioOperationError(error)).toBe(true);
      expect(error).toMatchObject({
        domain: "files",
        operation: "move",
        reason: {
          kind: "error_type",
          errorType: "FILE_LOST",
        },
      });
    }),
  );

  it.effect("requires both error_type and status_code when a contract declares both", () =>
    Effect.gen(function* () {
      const spec = definePutioOperationErrorSpec({
        domain: "files",
        operation: "move",
        knownErrors: [{ errorType: "FILE_LOST", statusCode: 404 }] as const,
      });

      const originalError = new PutioApiError({
        status: 409,
        body: {
          error_message: "File was lost",
          error_type: "FILE_LOST",
          status_code: 409,
        },
      });

      const exit = yield* Effect.exit(withOperationErrors(Effect.fail(originalError), spec));

      expect(expectFailure(exit)).toBe(originalError);
    }),
  );

  it.effect("wraps matched auth errors by status code in the pipeable form", () =>
    Effect.gen(function* () {
      const spec = definePutioOperationErrorSpec({
        domain: "files",
        operation: "delete",
        knownErrors: [{ statusCode: 403 }] as const,
      });

      const exit = yield* Effect.exit(
        Effect.fail(
          new PutioAuthError({
            status: 403,
            body: {
              error_message: "Forbidden",
              status_code: 403,
            },
          }),
        ).pipe(withOperationErrors(spec)),
      );

      const error = expectFailure(exit);
      expect(error).toBeInstanceOf(PutioOperationError);
      expect(error).toMatchObject({
        domain: "files",
        operation: "delete",
        reason: {
          kind: "status_code",
          statusCode: 403,
        },
      });
    }),
  );

  it.effect("leaves non-matchable errors alone", () =>
    Effect.gen(function* () {
      const transportError = new PutioTransportError({ cause: "network" });

      const spec = definePutioOperationErrorSpec({
        domain: "files",
        operation: "list",
        knownErrors: [{ errorType: "FILE_LOST" }] as const,
      });

      const exit = yield* Effect.exit(withOperationErrors(Effect.fail(transportError), spec));

      expect(expectFailure(exit)).toBe(transportError);
    }),
  );
});
