import { Effect, Schema } from "effect";

import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import {
  OkResponseSchema,
  encodePathSegment,
  requestJson,
  type PutioSdkContext,
} from "../core/http.js";
import { decodeAndRunRedacted, NonEmptyStringSchema } from "../core/validation.js";

const RemoveRateLimitBanInputSchema = Schema.Struct({
  captchaToken: NonEmptyStringSchema,
  id: NonEmptyStringSchema,
});

export type RemoveRateLimitBanInput = Schema.Schema.Type<typeof RemoveRateLimitBanInputSchema>;

export const RemoveRateLimitBanErrorSpec = definePutioOperationErrorSpec({
  domain: "rateLimits",
  operation: "removeBan",
  knownErrors: [
    { statusCode: 400 as const },
    { errorType: "CAPTCHA_FAILED", statusCode: 403 as const },
    { errorType: "Forbidden", statusCode: 403 as const },
    { statusCode: 404 as const },
  ],
});

export type RemoveRateLimitBanError = PutioOperationFailure<typeof RemoveRateLimitBanErrorSpec>;

/**
 * Lifts a captcha-needed IP rate limit, using the `X-RateLimit-ID` of the 429
 * (`PutioRateLimitError.id`) and a solved reCAPTCHA token. The API lifts it
 * only for the IP it limited, so call it from the limited visitor's browser.
 */
export const removeRateLimitBan = (
  input: RemoveRateLimitBanInput,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  RemoveRateLimitBanError,
  PutioSdkContext
> =>
  decodeAndRunRedacted("rateLimits", "removeBan")(
    RemoveRateLimitBanInputSchema,
    input,
    ({ captchaToken, id }) =>
      requestJson(OkResponseSchema, {
        auth: { type: "none" },
        body: { type: "form", value: { captcha_token: captchaToken } },
        method: "DELETE",
        path: `/v2/ban/${encodePathSegment(id)}`,
      }),
  ).pipe(withOperationErrors(RemoveRateLimitBanErrorSpec));
