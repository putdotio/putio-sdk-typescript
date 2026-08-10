import { Effect, Schema } from "effect";
import {
  PutioApiError,
  PutioValidationError,
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
  type PutioSdkError,
} from "../core/errors.js";
import {
  OkResponseSchema,
  buildPutioUrl,
  encodePathSegment,
  requestJson,
  selectJsonField,
  selectJsonFields,
  type PutioSdkContext,
} from "../core/http.js";
import { NonEmptyStringSchema, PositiveIntegerSchema } from "../core/validation.js";
import { OAuthAppSchema, OAuthAppSessionSchema } from "./oauth.js";
export const LoginResponseSchema = Schema.Struct({
  access_token: Schema.String,
  user_id: Schema.Int,
});
const OAuthAuthorizationCodeResponseSchema = Schema.Struct({
  access_token: Schema.String,
});
export const OAuthAuthorizationCodeExchangeErrorCodeSchema = Schema.Literals([
  "access_denied",
  "invalid_request",
  "unauthorized_client",
]);
export class OAuthAuthorizationCodeExchangeError extends Schema.TaggedError<OAuthAuthorizationCodeExchangeError>()(
  "OAuthAuthorizationCodeExchangeError",
  {
    code: OAuthAuthorizationCodeExchangeErrorCodeSchema,
    status: Schema.Literal(400),
  },
) {}
const TokenScopeSchema = Schema.NullOr(
  Schema.Literals([
    "default",
    "two_factor",
    "files_public_access",
    "files_download",
    "token_validate",
  ]),
);
export const ValidateTokenResponseSchema = Schema.Struct({
  result: Schema.Boolean,
  token_id: Schema.NullOr(Schema.Int),
  token_scope: TokenScopeSchema,
  user_id: Schema.NullOr(Schema.Int),
});
const RecoveryCodeEntrySchema = Schema.Struct({
  code: Schema.String,
  used_at: Schema.NullOr(Schema.String),
});
export const TwoFactorRecoveryCodesSchema = Schema.Struct({
  codes: Schema.Array(RecoveryCodeEntrySchema),
  created_at: Schema.String,
});
export const GenerateTOTPResponseSchema = Schema.Struct({
  recovery_codes: TwoFactorRecoveryCodesSchema,
  secret: Schema.String,
  uri: Schema.String,
});
export const VerifyTOTPResponseSchema = Schema.Struct({
  token: Schema.String,
  user_id: Schema.Int,
});
export const AuthorizationCodeSchema = Schema.Struct({
  code: Schema.String,
  qr_code_url: Schema.String,
});
const AuthorizationCodeEnvelopeSchema = Schema.Struct({
  code: Schema.String,
  qr_code_url: Schema.String,
  status: Schema.Literal("OK"),
});
const CodeMatchEnvelopeSchema = Schema.Struct({
  oauth_token: Schema.NullOr(Schema.String),
  status: Schema.Literal("OK"),
});
const LinkDeviceEnvelopeSchema = Schema.Struct({
  app: OAuthAppSchema,
  status: Schema.Literal("OK"),
});
const GrantsEnvelopeSchema = Schema.Struct({
  apps: Schema.Array(OAuthAppSchema),
  status: Schema.Literal("OK"),
});
const ClientsEnvelopeSchema = Schema.Struct({
  clients: Schema.Array(OAuthAppSessionSchema),
  status: Schema.Literal("OK"),
});
const VoucherEnvelopeSchema = Schema.Struct({
  status: Schema.Literal("OK"),
  voucher: Schema.Struct({
    days: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    owner: Schema.NullOr(Schema.String),
  }),
});
const GiftCardEnvelopeSchema = Schema.Struct({
  gift_card: Schema.Struct({
    days: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    plan: Schema.Boolean,
  }),
  status: Schema.Literal("OK"),
});
const FamilyInviteEnvelopeSchema = Schema.Struct({
  invite: Schema.Struct({
    owner: Schema.String,
    plan: Schema.String,
  }),
  status: Schema.Literal("OK"),
});
const FriendInviteEnvelopeSchema = Schema.Struct({
  invite: Schema.Struct({
    inviter: Schema.String,
    plan: Schema.Struct({
      code: Schema.String,
      name: Schema.String,
      period: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    }),
  }),
  status: Schema.Literal("OK"),
});
const ExistsEnvelopeSchema = Schema.Struct({
  exists: Schema.Boolean,
  status: Schema.Literal("OK"),
});
const ResetPasswordEnvelopeSchema = Schema.Struct({
  access_token: Schema.String,
  status: Schema.Literal("OK"),
});
const GenerateTOTPEnvelopeSchema = Schema.Struct({
  recovery_codes: TwoFactorRecoveryCodesSchema,
  secret: Schema.String,
  status: Schema.Literal("OK"),
  uri: Schema.String,
});
const VerifyTOTPEnvelopeSchema = Schema.Struct({
  status: Schema.Literal("OK"),
  token: Schema.String,
  user_id: Schema.Int,
});
const RecoveryCodesEnvelopeSchema = Schema.Struct({
  recovery_codes: TwoFactorRecoveryCodesSchema,
  status: Schema.Literal("OK"),
});
const AuthClientIdSchema = Schema.Union([NonEmptyStringSchema, PositiveIntegerSchema]);
const LoginInputSchema = Schema.Struct({
  callbackUrl: Schema.optional(NonEmptyStringSchema),
  clientId: AuthClientIdSchema,
  clientName: Schema.optional(NonEmptyStringSchema),
  clientSecret: NonEmptyStringSchema,
  fingerprint: Schema.optional(NonEmptyStringSchema),
  password: NonEmptyStringSchema,
  username: NonEmptyStringSchema,
});
export const RegisterInputSchema = Schema.Struct({
  client_id: AuthClientIdSchema,
  family_invite_code: Schema.optional(NonEmptyStringSchema),
  friend_invite_code: Schema.optional(NonEmptyStringSchema),
  gift_card_confirmation_code: Schema.optional(NonEmptyStringSchema),
  mail: NonEmptyStringSchema,
  password: NonEmptyStringSchema,
  plan_name: Schema.optional(NonEmptyStringSchema),
  username: NonEmptyStringSchema,
  voucher_code: Schema.optional(NonEmptyStringSchema),
});
export const OAuthAuthorizationCodeExchangeInputSchema = Schema.Struct({
  clientId: AuthClientIdSchema,
  clientSecret: NonEmptyStringSchema,
  code: NonEmptyStringSchema,
  redirectUri: Schema.optional(NonEmptyStringSchema),
});
const AuthExistsInputSchema = Schema.Struct({
  key: Schema.Literals(["mail", "username"]),
  value: NonEmptyStringSchema,
});
const AuthResetPasswordInputSchema = Schema.Struct({
  key: NonEmptyStringSchema,
  password: NonEmptyStringSchema,
});
const AuthGetCodeInputSchema = Schema.Struct({
  appId: AuthClientIdSchema,
  clientName: Schema.optional(NonEmptyStringSchema),
});
const AuthVerifyTotpInputSchema = Schema.Struct({
  code: NonEmptyStringSchema,
  twoFactorScopedToken: NonEmptyStringSchema,
});
export type LoginResponse = Schema.Schema.Type<typeof LoginResponseSchema>;
export type ValidateTokenResponse = Schema.Schema.Type<typeof ValidateTokenResponseSchema>;
export type TwoFactorRecoveryCodes = Schema.Schema.Type<typeof TwoFactorRecoveryCodesSchema>;
export type GenerateTOTPResponse = Schema.Schema.Type<typeof GenerateTOTPResponseSchema>;
export type VerifyTOTPResponse = Schema.Schema.Type<typeof VerifyTOTPResponseSchema>;
export type RegisterInput = Schema.Schema.Type<typeof RegisterInputSchema>;
export type LoginInput = Schema.Schema.Type<typeof LoginInputSchema>;
export type AuthGetCodeInput = Schema.Schema.Type<typeof AuthGetCodeInputSchema>;
export type OAuthAuthorizationCodeExchangeInput = Schema.Schema.Type<
  typeof OAuthAuthorizationCodeExchangeInputSchema
>;
export const LoginErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "login",
  knownErrors: [
    { statusCode: 401 as const },
    { errorType: "invalid_app_credentials", statusCode: 403 as const },
    { errorType: "password_reset_required", statusCode: 403 as const },
  ],
});
export const RegisterErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "register",
  knownErrors: [
    { errorType: "INVALID_USERNAME", statusCode: 400 as const },
    { errorType: "INVALID_MAIL", statusCode: 400 as const },
    { errorType: "REDEEMED_VOUCHER_CODE", statusCode: 400 as const },
    { errorType: "USERNAME_EXISTS", statusCode: 400 as const },
    { errorType: "MAIL_EXISTS", statusCode: 400 as const },
    { errorType: "PWNED_NEW_PASSWORD", statusCode: 400 as const },
    { errorType: "DISPOSABLE_MAIL_NOT_ALLOWED", statusCode: 400 as const },
    { statusCode: 403 as const },
    { errorType: "CLIENT_NOT_FOUND", statusCode: 404 as const },
    { errorType: "INVALID_VOUCHER_CODE", statusCode: 404 as const },
    { errorType: "INVALID_GIFT_CARD_CONFIRMATION_CODE", statusCode: 404 as const },
    { errorType: "FAMILY_INVITE_INVALID_CODE", statusCode: 404 as const },
    { errorType: "FAMILY_INVITE_OWNER_NOT_ACTIVE", statusCode: 404 as const },
    { errorType: "FRIEND_INVITE_INVALID_CODE", statusCode: 404 as const },
    { errorType: "FRIEND_INVITE_OWNER_NOT_ACTIVE", statusCode: 404 as const },
    { errorType: "PLAN_NOT_FOUND", statusCode: 404 as const },
  ],
});
export const VoucherLookupErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "getVoucher",
  knownErrors: [{ errorType: "INVALID_VOUCHER_CODE", statusCode: 404 as const }],
});
export const GiftCardLookupErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "getGiftCard",
  knownErrors: [{ errorType: "INVALID_CONFIRMATION_CODE", statusCode: 404 as const }],
});
export const FamilyInviteLookupErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "getFamilyInvite",
  knownErrors: [{ errorType: "INVALID_FAMILY_INVITE_CODE", statusCode: 404 as const }],
});
export const FriendInviteLookupErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "getFriendInvite",
  knownErrors: [
    { errorType: "INVALID_FRIEND_INVITE_CODE", statusCode: 404 as const },
    { errorType: "FRIEND_INVITE_INVALID_CODE", statusCode: 404 as const },
  ],
});
export const ForgotPasswordErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "forgotPassword",
  knownErrors: [{ statusCode: 404 as const }],
});
export const ResetPasswordErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "resetPassword",
  knownErrors: [
    { errorType: "INVALID_PASSWORD_RESET_KEY", statusCode: 400 as const },
    { errorType: "PWNED_NEW_PASSWORD", statusCode: 400 as const },
  ],
});
export const LinkDeviceErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "linkDevice",
  knownErrors: [{ statusCode: 404 as const }],
});
export const GrantsErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "grants",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});
export const ClientsErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "clients",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});
export const RevokeOAuthGrantErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "revokeApp",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});
export const RevokeOAuthClientErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "revokeClient",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});
export const RevokeAllOAuthClientsErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "revokeAllClients",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});
export const GenerateTOTPErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "generateTOTP",
  knownErrors: [
    { errorType: "already_exists", statusCode: 403 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
  ],
});
export const VerifyTOTPErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "verifyTOTP",
  knownErrors: [
    { errorType: "invalid_setup", statusCode: 400 as const },
    { errorType: "invalid_code", statusCode: 400 as const },
    { errorType: "code_not_found", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
  ],
});
export const RecoveryCodesErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "getRecoveryCodes",
  knownErrors: [
    { errorType: "invalid_setup", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
  ],
});
export const RegenerateRecoveryCodesErrorSpec = definePutioOperationErrorSpec({
  domain: "auth",
  operation: "regenerateRecoveryCodes",
  knownErrors: [
    { errorType: "invalid_setup", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
  ],
});
export type LoginError = PutioOperationFailure<typeof LoginErrorSpec>;
export type RegisterError = PutioOperationFailure<typeof RegisterErrorSpec>;
export type VoucherLookupError = PutioOperationFailure<typeof VoucherLookupErrorSpec>;
export type GiftCardLookupError = PutioOperationFailure<typeof GiftCardLookupErrorSpec>;
export type FamilyInviteLookupError = PutioOperationFailure<typeof FamilyInviteLookupErrorSpec>;
export type FriendInviteLookupError = PutioOperationFailure<typeof FriendInviteLookupErrorSpec>;
export type ForgotPasswordError = PutioOperationFailure<typeof ForgotPasswordErrorSpec>;
export type ResetPasswordError = PutioOperationFailure<typeof ResetPasswordErrorSpec>;
export type LinkDeviceError = PutioOperationFailure<typeof LinkDeviceErrorSpec>;
export type GrantsError = PutioOperationFailure<typeof GrantsErrorSpec>;
export type ClientsError = PutioOperationFailure<typeof ClientsErrorSpec>;
export type RevokeOAuthGrantError = PutioOperationFailure<typeof RevokeOAuthGrantErrorSpec>;
export type RevokeOAuthClientError = PutioOperationFailure<typeof RevokeOAuthClientErrorSpec>;
export type RevokeAllOAuthClientsError = PutioOperationFailure<
  typeof RevokeAllOAuthClientsErrorSpec
>;
export type GenerateTOTPError = PutioOperationFailure<typeof GenerateTOTPErrorSpec>;
export type VerifyTOTPError = PutioOperationFailure<typeof VerifyTOTPErrorSpec>;
export type RecoveryCodesError = PutioOperationFailure<typeof RecoveryCodesErrorSpec>;
export type RegenerateRecoveryCodesError = PutioOperationFailure<
  typeof RegenerateRecoveryCodesErrorSpec
>;
const decodeAuthInput = <S extends Schema.Top, A, E, R>(
  operation: string,
  schema: S,
  input: unknown,
  run: (decoded: S["Type"]) => Effect.Effect<A, E, R>,
) =>
  Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(
      () =>
        new PutioValidationError({
          cause: {
            domain: "auth",
            operation,
            reason: "Invalid request input",
          },
        }),
    ),
    Effect.flatMap(run),
  );
export const buildAuthLoginUrl = (options: {
  readonly clientId: string | number;
  readonly redirectUri: string;
  readonly responseType?: string;
  readonly state: string;
  readonly clientName?: string;
  readonly webAppUrl?: string | URL;
}) =>
  buildPutioUrl(options.webAppUrl ?? "https://app.put.io", "/authenticate", {
    client_id: options.clientId,
    client_name: options.clientName,
    isolated: 1,
    redirect_uri: options.redirectUri,
    response_type: options.responseType ?? "token",
    state: options.state,
  });
const isOAuthAuthorizationCodeExchangeErrorCode = Schema.is(
  OAuthAuthorizationCodeExchangeErrorCodeSchema,
);
const mapOAuthAuthorizationCodeExchangeError = (
  error: PutioSdkError,
): PutioSdkError | OAuthAuthorizationCodeExchangeError =>
  error instanceof PutioApiError &&
  error.status === 400 &&
  isOAuthAuthorizationCodeExchangeErrorCode(error.body.error)
    ? new OAuthAuthorizationCodeExchangeError({
        code: error.body.error,
        status: 400,
      })
    : error;
export const exchangeOAuthAuthorizationCode = (
  input: OAuthAuthorizationCodeExchangeInput,
): Effect.Effect<string, PutioSdkError | OAuthAuthorizationCodeExchangeError, PutioSdkContext> =>
  decodeAuthInput(
    "exchangeAuthorizationCode",
    OAuthAuthorizationCodeExchangeInputSchema,
    input,
    (decodedInput) =>
      requestJson(OAuthAuthorizationCodeResponseSchema, {
        auth: { type: "none" },
        body: {
          type: "form",
          value: {
            client_id: decodedInput.clientId,
            client_secret: decodedInput.clientSecret,
            code: decodedInput.code,
            grant_type: "authorization_code",
            redirect_uri: decodedInput.redirectUri,
          },
        },
        method: "POST",
        path: "/v2/oauth2/access_token",
      }).pipe(
        selectJsonField("access_token"),
        Effect.mapError(mapOAuthAuthorizationCodeExchangeError),
      ),
  );
export const login = (
  input: LoginInput,
): Effect.Effect<LoginResponse, LoginError, PutioSdkContext> =>
  decodeAuthInput("login", LoginInputSchema, input, (decodedInput) =>
    requestJson(LoginResponseSchema, {
      auth: {
        type: "basic",
        password: decodedInput.password,
        username: decodedInput.username,
      },
      method: "PUT",
      path: decodedInput.fingerprint
        ? `/v2/oauth2/authorizations/clients/${encodePathSegment(decodedInput.clientId)}/${encodePathSegment(decodedInput.fingerprint)}`
        : `/v2/oauth2/authorizations/clients/${encodePathSegment(decodedInput.clientId)}`,
      query: {
        callback_url: decodedInput.callbackUrl,
        client_name: decodedInput.clientName,
        client_secret: decodedInput.clientSecret,
      },
    }).pipe(selectJsonFields("access_token", "user_id")),
  ).pipe(withOperationErrors(LoginErrorSpec));
export const logout = (): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  PutioSdkError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: "/v2/oauth/grants/logout",
  });
export const register = (
  input: RegisterInput,
): Effect.Effect<
  {
    readonly access_token: string;
  },
  RegisterError,
  PutioSdkContext
> =>
  decodeAuthInput("register", RegisterInputSchema, input, (decodedInput) =>
    requestJson(ResetPasswordEnvelopeSchema, {
      auth: {
        type: "none",
      },
      body: {
        type: "form",
        value: decodedInput,
      },
      method: "POST",
      path: "/v2/registration/register",
    }).pipe(selectJsonFields("access_token")),
  ).pipe(withOperationErrors(RegisterErrorSpec));
export const exists = (
  key: "mail" | "username",
  value: string,
): Effect.Effect<boolean, PutioSdkError, PutioSdkContext> =>
  decodeAuthInput("exists", AuthExistsInputSchema, { key, value }, (decodedInput) =>
    requestJson(ExistsEnvelopeSchema, {
      auth: {
        type: "none",
      },
      method: "GET",
      path: `/v2/registration/exists/${encodePathSegment(decodedInput.key)}`,
      query: {
        value: decodedInput.value,
      },
    }).pipe(selectJsonField("exists")),
  );
export const getVoucher = (
  code: string,
): Effect.Effect<
  Schema.Schema.Type<typeof VoucherEnvelopeSchema>["voucher"],
  VoucherLookupError,
  PutioSdkContext
> =>
  decodeAuthInput("getVoucher", NonEmptyStringSchema, code, (decodedCode) =>
    requestJson(VoucherEnvelopeSchema, {
      auth: {
        type: "none",
      },
      method: "GET",
      path: `/v2/registration/voucher/${encodePathSegment(decodedCode)}`,
    }).pipe(selectJsonField("voucher")),
  ).pipe(withOperationErrors(VoucherLookupErrorSpec));
export const getGiftCard = (
  code: string,
): Effect.Effect<
  Schema.Schema.Type<typeof GiftCardEnvelopeSchema>["gift_card"],
  GiftCardLookupError,
  PutioSdkContext
> =>
  decodeAuthInput("getGiftCard", NonEmptyStringSchema, code, (decodedCode) =>
    requestJson(GiftCardEnvelopeSchema, {
      auth: {
        type: "none",
      },
      method: "GET",
      path: `/v2/registration/gift_card/${encodePathSegment(decodedCode)}`,
    }).pipe(selectJsonField("gift_card")),
  ).pipe(withOperationErrors(GiftCardLookupErrorSpec));
export const getFamilyInvite = (
  code: string,
): Effect.Effect<
  Schema.Schema.Type<typeof FamilyInviteEnvelopeSchema>["invite"],
  FamilyInviteLookupError,
  PutioSdkContext
> =>
  decodeAuthInput("getFamilyInvite", NonEmptyStringSchema, code, (decodedCode) =>
    requestJson(FamilyInviteEnvelopeSchema, {
      auth: {
        type: "none",
      },
      method: "GET",
      path: `/v2/registration/family/${encodePathSegment(decodedCode)}`,
    }).pipe(selectJsonField("invite")),
  ).pipe(withOperationErrors(FamilyInviteLookupErrorSpec));
export const getFriendInvite = (
  code: string,
): Effect.Effect<
  Schema.Schema.Type<typeof FriendInviteEnvelopeSchema>["invite"],
  FriendInviteLookupError,
  PutioSdkContext
> =>
  decodeAuthInput("getFriendInvite", NonEmptyStringSchema, code, (decodedCode) =>
    requestJson(FriendInviteEnvelopeSchema, {
      auth: {
        type: "none",
      },
      method: "GET",
      path: `/v2/registration/friend/${encodePathSegment(decodedCode)}`,
    }).pipe(selectJsonField("invite")),
  ).pipe(withOperationErrors(FriendInviteLookupErrorSpec));
export const forgotPassword = (
  mail: string,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  ForgotPasswordError,
  PutioSdkContext
> =>
  decodeAuthInput("forgotPassword", NonEmptyStringSchema, mail, (decodedMail) =>
    requestJson(OkResponseSchema, {
      auth: {
        type: "none",
      },
      body: {
        type: "form",
        value: {
          mail: decodedMail,
        },
      },
      method: "POST",
      path: "/v2/registration/password/forgot",
    }),
  ).pipe(withOperationErrors(ForgotPasswordErrorSpec));
export const resetPassword = (
  key: string,
  password: string,
): Effect.Effect<
  {
    readonly access_token: string;
  },
  ResetPasswordError,
  PutioSdkContext
> =>
  decodeAuthInput(
    "resetPassword",
    AuthResetPasswordInputSchema,
    { key, password },
    (decodedInput) =>
      requestJson(ResetPasswordEnvelopeSchema, {
        auth: {
          type: "none",
        },
        body: {
          type: "form",
          value: decodedInput,
        },
        method: "POST",
        path: "/v2/registration/password/reset",
      }).pipe(selectJsonFields("access_token")),
  ).pipe(withOperationErrors(ResetPasswordErrorSpec));
export const getCode = (
  input: AuthGetCodeInput,
): Effect.Effect<
  Schema.Schema.Type<typeof AuthorizationCodeSchema>,
  PutioSdkError,
  PutioSdkContext
> =>
  decodeAuthInput("getCode", AuthGetCodeInputSchema, input, (decodedInput) =>
    requestJson(AuthorizationCodeEnvelopeSchema, {
      auth: {
        type: "none",
      },
      method: "GET",
      path: "/v2/oauth2/oob/code",
      query: {
        app_id: decodedInput.appId,
        client_name: decodedInput.clientName,
      },
    }).pipe(selectJsonFields("code", "qr_code_url")),
  );
export const checkCodeMatch = (
  code: string,
): Effect.Effect<string | null, PutioSdkError, PutioSdkContext> =>
  decodeAuthInput("checkCodeMatch", NonEmptyStringSchema, code, (decodedCode) =>
    requestJson(CodeMatchEnvelopeSchema, {
      auth: {
        type: "none",
      },
      method: "GET",
      path: `/v2/oauth2/oob/code/${encodePathSegment(decodedCode)}`,
    }).pipe(selectJsonField("oauth_token")),
  );
export const linkDevice = (
  code: string,
): Effect.Effect<Schema.Schema.Type<typeof OAuthAppSchema>, LinkDeviceError, PutioSdkContext> =>
  decodeAuthInput("linkDevice", NonEmptyStringSchema, code, (decodedCode) =>
    requestJson(LinkDeviceEnvelopeSchema, {
      body: {
        type: "form",
        value: {
          code: decodedCode,
        },
      },
      method: "POST",
      path: "/v2/oauth2/oob/code",
    }).pipe(selectJsonField("app")),
  ).pipe(withOperationErrors(LinkDeviceErrorSpec));
export const grants = (): Effect.Effect<
  ReadonlyArray<Schema.Schema.Type<typeof OAuthAppSchema>>,
  GrantsError,
  PutioSdkContext
> =>
  requestJson(GrantsEnvelopeSchema, {
    method: "GET",
    path: "/v2/oauth/grants/",
  }).pipe(selectJsonField("apps"), withOperationErrors(GrantsErrorSpec));
export const revokeApp = (
  id: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  RevokeOAuthGrantError,
  PutioSdkContext
> =>
  decodeAuthInput("revokeApp", PositiveIntegerSchema, id, (decodedId) =>
    requestJson(OkResponseSchema, {
      method: "POST",
      path: `/v2/oauth/grants/${encodePathSegment(decodedId)}/delete`,
    }),
  ).pipe(withOperationErrors(RevokeOAuthGrantErrorSpec));
export const clients = (): Effect.Effect<
  ReadonlyArray<Schema.Schema.Type<typeof OAuthAppSessionSchema>>,
  ClientsError,
  PutioSdkContext
> =>
  requestJson(ClientsEnvelopeSchema, {
    method: "GET",
    path: "/v2/oauth/clients/",
  }).pipe(selectJsonField("clients"), withOperationErrors(ClientsErrorSpec));
export const revokeClient = (
  id: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  RevokeOAuthClientError,
  PutioSdkContext
> =>
  decodeAuthInput("revokeClient", PositiveIntegerSchema, id, (decodedId) =>
    requestJson(OkResponseSchema, {
      method: "POST",
      path: `/v2/oauth/clients/${encodePathSegment(decodedId)}/delete`,
    }),
  ).pipe(withOperationErrors(RevokeOAuthClientErrorSpec));
export const revokeAllClients = (): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  RevokeAllOAuthClientsError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: "/v2/oauth/clients/delete-all",
  }).pipe(withOperationErrors(RevokeAllOAuthClientsErrorSpec));
export const validateToken = (
  token: string,
): Effect.Effect<ValidateTokenResponse, PutioSdkError, PutioSdkContext> =>
  decodeAuthInput("validateToken", NonEmptyStringSchema, token, (decodedToken) =>
    requestJson(ValidateTokenResponseSchema, {
      auth: {
        type: "none",
      },
      method: "GET",
      path: "/v2/oauth2/validate",
      query: {
        oauth_token: decodedToken,
      },
    }),
  );
export const generateTOTP = (): Effect.Effect<
  GenerateTOTPResponse,
  GenerateTOTPError,
  PutioSdkContext
> =>
  requestJson(GenerateTOTPEnvelopeSchema, {
    method: "POST",
    path: "/v2/two_factor/generate/totp",
  }).pipe(
    Effect.map(({ recovery_codes, secret, uri }) => ({
      recovery_codes,
      secret,
      uri,
    })),
    withOperationErrors(GenerateTOTPErrorSpec),
  );
export const verifyTOTP = (
  twoFactorScopedToken: string,
  code: string,
): Effect.Effect<VerifyTOTPResponse, VerifyTOTPError, PutioSdkContext> =>
  decodeAuthInput(
    "verifyTOTP",
    AuthVerifyTotpInputSchema,
    { code, twoFactorScopedToken },
    (decodedInput) =>
      requestJson(VerifyTOTPEnvelopeSchema, {
        auth: {
          type: "none",
        },
        body: {
          type: "form",
          value: {
            code: decodedInput.code,
          },
        },
        method: "POST",
        path: "/v2/two_factor/verify/totp",
        query: {
          oauth_token: decodedInput.twoFactorScopedToken,
        },
      }).pipe(
        Effect.map(({ token, user_id }) => ({
          token,
          user_id,
        })),
      ),
  ).pipe(withOperationErrors(VerifyTOTPErrorSpec));
export const getRecoveryCodes = (): Effect.Effect<
  TwoFactorRecoveryCodes,
  RecoveryCodesError,
  PutioSdkContext
> =>
  requestJson(RecoveryCodesEnvelopeSchema, {
    method: "GET",
    path: "/v2/two_factor/recovery_codes",
  }).pipe(selectJsonField("recovery_codes"), withOperationErrors(RecoveryCodesErrorSpec));
export const regenerateRecoveryCodes = (): Effect.Effect<
  TwoFactorRecoveryCodes,
  RegenerateRecoveryCodesError,
  PutioSdkContext
> =>
  requestJson(RecoveryCodesEnvelopeSchema, {
    method: "POST",
    path: "/v2/two_factor/recovery_codes/refresh",
  }).pipe(selectJsonField("recovery_codes"), withOperationErrors(RegenerateRecoveryCodesErrorSpec));
