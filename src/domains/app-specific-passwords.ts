import { Effect, Schema } from "effect";

import {
  PutioErrorEnvelopeSchema,
  definePutioOperationErrorSpec,
  mapDecodeErrorToValidationError,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import {
  OkResponseSchema,
  encodePathSegment,
  requestJson,
  selectJsonField,
  selectJsonFields,
  type PutioSdkContext,
} from "../core/http.js";

const AppSpecificPasswordIdSchema = Schema.Int.check(Schema.isGreaterThan(0));
const AppSpecificPasswordNoteSchema = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(255),
);
const MaskedIpv4AddressPattern = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}XXX$/;
const Ipv6HextetPattern = /^[\dA-Fa-f]{1,4}$/;

const isMaskedIpv6Address = (value: string): boolean => {
  const compressedParts = value.split("::");

  if (compressedParts.length > 2) {
    return false;
  }

  const hextets = compressedParts.flatMap((part) => (part === "" ? [] : part.split(":")));

  if (
    hextets.at(-1) !== "X" ||
    !hextets.slice(0, -1).every((part) => Ipv6HextetPattern.test(part))
  ) {
    return false;
  }

  return compressedParts.length === 2 ? hextets.length < 8 : hextets.length === 8;
};

const MaskedIpAddressSchema = Schema.String.check(
  Schema.makeFilter((value) =>
    MaskedIpv4AddressPattern.test(value) || isMaskedIpv6Address(value)
      ? undefined
      : "Expected a masked IP address",
  ),
);

export const AppSpecificPasswordSchema = Schema.Struct({
  created_at: Schema.String,
  id: AppSpecificPasswordIdSchema,
  ip_address: Schema.NullOr(MaskedIpAddressSchema),
  last_used_at: Schema.NullOr(Schema.String),
  note: Schema.String,
});

export const CreateAppSpecificPasswordInputSchema = Schema.Struct({
  note: AppSpecificPasswordNoteSchema,
});

const CreateAppSpecificPasswordEnvelopeSchema = AppSpecificPasswordSchema.pipe(
  Schema.fieldsAssign({
    password: Schema.String,
    status: Schema.Literal("OK"),
  }),
);

const ListAppSpecificPasswordsEnvelopeSchema = Schema.Struct({
  passwords: Schema.Array(AppSpecificPasswordSchema),
  status: Schema.Literal("OK"),
});

export type AppSpecificPassword = Schema.Schema.Type<typeof AppSpecificPasswordSchema>;
export type CreateAppSpecificPasswordInput = Schema.Schema.Type<
  typeof CreateAppSpecificPasswordInputSchema
>;
export type CreateAppSpecificPasswordResult = AppSpecificPassword & {
  readonly password: string;
};

const RestrictedAppSpecificPasswordError: {
  readonly errorType: "invalid_scope";
  readonly statusCode: 401;
} = {
  errorType: "invalid_scope",
  statusCode: 401,
};

const TooManyAppSpecificPasswordsErrorBodySchema = PutioErrorEnvelopeSchema.pipe(
  Schema.fieldsAssign({
    extra: Schema.Struct({
      limit: Schema.Int,
    }),
  }),
);

export const CreateAppSpecificPasswordErrorSpec = definePutioOperationErrorSpec({
  domain: "account",
  operation: "appSpecificPasswords.create",
  knownErrors: [
    { errorType: "NOTE_REQUIRED", statusCode: 400 as const },
    { errorType: "NOTE_TOO_LONG", statusCode: 400 as const },
    {
      bodySchema: TooManyAppSpecificPasswordsErrorBodySchema,
      errorType: "TOO_MANY_APP_SPECIFIC_PASSWORDS",
      statusCode: 403 as const,
    },
    RestrictedAppSpecificPasswordError,
  ],
});

export const ListAppSpecificPasswordsErrorSpec = definePutioOperationErrorSpec({
  domain: "account",
  operation: "appSpecificPasswords.list",
  knownErrors: [RestrictedAppSpecificPasswordError],
});

export const DeleteAppSpecificPasswordErrorSpec = definePutioOperationErrorSpec({
  domain: "account",
  operation: "appSpecificPasswords.delete",
  knownErrors: [RestrictedAppSpecificPasswordError],
});

export const DeleteAllAppSpecificPasswordsErrorSpec = definePutioOperationErrorSpec({
  domain: "account",
  operation: "appSpecificPasswords.deleteAll",
  knownErrors: [RestrictedAppSpecificPasswordError],
});

export type CreateAppSpecificPasswordError = PutioOperationFailure<
  typeof CreateAppSpecificPasswordErrorSpec
>;
export type ListAppSpecificPasswordsError = PutioOperationFailure<
  typeof ListAppSpecificPasswordsErrorSpec
>;
export type DeleteAppSpecificPasswordError = PutioOperationFailure<
  typeof DeleteAppSpecificPasswordErrorSpec
>;
export type DeleteAllAppSpecificPasswordsError = PutioOperationFailure<
  typeof DeleteAllAppSpecificPasswordsErrorSpec
>;

export const createAppSpecificPassword = (
  input: CreateAppSpecificPasswordInput,
): Effect.Effect<
  CreateAppSpecificPasswordResult,
  CreateAppSpecificPasswordError,
  PutioSdkContext
> =>
  Schema.decodeUnknownEffect(CreateAppSpecificPasswordInputSchema, {
    onExcessProperty: "error",
  })(input).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedInput) =>
      requestJson(CreateAppSpecificPasswordEnvelopeSchema, {
        body: {
          type: "form",
          value: decodedInput,
        },
        method: "POST",
        path: "/v2/app_specific_password/create",
      }),
    ),
    selectJsonFields("created_at", "id", "ip_address", "last_used_at", "note", "password"),
    withOperationErrors(CreateAppSpecificPasswordErrorSpec),
  );

export const listAppSpecificPasswords = (): Effect.Effect<
  ReadonlyArray<AppSpecificPassword>,
  ListAppSpecificPasswordsError,
  PutioSdkContext
> =>
  requestJson(ListAppSpecificPasswordsEnvelopeSchema, {
    method: "GET",
    path: "/v2/app_specific_password/list",
  }).pipe(selectJsonField("passwords"), withOperationErrors(ListAppSpecificPasswordsErrorSpec));

export const deleteAppSpecificPassword = (
  id: number,
): Effect.Effect<void, DeleteAppSpecificPasswordError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(AppSpecificPasswordIdSchema)(id).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedId) =>
      requestJson(OkResponseSchema, {
        method: "POST",
        path: `/v2/app_specific_password/${encodePathSegment(decodedId)}/delete`,
      }),
    ),
    Effect.asVoid,
    withOperationErrors(DeleteAppSpecificPasswordErrorSpec),
  );

export const deleteAllAppSpecificPasswords = (): Effect.Effect<
  void,
  DeleteAllAppSpecificPasswordsError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: "/v2/app_specific_password/delete_all",
  }).pipe(Effect.asVoid, withOperationErrors(DeleteAllAppSpecificPasswordsErrorSpec));
