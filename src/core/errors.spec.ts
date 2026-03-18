import { Headers } from "@effect/platform";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

import {
  PutioApiError,
  PutioAuthError,
  PutioRateLimitError,
  PutioTransportError,
  PutioOperationError,
  definePutioOperationErrorSpec,
  fallbackPutioErrorEnvelope,
  makeResponseError,
  parseErrorBody,
  responseRateLimitHeaders,
  withOperationErrors,
} from "./errors.js";

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

describe("sdk core errors", () => {
  it("builds a fallback error envelope from the status code", () => {
    expect(fallbackPutioErrorEnvelope(503)).toEqual({
      error_message: "put.io API request failed with status 503",
      status_code: 503,
    });
  });

  it("extracts rate-limit metadata from response headers", () => {
    const headers = Headers.fromInput({
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
      reset: "1773496255",
    });
  });

  it("maps 429 responses to PutioRateLimitError", () => {
    const error = makeResponseError(
      429,
      Headers.fromInput({
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
      _tag: "PutioRateLimitError",
      action: "captcha-needed",
      id: "limit-id",
      status: 429,
    });
  });

  it("maps auth and generic API errors to the right classes", () => {
    const authError = makeResponseError(401, Headers.empty, {
      error_message: "Unauthorized",
      status_code: 401,
    });
    const apiError = makeResponseError(500, Headers.empty, {
      error_message: "Server error",
      status_code: 500,
    });

    expect(authError).toBeInstanceOf(PutioAuthError);
    expect(apiError).toBeInstanceOf(PutioApiError);
  });

  it("parses a valid API error body", async () => {
    const body = await Effect.runPromise(
      parseErrorBody(400, {
        details: { field: "name" },
        error_message: "Bad request",
        error_type: "BadRequest",
        status_code: 400,
      }),
    );

    expect(body).toEqual({
      details: { field: "name" },
      error_message: "Bad request",
      error_type: "BadRequest",
      status_code: 400,
    });
  });

  it("falls back when the API error body is invalid", async () => {
    const body = await Effect.runPromise(parseErrorBody(418, "not-an-envelope"));

    expect(body).toEqual({
      error_message: "put.io API request failed with status 418",
      status_code: 418,
    });
  });

  it("wraps matched API errors in a typed operation error by error_type", async () => {
    const spec = definePutioOperationErrorSpec({
      domain: "files",
      operation: "move",
      knownErrors: [{ errorType: "FILE_LOST" }] as const,
    });

    const exit = await Effect.runPromiseExit(
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

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const error = expectFailure(exit);
      expect(error).toBeInstanceOf(PutioOperationError);
      expect(error).toMatchObject({
        _tag: "PutioOperationError",
        domain: "files",
        operation: "move",
        reason: {
          kind: "error_type",
          errorType: "FILE_LOST",
        },
      });
    }
  });

  it("requires both error_type and status_code when a contract declares both", async () => {
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

    const exit = await Effect.runPromiseExit(withOperationErrors(Effect.fail(originalError), spec));

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      expect(expectFailure(exit)).toBe(originalError);
    }
  });

  it("supports pipe-friendly operation error wrapping", async () => {
    const spec = definePutioOperationErrorSpec({
      domain: "files",
      operation: "delete",
      knownErrors: [{ statusCode: 404 }] as const,
    });

    const exit = await Effect.runPromiseExit(
      Effect.fail(
        new PutioApiError({
          status: 404,
          body: {
            error_message: "Not found",
            status_code: 404,
          },
        }),
      ).pipe(withOperationErrors(spec)),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const error = expectFailure(exit);
      expect(error).toBeInstanceOf(PutioOperationError);
      expect(error).toMatchObject({
        _tag: "PutioOperationError",
        domain: "files",
        operation: "delete",
        reason: {
          kind: "status_code",
          statusCode: 404,
        },
      });
    }
  });

  it("wraps matched API errors in a typed operation error by status code", async () => {
    const spec = definePutioOperationErrorSpec({
      domain: "download-links",
      operation: "create",
      knownErrors: [{ statusCode: 404 }] as const,
    });

    const exit = await Effect.runPromiseExit(
      withOperationErrors(
        Effect.fail(
          new PutioAuthError({
            status: 404,
            body: {
              error_message: "Not found",
              status_code: 404,
            },
          }),
        ),
        spec,
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const error = expectFailure(exit);
      expect(error).toBeInstanceOf(PutioOperationError);
      expect(error).toMatchObject({
        _tag: "PutioOperationError",
        domain: "download-links",
        operation: "create",
        reason: {
          kind: "status_code",
          statusCode: 404,
        },
      });
    }
  });

  it("leaves non-matchable errors alone", async () => {
    const transportError = new PutioTransportError({ cause: "network" });
    const spec = definePutioOperationErrorSpec({
      domain: "files",
      operation: "list",
      knownErrors: [{ errorType: "FILE_LOST" }] as const,
    });

    const exit = await Effect.runPromiseExit(
      withOperationErrors(Effect.fail(transportError), spec),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      expect(expectFailure(exit)).toBe(transportError);
    }
  });
});
