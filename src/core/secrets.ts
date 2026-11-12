import { Effect, Predicate, Redacted } from "effect";

import { mapConfigurationError, type PutioConfigurationError } from "./errors.js";

export const revealSecret = (
  secret: string | Redacted.Redacted<string>,
): Effect.Effect<string, PutioConfigurationError> =>
  Predicate.isString(secret)
    ? Effect.succeed(secret)
    : Effect.try({
        try: () => Redacted.value(secret),
        catch: mapConfigurationError,
      });

export const revealAccessToken = (
  accessToken: Redacted.Redacted<string> | undefined,
): Effect.Effect<string | undefined, PutioConfigurationError> =>
  accessToken === undefined
    ? Effect.undefined
    : revealSecret(accessToken).pipe(Effect.map((token) => (token === "" ? undefined : token)));
