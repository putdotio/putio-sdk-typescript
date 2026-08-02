import { Effect, Schema } from "effect";
import { joinCsv, toCursorSelectionForm } from "../core/forms.js";
import {
  mapDecodeErrorToValidationError,
  mapConfigurationError,
  PutioValidationError,
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
  type PutioSdkError,
} from "../core/errors.js";
import {
  OkResponseSchema,
  PutioSdkConfig,
  buildPutioUrl,
  encodePathSegment,
  requestJson,
  requestVoid,
  selectJsonField,
  type PutioSdkConfigShape,
  type PutioSdkContext,
} from "../core/http.js";
import {
  NonEmptyStringSchema,
  PositiveIntegerSchema,
  decodeAndRun,
  makeCursorSelectionSchema,
} from "../core/validation.js";
const RequestedFlag = Schema.Literal(1);
const NonNegativeFileIdSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const PositiveFileIdSchema = Schema.Int.check(Schema.isGreaterThan(0));
export const FileTypeSchema = Schema.Literals([
  "FOLDER",
  "FILE",
  "AUDIO",
  "VIDEO",
  "IMAGE",
  "ARCHIVE",
  "PDF",
  "TEXT",
  "SWF",
]);
export const FolderTypeSchema = Schema.Literals(["REGULAR", "SHARED_ROOT", "SHARED_FRIEND"]);
export const FileSortSchema = Schema.Literals([
  "NAME_ASC",
  "NAME_DESC",
  "SIZE_ASC",
  "SIZE_DESC",
  "DATE_ASC",
  "DATE_DESC",
  "MODIFIED_ASC",
  "MODIFIED_DESC",
  "TYPE_ASC",
  "TYPE_DESC",
  "WATCH_ASC",
  "WATCH_DESC",
]);
export const FileSetSortInputSchema = Schema.Struct({
  fileId: NonNegativeFileIdSchema,
  sortBy: FileSortSchema,
});
export const FileCopyInputSchema = Schema.Struct({
  fileId: PositiveFileIdSchema,
  name: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
  parentId: NonNegativeFileIdSchema,
});
export const FileTouchInputSchema = Schema.Struct({
  fileIds: Schema.Array(NonNegativeFileIdSchema).check(Schema.isMinLength(1)),
  updatedAt: Schema.optional(Schema.DateValid),
});
export const FileMediaMetadataSchema = Schema.Struct({
  aspect_ratio: Schema.optional(
    Schema.NullOr(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))),
  ),
  codec: Schema.optional(Schema.NullOr(Schema.String)),
  duration: Schema.optional(Schema.NullOr(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)))),
  height: Schema.optional(Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)))),
  width: Schema.optional(Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)))),
});
export const FileMediaInfoFormatSchema = Schema.Struct({
  bit_rate: Schema.optional(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))),
  duration: Schema.optional(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))),
  name: Schema.optional(Schema.String),
});
export const FileMediaInfoStreamSchema = Schema.Struct({
  channels: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  codec_name: Schema.optional(Schema.String),
  codec_type: Schema.optional(Schema.String),
  height: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  level: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  profile: Schema.optional(Schema.String),
  rfc6381_codec: Schema.optional(Schema.String),
  width: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
});
export const FileMediaInfoSchema = Schema.Struct({
  format: Schema.optional(Schema.NullOr(FileMediaInfoFormatSchema)),
  mime_type: Schema.optional(Schema.NullOr(Schema.String)),
  streams: Schema.optional(Schema.Array(FileMediaInfoStreamSchema)),
});
export const FileBaseSchema = Schema.Struct({
  content_type: Schema.NullOr(Schema.String),
  created_at: Schema.String,
  crc32: Schema.NullOr(Schema.String),
  extension: Schema.NullOr(Schema.String),
  file_type: FileTypeSchema,
  first_accessed_at: Schema.NullOr(Schema.String),
  folder_type: FolderTypeSchema,
  icon: Schema.NullOr(Schema.String),
  id: Schema.Int,
  is_hidden: Schema.Boolean,
  is_mp4_available: Schema.Boolean,
  is_shared: Schema.Boolean,
  name: Schema.String,
  opensubtitles_hash: Schema.NullOr(Schema.String),
  parent_id: Schema.NullOr(Schema.Int),
  screenshot: Schema.NullOr(Schema.String),
  sha1: Schema.optional(Schema.NullOr(Schema.String)),
  size: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  start_from: Schema.optional(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))),
  updated_at: Schema.String,
});
export const FileBroadSchema = FileBaseSchema.pipe(
  Schema.fieldsAssign({
    content_type_and_codecs: Schema.optional(Schema.NullOr(Schema.String)),
    media_info: Schema.optional(Schema.NullOr(FileMediaInfoSchema)),
    media_metadata: Schema.optional(Schema.NullOr(FileMediaMetadataSchema)),
    mp4_size: Schema.optional(Schema.NullOr(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)))),
    mp4_stream_url: Schema.optional(Schema.NullOr(Schema.String)),
    need_convert: Schema.optional(Schema.Boolean),
    sender_name: Schema.optional(Schema.String),
    sort_by: Schema.optional(FileSortSchema),
    stream_url: Schema.optional(Schema.NullOr(Schema.String)),
    video_metadata: Schema.optional(Schema.NullOr(FileMediaMetadataSchema)),
  }),
);
export const FileQuerySchema = Schema.Struct({
  codecs: Schema.optional(RequestedFlag),
  media_info: Schema.optional(RequestedFlag),
  media_metadata: Schema.optional(RequestedFlag),
  mp4_status: Schema.optional(RequestedFlag),
  mp4_stream_url: Schema.optional(RequestedFlag),
  stream_url: Schema.optional(RequestedFlag),
  video_metadata: Schema.optional(RequestedFlag),
});
export const FileGetChildInputSchema = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1)),
  parentId: NonNegativeFileIdSchema,
  query: Schema.optional(FileQuerySchema),
});
export const FilesListQuerySchema = FileQuerySchema.mapFields(
  ({ codecs: _codecs, media_info: _mediaInfo, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    breadcrumbs: Schema.optional(RequestedFlag),
    codecs_parent: Schema.optional(RequestedFlag),
    content_type: Schema.optional(Schema.String),
    file_type: Schema.optional(Schema.String),
    hidden: Schema.optional(RequestedFlag),
    media_info_parent: Schema.optional(RequestedFlag),
    media_metadata_parent: Schema.optional(RequestedFlag),
    mp4_status_parent: Schema.optional(RequestedFlag),
    mp4_stream_url_parent: Schema.optional(RequestedFlag),
    no_cursor: Schema.optional(RequestedFlag),
    per_page: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0))),
    sort: Schema.optional(FileSortSchema),
    sort_by: Schema.optional(FileSortSchema),
    stream_url_parent: Schema.optional(RequestedFlag),
    total: Schema.optional(RequestedFlag),
    video_metadata_parent: Schema.optional(RequestedFlag),
  }),
);
export const FilesSearchQuerySchema = Schema.Struct({
  per_page: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0))),
  query: Schema.String,
});
export const FileBreadcrumbSchema = Schema.Tuple([Schema.Int, Schema.String]);
const FileEnvelopeSchema = Schema.Struct({
  file: FileBroadSchema,
  status: Schema.Literal("OK"),
});
export const FilesListEnvelopeSchema = Schema.Struct({
  breadcrumbs: Schema.optional(Schema.Array(FileBreadcrumbSchema)),
  cursor: Schema.NullOr(Schema.String),
  files: Schema.Array(FileBroadSchema),
  parent: Schema.NullOr(FileBroadSchema),
  status: Schema.Literal("OK"),
  total: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
});
const FilesListContinueEnvelopeSchema = Schema.Struct({
  breadcrumbs: Schema.optional(Schema.Array(FileBreadcrumbSchema)),
  cursor: Schema.NullOr(Schema.String),
  files: Schema.Array(FileBroadSchema),
  parent: Schema.optional(Schema.NullOr(FileBroadSchema)),
  status: Schema.Literal("OK"),
  total: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
});
const FilesSearchEnvelopeSchema = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  files: Schema.Array(FileBroadSchema),
  status: Schema.Literal("OK"),
  total: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});
const FilesListInputSchema = Schema.Struct({
  parent: Schema.Union([NonNegativeFileIdSchema, Schema.Literal("friends")]),
  query: FilesListQuerySchema,
});
const FilesContinueInputSchema = Schema.Struct({
  cursor: NonEmptyStringSchema,
  query: Schema.Struct({
    per_page: Schema.optional(PositiveIntegerSchema),
  }),
});
const FileGetInputSchema = Schema.Struct({
  id: PositiveFileIdSchema,
  query: Schema.optional(FileQuerySchema),
});
const FilesSearchContinueInputSchema = Schema.Struct({
  cursor: NonEmptyStringSchema,
  query: Schema.Struct({
    per_page: Schema.optional(PositiveIntegerSchema),
  }),
});
const FileSubtitlesInputSchema = Schema.Struct({
  fileId: PositiveFileIdSchema,
  options: Schema.Struct({
    languages: Schema.optional(Schema.Array(NonEmptyStringSchema).check(Schema.isMinLength(1))),
  }),
});
const FileNextInputSchema = Schema.Struct({
  fileId: PositiveFileIdSchema,
  fileType: FileTypeSchema,
});
const FileCreateFolderInputSchema = Schema.Struct({
  name: Schema.optional(NonEmptyStringSchema),
  parent_id: Schema.optional(NonNegativeFileIdSchema),
  path: Schema.optional(NonEmptyStringSchema),
}).check(
  Schema.makeFilter((input) => input.name !== undefined || input.path !== undefined, {
    expected: "a non-empty folder name or path",
  }),
);
const FileRenameInputSchema = Schema.Struct({
  file_id: PositiveFileIdSchema,
  name: NonEmptyStringSchema,
});
const FileStartFromSetInputSchema = Schema.Struct({
  file_id: PositiveFileIdSchema,
  time: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
});
const FileStartFromEnvelopeSchema = Schema.Struct({
  start_from: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  status: Schema.Literal("OK"),
});
const FileDownloadUrlEnvelopeSchema = Schema.Struct({
  status: Schema.Literal("OK"),
  url: Schema.String,
});
const FileCanWriteEnvelopeSchema = Schema.Struct({
  status: Schema.Literal("OK"),
  user_id: Schema.Int,
});
const FileUploadTransferSchema = Schema.Struct({
  id: Schema.Int,
  name: Schema.String,
});
const FileUploadEnvelopeSchema = Schema.Struct({
  file: Schema.optional(FileBroadSchema),
  status: Schema.Literal("OK"),
  transfer: Schema.optional(FileUploadTransferSchema),
});
const FileConversionNotAvailableSchema = Schema.Struct({
  id: Schema.Int,
  status: Schema.Literal("NOT_AVAILABLE"),
});
const FileConversionInQueueSchema = Schema.Struct({
  id: Schema.Int,
  percent_done: Schema.optional(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))),
  status: Schema.Literal("IN_QUEUE"),
});
const FileConversionConvertingSchema = Schema.Struct({
  id: Schema.Int,
  percent_done: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  status: Schema.Literal("CONVERTING"),
});
const FileConversionCompletedSchema = Schema.Struct({
  id: Schema.Int,
  percent_done: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  size: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  status: Schema.Literal("COMPLETED"),
});
const FileConversionErrorSchema = Schema.Struct({
  id: Schema.Int,
  status: Schema.Literal("ERROR"),
});
export const FileConversionStatusSchema = Schema.Union([
  FileConversionNotAvailableSchema,
  FileConversionInQueueSchema,
  FileConversionConvertingSchema,
  FileConversionCompletedSchema,
  FileConversionErrorSchema,
]);
const FileConversionStatusEnvelopeSchema = Schema.Struct({
  mp4: FileConversionStatusSchema,
  status: Schema.Literal("OK"),
});
const FilesBulkConvertEnvelopeSchema = Schema.Struct({
  count: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  status: Schema.Literal("OK"),
});
const ActiveConversionFields = {
  name: Schema.String,
};
export const FileActiveConversionSchema = Schema.Union([
  FileConversionNotAvailableSchema.pipe(Schema.fieldsAssign(ActiveConversionFields)),
  FileConversionInQueueSchema.pipe(Schema.fieldsAssign(ActiveConversionFields)),
  FileConversionConvertingSchema.pipe(Schema.fieldsAssign(ActiveConversionFields)),
  FileConversionCompletedSchema.pipe(Schema.fieldsAssign(ActiveConversionFields)),
  FileConversionErrorSchema.pipe(Schema.fieldsAssign(ActiveConversionFields)),
]);
const FileActiveConversionsEnvelopeSchema = Schema.Struct({
  mp4s: Schema.Array(FileActiveConversionSchema),
});
export const FileSubtitleSchema = Schema.Struct({
  format: Schema.String,
  key: Schema.String,
  language: Schema.String,
  language_code: Schema.String,
  name: Schema.String,
  source: Schema.String,
  url: Schema.String,
});
const FileSubtitlesEnvelopeSchema = Schema.Struct({
  default: Schema.NullOr(Schema.String),
  subtitles: Schema.Array(FileSubtitleSchema),
});
const FileDeleteResultEnvelopeSchema = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  skipped: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  status: Schema.Literal("OK"),
});
export const FilesMoveErrorSchema = Schema.Struct({
  error_type: Schema.String,
  id: Schema.Int,
  name: Schema.NullOr(Schema.String),
  status_code: Schema.Int,
});
const FilesMoveEnvelopeSchema = Schema.Struct({
  errors: Schema.Array(FilesMoveErrorSchema),
  status: Schema.Literal("OK"),
});
export const FileExtractionStatusSchema = Schema.Literals([
  "ERROR",
  "EXTRACTED",
  "EXTRACTING",
  "NEW",
  "PASSWORD",
  "PASSWORD_OBTAINED",
  "SENT_TO_QUEUE",
]);
export const FileExtractionSchema = Schema.Struct({
  files: Schema.Array(Schema.Int),
  id: Schema.Int,
  message: Schema.NullOr(Schema.String),
  name: Schema.String,
  num_parts: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  status: FileExtractionStatusSchema,
});
const FileExtractionsEnvelopeSchema = Schema.Struct({
  extractions: Schema.Array(FileExtractionSchema),
  status: Schema.optional(Schema.Literal("OK")),
});
const FilesBulkSelectionSchema = makeCursorSelectionSchema("ids", "excludeIds", {});
const FilesDeleteOptionsSchema = Schema.Struct({
  ignoreFileOwner: Schema.optional(Schema.Boolean),
  partialDelete: Schema.optional(Schema.Boolean),
  skipTrash: Schema.optional(Schema.Boolean),
});
const FilesSelectionDeleteOptionsSchema = Schema.Struct({
  partialDelete: Schema.optional(Schema.Boolean),
  skipTrash: Schema.optional(Schema.Boolean),
});
const FilesIdsInputSchema = Schema.Array(PositiveFileIdSchema).check(Schema.isMinLength(1));
const FilesMoveInputSchema = Schema.Struct({
  ids: FilesIdsInputSchema,
  parentId: NonNegativeFileIdSchema,
});
const FilesMoveSelectionInputSchema = Schema.Struct({
  parentId: NonNegativeFileIdSchema,
  selection: FilesBulkSelectionSchema,
});
const FilesWatchStatusInputSchema = makeCursorSelectionSchema("ids", "excludeIds", {
  watched: Schema.Boolean,
});
const FilesExtractInputSchema = makeCursorSelectionSchema("ids", "excludeIds", {
  password: Schema.optional(NonEmptyStringSchema),
});
const FileUploadInputSchema = Schema.Struct({
  file: Schema.instanceOf(Blob),
  fileName: Schema.optional(NonEmptyStringSchema),
  parentId: Schema.optional(NonNegativeFileIdSchema),
});
const FileUploadOptionsSchema = Schema.Struct({
  oauthToken: Schema.optional(NonEmptyStringSchema),
});
const FilesNextFileSchema = Schema.Struct({
  id: Schema.Int,
  name: Schema.String,
  parent_id: Schema.NullOr(Schema.Int),
});
const FilesNextFileEnvelopeSchema = Schema.Struct({
  next_file: FilesNextFileSchema,
  status: Schema.Literal("OK"),
});
const FilesNextVideoEnvelopeSchema = Schema.Struct({
  next_video: FilesNextFileSchema,
  status: Schema.Literal("OK"),
});
export type FileType = Schema.Schema.Type<typeof FileTypeSchema>;
export type FolderType = Schema.Schema.Type<typeof FolderTypeSchema>;
export type FileSort = Schema.Schema.Type<typeof FileSortSchema>;
export type FileSetSortInput = Schema.Schema.Type<typeof FileSetSortInputSchema>;
export type FileCopyInput = Schema.Schema.Type<typeof FileCopyInputSchema>;
export type FileTouchInput = Schema.Schema.Type<typeof FileTouchInputSchema>;
export type FileMediaMetadata = Schema.Schema.Type<typeof FileMediaMetadataSchema>;
export type FileMediaInfo = Schema.Schema.Type<typeof FileMediaInfoSchema>;
export type FileBase = Schema.Schema.Type<typeof FileBaseSchema>;
export type FileBroad = Schema.Schema.Type<typeof FileBroadSchema>;
export type FileCore = FileBase;
export type FileVideoMetadata = FileMediaMetadata;
export type FileQuery = Schema.Schema.Type<typeof FileQuerySchema>;
export type FileGetChildInput = Schema.Schema.Type<typeof FileGetChildInputSchema>;
export type FilesListQuery = Schema.Schema.Type<typeof FilesListQuerySchema>;
export type FilesSearchQuery = Schema.Schema.Type<typeof FilesSearchQuerySchema>;
export type FileBreadcrumb = Schema.Schema.Type<typeof FileBreadcrumbSchema>;
export type FileListResponse = Schema.Schema.Type<typeof FilesListEnvelopeSchema>;
export type FileListContinuationResponse = Schema.Schema.Type<
  typeof FilesListContinueEnvelopeSchema
>;
export type FileSearchResponse = Schema.Schema.Type<typeof FilesSearchEnvelopeSchema>;
export type FileCreateFolderInput = Schema.Schema.Type<typeof FileCreateFolderInputSchema>;
export type FileRenameInput = Schema.Schema.Type<typeof FileRenameInputSchema>;
export type FileStartFromSetInput = Schema.Schema.Type<typeof FileStartFromSetInputSchema>;
export type FileConversionStatus = Schema.Schema.Type<typeof FileConversionStatusSchema>;
export type FileActiveConversion = Schema.Schema.Type<typeof FileActiveConversionSchema>;
export type FileExtractionStatus = Schema.Schema.Type<typeof FileExtractionStatusSchema>;
export type FileExtraction = Schema.Schema.Type<typeof FileExtractionSchema>;
export type FileSubtitle = Schema.Schema.Type<typeof FileSubtitleSchema>;
export type FilesMoveError = Schema.Schema.Type<typeof FilesMoveErrorSchema>;
export type FilesBulkSelection = Schema.Schema.Type<typeof FilesBulkSelectionSchema>;
export type FileUploadTransfer = Schema.Schema.Type<typeof FileUploadTransferSchema>;
export type FileUploadEnvelope = Schema.Schema.Type<typeof FileUploadEnvelopeSchema>;
export type FileUploadResult =
  | {
      readonly type: "file";
      readonly file: FileBroad;
    }
  | {
      readonly type: "transfer";
      readonly transfer: FileUploadTransfer;
    };
export type FileDirectAccessOptions = {
  readonly oauthToken?: string;
  readonly useTunnel?: boolean;
};
export type FileApiDownloadUrlOptions = FileDirectAccessOptions & {
  readonly name?: string;
};
export type FileApiMp4DownloadUrlOptions = FileDirectAccessOptions & {
  readonly convert?: boolean;
  readonly name?: string;
};
export type FileHlsStreamUrlOptions = {
  readonly maxSubtitleCount?: number;
  readonly oauthToken?: string;
  readonly playOriginal?: boolean;
  readonly subtitleLanguages?: ReadonlyArray<string>;
};
export type FileUploadInput = {
  readonly file: Blob;
  readonly fileName?: string;
  readonly parentId?: number;
};
export type FileUploadRequestDescriptor = {
  readonly body: FormData;
  readonly method: "POST";
  readonly url: string;
};
export type FileResponseFor<TQuery extends FileQuery> = FileBase &
  (TQuery["stream_url"] extends 1
    ? {
        readonly stream_url: string | null;
      }
    : {}) &
  (TQuery["mp4_status"] extends 1
    ? {
        readonly mp4_size: number | null;
        readonly need_convert: boolean;
      }
    : {}) &
  (TQuery["mp4_stream_url"] extends 1
    ?
        | {
            readonly is_mp4_available: true;
            readonly mp4_stream_url: string | null;
            readonly mp4_size: number | null;
            readonly need_convert: boolean;
          }
        | {
            readonly is_mp4_available: false;
            readonly mp4_size: number | null;
            readonly need_convert: boolean;
          }
    : {}) &
  (TQuery["video_metadata"] extends 1
    ? TQuery["media_metadata"] extends 1
      ? {}
      : {
          readonly video_metadata: FileMediaMetadata | null;
        }
    : {}) &
  (TQuery["media_metadata"] extends 1
    ? {
        readonly media_metadata: FileMediaMetadata | null;
      }
    : {}) &
  (TQuery["codecs"] extends 1
    ? {
        readonly content_type_and_codecs: string | null;
      }
    : {}) &
  (TQuery["media_info"] extends 1
    ? {
        readonly media_info: FileMediaInfo | null;
      }
    : {});
export const QueryFilesErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "query",
  knownErrors: [
    { statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
  ],
});
export const ContinueFilesErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "continue",
  knownErrors: [
    { statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
  ],
});
export const GetFileErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "get",
  knownErrors: [
    { statusCode: 404 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
  ],
});
export const GetFileChildErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "getChild",
  knownErrors: [
    { statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 403 as const },
    { statusCode: 404 as const },
  ],
});
export const CopyFileErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "copy",
  knownErrors: [
    { errorType: "NAME_ALREADY_EXIST", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
    { statusCode: 403 as const },
    { statusCode: 404 as const },
  ],
});
export const TouchFilesErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "touch",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
    { statusCode: 403 as const },
  ],
});
export const CanWriteFileErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "canWrite",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 402 as const },
    { statusCode: 403 as const },
    { statusCode: 404 as const },
  ],
});
export const SearchFilesErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "search",
  knownErrors: [
    { errorType: "SEARCH_TOO_LONG_QUERY", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
  ],
});
export const CreateFolderErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "createFolder",
  knownErrors: [
    { errorType: "EMPTY_NAME", statusCode: 400 as const },
    { errorType: "SLASH_IN_NAME", statusCode: 400 as const },
    { errorType: "NAME_TOO_LONG", statusCode: 400 as const },
    { errorType: "NAME_ALREADY_EXIST", statusCode: 400 as const },
    { statusCode: 403 as const },
    { statusCode: 404 as const },
  ],
});
export const RenameFileErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "rename",
  knownErrors: [
    { errorType: "EMPTY_NAME", statusCode: 400 as const },
    { errorType: "SLASH_IN_NAME", statusCode: 400 as const },
    { errorType: "NAME_TOO_LONG", statusCode: 400 as const },
    { errorType: "NAME_ALREADY_EXIST", statusCode: 400 as const },
    { statusCode: 403 as const },
    { statusCode: 404 as const },
  ],
});
export const StartFromErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "startFrom",
  knownErrors: [
    { errorType: "FEATURE_DISABLED", statusCode: 400 as const },
    { errorType: "INVALID_MEDIA", statusCode: 400 as const },
    { statusCode: 400 as const },
    { statusCode: 404 as const },
  ],
});
export const DownloadUrlErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "getDownloadUrl",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 402 as const },
    { statusCode: 404 as const },
  ],
});
export const FileMp4ErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "mp4",
  knownErrors: [
    { errorType: "INVALID_MEDIA", statusCode: 400 as const },
    { errorType: "MP4_NOT_FOUND", statusCode: 400 as const },
    { errorType: "NotFile", statusCode: 400 as const },
    { statusCode: 400 as const },
    { statusCode: 404 as const },
  ],
});
export const FileSubtitlesErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "listSubtitles",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 404 as const },
    { statusCode: 402 as const },
  ],
});
export const FileActiveConversionsErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "listActiveConversions",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 402 as const },
  ],
});
export const FileMp4MutationErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "manageMp4",
  knownErrors: [
    { errorType: "MP4_NOT_FOUND", statusCode: 400 as const },
    { errorType: "NotFile", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
    { statusCode: 402 as const },
    { statusCode: 403 as const },
    { statusCode: 404 as const },
  ],
});
export const FileExtractionsErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "extract",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
    { statusCode: 402 as const },
  ],
});
export const FileWatchStatusErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "setWatchStatus",
  knownErrors: [
    { errorType: "FEATURE_DISABLED", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
  ],
});
export const FileUploadErrorSpec = definePutioOperationErrorSpec({
  domain: "files",
  operation: "upload",
  knownErrors: [
    { errorType: "Unauthorized", statusCode: 401 as const },
    { statusCode: 401 as const },
    { statusCode: 402 as const },
    { statusCode: 429 as const },
  ],
});
export type QueryFilesError = PutioOperationFailure<typeof QueryFilesErrorSpec>;
export type ContinueFilesError = PutioOperationFailure<typeof ContinueFilesErrorSpec>;
export type GetFileError = PutioOperationFailure<typeof GetFileErrorSpec>;
export type GetFileChildError = PutioOperationFailure<typeof GetFileChildErrorSpec>;
export type CopyFileError = PutioOperationFailure<typeof CopyFileErrorSpec>;
export type TouchFilesError = PutioOperationFailure<typeof TouchFilesErrorSpec>;
export type CanWriteFileError = PutioOperationFailure<typeof CanWriteFileErrorSpec>;
export type SearchFilesError = PutioOperationFailure<typeof SearchFilesErrorSpec>;
export type CreateFolderError = PutioOperationFailure<typeof CreateFolderErrorSpec>;
export type RenameFileError = PutioOperationFailure<typeof RenameFileErrorSpec>;
export type StartFromError = PutioOperationFailure<typeof StartFromErrorSpec>;
export type DownloadUrlError = PutioOperationFailure<typeof DownloadUrlErrorSpec>;
export type FileMp4Error = PutioOperationFailure<typeof FileMp4ErrorSpec>;
export type FileSubtitlesError = PutioOperationFailure<typeof FileSubtitlesErrorSpec>;
export type FileActiveConversionsError = PutioOperationFailure<
  typeof FileActiveConversionsErrorSpec
>;
export type FileMp4MutationError = PutioOperationFailure<typeof FileMp4MutationErrorSpec>;
export type FileExtractionsError = PutioOperationFailure<typeof FileExtractionsErrorSpec>;
export type FileWatchStatusError = PutioOperationFailure<typeof FileWatchStatusErrorSpec>;
export type FileUploadError = PutioOperationFailure<typeof FileUploadErrorSpec>;
const missingFieldError = (field: string) =>
  new PutioValidationError({
    cause: `Expected put.io to include "${field}" because it was requested`,
  });
const failMissingField = (field: string): Effect.Effect<never, PutioValidationError> =>
  Effect.fail(missingFieldError(field));
const widenValidationError = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | PutioValidationError, R> => effect;
const hasStreamUrl = (
  value: FileBroad,
): value is FileBroad & {
  readonly stream_url: string | null;
} => "stream_url" in value;
const hasMp4StreamUrl = (
  value: FileBroad,
): value is FileBroad & {
  readonly mp4_stream_url: string | null;
} => "mp4_stream_url" in value;
const hasMp4StreamUrlWhenAvailable = (
  value: FileBroad,
): value is FileBroad &
  (
    | {
        readonly is_mp4_available: true;
        readonly mp4_stream_url: string | null;
      }
    | {
        readonly is_mp4_available: false;
      }
  ) => !value.is_mp4_available || hasMp4StreamUrl(value);
const hasMp4StatusFields = (
  value: FileBroad,
): value is FileBroad & {
  readonly mp4_size: number | null;
  readonly need_convert: boolean;
} => "mp4_size" in value && typeof value.need_convert === "boolean";
const hasVideoMetadata = (
  value: FileBroad,
): value is FileBroad & {
  readonly video_metadata: FileMediaMetadata | null;
} => "video_metadata" in value;
const hasMediaMetadata = (
  value: FileBroad,
): value is FileBroad & {
  readonly media_metadata: FileMediaMetadata | null;
} => "media_metadata" in value;
const hasCodecs = (
  value: FileBroad,
): value is FileBroad & {
  readonly content_type_and_codecs: string | null;
} => "content_type_and_codecs" in value;
const hasMediaInfo = (
  value: FileBroad,
): value is FileBroad & {
  readonly media_info: FileMediaInfo | null;
} => "media_info" in value;
const useTunnelToQuery = (useTunnel?: boolean) =>
  useTunnel === false
    ? {
        notunnel: 1,
      }
    : {};
const resolveRouteContext = (
  oauthToken?: string,
): Effect.Effect<
  {
    readonly config: PutioSdkConfigShape;
    readonly oauthToken: string;
  },
  PutioSdkError,
  PutioSdkConfig
> =>
  Effect.gen(function* () {
    const config = yield* PutioSdkConfig;
    const resolvedOauthToken = oauthToken ?? config.accessToken;
    if (resolvedOauthToken) {
      return {
        config,
        oauthToken: resolvedOauthToken,
      };
    }
    return yield* Effect.fail(
      mapConfigurationError(
        "This helper requires an oauth token, but neither an override nor PutioSdkConfig.accessToken was provided",
      ),
    );
  });
const normalizeFileName = (name: string) => encodeURIComponent(name);
const toUploadResult = (value: FileUploadEnvelope): FileUploadResult => {
  if (value.file) {
    return {
      file: value.file,
      type: "file",
    };
  }
  if (value.transfer) {
    return {
      transfer: value.transfer,
      type: "transfer",
    };
  }
  throw new PutioValidationError({
    cause: 'Expected put.io upload response to contain either "file" or "transfer"',
  });
};
export const buildFileApiDownloadUrl = (
  baseUrl: string | URL,
  fileId: number,
  options: FileApiDownloadUrlOptions = {},
): string =>
  buildPutioUrl(
    baseUrl,
    options.name
      ? `/v2/files/${encodePathSegment(fileId)}/download/${normalizeFileName(options.name)}`
      : `/v2/files/${encodePathSegment(fileId)}/download`,
    {
      ...useTunnelToQuery(options.useTunnel),
      oauth_token: options.oauthToken,
    },
  );
export const buildFileApiContentUrl = (
  baseUrl: string | URL,
  fileId: number,
  options: FileDirectAccessOptions = {},
): string =>
  buildPutioUrl(baseUrl, `/v2/files/${encodePathSegment(fileId)}/stream`, {
    ...useTunnelToQuery(options.useTunnel),
    oauth_token: options.oauthToken,
  });
export const buildFileApiMp4DownloadUrl = (
  baseUrl: string | URL,
  fileId: number,
  options: FileApiMp4DownloadUrlOptions = {},
): string =>
  buildPutioUrl(
    baseUrl,
    options.name
      ? `/v2/files/${encodePathSegment(fileId)}/mp4/download/${normalizeFileName(options.name)}`
      : `/v2/files/${encodePathSegment(fileId)}/mp4/download`,
    {
      ...useTunnelToQuery(options.useTunnel),
      convert: options.convert ? 1 : undefined,
      oauth_token: options.oauthToken,
    },
  );
export const buildFileHlsStreamUrl = (
  baseUrl: string | URL,
  fileId: number,
  options: FileHlsStreamUrlOptions = {},
): string =>
  buildPutioUrl(baseUrl, `/v2/files/${encodePathSegment(fileId)}/hls/media.m3u8`, {
    max_subtitle_count: options.maxSubtitleCount,
    oauth_token: options.oauthToken,
    original:
      typeof options.playOriginal === "boolean" ? (options.playOriginal ? 1 : 0) : undefined,
    subtitle_languages: joinCsv(options.subtitleLanguages),
  });
export const createFileUploadFormData = (input: FileUploadInput): FormData => {
  const formData = new FormData();
  formData.append("file", input.file);
  if (input.fileName) {
    formData.append("filename", input.fileName);
  }
  if (input.parentId !== undefined) {
    formData.append("parent_id", String(input.parentId));
  }
  return formData;
};
const ensureFileQueryFields = <TQuery extends FileQuery, E>(
  effect: Effect.Effect<FileBroad, E, PutioSdkContext>,
  query: TQuery,
): Effect.Effect<FileResponseFor<TQuery>, E | PutioValidationError, PutioSdkContext> =>
  Effect.gen(function* () {
    const file = yield* widenValidationError(effect);
    if (query.stream_url === 1 && !hasStreamUrl(file)) {
      return yield* failMissingField("stream_url");
    }
    if ((query.mp4_status === 1 || query.mp4_stream_url === 1) && !hasMp4StatusFields(file)) {
      return yield* failMissingField(
        query.mp4_stream_url === 1 ? "mp4_size/need_convert" : "mp4_size",
      );
    }
    if (query.mp4_stream_url === 1 && !hasMp4StreamUrlWhenAvailable(file)) {
      return yield* failMissingField("mp4_stream_url");
    }
    if (query.video_metadata === 1 && query.media_metadata !== 1 && !hasVideoMetadata(file)) {
      return yield* failMissingField("video_metadata");
    }
    if (query.media_metadata === 1 && !hasMediaMetadata(file)) {
      return yield* failMissingField("media_metadata");
    }
    if (query.codecs === 1 && !hasCodecs(file)) {
      return yield* failMissingField("content_type_and_codecs");
    }
    if (query.media_info === 1 && !hasMediaInfo(file)) {
      return yield* failMissingField("media_info");
    }
    // Requested-field checks above turn the decoded broad payload into the
    // query-conditioned response contract the rest of the SDK can trust.
    return file as FileResponseFor<TQuery>;
  });
export const queryFiles = (
  parent: number | "friends",
  query: FilesListQuery = {},
): Effect.Effect<FileListResponse, QueryFilesError, PutioSdkContext> =>
  decodeAndRun(FilesListInputSchema, { parent, query }, (decodedInput) =>
    requestJson(FilesListEnvelopeSchema, {
      method: "GET",
      path:
        decodedInput.parent === "friends"
          ? "/v2/files/list/items-shared-with-you"
          : "/v2/files/list",
      query:
        decodedInput.parent === "friends"
          ? decodedInput.query
          : {
              ...decodedInput.query,
              parent_id: decodedInput.parent,
            },
    }),
  ).pipe(withOperationErrors(QueryFilesErrorSpec));
export const continueFiles = (
  cursor: string,
  query: {
    readonly per_page?: number;
  } = {},
): Effect.Effect<FileListContinuationResponse, ContinueFilesError, PutioSdkContext> =>
  decodeAndRun(FilesContinueInputSchema, { cursor, query }, (decodedInput) =>
    requestJson(FilesListContinueEnvelopeSchema, {
      body: {
        type: "form",
        value: {
          cursor: decodedInput.cursor,
        },
      },
      method: "POST",
      path: "/v2/files/list/continue",
      query: decodedInput.query,
    }),
  ).pipe(withOperationErrors(ContinueFilesErrorSpec));
export function getFile(input: {
  readonly id: number;
}): Effect.Effect<FileCore, GetFileError | PutioValidationError, PutioSdkContext>;
export function getFile<TQuery extends FileQuery>(input: {
  readonly id: number;
  readonly query: TQuery;
}): Effect.Effect<FileResponseFor<TQuery>, GetFileError | PutioValidationError, PutioSdkContext>;
export function getFile(input: { readonly id: number; readonly query?: FileQuery | null }) {
  return decodeAndRun(FileGetInputSchema, input, (decodedInput) => {
    const effect = requestJson(FileEnvelopeSchema, {
      method: "GET",
      path: `/v2/files/${encodePathSegment(decodedInput.id)}`,
      query: decodedInput.query,
    }).pipe(selectJsonField("file"), withOperationErrors(GetFileErrorSpec));
    return decodedInput.query === undefined
      ? effect
      : ensureFileQueryFields(effect, decodedInput.query);
  });
}
export function getFileChild(input: {
  readonly name: string;
  readonly parentId: number;
}): Effect.Effect<FileCore, GetFileChildError | PutioValidationError, PutioSdkContext>;
export function getFileChild<TQuery extends FileQuery>(input: {
  readonly name: string;
  readonly parentId: number;
  readonly query: TQuery;
}): Effect.Effect<
  FileResponseFor<TQuery>,
  GetFileChildError | PutioValidationError,
  PutioSdkContext
>;
export function getFileChild(input: FileGetChildInput) {
  return Schema.decodeUnknownEffect(FileGetChildInputSchema)(input).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedInput) => {
      const effect = requestJson(FileEnvelopeSchema, {
        method: "GET",
        path: `/v2/files/${encodePathSegment(decodedInput.parentId)}/child`,
        query: {
          ...decodedInput.query,
          name: decodedInput.name,
        },
      }).pipe(selectJsonField("file"), withOperationErrors(GetFileChildErrorSpec));
      return decodedInput.query === undefined
        ? effect
        : ensureFileQueryFields(effect, decodedInput.query);
    }),
  );
}
export const copyFile = (
  input: FileCopyInput,
): Effect.Effect<FileBroad, CopyFileError | PutioValidationError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(FileCopyInputSchema)(input).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedInput) =>
      requestJson(FileEnvelopeSchema, {
        body: {
          type: "form",
          value: {
            file_id: decodedInput.fileId,
            name: decodedInput.name,
            parent_id: decodedInput.parentId,
          },
        },
        method: "POST",
        path: "/v2/files/copy",
      }),
    ),
    selectJsonField("file"),
    withOperationErrors(CopyFileErrorSpec),
  );
export const touchFiles = (
  input: FileTouchInput,
): Effect.Effect<void, TouchFilesError | PutioValidationError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(FileTouchInputSchema)(input).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedInput) =>
      requestJson(OkResponseSchema, {
        body: {
          type: "form",
          value: {
            file_ids: joinCsv(decodedInput.fileIds),
            updated_at: decodedInput.updatedAt?.toISOString(),
          },
        },
        method: "POST",
        path: "/v2/files/touch",
      }),
    ),
    Effect.asVoid,
    withOperationErrors(TouchFilesErrorSpec),
  );
export const canWriteFile = (
  fileId: number,
): Effect.Effect<number, CanWriteFileError | PutioValidationError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(PositiveFileIdSchema)(fileId).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedFileId) =>
      requestJson(FileCanWriteEnvelopeSchema, {
        method: "GET",
        path: `/v2/files/${encodePathSegment(decodedFileId)}/can-write`,
      }),
    ),
    selectJsonField("user_id"),
    withOperationErrors(CanWriteFileErrorSpec),
  );
export const searchFiles = (
  query: FilesSearchQuery,
): Effect.Effect<FileSearchResponse, SearchFilesError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(FilesSearchQuerySchema)(query).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedQuery) =>
      requestJson(FilesSearchEnvelopeSchema, {
        method: "GET",
        path: "/v2/files/search",
        query: decodedQuery,
      }),
    ),
    withOperationErrors(SearchFilesErrorSpec),
  );
export const continueSearch = (
  cursor: string,
  query: {
    readonly per_page?: number;
  } = {},
): Effect.Effect<FileSearchResponse, SearchFilesError, PutioSdkContext> =>
  decodeAndRun(FilesSearchContinueInputSchema, { cursor, query }, (decodedInput) =>
    requestJson(FilesSearchEnvelopeSchema, {
      body: {
        type: "form",
        value: {
          cursor: decodedInput.cursor,
        },
      },
      method: "POST",
      path: "/v2/files/search/continue",
      query: decodedInput.query,
    }),
  ).pipe(withOperationErrors(SearchFilesErrorSpec));
export const setFileSort = (
  input: FileSetSortInput,
): Effect.Effect<void, PutioSdkError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(FileSetSortInputSchema)(input).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedInput) =>
      requestJson(OkResponseSchema, {
        body: {
          type: "form",
          value: {
            file_id: decodedInput.fileId,
            sort_by: decodedInput.sortBy,
          },
        },
        method: "POST",
        path: "/v2/files/set-sort-by",
      }),
    ),
    Effect.asVoid,
  );
export const resetFileSortSettings = (): Effect.Effect<void, PutioSdkError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: "/v2/files/remove-sort-by-settings",
  }).pipe(Effect.asVoid);
export const createFolder = (
  input: FileCreateFolderInput,
): Effect.Effect<FileBroad, CreateFolderError, PutioSdkContext> =>
  decodeAndRun(FileCreateFolderInputSchema, input, (decodedInput) =>
    requestJson(FileEnvelopeSchema, {
      body: {
        type: "form",
        value: decodedInput,
      },
      method: "POST",
      path: "/v2/files/create-folder",
    }),
  ).pipe(selectJsonField("file"), withOperationErrors(CreateFolderErrorSpec));
export const renameFile = (
  input: FileRenameInput,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, RenameFileError, PutioSdkContext> =>
  decodeAndRun(FileRenameInputSchema, input, (decodedInput) =>
    requestJson(OkResponseSchema, {
      body: {
        type: "form",
        value: decodedInput,
      },
      method: "POST",
      path: "/v2/files/rename",
    }),
  ).pipe(withOperationErrors(RenameFileErrorSpec));
export const deleteFiles = (
  ids: ReadonlyArray<number>,
  options: {
    readonly ignoreFileOwner?: boolean;
    readonly partialDelete?: boolean;
    readonly skipTrash?: boolean;
  } = {},
): Effect.Effect<
  Schema.Schema.Type<typeof FileDeleteResultEnvelopeSchema>,
  PutioSdkError,
  PutioSdkContext
> =>
  decodeAndRun(
    Schema.Struct({ ids: FilesIdsInputSchema, options: FilesDeleteOptionsSchema }),
    { ids, options },
    (decodedInput) =>
      requestJson(FileDeleteResultEnvelopeSchema, {
        body: {
          type: "form",
          value: {
            file_ids: joinCsv(decodedInput.ids),
          },
        },
        method: "POST",
        path: "/v2/files/delete",
        query: {
          partial_delete: decodedInput.options.partialDelete,
          skip_nonexistents: true,
          skip_owner_check: decodedInput.options.ignoreFileOwner,
          skip_trash: decodedInput.options.skipTrash,
        },
      }),
  );
export const deleteFileSelection = (
  selection: FilesBulkSelection,
  options: {
    readonly partialDelete?: boolean;
    readonly skipTrash?: boolean;
  } = {},
): Effect.Effect<
  Schema.Schema.Type<typeof FileDeleteResultEnvelopeSchema>,
  PutioSdkError,
  PutioSdkContext
> =>
  decodeAndRun(
    Schema.Struct({
      options: FilesSelectionDeleteOptionsSchema,
      selection: FilesBulkSelectionSchema,
    }),
    { options, selection },
    (decodedInput) =>
      requestJson(FileDeleteResultEnvelopeSchema, {
        body: {
          type: "form",
          value: toCursorSelectionForm(decodedInput.selection),
        },
        method: "POST",
        path: "/v2/files/delete",
        query: {
          partial_delete: decodedInput.options.partialDelete,
          skip_nonexistents: true,
          skip_trash: decodedInput.options.skipTrash,
        },
      }),
  );
export const moveFiles = (
  ids: ReadonlyArray<number>,
  parentId: number,
): Effect.Effect<ReadonlyArray<FilesMoveError>, PutioSdkError, PutioSdkContext> =>
  decodeAndRun(FilesMoveInputSchema, { ids, parentId }, (decodedInput) =>
    requestJson(FilesMoveEnvelopeSchema, {
      body: {
        type: "form",
        value: {
          file_ids: joinCsv(decodedInput.ids),
          parent_id: decodedInput.parentId,
        },
      },
      method: "POST",
      path: "/v2/files/move",
    }),
  ).pipe(selectJsonField("errors"));
export const moveFileSelection = (
  selection: FilesBulkSelection,
  parentId: number,
): Effect.Effect<ReadonlyArray<FilesMoveError>, PutioSdkError, PutioSdkContext> =>
  decodeAndRun(FilesMoveSelectionInputSchema, { parentId, selection }, (decodedInput) =>
    requestJson(FilesMoveEnvelopeSchema, {
      body: {
        type: "form",
        value: {
          ...toCursorSelectionForm(decodedInput.selection),
          parent_id: decodedInput.parentId,
        },
      },
      method: "POST",
      path: "/v2/files/move",
    }),
  ).pipe(selectJsonField("errors"));
export const getStartFrom = (
  fileId: number,
): Effect.Effect<number, StartFromError, PutioSdkContext> =>
  decodeAndRun(PositiveFileIdSchema, fileId, (decodedFileId) =>
    requestJson(FileStartFromEnvelopeSchema, {
      method: "GET",
      path: `/v2/files/${encodePathSegment(decodedFileId)}/start-from`,
    }),
  ).pipe(selectJsonField("start_from"), withOperationErrors(StartFromErrorSpec));
export const getDownloadUrl = (
  fileId: number,
): Effect.Effect<string, DownloadUrlError, PutioSdkContext> =>
  decodeAndRun(PositiveFileIdSchema, fileId, (decodedFileId) =>
    requestJson(FileDownloadUrlEnvelopeSchema, {
      method: "GET",
      path: `/v2/files/${encodePathSegment(decodedFileId)}/url`,
    }),
  ).pipe(selectJsonField("url"), withOperationErrors(DownloadUrlErrorSpec));
export const getApiDownloadUrl = (
  fileId: number,
  options: FileApiDownloadUrlOptions = {},
): Effect.Effect<string, PutioSdkError, PutioSdkConfig> =>
  resolveRouteContext(options.oauthToken).pipe(
    Effect.map(({ config, oauthToken }) =>
      buildFileApiDownloadUrl(config.baseUrl ?? "https://api.put.io", fileId, {
        ...options,
        oauthToken,
      }),
    ),
  );
export const getApiContentUrl = (
  fileId: number,
  options: FileDirectAccessOptions = {},
): Effect.Effect<string, PutioSdkError, PutioSdkConfig> =>
  resolveRouteContext(options.oauthToken).pipe(
    Effect.map(({ config, oauthToken }) =>
      buildFileApiContentUrl(config.baseUrl ?? "https://api.put.io", fileId, {
        ...options,
        oauthToken,
      }),
    ),
  );
export const getApiMp4DownloadUrl = (
  fileId: number,
  options: FileApiMp4DownloadUrlOptions = {},
): Effect.Effect<string, PutioSdkError, PutioSdkConfig> =>
  resolveRouteContext(options.oauthToken).pipe(
    Effect.map(({ config, oauthToken }) =>
      buildFileApiMp4DownloadUrl(config.baseUrl ?? "https://api.put.io", fileId, {
        ...options,
        oauthToken,
      }),
    ),
  );
export const getHlsStreamUrl = (
  fileId: number,
  options: FileHlsStreamUrlOptions = {},
): Effect.Effect<string, PutioSdkError, PutioSdkConfig> =>
  resolveRouteContext(options.oauthToken).pipe(
    Effect.map(({ config, oauthToken }) =>
      buildFileHlsStreamUrl(config.baseUrl ?? "https://api.put.io", fileId, {
        ...options,
        oauthToken,
      }),
    ),
  );
export const listFileSubtitles = (
  fileId: number,
  options: {
    readonly languages?: ReadonlyArray<string>;
  } = {},
): Effect.Effect<
  {
    readonly default: string | null;
    readonly subtitles: ReadonlyArray<FileSubtitle>;
  },
  FileSubtitlesError,
  PutioSdkContext
> =>
  decodeAndRun(FileSubtitlesInputSchema, { fileId, options }, (decodedInput) =>
    requestJson(FileSubtitlesEnvelopeSchema, {
      method: "GET",
      path: `/v2/files/${encodePathSegment(decodedInput.fileId)}/subtitles`,
      query: decodedInput.options.languages
        ? {
            languages: joinCsv(decodedInput.options.languages),
          }
        : undefined,
    }),
  ).pipe(withOperationErrors(FileSubtitlesErrorSpec));
export const setStartFrom = (
  input: FileStartFromSetInput,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, StartFromError, PutioSdkContext> =>
  decodeAndRun(FileStartFromSetInputSchema, input, (decodedInput) =>
    requestJson(OkResponseSchema, {
      body: {
        type: "form",
        value: {
          time: decodedInput.time,
        },
      },
      method: "POST",
      path: `/v2/files/${encodePathSegment(decodedInput.file_id)}/start-from`,
    }),
  ).pipe(withOperationErrors(StartFromErrorSpec));
export const resetStartFrom = (
  fileId: number,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, StartFromError, PutioSdkContext> =>
  decodeAndRun(PositiveFileIdSchema, fileId, (decodedFileId) =>
    requestJson(OkResponseSchema, {
      method: "POST",
      path: `/v2/files/${encodePathSegment(decodedFileId)}/start-from/delete`,
    }),
  ).pipe(withOperationErrors(StartFromErrorSpec));
export const getMp4Status = (
  fileId: number,
): Effect.Effect<FileConversionStatus, FileMp4Error, PutioSdkContext> =>
  decodeAndRun(PositiveFileIdSchema, fileId, (decodedFileId) =>
    requestJson(FileConversionStatusEnvelopeSchema, {
      method: "GET",
      path: `/v2/files/${encodePathSegment(decodedFileId)}/mp4`,
    }),
  ).pipe(selectJsonField("mp4"), withOperationErrors(FileMp4ErrorSpec));
export const convertFileToMp4 = (
  fileId: number,
): Effect.Effect<FileConversionStatus, FileMp4Error, PutioSdkContext> =>
  decodeAndRun(PositiveFileIdSchema, fileId, (decodedFileId) =>
    requestJson(FileConversionStatusEnvelopeSchema, {
      method: "POST",
      path: `/v2/files/${encodePathSegment(decodedFileId)}/mp4`,
    }),
  ).pipe(selectJsonField("mp4"), withOperationErrors(FileMp4ErrorSpec));
export const deleteFileMp4 = (
  fileId: number,
): Effect.Effect<void, FileMp4MutationError, PutioSdkContext> =>
  decodeAndRun(PositiveFileIdSchema, fileId, (decodedFileId) =>
    requestVoid({
      method: "DELETE",
      path: `/v2/files/${encodePathSegment(decodedFileId)}/mp4`,
    }),
  ).pipe(withOperationErrors(FileMp4MutationErrorSpec));
export const putMp4ToMyFiles = (
  fileId: number,
): Effect.Effect<void, FileMp4MutationError, PutioSdkContext> =>
  decodeAndRun(PositiveFileIdSchema, fileId, (decodedFileId) =>
    requestVoid({
      method: "GET",
      path: `/v2/files/${encodePathSegment(decodedFileId)}/put-mp4-to-my-folders`,
    }),
  ).pipe(withOperationErrors(FileMp4MutationErrorSpec));
export const convertFilesToMp4 = (
  ids: ReadonlyArray<number>,
): Effect.Effect<number, PutioSdkError, PutioSdkContext> =>
  decodeAndRun(FilesIdsInputSchema, ids, (decodedIds) =>
    requestJson(FilesBulkConvertEnvelopeSchema, {
      body: {
        type: "form",
        value: {
          file_ids: joinCsv(decodedIds),
        },
      },
      method: "POST",
      path: "/v2/files/convert_mp4",
    }),
  ).pipe(selectJsonField("count"));
export const convertFileSelectionToMp4 = (
  selection: FilesBulkSelection,
): Effect.Effect<number, PutioSdkError, PutioSdkContext> =>
  decodeAndRun(FilesBulkSelectionSchema, selection, (decodedSelection) =>
    requestJson(FilesBulkConvertEnvelopeSchema, {
      body: {
        type: "form",
        value: toCursorSelectionForm(decodedSelection),
      },
      method: "POST",
      path: "/v2/files/convert_mp4",
    }),
  ).pipe(selectJsonField("count"));
export const listActiveMp4Conversions = (): Effect.Effect<
  ReadonlyArray<FileActiveConversion>,
  FileActiveConversionsError,
  PutioSdkContext
> =>
  requestJson(FileActiveConversionsEnvelopeSchema, {
    method: "GET",
    path: "/v2/mp4/queue",
  }).pipe(selectJsonField("mp4s"), withOperationErrors(FileActiveConversionsErrorSpec));
export const setFilesWatchStatus = (
  selection: FilesBulkSelection & {
    readonly watched: boolean;
  },
): Effect.Effect<void, FileWatchStatusError, PutioSdkContext> =>
  decodeAndRun(FilesWatchStatusInputSchema, selection, (decodedSelection) =>
    requestVoid({
      body: {
        type: "form",
        value: {
          ...toCursorSelectionForm(decodedSelection),
          watched: decodedSelection.watched,
        },
      },
      method: "POST",
      path: "/v2/files/watch-status",
    }),
  ).pipe(withOperationErrors(FileWatchStatusErrorSpec));
export const extractFiles = (
  selection: FilesBulkSelection & {
    readonly password?: string;
  },
): Effect.Effect<ReadonlyArray<FileExtraction>, FileExtractionsError, PutioSdkContext> =>
  decodeAndRun(FilesExtractInputSchema, selection, (decodedSelection) =>
    requestJson(FileExtractionsEnvelopeSchema, {
      body: {
        type: "form",
        value: {
          ...toCursorSelectionForm(decodedSelection, "user_file_ids"),
          password: decodedSelection.password,
        },
      },
      method: "POST",
      path: "/v2/files/extract",
    }),
  ).pipe(selectJsonField("extractions"), withOperationErrors(FileExtractionsErrorSpec));
export const listFileExtractions = (): Effect.Effect<
  ReadonlyArray<FileExtraction>,
  FileExtractionsError,
  PutioSdkContext
> =>
  requestJson(FileExtractionsEnvelopeSchema, {
    method: "GET",
    path: "/v2/files/extract",
  }).pipe(selectJsonField("extractions"), withOperationErrors(FileExtractionsErrorSpec));
export const deleteFileExtraction = (
  extractionId: number,
): Effect.Effect<void, PutioSdkError, PutioSdkContext> =>
  decodeAndRun(PositiveIntegerSchema, extractionId, (decodedExtractionId) =>
    requestVoid({
      method: "DELETE",
      path: `/v2/files/extract/${encodePathSegment(decodedExtractionId)}`,
    }),
  );
export const findNextFile = (
  fileId: number,
  fileType: FileType,
): Effect.Effect<Schema.Schema.Type<typeof FilesNextFileSchema>, PutioSdkError, PutioSdkContext> =>
  decodeAndRun(FileNextInputSchema, { fileId, fileType }, (decodedInput) =>
    requestJson(FilesNextFileEnvelopeSchema, {
      method: "GET",
      path: `/v2/files/${encodePathSegment(decodedInput.fileId)}/next-file`,
      query: {
        file_type: decodedInput.fileType,
      },
    }),
  ).pipe(selectJsonField("next_file"));
export const findNextVideo = (
  fileId: number,
): Effect.Effect<Schema.Schema.Type<typeof FilesNextFileSchema>, PutioSdkError, PutioSdkContext> =>
  decodeAndRun(PositiveFileIdSchema, fileId, (decodedFileId) =>
    requestJson(FilesNextVideoEnvelopeSchema, {
      method: "GET",
      path: `/v2/files/${encodePathSegment(decodedFileId)}/next-video`,
    }),
  ).pipe(selectJsonField("next_video"));
export const createFileUploadRequest = (
  input: FileUploadInput,
  options: {
    readonly oauthToken?: string;
  } = {},
): Effect.Effect<FileUploadRequestDescriptor, PutioSdkError, PutioSdkConfig> =>
  decodeAndRun(
    Schema.Struct({ input: FileUploadInputSchema, options: FileUploadOptionsSchema }),
    { input, options },
    (decoded) =>
      resolveRouteContext(decoded.options.oauthToken).pipe(
        Effect.map(({ config, oauthToken }) => ({
          body: createFileUploadFormData(decoded.input),
          method: "POST" as const,
          url: buildPutioUrl(config.uploadBaseUrl ?? "https://upload.put.io", "/v2/files/upload", {
            oauth_token: oauthToken,
          }),
        })),
      ),
  );
export const uploadFile = (
  input: FileUploadInput,
  options: {
    readonly oauthToken?: string;
  } = {},
): Effect.Effect<FileUploadResult, FileUploadError | PutioValidationError, PutioSdkContext> =>
  decodeAndRun(
    Schema.Struct({ input: FileUploadInputSchema, options: FileUploadOptionsSchema }),
    { input, options },
    (decoded) =>
      resolveRouteContext(decoded.options.oauthToken).pipe(
        Effect.flatMap(({ config, oauthToken }) =>
          requestJson(FileUploadEnvelopeSchema, {
            auth: {
              type: "none",
            },
            baseUrl: config.uploadBaseUrl ?? "https://upload.put.io",
            body: {
              type: "form-data",
              value: createFileUploadFormData(decoded.input),
            },
            method: "POST",
            path: "/v2/files/upload",
            query: {
              oauth_token: oauthToken,
            },
          }),
        ),
      ),
  ).pipe(Effect.map(toUploadResult), withOperationErrors(FileUploadErrorSpec));
