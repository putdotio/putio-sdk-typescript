import { Effect, Schema } from "effect";
import type { PutioSdkError } from "../core/errors.js";
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
const isJsonValue = (value: unknown): value is PutioJsonValue => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }
  return false;
};
const isJsonObject = (value: unknown): value is PutioJsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value) && isJsonValue(value);
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
  schema: Schema.Decoder<A, never>,
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
  requestJson(OkResponseSchema, {
    body: {
      type: "json",
      value: {
        config,
      },
    },
    method: "PUT",
    path: "/v2/config",
  });
export const getConfigKey = (
  key: string,
): Effect.Effect<PutioJsonValue, PutioSdkError, PutioSdkContext> =>
  requestJson(ConfigValueEnvelopeSchema, {
    method: "GET",
    path: `/v2/config/${encodePathSegment(key)}`,
  }).pipe(selectJsonField("value"));
export const getConfigKeyWith = <A>(
  key: string,
  schema: Schema.Decoder<A, never>,
): Effect.Effect<A, PutioSdkError, PutioSdkContext> =>
  requestJson(
    Schema.Struct({
      status: Schema.Literal("OK"),
      value: schema,
    }),
    {
      method: "GET",
      path: `/v2/config/${encodePathSegment(key)}`,
    },
  ).pipe(Effect.map((envelope) => envelope["value"]));
export const setConfigKey = (
  key: string,
  value: PutioJsonValue,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, PutioSdkError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "json",
      value: {
        value,
      },
    },
    method: "PUT",
    path: `/v2/config/${encodePathSegment(key)}`,
  });
export const deleteConfigKey = (
  key: string,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, PutioSdkError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    method: "DELETE",
    path: `/v2/config/${encodePathSegment(key)}`,
  });
