import { Effect, Schema } from "effect";

import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
  type PutioSdkError,
} from "../core/errors.js";
import {
  OkResponseSchema,
  buildPutioUrl,
  requestJson,
  selectJsonField,
  selectJsonFields,
  type PutioSdkContext,
} from "../core/http.js";
import { OAuthAppSchema, OAuthAppSessionSchema } from "./oauth.js";

export const LoginResponseSchema = Schema.Struct({
  access_token: Schema.String,
  user_id: Schema.Number.pipe(Schema.int()),
});

const TokenScopeSchema = Schema.NullOr(
  Schema.Literal(
    "default",
    "two_factor",
    "files_public_access",
    "files_download",
    "token_validate",
  ),
);

export const ValidateTokenResponseSchema = Schema.Struct({
  result: Schema.Boolean,
  token_id: Schema.NullOr(Schema.Number.pipe(Schema.int())),
  token_scope: TokenScopeSchema,
  user_id: Schema.NullOr(Schema.Number.pipe(Schema.int())),
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
  user_id: Schema.Number.pipe(Schema.int()),
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
    days: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    owner: Schema.NullOr(Schema.String),
  }),
});

const GiftCardEnvelopeSchema = Schema.Struct({
  gift_card: Schema.Struct({
    days: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
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
      period: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
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
  user_id: Schema.Number.pipe(Schema.int()),
});

const RecoveryCodesEnvelopeSchema = Schema.Struct({
  recovery_codes: TwoFactorRecoveryCodesSchema,
  status: Schema.Literal("OK"),
});

export const RegisterInputSchema = Schema.Struct({
  client_id: Schema.Union(Schema.String, Schema.Number.pipe(Schema.int())),
  family_invite_code: Schema.optional(Schema.String),
  friend_invite_code: Schema.optional(Schema.String),
  gift_card_confirmation_code: Schema.optional(Schema.String),
  mail: Schema.String,
  password: Schema.String,
  plan_name: Schema.optional(Schema.String),
  username: Schema.String,
  voucher_code: Schema.optional(Schema.String),
});

export type LoginResponse = Schema.Schema.Type<typeof LoginResponseSchema>;
export type ValidateTokenResponse = Schema.Schema.Type<typeof ValidateTokenResponseSchema>;
export type TwoFactorRecoveryCodes = Schema.Schema.Type<typeof TwoFactorRecoveryCodesSchema>;
export type GenerateTOTPResponse = Schema.Schema.Type<typeof GenerateTOTPResponseSchema>;
export type VerifyTOTPResponse = Schema.Schema.Type<typeof VerifyTOTPResponseSchema>;
export type RegisterInput = Schema.Schema.Type<typeof RegisterInputSchema>;

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

export const login = (input: {
  readonly clientId: string | number;
  readonly clientSecret: string;
  readonly password: string;
  readonly username: string;
  readonly clientName?: string;
  readonly fingerprint?: string;
}): Effect.Effect<LoginResponse, LoginError, PutioSdkContext> =>
  requestJson(LoginResponseSchema, {
    auth: {
      type: "basic",
      password: input.password,
      username: input.username,
    },
    method: "PUT",
    path: input.fingerprint
      ? `/v2/oauth2/authorizations/clients/${input.clientId}/${input.fingerprint}`
      : `/v2/oauth2/authorizations/clients/${input.clientId}`,
    query: {
      client_name: input.clientName,
      client_secret: input.clientSecret,
    },
  }).pipe(selectJsonFields("access_token", "user_id"), withOperationErrors(LoginErrorSpec));

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
): Effect.Effect<{ readonly access_token: string }, RegisterError, PutioSdkContext> =>
  requestJson(ResetPasswordEnvelopeSchema, {
    auth: {
      type: "none",
    },
    body: {
      type: "form",
      value: input,
    },
    method: "POST",
    path: "/v2/registration/register",
  }).pipe(selectJsonFields("access_token"), withOperationErrors(RegisterErrorSpec));

export const exists = (
  key: "mail" | "username",
  value: string,
): Effect.Effect<boolean, PutioSdkError, PutioSdkContext> =>
  requestJson(ExistsEnvelopeSchema, {
    auth: {
      type: "none",
    },
    method: "GET",
    path: `/v2/registration/exists/${key}`,
    query: {
      value,
    },
  }).pipe(selectJsonField("exists"));

export const getVoucher = (
  code: string,
): Effect.Effect<
  Schema.Schema.Type<typeof VoucherEnvelopeSchema>["voucher"],
  VoucherLookupError,
  PutioSdkContext
> =>
  requestJson(VoucherEnvelopeSchema, {
    auth: {
      type: "none",
    },
    method: "GET",
    path: `/v2/registration/voucher/${code}`,
  }).pipe(selectJsonField("voucher"), withOperationErrors(VoucherLookupErrorSpec));

export const getGiftCard = (
  code: string,
): Effect.Effect<
  Schema.Schema.Type<typeof GiftCardEnvelopeSchema>["gift_card"],
  GiftCardLookupError,
  PutioSdkContext
> =>
  requestJson(GiftCardEnvelopeSchema, {
    auth: {
      type: "none",
    },
    method: "GET",
    path: `/v2/registration/gift_card/${code}`,
  }).pipe(selectJsonField("gift_card"), withOperationErrors(GiftCardLookupErrorSpec));

export const getFamilyInvite = (
  code: string,
): Effect.Effect<
  Schema.Schema.Type<typeof FamilyInviteEnvelopeSchema>["invite"],
  FamilyInviteLookupError,
  PutioSdkContext
> =>
  requestJson(FamilyInviteEnvelopeSchema, {
    auth: {
      type: "none",
    },
    method: "GET",
    path: `/v2/registration/family/${code}`,
  }).pipe(selectJsonField("invite"), withOperationErrors(FamilyInviteLookupErrorSpec));

export const getFriendInvite = (
  code: string,
): Effect.Effect<
  Schema.Schema.Type<typeof FriendInviteEnvelopeSchema>["invite"],
  FriendInviteLookupError,
  PutioSdkContext
> =>
  requestJson(FriendInviteEnvelopeSchema, {
    auth: {
      type: "none",
    },
    method: "GET",
    path: `/v2/registration/friend/${code}`,
  }).pipe(selectJsonField("invite"), withOperationErrors(FriendInviteLookupErrorSpec));

export const forgotPassword = (
  mail: string,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  ForgotPasswordError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    auth: {
      type: "none",
    },
    body: {
      type: "form",
      value: {
        mail,
      },
    },
    method: "POST",
    path: "/v2/registration/password/forgot",
  }).pipe(withOperationErrors(ForgotPasswordErrorSpec));

export const resetPassword = (
  key: string,
  password: string,
): Effect.Effect<{ readonly access_token: string }, ResetPasswordError, PutioSdkContext> =>
  requestJson(ResetPasswordEnvelopeSchema, {
    auth: {
      type: "none",
    },
    body: {
      type: "form",
      value: {
        key,
        password,
      },
    },
    method: "POST",
    path: "/v2/registration/password/reset",
  }).pipe(selectJsonFields("access_token"), withOperationErrors(ResetPasswordErrorSpec));

export const getCode = (input: {
  readonly appId: number | string;
  readonly clientName?: string;
}): Effect.Effect<
  Schema.Schema.Type<typeof AuthorizationCodeSchema>,
  PutioSdkError,
  PutioSdkContext
> =>
  requestJson(AuthorizationCodeEnvelopeSchema, {
    auth: {
      type: "none",
    },
    method: "GET",
    path: "/v2/oauth2/oob/code",
    query: {
      app_id: input.appId,
      client_name: input.clientName,
    },
  }).pipe(selectJsonFields("code", "qr_code_url"));

export const checkCodeMatch = (
  code: string,
): Effect.Effect<string | null, PutioSdkError, PutioSdkContext> =>
  requestJson(CodeMatchEnvelopeSchema, {
    auth: {
      type: "none",
    },
    method: "GET",
    path: `/v2/oauth2/oob/code/${code}`,
  }).pipe(selectJsonField("oauth_token"));

export const linkDevice = (
  code: string,
): Effect.Effect<Schema.Schema.Type<typeof OAuthAppSchema>, LinkDeviceError, PutioSdkContext> =>
  requestJson(LinkDeviceEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        code,
      },
    },
    method: "POST",
    path: "/v2/oauth2/oob/code",
  }).pipe(selectJsonField("app"), withOperationErrors(LinkDeviceErrorSpec));

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
  requestJson(OkResponseSchema, {
    method: "POST",
    path: `/v2/oauth/grants/${id}/delete`,
  }).pipe(withOperationErrors(RevokeOAuthGrantErrorSpec));

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
  requestJson(OkResponseSchema, {
    method: "POST",
    path: `/v2/oauth/clients/${id}/delete`,
  }).pipe(withOperationErrors(RevokeOAuthClientErrorSpec));

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
  requestJson(ValidateTokenResponseSchema, {
    auth: {
      type: "none",
    },
    method: "GET",
    path: "/v2/oauth2/validate",
    query: {
      oauth_token: token,
    },
  });

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
  requestJson(VerifyTOTPEnvelopeSchema, {
    auth: {
      type: "none",
    },
    body: {
      type: "form",
      value: {
        code,
      },
    },
    method: "POST",
    path: "/v2/two_factor/verify/totp",
    query: {
      oauth_token: twoFactorScopedToken,
    },
  }).pipe(
    Effect.map(({ token, user_id }) => ({
      token,
      user_id,
    })),
    withOperationErrors(VerifyTOTPErrorSpec),
  );

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
