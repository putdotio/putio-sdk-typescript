import { Effect, Option, Schema, SchemaIssue, SchemaParser } from "effect";
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
const nativeObjectConstructorSource = Function.prototype.toString.call(Object);
const nativeArrayConstructorSource = Function.prototype.toString.call(Array);
const hasMatchingNativeConstructor = (prototype: object, constructorSource: string): boolean => {
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
  const constructorPrototype =
    typeof constructor === "function"
      ? Object.getOwnPropertyDescriptor(constructor, "prototype")?.value
      : undefined;
  return (
    typeof constructor === "function" &&
    constructorPrototype === prototype &&
    Function.prototype.toString.call(constructor) === constructorSource
  );
};
const isPlainRecord = (value: object): value is Record<string, unknown> => {
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) {
      return true;
    }
    if (Object.getPrototypeOf(prototype) !== null) {
      return false;
    }
    return hasMatchingNativeConstructor(prototype, nativeObjectConstructorSource);
  } catch {
    return false;
  }
};
const isPlainArray = (value: ReadonlyArray<unknown>): boolean => {
  try {
    const prototype = Object.getPrototypeOf(value);
    return (
      prototype !== null &&
      Object.getPrototypeOf(prototype) !== null &&
      hasMatchingNativeConstructor(prototype, nativeArrayConstructorSource)
    );
  } catch {
    return false;
  }
};
type JsonWalkMode = "snapshot" | "validate";
type JsonWalkResult =
  | { readonly _tag: "Invalid" }
  | { readonly _tag: "Validated" }
  | { readonly _tag: "Snapshot"; readonly value: PutioJsonValue };
const invalidJsonWalk: JsonWalkResult = { _tag: "Invalid" };
const validatedJsonWalk: JsonWalkResult = { _tag: "Validated" };
const walkJsonValue = (
  value: unknown,
  mode: JsonWalkMode,
  ancestors: Set<object> = new Set(),
): JsonWalkResult => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return mode === "snapshot" ? { _tag: "Snapshot", value } : validatedJsonWalk;
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? mode === "snapshot"
        ? { _tag: "Snapshot", value }
        : validatedJsonWalk
      : invalidJsonWalk;
  }
  if (typeof value !== "object" || ancestors.has(value)) {
    return invalidJsonWalk;
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (!isPlainArray(value)) {
        return invalidJsonWalk;
      }
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const lengthDescriptor = descriptors["length"];
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0
      ) {
        return invalidJsonWalk;
      }
      const output: Array<PutioJsonValue> | undefined = mode === "snapshot" ? [] : undefined;
      for (let index = 0; index < lengthDescriptor.value; index += 1) {
        const descriptor = descriptors[String(index)];
        if (descriptor === undefined || !("value" in descriptor)) {
          return invalidJsonWalk;
        }
        const item = walkJsonValue(descriptor.value, mode, ancestors);
        if (item._tag === "Invalid") {
          return item;
        }
        if (output === undefined) {
          if (item._tag !== "Validated") {
            return invalidJsonWalk;
          }
        } else {
          if (item._tag !== "Snapshot") {
            return invalidJsonWalk;
          }
          output.push(item.value);
        }
      }
      return output === undefined ? validatedJsonWalk : { _tag: "Snapshot", value: output };
    }
    if (!isPlainRecord(value)) {
      return invalidJsonWalk;
    }
    const output: Record<string, PutioJsonValue> | undefined = mode === "snapshot" ? {} : undefined;
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!descriptor.enumerable) {
        continue;
      }
      if (!("value" in descriptor)) {
        return invalidJsonWalk;
      }
      const item = walkJsonValue(descriptor.value, mode, ancestors);
      if (item._tag === "Invalid") {
        return item;
      }
      if (output === undefined) {
        if (item._tag !== "Validated") {
          return invalidJsonWalk;
        }
        continue;
      }
      if (item._tag !== "Snapshot") {
        return invalidJsonWalk;
      }
      Object.defineProperty(output, key, {
        configurable: true,
        enumerable: true,
        value: item.value,
        writable: true,
      });
    }
    return output === undefined ? validatedJsonWalk : { _tag: "Snapshot", value: output };
  } catch {
    return invalidJsonWalk;
  } finally {
    ancestors.delete(value);
  }
};
const snapshotJsonValue = (value: unknown): PutioJsonValue | undefined => {
  const result = walkJsonValue(value, "snapshot");
  return result._tag === "Snapshot" ? result.value : undefined;
};
const snapshotJsonObject = (value: unknown): PutioJsonObject | undefined => {
  const snapshot = snapshotJsonValue(value);
  return typeof snapshot === "object" && snapshot !== null && !Array.isArray(snapshot)
    ? snapshot
    : undefined;
};
const isJsonValue = (value: unknown): value is PutioJsonValue =>
  walkJsonValue(value, "validate")._tag === "Validated";
const isJsonObject = (value: unknown): value is PutioJsonObject =>
  typeof value === "object" && value !== null && isJsonValue(value) && !Array.isArray(value);
export const JsonValueSchema = Schema.declareConstructor<PutioJsonValue>()(
  [],
  () => (input, ast) => {
    const snapshot = snapshotJsonValue(input);
    return snapshot === undefined
      ? Effect.fail(new SchemaIssue.InvalidType(ast, Option.none()))
      : Effect.succeed(snapshot);
  },
  {
    expected: "a JSON-compatible value",
  },
);
const JsonValueResponseSchema = Schema.declareConstructor<PutioJsonValue>()(
  [],
  () => (input, ast) =>
    isJsonValue(input)
      ? Effect.succeed(input)
      : Effect.fail(new SchemaIssue.InvalidType(ast, Option.none())),
  {
    expected: "a JSON-compatible value",
  },
);
const JsonObjectResponseSchema = Schema.declareConstructor<PutioJsonObject>()(
  [],
  () => (input, ast) =>
    isJsonObject(input)
      ? Effect.succeed(input)
      : Effect.fail(new SchemaIssue.InvalidType(ast, Option.none())),
  {
    expected: "a JSON object",
  },
);
export const JsonObjectSchema = Schema.declareConstructor<PutioJsonObject>()(
  [],
  () => (input, ast) => {
    const snapshot = snapshotJsonObject(input);
    return snapshot === undefined
      ? Effect.fail(new SchemaIssue.InvalidType(ast, Option.none()))
      : Effect.succeed(snapshot);
  },
  {
    expected: "a JSON object",
  },
);
const ConfigKeySchema = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isPattern(/^(?!\.{1,2}$)/),
  Schema.makeFilter((key: string) => key.isWellFormed(), {
    expected: "a well-formed Unicode config key",
  }),
);
const ConfigSetKeyInputSchema = Schema.Struct({
  key: ConfigKeySchema,
  value: JsonValueSchema,
});
const getResponseEnvelopeFields = (
  input: unknown,
  valueField: "config" | "value",
): { readonly status: unknown; readonly value: unknown } | undefined => {
  if (typeof input !== "object" || input === null || !isPlainRecord(input)) {
    return undefined;
  }
  try {
    const statusDescriptor = Object.getOwnPropertyDescriptor(input, "status");
    const valueDescriptor = Object.getOwnPropertyDescriptor(input, valueField);
    if (
      statusDescriptor === undefined ||
      !("value" in statusDescriptor) ||
      valueDescriptor === undefined ||
      !("value" in valueDescriptor)
    ) {
      return undefined;
    }
    return {
      status: statusDescriptor.value,
      value: valueDescriptor.value,
    };
  } catch {
    return undefined;
  }
};
const makeConfigEnvelopeSchema = <A>(schema: Schema.ConstraintDecoder<A, never>) =>
  Schema.declareConstructor<{
    readonly config: A;
    readonly status: "OK";
  }>()([schema], ([configSchema]) => (input, ast, options) => {
    const fields = getResponseEnvelopeFields(input, "config");
    if (fields === undefined || fields.status !== "OK") {
      return Effect.fail(new SchemaIssue.InvalidType(ast, Option.none()));
    }
    return SchemaParser.decodeUnknownEffect(configSchema)(fields.value, options).pipe(
      Effect.map((config) => ({ config, status: "OK" })),
    );
  });
const makeConfigValueEnvelopeSchema = <A>(schema: Schema.ConstraintDecoder<A, never>) =>
  Schema.declareConstructor<{
    readonly status: "OK";
    readonly value: A;
  }>()([schema], ([valueSchema]) => (input, ast, options) => {
    const fields = getResponseEnvelopeFields(input, "value");
    if (fields === undefined || fields.status !== "OK") {
      return Effect.fail(new SchemaIssue.InvalidType(ast, Option.none()));
    }
    return SchemaParser.decodeUnknownEffect(valueSchema)(fields.value, options).pipe(
      Effect.map((value) => ({ status: "OK", value })),
    );
  });
const ConfigEnvelopeSchema = makeConfigEnvelopeSchema(JsonObjectResponseSchema);
const ConfigValueEnvelopeSchema = makeConfigValueEnvelopeSchema(JsonValueResponseSchema);
export const readConfig = (): Effect.Effect<PutioJsonObject, PutioSdkError, PutioSdkContext> =>
  requestJson(ConfigEnvelopeSchema, {
    method: "GET",
    path: "/v2/config",
  }).pipe(selectJsonField("config"));
export const readConfigWith = <A>(
  schema: Schema.ConstraintDecoder<A, never>,
): Effect.Effect<A, PutioSdkError, PutioSdkContext> =>
  requestJson(makeConfigEnvelopeSchema(JsonObjectResponseSchema.pipe(Schema.decodeTo(schema))), {
    method: "GET",
    path: "/v2/config",
  }).pipe(Effect.map((envelope) => envelope["config"]));
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
        makeConfigValueEnvelopeSchema(JsonValueResponseSchema.pipe(Schema.decodeTo(schema))),
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
  Schema.decodeUnknownEffect(ConfigSetKeyInputSchema, { onExcessProperty: "error" })({
    key,
    value,
  }).pipe(
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
