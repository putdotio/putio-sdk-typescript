import { Effect, Schema } from "effect";
import { mapDecodeErrorToValidationError, type PutioSdkError } from "../core/errors.js";
import {
  OkResponseSchema,
  encodePathSegment,
  requestJson,
  selectJsonField,
  type PutioSdkContext,
} from "../core/http.js";
export type PutioJsonPrimitive = string | number | boolean | null;
export type PutioJsonValue =
  | PutioJsonPrimitive
  | {
      readonly [key: string]: PutioJsonValue;
    }
  | ReadonlyArray<PutioJsonValue>;
export type PutioJsonObject = {
  readonly [key: string]: PutioJsonValue;
};
const isPlainRecord = (value: object): value is Record<string, unknown> => {
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
};
const isJsonValue = (
  value: unknown,
  ancestors: ReadonlySet<object> = new Set(),
): value is PutioJsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value !== "object" || ancestors.has(value)) {
    return false;
  }
  const descendants = new Set(ancestors).add(value);
  try {
    if (Array.isArray(value)) {
      return value.every((item) => isJsonValue(item, descendants));
    }
    return (
      isPlainRecord(value) && Object.values(value).every((item) => isJsonValue(item, descendants))
    );
  } catch {
    return false;
  }
};
const isJsonObject = (value: unknown): value is PutioJsonObject =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  isPlainRecord(value) &&
  isJsonValue(value);
export const JsonValueSchema = Schema.Unknown.pipe(
  Schema.refine(isJsonValue, {
    expected: "a JSON-compatible value",
  }),
);
export const JsonObjectSchema = Schema.Unknown.pipe(
  Schema.refine(isJsonObject, {
    expected: "a JSON object",
  }),
);
const ConfigKeySchema = Schema.String.check(Schema.isMinLength(1));
const ConfigSetKeyInputSchema = Schema.Struct({
  key: ConfigKeySchema,
  value: JsonValueSchema,
});
const ConfigEnvelopeSchema = Schema.Struct({
  config: JsonObjectSchema,
  status: Schema.Literal("OK"),
});
const ConfigValueEnvelopeSchema = Schema.Struct({
  status: Schema.Literal("OK"),
  value: JsonValueSchema,
});
export const readConfig = (): Effect.Effect<PutioJsonObject, PutioSdkError, PutioSdkContext> =>
  requestJson(ConfigEnvelopeSchema, {
    method: "GET",
    path: "/v2/config",
  }).pipe(selectJsonField("config"));
export const readConfigWith = <A>(
  schema: Schema.ConstraintDecoder<A, never>,
): Effect.Effect<A, PutioSdkError, PutioSdkContext> =>
  requestJson(
    Schema.Struct({
      config: schema,
      status: Schema.Literal("OK"),
    }),
    {
      method: "GET",
      path: "/v2/config",
    },
  ).pipe(Effect.map((envelope) => envelope["config"]));
export const writeConfig = (
  config: PutioJsonObject,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, PutioSdkError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(JsonObjectSchema)(config).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedConfig) =>
      requestJson(OkResponseSchema, {
        body: {
          type: "json",
          value: {
            config: decodedConfig,
          },
        },
        method: "PUT",
        path: "/v2/config",
      }),
    ),
  );
export const getConfigKey = (
  key: string,
): Effect.Effect<PutioJsonValue, PutioSdkError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(ConfigKeySchema)(key).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedKey) =>
      requestJson(ConfigValueEnvelopeSchema, {
        method: "GET",
        path: `/v2/config/${encodePathSegment(decodedKey)}`,
      }),
    ),
    selectJsonField("value"),
  );
export const getConfigKeyWith = <A>(
  key: string,
  schema: Schema.ConstraintDecoder<A, never>,
): Effect.Effect<A, PutioSdkError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(ConfigKeySchema)(key).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedKey) =>
      requestJson(
        Schema.Struct({
          status: Schema.Literal("OK"),
          value: schema,
        }),
        {
          method: "GET",
          path: `/v2/config/${encodePathSegment(decodedKey)}`,
        },
      ),
    ),
    Effect.map((envelope) => envelope["value"]),
  );
export const setConfigKey = (
  key: string,
  value: PutioJsonValue,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, PutioSdkError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(ConfigSetKeyInputSchema)({ key, value }).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedInput) =>
      requestJson(OkResponseSchema, {
        body: {
          type: "json",
          value: {
            value: decodedInput.value,
          },
        },
        method: "PUT",
        path: `/v2/config/${encodePathSegment(decodedInput.key)}`,
      }),
    ),
  );
export const deleteConfigKey = (
  key: string,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, PutioSdkError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(ConfigKeySchema)(key).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedKey) =>
      requestJson(OkResponseSchema, {
        method: "DELETE",
        path: `/v2/config/${encodePathSegment(decodedKey)}`,
      }),
    ),
  );
