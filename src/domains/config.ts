import { Effect, Predicate, Schema, SchemaIssue, SchemaParser } from "effect";
import { decodeAndRun } from "../core/validation.js";
import { type PutioSdkError } from "../core/errors.js";
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

const isNativePrototype = (prototype: unknown, constructorSource: string): prototype is object => {
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;

  return (
    Predicate.isFunction(constructor) &&
    Object.getOwnPropertyDescriptor(constructor, "prototype")?.value === prototype &&
    Function.prototype.toString.call(constructor) === constructorSource
  );
};

const isPlainRecord = (value: unknown): value is object => {
  try {
    const prototype = Object.getPrototypeOf(value);

    if (prototype === null) {
      return true;
    }

    if (Object.getPrototypeOf(prototype) !== null) {
      return false;
    }

    return isNativePrototype(prototype, nativeObjectConstructorSource);
  } catch {
    return false;
  }
};

const isPlainArray = (value: unknown): value is ReadonlyArray<unknown> => {
  try {
    if (!Array.isArray(value)) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return (
      prototype !== null &&
      Object.getPrototypeOf(prototype) !== null &&
      isNativePrototype(prototype, nativeArrayConstructorSource)
    );
  } catch {
    return false;
  }
};

type JsonCopies = Map<object, PutioJsonValue>;

const copyOfJsonValue = (value: PutioJsonValue, copies: JsonCopies): PutioJsonValue =>
  (Predicate.isObjectKeyword(value) ? copies.get(value) : undefined) ?? value;

const isJsonValueWithin = (
  value: unknown,
  ancestors: Set<object>,
  copies: JsonCopies | undefined,
): value is PutioJsonValue => {
  if (Predicate.isNull(value) || Predicate.isString(value) || Predicate.isBoolean(value)) {
    return true;
  }

  if (Predicate.isNumber(value)) {
    return Number.isFinite(value);
  }

  if (!Predicate.isObjectKeyword(value) || ancestors.has(value)) {
    return false;
  }

  ancestors.add(value);

  try {
    if (isPlainArray(value)) {
      const descriptors = Object.getOwnPropertyDescriptors<object>(value);
      const length = descriptors["length"]?.value;

      if (!Number.isSafeInteger(length) || length < 0) {
        return false;
      }

      const output: Array<PutioJsonValue> = [];

      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];

        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          !isJsonValueWithin(descriptor.value, ancestors, copies)
        ) {
          return false;
        }

        if (copies !== undefined) {
          output.push(copyOfJsonValue(descriptor.value, copies));
        }
      }

      copies?.set(value, output);

      return true;
    }

    if (!isPlainRecord(value)) {
      return false;
    }

    const output: Record<string, PutioJsonValue> = {};

    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!descriptor.enumerable) {
        continue;
      }

      if (!("value" in descriptor) || !isJsonValueWithin(descriptor.value, ancestors, copies)) {
        return false;
      }

      if (copies !== undefined) {
        Object.defineProperty(output, key, {
          configurable: true,
          enumerable: true,
          value: copyOfJsonValue(descriptor.value, copies),
          writable: true,
        });
      }
    }

    copies?.set(value, output);

    return true;
  } catch {
    return false;
  } finally {
    ancestors.delete(value);
  }
};

const isJsonValue = (value: unknown): value is PutioJsonValue =>
  isJsonValueWithin(value, new Set(), undefined);

const isJsonObjectValue = (value: PutioJsonValue): value is PutioJsonObject =>
  Predicate.isObjectKeyword(value) && !Array.isArray(value);

const isJsonObject = (value: unknown): value is PutioJsonObject =>
  isJsonValue(value) && isJsonObjectValue(value);

export const JsonValueSchema = Schema.declareConstructor<PutioJsonValue>()(
  [],
  () => (input, ast, options) => {
    const copies: JsonCopies = new Map();

    return isJsonValueWithin(input, new Set(), copies)
      ? Effect.succeed(copyOfJsonValue(input, copies))
      : Effect.fail(new SchemaIssue.InvalidType(ast, input, options));
  },
  {
    expected: "a JSON-compatible value",
  },
);

const JsonValueResponseSchema = Schema.declareConstructor<PutioJsonValue>()(
  [],
  () => (input, ast, options) =>
    isJsonValue(input)
      ? Effect.succeed(input)
      : Effect.fail(new SchemaIssue.InvalidType(ast, input, options)),
  {
    expected: "a JSON-compatible value",
  },
);

const JsonObjectResponseSchema = Schema.declareConstructor<PutioJsonObject>()(
  [],
  () => (input, ast, options) =>
    isJsonObject(input)
      ? Effect.succeed(input)
      : Effect.fail(new SchemaIssue.InvalidType(ast, input, options)),
  {
    expected: "a JSON object",
  },
);

export const JsonObjectSchema = Schema.declareConstructor<PutioJsonObject>()(
  [],
  () => (input, ast, options) => {
    const copies: JsonCopies = new Map();

    if (!isJsonValueWithin(input, new Set(), copies)) {
      return Effect.fail(new SchemaIssue.InvalidType(ast, input, options));
    }

    const copy = copyOfJsonValue(input, copies);

    return isJsonObjectValue(copy)
      ? Effect.succeed(copy)
      : Effect.fail(new SchemaIssue.InvalidType(ast, input, options));
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

const okEnvelopeField = (
  status: PropertyDescriptor | undefined,
  field: PropertyDescriptor | undefined,
): PropertyDescriptor | undefined =>
  status !== undefined &&
  "value" in status &&
  status.value === "OK" &&
  field !== undefined &&
  "value" in field
    ? field
    : undefined;

const makeConfigEnvelopeSchema = <A>(schema: Schema.ConstraintDecoder<A, never>) =>
  Schema.declareConstructor<{
    readonly config: A;
    readonly status: "OK";
  }>()(
    [schema],
    ([configSchema]) =>
      (input, ast, options) =>
        Effect.try({
          try: () =>
            isPlainRecord(input)
              ? okEnvelopeField(
                  Object.getOwnPropertyDescriptor(input, "status"),
                  Object.getOwnPropertyDescriptor(input, "config"),
                )
              : undefined,
          catch: () => new SchemaIssue.InvalidType(ast, input, options),
        }).pipe(
          Effect.flatMap((field) =>
            field === undefined
              ? Effect.fail(new SchemaIssue.InvalidType(ast, input, options))
              : SchemaParser.decodeUnknownEffect(configSchema)(field.value, options),
          ),
          Effect.map((config) => ({ config, status: "OK" })),
        ),
  );

const makeConfigValueEnvelopeSchema = <A>(schema: Schema.ConstraintDecoder<A, never>) =>
  Schema.declareConstructor<{
    readonly status: "OK";
    readonly value: A;
  }>()(
    [schema],
    ([valueSchema]) =>
      (input, ast, options) =>
        Effect.try({
          try: () =>
            isPlainRecord(input)
              ? okEnvelopeField(
                  Object.getOwnPropertyDescriptor(input, "status"),
                  Object.getOwnPropertyDescriptor(input, "value"),
                )
              : undefined,
          catch: () => new SchemaIssue.InvalidType(ast, input, options),
        }).pipe(
          Effect.flatMap((field) =>
            field === undefined
              ? Effect.fail(new SchemaIssue.InvalidType(ast, input, options))
              : SchemaParser.decodeUnknownEffect(valueSchema)(field.value, options),
          ),
          Effect.map((value) => ({ status: "OK", value })),
        ),
  );

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
  decodeAndRun(JsonObjectSchema, config, (decodedConfig) =>
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
  );

export const getConfigKey = (
  key: string,
): Effect.Effect<PutioJsonValue, PutioSdkError, PutioSdkContext> =>
  decodeAndRun(ConfigKeySchema, key, (decodedKey) =>
    requestJson(ConfigValueEnvelopeSchema, {
      method: "GET",
      path: `/v2/config/${encodePathSegment(decodedKey)}`,
    }),
  ).pipe(selectJsonField("value"));

export const getConfigKeyWith = <A>(
  key: string,
  schema: Schema.ConstraintDecoder<A, never>,
): Effect.Effect<A, PutioSdkError, PutioSdkContext> =>
  decodeAndRun(ConfigKeySchema, key, (decodedKey) =>
    requestJson(
      makeConfigValueEnvelopeSchema(JsonValueResponseSchema.pipe(Schema.decodeTo(schema))),
      {
        method: "GET",
        path: `/v2/config/${encodePathSegment(decodedKey)}`,
      },
    ),
  ).pipe(Effect.map((envelope) => envelope["value"]));

export const setConfigKey = (
  key: string,
  value: PutioJsonValue,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, PutioSdkError, PutioSdkContext> =>
  decodeAndRun(
    ConfigSetKeyInputSchema,
    {
      key,
      value,
    },
    (decodedInput) =>
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
  );

export const deleteConfigKey = (
  key: string,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, PutioSdkError, PutioSdkContext> =>
  decodeAndRun(ConfigKeySchema, key, (decodedKey) =>
    requestJson(OkResponseSchema, {
      method: "DELETE",
      path: `/v2/config/${encodePathSegment(decodedKey)}`,
    }),
  );
