import { Effect, Schema } from "effect";

import {
  OkResponseSchema,
  buildPutioUrl,
  requestJson,
  type PutioSdkContext,
  type PutioQueryValue,
} from "../core/http.js";
import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
  type PutioSdkError,
} from "../core/errors.js";

const OAuthAppBaseSchema = Schema.Struct({
  description: Schema.String,
  has_icon: Schema.NullOr(Schema.Boolean),
  id: Schema.Number.pipe(Schema.int()),
  name: Schema.String,
  website: Schema.String,
});

export const OAuthAppSchema = OAuthAppBaseSchema;

export const OwnedOAuthAppSchema = Schema.extend(
  OAuthAppBaseSchema,
  Schema.Struct({
    callback: Schema.String,
    hidden: Schema.Boolean,
    secret: Schema.String,
  }),
);

export const MyOAuthAppSchema = Schema.extend(
  OwnedOAuthAppSchema,
  Schema.Struct({
    users: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  }),
);

export const PopularOAuthAppSchema = Schema.extend(
  OAuthAppBaseSchema,
  Schema.Struct({
    hidden: Schema.optional(Schema.Boolean),
    maker: Schema.String,
    users: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  }),
);

export const OAuthAppSessionSchema = Schema.Struct({
  active: Schema.Boolean,
  app_id: Schema.Number.pipe(Schema.int()),
  app_name: Schema.optional(Schema.String),
  client_name: Schema.String,
  created_at: Schema.String,
  id: Schema.Number.pipe(Schema.int()),
  ip_address: Schema.String,
  last_used_at: Schema.NullOr(Schema.String),
  note: Schema.NullOr(Schema.String),
  user_agent: Schema.String,
});

export const OAuthAppWithTokenSchema = Schema.Struct({
  app: Schema.Union(OwnedOAuthAppSchema, OAuthAppSchema),
  status: Schema.Literal("OK"),
  token: Schema.NullOr(Schema.String),
});

const OAuthAppsEnvelopeSchema = Schema.Struct({
  apps: Schema.Array(MyOAuthAppSchema),
  status: Schema.Literal("OK"),
});

const PopularOAuthAppsEnvelopeSchema = Schema.Struct({
  apps: Schema.Array(PopularOAuthAppSchema),
  status: Schema.Literal("OK"),
});

const OAuthAppEnvelopeSchema = Schema.Struct({
  app: Schema.Union(OwnedOAuthAppSchema, OAuthAppSchema),
  status: Schema.Literal("OK"),
});

const OAuthRegeneratedTokenEnvelopeSchema = Schema.Struct({
  access_token: Schema.String,
  status: Schema.Literal("OK"),
});

export const OAuthAppCreateInputSchema = Schema.Struct({
  callback: Schema.String,
  description: Schema.String,
  hidden: Schema.optional(Schema.Boolean),
  icon: Schema.optional(Schema.instanceOf(Blob)),
  name: Schema.String,
  website: Schema.String,
});

export const OAuthAppUpdateInputSchema = Schema.Struct({
  callback: Schema.String,
  description: Schema.String,
  hidden: Schema.optional(Schema.Boolean),
  icon: Schema.optional(Schema.instanceOf(Blob)),
  id: Schema.Number.pipe(Schema.int()),
  website: Schema.String,
});

export const OAuthSetIconInputSchema = Schema.Struct({
  icon: Schema.instanceOf(Blob),
});

export type OAuthApp = Schema.Schema.Type<typeof OAuthAppSchema>;
export type OwnedOAuthApp = Schema.Schema.Type<typeof OwnedOAuthAppSchema>;
export type MyOAuthApp = Schema.Schema.Type<typeof MyOAuthAppSchema>;
export type PopularOAuthApp = Schema.Schema.Type<typeof PopularOAuthAppSchema>;
export type OAuthAppSession = Schema.Schema.Type<typeof OAuthAppSessionSchema>;
export type OAuthAppCreateInput = Schema.Schema.Type<typeof OAuthAppCreateInputSchema>;
export type OAuthAppUpdateInput = Schema.Schema.Type<typeof OAuthAppUpdateInputSchema>;
export type OAuthSetIconInput = Schema.Schema.Type<typeof OAuthSetIconInputSchema>;

export const QueryOAuthAppsErrorSpec = definePutioOperationErrorSpec({
  domain: "oauth",
  operation: "query",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export const GetOAuthAppErrorSpec = definePutioOperationErrorSpec({
  domain: "oauth",
  operation: "get",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export const CreateOAuthAppErrorSpec = definePutioOperationErrorSpec({
  domain: "oauth",
  operation: "create",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export const UpdateOAuthAppErrorSpec = definePutioOperationErrorSpec({
  domain: "oauth",
  operation: "update",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export const DeleteOAuthAppErrorSpec = definePutioOperationErrorSpec({
  domain: "oauth",
  operation: "delete",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export const RegenerateOAuthAppTokenErrorSpec = definePutioOperationErrorSpec({
  domain: "oauth",
  operation: "regenerateToken",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export type QueryOAuthAppsError = PutioOperationFailure<typeof QueryOAuthAppsErrorSpec>;
export type GetOAuthAppError = PutioOperationFailure<typeof GetOAuthAppErrorSpec>;
export type CreateOAuthAppError = PutioOperationFailure<typeof CreateOAuthAppErrorSpec>;
export type UpdateOAuthAppError = PutioOperationFailure<typeof UpdateOAuthAppErrorSpec>;
export type DeleteOAuthAppError = PutioOperationFailure<typeof DeleteOAuthAppErrorSpec>;
export type RegenerateOAuthAppTokenError = PutioOperationFailure<
  typeof RegenerateOAuthAppTokenErrorSpec
>;

const appendOptionalBoolean = (formData: FormData, key: string, value?: boolean) => {
  if (value !== undefined) {
    formData.append(key, String(value));
  }
};

const appendOptionalBlob = (formData: FormData, key: string, value?: Blob) => {
  if (value) {
    formData.append(key, value);
  }
};

const makeCreateOAuthAppFormData = (input: OAuthAppCreateInput) => {
  const formData = new FormData();
  formData.append("name", input.name);
  formData.append("description", input.description);
  formData.append("website", input.website);
  formData.append("callback", input.callback);
  appendOptionalBoolean(formData, "hidden", input.hidden);
  appendOptionalBlob(formData, "icon", input.icon);
  return formData;
};

const makeUpdateOAuthAppFormData = (input: OAuthAppUpdateInput) => {
  const formData = new FormData();
  formData.append("description", input.description);
  formData.append("website", input.website);
  formData.append("callback", input.callback);
  appendOptionalBoolean(formData, "hidden", input.hidden);
  appendOptionalBlob(formData, "icon", input.icon);
  return formData;
};

export const buildOAuthAuthorizeUrl = (options: {
  readonly baseUrl?: string | URL;
  readonly oauthToken: string;
  readonly query?: Readonly<Record<string, PutioQueryValue>>;
}) =>
  buildPutioUrl(options.baseUrl ?? "https://api.put.io", "/v2/oauth2/authorize", {
    ...options.query,
    oauth_token: options.oauthToken,
  });

export const buildOAuthAppIconUrl = (options: {
  readonly baseUrl?: string | URL;
  readonly id: number;
  readonly oauthToken: string;
}) =>
  buildPutioUrl(options.baseUrl ?? "https://api.put.io", `/v2/oauth/apps/${options.id}/icon`, {
    oauth_token: options.oauthToken,
  });

export const queryOAuthApps = (): Effect.Effect<
  ReadonlyArray<MyOAuthApp>,
  QueryOAuthAppsError,
  PutioSdkContext
> =>
  requestJson(OAuthAppsEnvelopeSchema, {
    method: "GET",
    path: "/v2/oauth/apps",
  }).pipe(
    Effect.map(({ apps }) => apps),
    (effect) => withOperationErrors(effect, QueryOAuthAppsErrorSpec),
  );

export const getOAuthApp = (
  id: number,
  options?: {
    readonly edit?: boolean;
  },
): Effect.Effect<
  Schema.Schema.Type<typeof OAuthAppWithTokenSchema>,
  GetOAuthAppError,
  PutioSdkContext
> =>
  requestJson(OAuthAppWithTokenSchema, {
    method: "GET",
    path: options?.edit ? `/v2/oauth/apps/${id}/edit` : `/v2/oauth/apps/${id}`,
  }).pipe((effect) => withOperationErrors(effect, GetOAuthAppErrorSpec));

export const setOAuthAppIcon = (
  id: number,
  input: OAuthSetIconInput,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, PutioSdkError, PutioSdkContext> => {
  const formData = new FormData();
  formData.append("icon", input.icon);

  return requestJson(OkResponseSchema, {
    body: {
      type: "form-data",
      value: formData,
    },
    method: "POST",
    path: `/v2/oauth/apps/${id}/icon`,
  });
};

export const createOAuthApp = (
  input: OAuthAppCreateInput,
): Effect.Effect<
  Schema.Schema.Type<typeof OAuthAppEnvelopeSchema>,
  CreateOAuthAppError,
  PutioSdkContext
> =>
  requestJson(OAuthAppEnvelopeSchema, {
    body: {
      type: "form-data",
      value: makeCreateOAuthAppFormData(input),
    },
    method: "POST",
    path: "/v2/oauth/apps/register",
  }).pipe((effect) => withOperationErrors(effect, CreateOAuthAppErrorSpec));

export const updateOAuthApp = (
  input: OAuthAppUpdateInput,
): Effect.Effect<
  Schema.Schema.Type<typeof OAuthAppWithTokenSchema>,
  UpdateOAuthAppError,
  PutioSdkContext
> =>
  requestJson(OAuthAppWithTokenSchema, {
    body: {
      type: "form-data",
      value: makeUpdateOAuthAppFormData(input),
    },
    method: "POST",
    path: `/v2/oauth/apps/${input.id}`,
  }).pipe((effect) => withOperationErrors(effect, UpdateOAuthAppErrorSpec));

export const deleteOAuthApp = (
  id: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  DeleteOAuthAppError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: `/v2/oauth/apps/${id}/delete`,
  }).pipe((effect) => withOperationErrors(effect, DeleteOAuthAppErrorSpec));

export const regenerateOAuthAppToken = (
  id: number,
): Effect.Effect<string, RegenerateOAuthAppTokenError, PutioSdkContext> =>
  requestJson(OAuthRegeneratedTokenEnvelopeSchema, {
    method: "POST",
    path: `/v2/oauth/apps/${id}/regenerate_token`,
  }).pipe(
    Effect.map(({ access_token }) => access_token),
    (effect) => withOperationErrors(effect, RegenerateOAuthAppTokenErrorSpec),
  );

export const getPopularOAuthApps = (): Effect.Effect<
  ReadonlyArray<PopularOAuthApp>,
  PutioSdkError,
  PutioSdkContext
> =>
  requestJson(PopularOAuthAppsEnvelopeSchema, {
    method: "GET",
    path: "/v2/oauth/apps/popular",
  }).pipe(Effect.map(({ apps }) => apps));
