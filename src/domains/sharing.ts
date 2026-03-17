import { Effect, Schema } from "effect";

import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import { FileBroadSchema } from "./files.js";
import { OkResponseSchema, requestJson } from "../core/http.js";

export const SharingCloneStatusSchema = Schema.Literal("NEW", "PROCESSING", "DONE", "ERROR");

export const SharingCloneInputSchema = Schema.Struct({
  cursor: Schema.optional(Schema.String),
  excludeIds: Schema.optional(Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative()))),
  ids: Schema.optional(Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative()))),
  parentId: Schema.optional(Schema.Number.pipe(Schema.int())),
});

const SharingCloneEnvelopeSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.positive()),
  status: Schema.Literal("OK"),
});

export const SharingCloneInfoSchema = Schema.Union(
  Schema.Struct({
    shared_file_clone_status: Schema.Literal("NEW", "PROCESSING", "DONE"),
    status: Schema.Literal("OK"),
  }),
  Schema.Struct({
    error_msg: Schema.String,
    shared_file_clone_status: Schema.Literal("ERROR"),
    status: Schema.Literal("OK"),
  }),
);

export const SharedFileSchema = Schema.extend(
  FileBroadSchema,
  Schema.Struct({
    shared_with: Schema.Union(
      Schema.Literal("everyone"),
      Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    ),
  }),
);

export const SharingShareInputSchema = Schema.Struct({
  cursor: Schema.optional(Schema.String),
  excludeIds: Schema.optional(Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative()))),
  ids: Schema.optional(Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative()))),
  target: Schema.Union(
    Schema.Struct({
      type: Schema.Literal("everyone"),
    }),
    Schema.Struct({
      friendNames: Schema.Array(Schema.String),
      type: Schema.Literal("friends"),
    }),
  ),
});

const SharedFilesEnvelopeSchema = Schema.Struct({
  shared: Schema.Array(SharedFileSchema),
  status: Schema.Literal("OK"),
});

export const SharedFileShareSchema = Schema.Struct({
  share_id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  user_avatar_url: Schema.String,
  user_name: Schema.String,
});

export const SharedFileSharedWithSchema = Schema.Union(
  Schema.Struct({
    share_type: Schema.Literal("everyone"),
    status: Schema.optional(Schema.Literal("OK")),
  }),
  Schema.Struct({
    share_type: Schema.Literal("friends"),
    shares: Schema.Array(SharedFileShareSchema),
    status: Schema.optional(Schema.Literal("OK")),
  }),
);

export const SharingUnshareInputSchema = Schema.Struct({
  fileId: Schema.Number.pipe(Schema.int(), Schema.positive()),
  shares: Schema.optional(
    Schema.Array(Schema.Union(Schema.Number.pipe(Schema.int()), Schema.String)),
  ),
});

export const PublicShareSchema = Schema.Struct({
  created_at: Schema.String,
  expiration_date: Schema.String,
  id: Schema.Number.pipe(Schema.int(), Schema.positive()),
  owner: Schema.Struct({
    name: Schema.String,
  }),
  push_token: Schema.String,
  token: Schema.String,
  user_file: Schema.Struct({
    file_type: Schema.String,
    id: Schema.Number.pipe(Schema.int()),
    name: Schema.String,
  }),
});

const PublicShareEnvelopeSchema = Schema.Struct({
  public_share: PublicShareSchema,
  status: Schema.optional(Schema.Literal("OK")),
});

const PublicSharesEnvelopeSchema = Schema.Struct({
  public_shares: Schema.Array(PublicShareSchema),
  status: Schema.optional(Schema.Literal("OK")),
});

const PublicShareFileListEnvelopeSchema = Schema.Struct({
  breadcrumbs: Schema.optional(
    Schema.Array(Schema.Tuple(Schema.Number.pipe(Schema.int()), Schema.String)),
  ),
  cursor: Schema.NullOr(Schema.String),
  files: Schema.Array(FileBroadSchema),
  parent: Schema.NullOr(FileBroadSchema),
  status: Schema.Literal("OK"),
  total: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
});

const PublicShareFileListContinueEnvelopeSchema = Schema.Struct({
  breadcrumbs: Schema.optional(
    Schema.Array(Schema.Tuple(Schema.Number.pipe(Schema.int()), Schema.String)),
  ),
  cursor: Schema.NullOr(Schema.String),
  files: Schema.Array(FileBroadSchema),
  parent: Schema.optional(Schema.NullOr(FileBroadSchema)),
  status: Schema.Literal("OK"),
  total: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
});

const PublicShareFileUrlEnvelopeSchema = Schema.Struct({
  status: Schema.optional(Schema.Literal("OK")),
  url: Schema.String,
});

export const PublicShareListQuerySchema = Schema.Struct({
  breadcrumbs: Schema.optional(Schema.Literal(1)),
  content_type: Schema.optional(Schema.String),
  file_type: Schema.optional(Schema.String),
  hidden: Schema.optional(Schema.Literal(1)),
  media_info_parent: Schema.optional(Schema.Literal(1)),
  mp4_status_parent: Schema.optional(Schema.Literal(1)),
  parent_id: Schema.optional(Schema.Number.pipe(Schema.int())),
  per_page: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  sort: Schema.optional(Schema.String),
  sort_by: Schema.optional(Schema.String),
  stream_url_parent: Schema.optional(Schema.Literal(1)),
  total: Schema.optional(Schema.Literal(1)),
  video_metadata_parent: Schema.optional(Schema.Literal(1)),
});

type PutioSdkContext =
  | import("../core/http.js").PutioSdkConfig
  | import("@effect/platform").HttpClient.HttpClient;

export type SharingCloneInput = Schema.Schema.Type<typeof SharingCloneInputSchema>;
export type SharingCloneInfo = Schema.Schema.Type<typeof SharingCloneInfoSchema>;
export type SharedFile = Schema.Schema.Type<typeof SharedFileSchema>;
export type SharedFileShare = Schema.Schema.Type<typeof SharedFileShareSchema>;
export type SharedFileSharedWith = Schema.Schema.Type<typeof SharedFileSharedWithSchema>;
export type SharingShareInput = Schema.Schema.Type<typeof SharingShareInputSchema>;
export type SharingUnshareInput = Schema.Schema.Type<typeof SharingUnshareInputSchema>;
export type PublicShare = Schema.Schema.Type<typeof PublicShareSchema>;
export type PublicShareListQuery = Schema.Schema.Type<typeof PublicShareListQuerySchema>;

export const CreateSharingCloneErrorSpec = definePutioOperationErrorSpec({
  domain: "sharing",
  operation: "clone",
  knownErrors: [
    { errorType: "SharedFileCloneConcurrentLimitError", statusCode: 400 as const },
    { errorType: "SharedFileCloneTooManyFilesError", statusCode: 400 as const },
    { errorType: "SharedFileCloneTooManyChildren", statusCode: 400 as const },
    { errorType: "SharedFileCloneTooManyChildrenError", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
  ],
});

export const GetSharingCloneInfoErrorSpec = definePutioOperationErrorSpec({
  domain: "sharing",
  operation: "getCloneInfo",
  knownErrors: [
    { errorType: "SHARED_FILE_CLONE_NOT_FOUND", statusCode: 404 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});

export const ShareFilesErrorSpec = definePutioOperationErrorSpec({
  domain: "sharing",
  operation: "shareFiles",
  knownErrors: [
    { errorType: "ALREADY_SHARED", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
  ],
});

export const ListSharedFilesErrorSpec = definePutioOperationErrorSpec({
  domain: "sharing",
  operation: "listSharedFiles",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export const GetSharedWithErrorSpec = definePutioOperationErrorSpec({
  domain: "sharing",
  operation: "getSharedWith",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});

export const UnshareFileErrorSpec = definePutioOperationErrorSpec({
  domain: "sharing",
  operation: "unshare",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
    { statusCode: 404 as const },
  ],
});

export const CreatePublicShareErrorSpec = definePutioOperationErrorSpec({
  domain: "sharing",
  operation: "createPublicShare",
  knownErrors: [
    { errorType: "PUBLIC_SHARE_NOT_ALLOWED_PLAN", statusCode: 403 as const },
    { errorType: "PUBLIC_SHARE_FOLDER_ROOT_NOT_ALLOWED", statusCode: 400 as const },
    { errorType: "PUBLIC_SHARE_SINGLE_FILE_LIMIT_EXCEEDED", statusCode: 403 as const },
    { errorType: "PUBLIC_SHARE_FOLDER_LINK_COUNT_LIMIT_EXCEEDED", statusCode: 403 as const },
    { errorType: "PUBLIC_SHARE_FOLDER_MAX_SIZE_LIMIT_EXCEEDED", statusCode: 403 as const },
    { errorType: "PUBLIC_SHARE_FOLDER_MAX_CHILDREN_LIMIT_EXCEEDED", statusCode: 403 as const },
    { errorType: "PUBLIC_SHARE_DAILY_TOTAL_LINK_COUNT_EXCEEDED", statusCode: 403 as const },
    { errorType: "PUBLIC_SHARE_WEEKLY_TOTAL_LINK_COUNT_EXCEEDED", statusCode: 403 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});

export const ListPublicSharesErrorSpec = definePutioOperationErrorSpec({
  domain: "sharing",
  operation: "listPublicShares",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export const DeletePublicShareErrorSpec = definePutioOperationErrorSpec({
  domain: "sharing",
  operation: "deletePublicShare",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});

export const GetPublicShareErrorSpec = definePutioOperationErrorSpec({
  domain: "sharing",
  operation: "getPublicShare",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});

export const ListPublicShareFilesErrorSpec = definePutioOperationErrorSpec({
  domain: "sharing",
  operation: "listPublicShareFiles",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});

export const ContinuePublicShareFilesErrorSpec = definePutioOperationErrorSpec({
  domain: "sharing",
  operation: "continuePublicShareFiles",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
    { statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});

export const GetPublicShareFileUrlErrorSpec = definePutioOperationErrorSpec({
  domain: "sharing",
  operation: "getPublicShareFileUrl",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});

export type CreateSharingCloneError = PutioOperationFailure<typeof CreateSharingCloneErrorSpec>;
export type GetSharingCloneInfoError = PutioOperationFailure<typeof GetSharingCloneInfoErrorSpec>;
export type ShareFilesError = PutioOperationFailure<typeof ShareFilesErrorSpec>;
export type ListSharedFilesError = PutioOperationFailure<typeof ListSharedFilesErrorSpec>;
export type GetSharedWithError = PutioOperationFailure<typeof GetSharedWithErrorSpec>;
export type UnshareFileError = PutioOperationFailure<typeof UnshareFileErrorSpec>;
export type CreatePublicShareError = PutioOperationFailure<typeof CreatePublicShareErrorSpec>;
export type ListPublicSharesError = PutioOperationFailure<typeof ListPublicSharesErrorSpec>;
export type DeletePublicShareError = PutioOperationFailure<typeof DeletePublicShareErrorSpec>;
export type GetPublicShareError = PutioOperationFailure<typeof GetPublicShareErrorSpec>;
export type ListPublicShareFilesError = PutioOperationFailure<typeof ListPublicShareFilesErrorSpec>;
export type ContinuePublicShareFilesError = PutioOperationFailure<
  typeof ContinuePublicShareFilesErrorSpec
>;
export type GetPublicShareFileUrlError = PutioOperationFailure<
  typeof GetPublicShareFileUrlErrorSpec
>;

const toCsv = (values: ReadonlyArray<string | number> | undefined) =>
  values && values.length > 0 ? values.join(",") : undefined;

const toShareTarget = (target: SharingShareInput["target"]) =>
  target.type === "everyone" ? "everyone" : target.friendNames.join(",");

export const cloneSharedFiles = (
  input: SharingCloneInput = {},
): Effect.Effect<{ readonly id: number }, CreateSharingCloneError, PutioSdkContext> =>
  requestJson(SharingCloneEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        cursor: input.cursor,
        exclude_ids: toCsv(input.excludeIds),
        file_ids: toCsv(input.ids),
        parent_id: input.parentId ?? 0,
      },
    },
    method: "POST",
    path: "/v2/sharing/clone",
  }).pipe(
    Effect.map(({ id }) => ({ id })),
    (effect) => withOperationErrors(effect, CreateSharingCloneErrorSpec),
  );

export const getSharingCloneInfo = (
  id: number,
): Effect.Effect<SharingCloneInfo, GetSharingCloneInfoError, PutioSdkContext> =>
  requestJson(SharingCloneInfoSchema, {
    method: "GET",
    path: `/v2/sharing/clone/${id}`,
  }).pipe((effect) => withOperationErrors(effect, GetSharingCloneInfoErrorSpec));

export const shareFiles = (
  input: SharingShareInput,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, ShareFilesError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: {
        cursor: input.cursor,
        exclude_ids: toCsv(input.excludeIds),
        file_ids: toCsv(input.ids),
        friends: toShareTarget(input.target),
      },
    },
    method: "POST",
    path: "/v2/files/share",
  }).pipe((effect) => withOperationErrors(effect, ShareFilesErrorSpec));

export const listSharedFiles = (): Effect.Effect<
  ReadonlyArray<SharedFile>,
  ListSharedFilesError,
  PutioSdkContext
> =>
  requestJson(SharedFilesEnvelopeSchema, {
    method: "GET",
    path: "/v2/files/shared",
  }).pipe(
    Effect.map(({ shared }) => shared),
    (effect) => withOperationErrors(effect, ListSharedFilesErrorSpec),
  );

export const getSharedWith = (
  fileId: number,
): Effect.Effect<SharedFileSharedWith, GetSharedWithError, PutioSdkContext> =>
  requestJson(SharedFileSharedWithSchema, {
    method: "GET",
    path: `/v2/files/${fileId}/shared-with-v2`,
  }).pipe((effect) => withOperationErrors(effect, GetSharedWithErrorSpec));

export const unshareFile = (
  input: SharingUnshareInput,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, UnshareFileError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: {
        shares: input.shares && input.shares.length > 0 ? toCsv(input.shares) : "everyone",
      },
    },
    method: "POST",
    path: `/v2/files/${input.fileId}/unshare`,
  }).pipe((effect) => withOperationErrors(effect, UnshareFileErrorSpec));

export const createPublicShare = (
  fileId: number,
): Effect.Effect<PublicShare, CreatePublicShareError, PutioSdkContext> =>
  requestJson(PublicShareEnvelopeSchema, {
    method: "POST",
    path: `/v2/public_share/${fileId}`,
  }).pipe(
    Effect.map(({ public_share }) => public_share),
    (effect) => withOperationErrors(effect, CreatePublicShareErrorSpec),
  );

export const listPublicShares = (): Effect.Effect<
  ReadonlyArray<PublicShare>,
  ListPublicSharesError,
  PutioSdkContext
> =>
  requestJson(PublicSharesEnvelopeSchema, {
    method: "GET",
    path: "/v2/public_share/list",
  }).pipe(
    Effect.map(({ public_shares }) => public_shares),
    (effect) => withOperationErrors(effect, ListPublicSharesErrorSpec),
  );

export const deletePublicShare = (
  id: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  DeletePublicShareError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    method: "DELETE",
    path: `/v2/public_share/${id}`,
  }).pipe((effect) => withOperationErrors(effect, DeletePublicShareErrorSpec));

export const getPublicShare = (): Effect.Effect<
  PublicShare,
  GetPublicShareError,
  PutioSdkContext
> =>
  requestJson(PublicShareEnvelopeSchema, {
    method: "GET",
    path: "/v2/public_share",
  }).pipe(
    Effect.map(({ public_share }) => public_share),
    (effect) => withOperationErrors(effect, GetPublicShareErrorSpec),
  );

export const listPublicShareFiles = (
  query: PublicShareListQuery = {},
): Effect.Effect<
  Schema.Schema.Type<typeof PublicShareFileListEnvelopeSchema>,
  ListPublicShareFilesError,
  PutioSdkContext
> =>
  requestJson(PublicShareFileListEnvelopeSchema, {
    method: "GET",
    path: "/v2/public_share/files/list",
    query,
  }).pipe((effect) => withOperationErrors(effect, ListPublicShareFilesErrorSpec));

export const continuePublicShareFiles = (
  cursor: string,
  query: { readonly per_page?: number } = {},
): Effect.Effect<
  Schema.Schema.Type<typeof PublicShareFileListContinueEnvelopeSchema>,
  ContinuePublicShareFilesError,
  PutioSdkContext
> =>
  requestJson(PublicShareFileListContinueEnvelopeSchema, {
    body: {
      type: "form",
      value: { cursor },
    },
    method: "POST",
    path: "/v2/public_share/files/list/continue",
    query,
  }).pipe((effect) => withOperationErrors(effect, ContinuePublicShareFilesErrorSpec));

export const getPublicShareFileUrl = (
  fileId: number,
): Effect.Effect<string, GetPublicShareFileUrlError, PutioSdkContext> =>
  requestJson(PublicShareFileUrlEnvelopeSchema, {
    method: "GET",
    path: `/v2/public_share/files/${fileId}/url`,
  }).pipe(
    Effect.map(({ url }) => url),
    (effect) => withOperationErrors(effect, GetPublicShareFileUrlErrorSpec),
  );
