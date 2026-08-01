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
const snapshotJsonValue = (
  value: unknown,
  ancestors: ReadonlySet<object> = new Set(),
): PutioJsonValue | undefined => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "object" || ancestors.has(value)) {
    return undefined;
  }
  const descendants = new Set(ancestors).add(value);
  try {
    if (Array.isArray(value)) {
      const output: Array<PutioJsonValue> = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !("value" in descriptor)) {
          return undefined;
        }
        const item = snapshotJsonValue(descriptor.value, descendants);
        if (item === undefined) {
          return undefined;
        }
        output.push(item);
      }
      return output;
    }
    if (!isPlainRecord(value)) {
      return undefined;
    }
    const output: Record<string, PutioJsonValue> = {};
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!descriptor.enumerable) {
        continue;
      }
      if (!("value" in descriptor)) {
        return undefined;
      }
      const item = snapshotJsonValue(descriptor.value, descendants);
      if (item === undefined) {
        return undefined;
      }
      Object.defineProperty(output, key, {
        configurable: true,
        enumerable: true,
        value: item,
        writable: true,
      });
    }
    return output;
  } catch {
    return undefined;
  }
};
const isJsonValue = (value: unknown): value is PutioJsonValue =>
  snapshotJsonValue(value) !== undefined;
const isJsonObject = (value: unknown): value is PutioJsonObject =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  isPlainRecord(value) &&
  isJsonValue(value);
const snapshotJsonObject = (value: unknown): PutioJsonObject | undefined => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !isPlainRecord(value)
  ) {
    return undefined;
  }
  const snapshot = snapshotJsonValue(value);
  return typeof snapshot === "object" && snapshot !== null && !Array.isArray(snapshot)
    ? snapshot
    : undefined;
};
const requireJsonSnapshot = <A extends PutioJsonValue>(
  snapshot: A | undefined,
  expected: string,
): Effect.Effect<A, PutioSdkError> =>
  snapshot === undefined
    ? Effect.fail(mapDecodeErrorToValidationError(`Expected ${expected}`))
    : Effect.succeed(snapshot);
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
      requireJsonSnapshot(snapshotJsonObject(decodedConfig), "a JSON object").pipe(
        Effect.flatMap((configSnapshot) =>
          requestJson(OkResponseSchema, {
            body: {
              type: "json",
              value: {
                config: configSnapshot,
              },
            },
            method: "PUT",
            path: "/v2/config",
          }),
        ),
      ),
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
      requireJsonSnapshot(snapshotJsonValue(decodedInput.value), "a JSON-compatible value").pipe(
        Effect.flatMap((valueSnapshot) =>
          requestJson(OkResponseSchema, {
            body: {
              type: "json",
              value: {
                value: valueSnapshot,
              },
            },
            method: "PUT",
            path: `/v2/config/${encodePathSegment(decodedInput.key)}`,
          }),
        ),
      ),
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
