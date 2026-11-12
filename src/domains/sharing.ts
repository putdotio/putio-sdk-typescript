import { Effect, Schema } from "effect";
import { joinCsv, toCursorSelectionForm } from "../core/forms.js";
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
  cursorSelectionSchema,
  decodeAndRun,
  failMissingField,
} from "../core/validation.js";
import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import {
  FileBroadSchema,
  FileSortSchema,
  FileTypeSchema,
  FilesListEnvelopeSchema,
  type FileListResponse,
  type FileListResponseFor,
  type FilesBulkSelection,
} from "./files.js";
import {
  OkResponseSchema,
  encodePathSegment,
  requestJson,
  selectJsonField,
  selectJsonFields,
  type PutioSdkContext,
} from "../core/http.js";

export const SharingCloneStatusSchema = Schema.Literals(["NEW", "PROCESSING", "DONE", "ERROR"]);

export const SharingCloneInputSchema = cursorSelectionSchema({
  parentId: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
});

const SharingCloneEnvelopeSchema = Schema.Struct({
  id: Schema.Int.check(Schema.isGreaterThan(0)),
  status: Schema.Literal("OK"),
});

export const SharingCloneInfoSchema = Schema.Union([
  Schema.Struct({
    shared_file_clone_status: Schema.Literals(["NEW", "PROCESSING", "DONE"]),
    status: Schema.Literal("OK"),
  }),
  Schema.Struct({
    error_msg: Schema.String,
    shared_file_clone_status: Schema.Literal("ERROR"),
    status: Schema.Literal("OK"),
  }),
]);

export const SharedFileSchema = FileBroadSchema.pipe(
  Schema.fieldsAssign({
    shared_with: Schema.Union([
      Schema.Literal("everyone"),
      Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    ]),
  }),
);

export const SharingShareInputSchema = cursorSelectionSchema({
  target: Schema.Union([
    Schema.Struct({
      type: Schema.Literal("everyone"),
    }),
    Schema.Struct({
      friendNames: Schema.Array(NonEmptyStringSchema).check(Schema.isMinLength(1)),
      type: Schema.Literal("friends"),
    }),
  ]),
});

const SharedFilesEnvelopeSchema = Schema.Struct({
  shared: Schema.Array(SharedFileSchema),
  status: Schema.Literal("OK"),
});

export const SharedFileShareSchema = Schema.Struct({
  share_id: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  user_avatar_url: Schema.String,
  user_name: Schema.String,
});

export const SharedFileSharedWithSchema = Schema.Union([
  Schema.Struct({
    share_type: Schema.Literal("everyone"),
    status: Schema.optional(Schema.Literal("OK")),
  }),
  Schema.Struct({
    share_type: Schema.Literal("friends"),
    shares: Schema.Array(SharedFileShareSchema),
    status: Schema.optional(Schema.Literal("OK")),
  }),
]);

export const SharingUnshareInputSchema = Schema.Struct({
  fileId: PositiveIntegerSchema,
  shares: Schema.optional(
    Schema.Array(Schema.Union([PositiveIntegerSchema, NonEmptyStringSchema])),
  ),
});

export const PublicShareSchema = Schema.Struct({
  created_at: Schema.String,
  expiration_date: Schema.String,
  id: Schema.Int.check(Schema.isGreaterThan(0)),
  owner: Schema.Struct({
    name: Schema.String,
  }),
  push_token: Schema.String,
  token: Schema.String,
  user_file: Schema.Struct({
    file_type: FileTypeSchema,
    id: Schema.Int,
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

const PublicShareFileListContinueEnvelopeSchema = FilesListEnvelopeSchema.pipe(
  Schema.fieldsAssign({ parent: Schema.optional(Schema.NullOr(FileBroadSchema)) }),
);

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
  parent_id: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  per_page: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0))),
  sort: Schema.optional(FileSortSchema),
  sort_by: Schema.optional(FileSortSchema),
  stream_url_parent: Schema.optional(Schema.Literal(1)),
  total: Schema.optional(Schema.Literal(1)),
  video_metadata_parent: Schema.optional(Schema.Literal(1)),
});

const PublicShareContinueInputSchema = Schema.Struct({
  cursor: NonEmptyStringSchema,
  query: Schema.Struct({
    per_page: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0))),
  }),
});

export type SharingCloneInput = FilesBulkSelection &
  Pick<Schema.Schema.Type<typeof SharingCloneInputSchema>, "parentId">;

export type SharingCloneInfo = Schema.Schema.Type<typeof SharingCloneInfoSchema>;

export type SharedFile = Schema.Schema.Type<typeof SharedFileSchema>;

export type SharedFileShare = Schema.Schema.Type<typeof SharedFileShareSchema>;

export type SharedFileSharedWith = Schema.Schema.Type<typeof SharedFileSharedWithSchema>;

export type SharingShareInput = FilesBulkSelection &
  Pick<Schema.Schema.Type<typeof SharingShareInputSchema>, "target">;

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

const toShareTarget = (target: SharingShareInput["target"]): string =>
  target.type === "everyone" ? "everyone" : target.friendNames.join(",");

export const cloneSharedFiles = (
  input: SharingCloneInput,
): Effect.Effect<
  {
    readonly id: number;
  },
  CreateSharingCloneError,
  PutioSdkContext
> =>
  decodeAndRun(SharingCloneInputSchema, input, (decodedInput) =>
    requestJson(SharingCloneEnvelopeSchema, {
      body: {
        type: "form",
        value: {
          ...toCursorSelectionForm(decodedInput),
          parent_id: decodedInput.parentId ?? 0,
        },
      },
      method: "POST",
      path: "/v2/sharing/clone",
    }),
  ).pipe(selectJsonFields("id"), withOperationErrors(CreateSharingCloneErrorSpec));

export const getSharingCloneInfo = (
  id: number,
): Effect.Effect<SharingCloneInfo, GetSharingCloneInfoError, PutioSdkContext> =>
  decodeAndRun(PositiveIntegerSchema, id, (decodedId) =>
    requestJson(SharingCloneInfoSchema, {
      method: "GET",
      path: `/v2/sharing/clone/${encodePathSegment(decodedId)}`,
    }),
  ).pipe(withOperationErrors(GetSharingCloneInfoErrorSpec));

export const shareFiles = (
  input: SharingShareInput,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, ShareFilesError, PutioSdkContext> =>
  decodeAndRun(SharingShareInputSchema, input, (decodedInput) =>
    requestJson(OkResponseSchema, {
      body: {
        type: "form",
        value: {
          ...toCursorSelectionForm(decodedInput),
          friends: toShareTarget(decodedInput.target),
        },
      },
      method: "POST",
      path: "/v2/files/share",
    }),
  ).pipe(withOperationErrors(ShareFilesErrorSpec));

export const listSharedFiles = (): Effect.Effect<
  ReadonlyArray<SharedFile>,
  ListSharedFilesError,
  PutioSdkContext
> =>
  requestJson(SharedFilesEnvelopeSchema, {
    method: "GET",
    path: "/v2/files/shared",
  }).pipe(selectJsonField("shared"), withOperationErrors(ListSharedFilesErrorSpec));

export const getSharedWith = (
  fileId: number,
): Effect.Effect<SharedFileSharedWith, GetSharedWithError, PutioSdkContext> =>
  decodeAndRun(PositiveIntegerSchema, fileId, (decodedFileId) =>
    requestJson(SharedFileSharedWithSchema, {
      method: "GET",
      path: `/v2/files/${encodePathSegment(decodedFileId)}/shared-with-v2`,
    }),
  ).pipe(withOperationErrors(GetSharedWithErrorSpec));

export const unshareFile = (
  input: SharingUnshareInput,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, UnshareFileError, PutioSdkContext> =>
  decodeAndRun(SharingUnshareInputSchema, input, (decodedInput) =>
    requestJson(OkResponseSchema, {
      body: {
        type: "form",
        value: {
          shares: joinCsv(decodedInput.shares) ?? "everyone",
        },
      },
      method: "POST",
      path: `/v2/files/${encodePathSegment(decodedInput.fileId)}/unshare`,
    }),
  ).pipe(withOperationErrors(UnshareFileErrorSpec));

export const createPublicShare = (
  fileId: number,
): Effect.Effect<PublicShare, CreatePublicShareError, PutioSdkContext> =>
  decodeAndRun(PositiveIntegerSchema, fileId, (decodedFileId) =>
    requestJson(PublicShareEnvelopeSchema, {
      method: "POST",
      path: `/v2/public_share/${encodePathSegment(decodedFileId)}`,
    }),
  ).pipe(selectJsonField("public_share"), withOperationErrors(CreatePublicShareErrorSpec));

export const listPublicShares = (): Effect.Effect<
  ReadonlyArray<PublicShare>,
  ListPublicSharesError,
  PutioSdkContext
> =>
  requestJson(PublicSharesEnvelopeSchema, {
    method: "GET",
    path: "/v2/public_share/list",
  }).pipe(selectJsonField("public_shares"), withOperationErrors(ListPublicSharesErrorSpec));

export const deletePublicShare = (
  id: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  DeletePublicShareError,
  PutioSdkContext
> =>
  decodeAndRun(PositiveIntegerSchema, id, (decodedId) =>
    requestJson(OkResponseSchema, {
      method: "DELETE",
      path: `/v2/public_share/${encodePathSegment(decodedId)}`,
    }),
  ).pipe(withOperationErrors(DeletePublicShareErrorSpec));

export const getPublicShare = (): Effect.Effect<
  PublicShare,
  GetPublicShareError,
  PutioSdkContext
> =>
  requestJson(PublicShareEnvelopeSchema, {
    method: "GET",
    path: "/v2/public_share",
  }).pipe(selectJsonField("public_share"), withOperationErrors(GetPublicShareErrorSpec));

export function listPublicShareFiles<TQuery extends PublicShareListQuery>(
  query: TQuery,
): Effect.Effect<FileListResponseFor<TQuery>, ListPublicShareFilesError, PutioSdkContext>;
export function listPublicShareFiles(
  query?: PublicShareListQuery,
): Effect.Effect<FileListResponse, ListPublicShareFilesError, PutioSdkContext>;
export function listPublicShareFiles(query: PublicShareListQuery = {}) {
  return decodeAndRun(PublicShareListQuerySchema, query, (decodedQuery) =>
    requestJson(FilesListEnvelopeSchema, {
      method: "GET",
      path: "/v2/public_share/files/list",
      query: decodedQuery,
    }).pipe(
      Effect.filterOrElse(
        (response) => decodedQuery.breadcrumbs !== 1 || response.breadcrumbs !== undefined,
        () => failMissingField("breadcrumbs"),
      ),
    ),
  ).pipe(withOperationErrors(ListPublicShareFilesErrorSpec));
}

export const continuePublicShareFiles = (
  cursor: string,
  query: {
    readonly per_page?: number;
  } = {},
): Effect.Effect<
  Schema.Schema.Type<typeof PublicShareFileListContinueEnvelopeSchema>,
  ContinuePublicShareFilesError,
  PutioSdkContext
> =>
  decodeAndRun(
    PublicShareContinueInputSchema,
    {
      cursor,
      query,
    },
    (decodedInput) =>
      requestJson(PublicShareFileListContinueEnvelopeSchema, {
        body: {
          type: "form",
          value: { cursor: decodedInput.cursor },
        },
        method: "POST",
        path: "/v2/public_share/files/list/continue",
        query: decodedInput.query,
      }),
  ).pipe(withOperationErrors(ContinuePublicShareFilesErrorSpec));

export const getPublicShareFileUrl = (
  fileId: number,
): Effect.Effect<string, GetPublicShareFileUrlError, PutioSdkContext> =>
  decodeAndRun(PositiveIntegerSchema, fileId, (decodedFileId) =>
    requestJson(PublicShareFileUrlEnvelopeSchema, {
      method: "GET",
      path: `/v2/public_share/files/${encodePathSegment(decodedFileId)}/url`,
    }),
  ).pipe(selectJsonField("url"), withOperationErrors(GetPublicShareFileUrlErrorSpec));
