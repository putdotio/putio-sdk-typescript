export const httpCompatibilitySource = `
import { Cause as HttpCause, Effect as HttpEffect, Exit as HttpExit } from "effect";
import { createPutioSdkEffectClient as httpSdk, makePutioFetchLayer as httpLayer, makePutioSdkLayer as httpConfig } from "@putdotio/sdk";

const runHttpCompatibility = async () => {
  for (const status of [401, 403, 429, 502]) {
    for (const body of ["<html>private response</html>", "", "{invalid"]) {
      const exit = await HttpEffect.runPromiseExit(
        httpSdk().events.clear().pipe(
          HttpEffect.provide(httpConfig({ accessToken: "fixture-token" })),
          HttpEffect.provide(httpLayer(async () => new Response(body, {
            status,
            headers: { "retry-after": "60" },
          }))),
        ),
      );
      if (HttpExit.isSuccess(exit)) throw new Error("Expected HTTP failure");
      const error = exit.cause.reasons.find(HttpCause.isFailReason)?.error;
      const expectedTag = status === 429 ? "PutioRateLimitError" : status === 502 ? "PutioApiError" : "PutioAuthError";
      if (!error || error._tag !== expectedTag || !("status" in error) || error.status !== status) {
        throw new Error("HTTP classification lost: " + JSON.stringify(error));
      }
      if (!("cause" in error) || !(error.cause instanceof SyntaxError)) throw new Error("Missing parsing cause");
      if (JSON.stringify(error).includes("private response")) throw new Error("Response body leaked");
      if (error._tag === "PutioRateLimitError" && error.retryAfter !== "60") throw new Error("Retry-After lost");
    }
  }
};
`;
