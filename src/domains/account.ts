import { Effect, Schema } from "effect";

import {
  PutioValidationError,
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
  type PutioSdkError,
} from "../core/errors.js";
import {
  OkResponseSchema,
  requestJson,
  selectJsonField,
  type PutioSdkContext,
} from "../core/http.js";

const RequestedFlag = Schema.Literal(1);

export const AccountDiskSchema = Schema.Struct({
  avail: Schema.Number.pipe(Schema.nonNegative()),
  size: Schema.Number.pipe(Schema.nonNegative()),
  used: Schema.Number.pipe(Schema.nonNegative()),
});

export const AccountWarningsSchema = Schema.Struct({
  callback_url_has_failed: Schema.optional(Schema.Boolean),
  pushover_token_has_failed: Schema.optional(Schema.Boolean),
});

export const AccountSettingsSchema = Schema.Struct({
  beta_user: Schema.Boolean,
  callback_url: Schema.NullOr(Schema.String),
  dark_theme: Schema.Boolean,
  default_download_folder: Schema.Number.pipe(Schema.int()),
  dont_autoselect_subtitles: Schema.Boolean,
  fluid_layout: Schema.Boolean,
  hide_subtitles: Schema.Boolean,
  history_enabled: Schema.Boolean,
  is_invisible: Schema.Boolean,
  locale: Schema.NullOr(Schema.String),
  login_mails_enabled: Schema.Boolean,
  next_episode: Schema.Boolean,
  pushover_token: Schema.NullOr(Schema.String),
  show_optimistic_usage: Schema.Boolean,
  sort_by: Schema.String,
  start_from: Schema.Boolean,
  subtitle_languages: Schema.Array(Schema.NullOr(Schema.String)).pipe(Schema.maxItems(2)),
  theater_mode: Schema.Boolean,
  theme: Schema.Literal("dark", "light", "auto"),
  transfer_sort_by: Schema.NullOr(Schema.String),
  trash_enabled: Schema.Boolean,
  tunnel_route_name: Schema.NullOr(Schema.String),
  two_factor_enabled: Schema.Boolean,
  use_private_download_ip: Schema.Boolean,
  use_start_from: Schema.Boolean,
  video_player: Schema.NullOr(Schema.Literal("html5", "flash")),
});

const AccountFeaturesSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Boolean,
});

export const PasInfoSchema = Schema.Struct({
  user_hash: Schema.String,
});

export const AccountInfoBaseSchema = Schema.Struct({
  account_active: Schema.optional(Schema.NullOr(Schema.Boolean)),
  account_status: Schema.Literal("active", "inactive", "stranger"),
  avatar_url: Schema.String,
  can_create_sub_account: Schema.Boolean,
  disk: AccountDiskSchema,
  family_owner: Schema.optional(Schema.NullOr(Schema.String)),
  files_will_be_deleted_at: Schema.NullOr(Schema.String),
  is_admin: Schema.optional(Schema.Boolean),
  is_eligible_for_friend_invitation: Schema.Boolean,
  is_sub_account: Schema.Boolean,
  mail: Schema.String,
  monthly_bandwidth_usage: Schema.Number.pipe(Schema.nonNegative()),
  password_last_changed_at: Schema.NullOr(Schema.String),
  private_download_host_ip: Schema.NullOr(Schema.String),
  settings: AccountSettingsSchema,
  trash_size: Schema.Number.pipe(Schema.nonNegative()),
  user_id: Schema.Number.pipe(Schema.int()),
  username: Schema.String,
  warnings: AccountWarningsSchema,
});

export const AccountInfoQuerySchema = Schema.Struct({
  download_token: Schema.optional(RequestedFlag),
  features: Schema.optional(RequestedFlag),
  intercom: Schema.optional(RequestedFlag),
  pas: Schema.optional(RequestedFlag),
  platform: Schema.optional(Schema.String),
  profitwell: Schema.optional(RequestedFlag),
  push_token: Schema.optional(RequestedFlag),
});

export const AccountInfoBroadSchema = Schema.extend(
  AccountInfoBaseSchema,
  Schema.Struct({
    download_token: Schema.optional(Schema.String),
    features: Schema.optional(AccountFeaturesSchema),
    paddle_user_id: Schema.optional(Schema.NullOr(Schema.Number.pipe(Schema.int()))),
    pas: Schema.optional(PasInfoSchema),
    push_token: Schema.optional(Schema.String),
    user_hash: Schema.optional(Schema.String),
  }),
);

const AccountInfoEnvelopeSchema = Schema.Struct({
  info: AccountInfoBroadSchema,
  status: Schema.Literal("OK"),
});

const AccountSettingsEnvelopeSchema = Schema.Struct({
  settings: AccountSettingsSchema,
  status: Schema.Literal("OK"),
});

export const AccountTwoFactorSettingsSchema = Schema.Struct({
  code: Schema.String,
  enable: Schema.Boolean,
});

export const SaveAccountSettingsPayloadSchema = Schema.Union(
  Schema.partial(AccountSettingsSchema),
  Schema.Struct({
    username: Schema.String,
  }),
  Schema.Struct({
    current_password: Schema.String,
    mail: Schema.String,
  }),
  Schema.Struct({
    current_password: Schema.String,
    password: Schema.String,
  }),
  Schema.Struct({
    two_factor_enabled: AccountTwoFactorSettingsSchema,
  }),
);

export const AccountClearOptionsSchema = Schema.Struct({
  active_transfers: Schema.Boolean,
  files: Schema.Boolean,
  finished_transfers: Schema.Boolean,
  friends: Schema.Boolean,
  history: Schema.Boolean,
  rss_feeds: Schema.Boolean,
  rss_logs: Schema.Boolean,
  trash: Schema.Boolean,
});

export const AccountConfirmationSchema = Schema.Struct({
  created_at: Schema.String,
  subject: Schema.Literal("mail_change", "password_change", "subscription_upgrade"),
});

const AccountConfirmationsEnvelopeSchema = Schema.Struct({
  confirmations: Schema.Array(AccountConfirmationSchema),
  status: Schema.Literal("OK"),
});

export type AccountDisk = Schema.Schema.Type<typeof AccountDiskSchema>;
export type AccountWarnings = Schema.Schema.Type<typeof AccountWarningsSchema>;
export type AccountSettings = Schema.Schema.Type<typeof AccountSettingsSchema>;
export type AccountInfoQuery = Schema.Schema.Type<typeof AccountInfoQuerySchema>;
export type PasInfo = Schema.Schema.Type<typeof PasInfoSchema>;
export type AccountInfoBase = Schema.Schema.Type<typeof AccountInfoBaseSchema>;
export type AccountInfoBroad = Schema.Schema.Type<typeof AccountInfoBroadSchema>;
export type SaveAccountSettingsPayload = Schema.Schema.Type<
  typeof SaveAccountSettingsPayloadSchema
>;
export type AccountClearOptions = Schema.Schema.Type<typeof AccountClearOptionsSchema>;
export type AccountConfirmation = Schema.Schema.Type<typeof AccountConfirmationSchema>;

export type AccountInfoResponseFor<TQuery extends AccountInfoQuery> = AccountInfoBase &
  (TQuery["download_token"] extends 1 ? { readonly download_token: string } : {}) &
  (TQuery["features"] extends 1 ? { readonly features: Record<string, boolean> } : {}) &
  (TQuery["intercom"] extends 1 ? { readonly user_hash: string } : {}) &
  (TQuery["pas"] extends 1 ? { readonly pas: PasInfo } : {}) &
  (TQuery["profitwell"] extends 1 ? { readonly paddle_user_id: number | null } : {}) &
  (TQuery["push_token"] extends 1 ? { readonly push_token: string } : {});

const missingFieldError = (field: string) =>
  new PutioValidationError({
    cause: `Expected put.io to include "${field}" because it was requested`,
  });

const failMissingField = (field: string): Effect.Effect<never, PutioValidationError> =>
  Effect.fail(missingFieldError(field));

const widenValidationError = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | PutioValidationError, R> => effect;

const hasDownloadToken = (
  value: AccountInfoBroad,
): value is AccountInfoBroad & { readonly download_token: string } =>
  typeof value.download_token === "string";

const hasFeatures = (
  value: AccountInfoBroad,
): value is AccountInfoBroad & { readonly features: Record<string, boolean> } =>
  typeof value.features === "object" && value.features !== null;

const hasIntercomUserHash = (
  value: AccountInfoBroad,
): value is AccountInfoBroad & { readonly user_hash: string } =>
  typeof value.user_hash === "string";

const hasPas = (value: AccountInfoBroad): value is AccountInfoBroad & { readonly pas: PasInfo } =>
  typeof value.pas === "object" && value.pas !== null && typeof value.pas.user_hash === "string";

const hasPaddleUserId = (
  value: AccountInfoBroad,
): value is AccountInfoBroad & { readonly paddle_user_id: number | null } =>
  "paddle_user_id" in value;

const hasPushToken = (
  value: AccountInfoBroad,
): value is AccountInfoBroad & { readonly push_token: string } =>
  typeof value.push_token === "string";

const ensureAccountInfoFields = <TQuery extends AccountInfoQuery>(
  effect: Effect.Effect<AccountInfoBroad, PutioSdkError, PutioSdkContext>,
  query: TQuery,
): Effect.Effect<
  AccountInfoResponseFor<TQuery>,
  PutioSdkError | PutioValidationError,
  PutioSdkContext
> =>
  Effect.gen(function* () {
    const info = yield* widenValidationError(effect);

    if (query.download_token === 1 && !hasDownloadToken(info)) {
      return yield* failMissingField("download_token");
    }

    if (query.features === 1 && !hasFeatures(info)) {
      return yield* failMissingField("features");
    }

    if (query.intercom === 1 && !hasIntercomUserHash(info)) {
      return yield* failMissingField("user_hash");
    }

    if (query.pas === 1 && !hasPas(info)) {
      return yield* failMissingField("pas");
    }

    if (query.profitwell === 1 && !hasPaddleUserId(info)) {
      return yield* failMissingField("paddle_user_id");
    }

    if (query.push_token === 1 && !hasPushToken(info)) {
      return yield* failMissingField("push_token");
    }

    // Requested-field checks above establish the query-conditioned contract.
    return info as AccountInfoResponseFor<TQuery>;
  });

export const SaveAccountSettingsErrorSpec = definePutioOperationErrorSpec({
  domain: "account",
  operation: "saveSettings",
  knownErrors: [
    { errorType: "INVALID_CURRENT_PASSWORD", statusCode: 400 as const },
    { errorType: "INVALID_NEW_PASSWORD", statusCode: 400 as const },
    { errorType: "INVALID_USERNAME", statusCode: 400 as const },
    { errorType: "INVALID_MAIL", statusCode: 400 as const },
    { errorType: "DISPOSABLE_MAIL_NOT_ALLOWED", statusCode: 400 as const },
    { errorType: "INVALID_CALLBACK_URL", statusCode: 400 as const },
    { errorType: "INVALID_PUSHOVER_TOKEN", statusCode: 400 as const },
    { errorType: "INVALID_CODE", statusCode: 400 as const },
    { errorType: "INVALID_ENABLE", statusCode: 400 as const },
    { errorType: "INVALID_VALUE", statusCode: 400 as const },
    { errorType: "PWNED_NEW_PASSWORD", statusCode: 400 as const },
    { errorType: "SAME_USERNAME", statusCode: 409 as const },
    { errorType: "EXISTING_MAIL", statusCode: 409 as const },
    { errorType: "USERNAME_EXISTS", statusCode: 400 as const },
    { errorType: "UNAVAILABLE_VALUE", statusCode: 403 as const },
    { errorType: "ALREADY_ENABLED", statusCode: 403 as const },
    { errorType: "INVALID_STATE", statusCode: 403 as const },
    { errorType: "NOT_ENABLED", statusCode: 403 as const },
  ],
});

export const AccountConfirmationsErrorSpec = definePutioOperationErrorSpec({
  domain: "account",
  operation: "listConfirmations",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export type SaveAccountSettingsError = PutioOperationFailure<typeof SaveAccountSettingsErrorSpec>;
export type AccountConfirmationsError = PutioOperationFailure<typeof AccountConfirmationsErrorSpec>;

export function getAccountInfo(query: {
  readonly download_token: 1;
  readonly pas: 1;
}): Effect.Effect<
  AccountInfoBase & { readonly download_token: string; readonly pas: PasInfo },
  PutioSdkError,
  PutioSdkContext
>;
export function getAccountInfo(query: {
  readonly download_token: 1;
}): Effect.Effect<
  AccountInfoBase & { readonly download_token: string },
  PutioSdkError,
  PutioSdkContext
>;
export function getAccountInfo(query: {
  readonly features: 1;
}): Effect.Effect<
  AccountInfoBase & { readonly features: Record<string, boolean> },
  PutioSdkError,
  PutioSdkContext
>;
export function getAccountInfo(query: {
  readonly intercom: 1;
  readonly platform?: string;
}): Effect.Effect<AccountInfoBase & { readonly user_hash: string }, PutioSdkError, PutioSdkContext>;
export function getAccountInfo(query: {
  readonly pas: 1;
}): Effect.Effect<AccountInfoBase & { readonly pas: PasInfo }, PutioSdkError, PutioSdkContext>;
export function getAccountInfo(query: {
  readonly profitwell: 1;
}): Effect.Effect<
  AccountInfoBase & { readonly paddle_user_id: number | null },
  PutioSdkError,
  PutioSdkContext
>;
export function getAccountInfo(query: {
  readonly push_token: 1;
}): Effect.Effect<
  AccountInfoBase & { readonly push_token: string },
  PutioSdkError,
  PutioSdkContext
>;
export function getAccountInfo(
  query: AccountInfoQuery,
): Effect.Effect<AccountInfoBroad, PutioSdkError, PutioSdkContext>;
export function getAccountInfo(query: AccountInfoQuery) {
  const effect = requestJson(AccountInfoEnvelopeSchema, {
    method: "GET",
    path: "/v2/account/info",
    query,
  }).pipe(selectJsonField("info"));

  return ensureAccountInfoFields(effect, query);
}

export const getAccountSettings = (): Effect.Effect<
  AccountSettings,
  PutioSdkError,
  PutioSdkContext
> =>
  requestJson(AccountSettingsEnvelopeSchema, {
    method: "GET",
    path: "/v2/account/settings",
  }).pipe(selectJsonField("settings"));

export const saveAccountSettings = (
  payload: SaveAccountSettingsPayload,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  SaveAccountSettingsError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "json",
      value: payload,
    },
    method: "POST",
    path: "/v2/account/settings",
  }).pipe(withOperationErrors(SaveAccountSettingsErrorSpec));

export const clearAccount = (
  options: AccountClearOptions,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, PutioSdkError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: options,
    },
    method: "POST",
    path: "/v2/account/clear",
  });

export const destroyAccount = (
  currentPassword: string,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, PutioSdkError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: {
        current_password: currentPassword,
      },
    },
    method: "POST",
    path: "/v2/account/destroy",
  });

export const listAccountConfirmations = (
  subject?: AccountConfirmation["subject"],
): Effect.Effect<ReadonlyArray<AccountConfirmation>, AccountConfirmationsError, PutioSdkContext> =>
  requestJson(AccountConfirmationsEnvelopeSchema, {
    method: "GET",
    path: "/v2/account/confirmation/list",
    query: subject
      ? {
          type: subject,
        }
      : undefined,
  }).pipe(selectJsonField("confirmations"), withOperationErrors(AccountConfirmationsErrorSpec));
