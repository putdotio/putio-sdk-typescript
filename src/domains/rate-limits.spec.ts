import { Effect } from "effect";
import { PutioOperationError, PutioValidationError } from "../core/errors.js";
import { removeRateLimitBan } from "./rate-limits.js";
import { describe, expect, it } from "@effect/vitest";

import {
  expectFailure,
  getAuthorizationHeader,
  getFormBody,
  jsonResponse,
  provideSdk,
} from "../../test/support/sdk-test.js";

describe("rate limit domain", () => {
  it.effect("lifts a ban with the captcha token and never sends credentials", () =>
    Effect.gen(function* () {
      expect(
        yield* provideSdk(
          removeRateLimitBan({ captchaToken: "captcha-token", id: "A1B2/C3" }),
          (request) => {
            expect(request.method).toBe("DELETE");
            expect(request.url).toBe("https://api.put.io/v2/ban/A1B2%2FC3");
            expect(getFormBody(request).get("captcha_token")).toBe("captcha-token");
            expect(getAuthorizationHeader(request)).toBeUndefined();

            return jsonResponse({ status: "OK" });
          },
          { accessToken: "user-token" },
        ),
      ).toEqual({ status: "OK" });
    }),
  );

  it.effect.each([
    ["CAPTCHA_FAILED", 403],
    ["Forbidden", 403],
    ["NotFound", 404],
  ] as const)("types a %s response as a removeBan failure", ([errorType, statusCode]) =>
    Effect.gen(function* () {
      const error = expectFailure(
        yield* Effect.exit(
          provideSdk(removeRateLimitBan({ captchaToken: "token", id: "ID" }), () =>
            jsonResponse(
              { error_type: errorType, status: "ERROR", status_code: statusCode },
              { status: statusCode },
            ),
          ),
        ),
      );

      expect(error).toBeInstanceOf(PutioOperationError);
      expect(error).toMatchObject({ domain: "rateLimits", operation: "removeBan" });
    }),
  );

  it.effect("rejects missing inputs before sending a request", () =>
    Effect.gen(function* () {
      const error = expectFailure(
        yield* Effect.exit(
          provideSdk(removeRateLimitBan({ captchaToken: "", id: "ID" }), () => {
            throw new Error("no request expected");
          }),
        ),
      );

      expect(error).toBeInstanceOf(PutioValidationError);
    }),
  );
});
