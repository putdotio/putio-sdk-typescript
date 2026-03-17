import { Effect, Schema } from "effect";

import {
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
  requestJson,
  requestVoid,
  type PutioSdkConfigShape,
  type PutioSdkContext,
  type PutioQuery,
  type PutioQueryValue,
} from "../core/http.js";

const RequestedFlag = Schema.Literal(1);

export const FileTypeSchema = Schema.Literal(
  "FOLDER",
  "FILE",
  "AUDIO",
  "VIDEO",
  "IMAGE",
  "ARCHIVE",
  "PDF",
  "TEXT",
  "SWF",
);

export const FolderTypeSchema = Schema.Literal("REGULAR", "SHARED_ROOT", "SHARED_FRIEND");

export const FileSortSchema = Schema.Literal(
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
);

export const FileMediaMetadataSchema = Schema.Struct({
  aspect_ratio: Schema.optional(Schema.NullOr(Schema.Number.pipe(Schema.nonNegative()))),
  codec: Schema.optional(Schema.NullOr(Schema.String)),
  duration: Schema.optional(Schema.NullOr(Schema.Number.pipe(Schema.nonNegative()))),
  height: Schema.optional(Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative()))),
  width: Schema.optional(Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative()))),
});

export const FileMediaInfoFormatSchema = Schema.Struct({
  bit_rate: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
  duration: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
  name: Schema.optional(Schema.String),
});

export const FileMediaInfoStreamSchema = Schema.Struct({
  channels: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  codec_name: Schema.optional(Schema.String),
  codec_type: Schema.optional(Schema.String),
  height: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  level: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  profile: Schema.optional(Schema.String),
  rfc6381_codec: Schema.optional(Schema.String),
  width: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
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
  id: Schema.Number.pipe(Schema.int()),
  is_hidden: Schema.Boolean,
  is_mp4_available: Schema.Boolean,
  is_shared: Schema.Boolean,
  name: Schema.String,
  opensubtitles_hash: Schema.NullOr(Schema.String),
  parent_id: Schema.NullOr(Schema.Number.pipe(Schema.int())),
  screenshot: Schema.NullOr(Schema.String),
  sha1: Schema.optional(Schema.NullOr(Schema.String)),
  size: Schema.Number.pipe(Schema.nonNegative()),
  start_from: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
  updated_at: Schema.String,
});

export const FileBroadSchema = Schema.extend(
  FileBaseSchema,
  Schema.Struct({
    content_type_and_codecs: Schema.optional(Schema.NullOr(Schema.String)),
    media_info: Schema.optional(Schema.NullOr(FileMediaInfoSchema)),
    media_metadata: Schema.optional(Schema.NullOr(FileMediaMetadataSchema)),
    mp4_size: Schema.optional(Schema.NullOr(Schema.Number.pipe(Schema.nonNegative()))),
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

export const FilesListQuerySchema = Schema.extend(
  FileQuerySchema.pipe(Schema.omit("codecs", "media_info")),
  Schema.Struct({
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
    per_page: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
    sort: Schema.optional(FileSortSchema),
    sort_by: Schema.optional(FileSortSchema),
    stream_url_parent: Schema.optional(RequestedFlag),
    total: Schema.optional(RequestedFlag),
    video_metadata_parent: Schema.optional(RequestedFlag),
  }),
);

export const FilesSearchQuerySchema = Schema.Struct({
  per_page: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  query: Schema.String,
  type: Schema.optional(Schema.Union(FileTypeSchema, Schema.Array(FileTypeSchema))),
});

export const FileBreadcrumbSchema = Schema.Tuple(Schema.Number.pipe(Schema.int()), Schema.String);

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
  total: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
});

const FilesListContinueEnvelopeSchema = Schema.Struct({
  breadcrumbs: Schema.optional(Schema.Array(FileBreadcrumbSchema)),
  cursor: Schema.NullOr(Schema.String),
  files: Schema.Array(FileBroadSchema),
  parent: Schema.optional(Schema.NullOr(FileBroadSchema)),
  status: Schema.Literal("OK"),
  total: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
});

const FilesSearchEnvelopeSchema = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  files: Schema.Array(FileBroadSchema),
  status: Schema.Literal("OK"),
  total: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
});

const FileCreateFolderInputSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  parent_id: Schema.optional(Schema.Number.pipe(Schema.int())),
  path: Schema.optional(Schema.String),
});

const FileRenameInputSchema = Schema.Struct({
  file_id: Schema.Number.pipe(Schema.int()),
  name: Schema.String,
});

const FileStartFromSetInputSchema = Schema.Struct({
  file_id: Schema.Number.pipe(Schema.int()),
  time: Schema.Number,
});

const FileStartFromEnvelopeSchema = Schema.Struct({
  start_from: Schema.Number.pipe(Schema.nonNegative()),
  status: Schema.Literal("OK"),
});

const FileDownloadUrlEnvelopeSchema = Schema.Struct({
  status: Schema.Literal("OK"),
  url: Schema.String,
});

const FileUploadTransferSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int()),
  name: Schema.String,
});

const FileUploadEnvelopeSchema = Schema.Struct({
  file: Schema.optional(FileBroadSchema),
  status: Schema.Literal("OK"),
  transfer: Schema.optional(FileUploadTransferSchema),
});

export const FileConversionStatusSchema = Schema.Union(
  Schema.Struct({
    id: Schema.Number.pipe(Schema.int()),
    status: Schema.Literal("NOT_AVAILABLE"),
  }),
  Schema.Struct({
    id: Schema.Number.pipe(Schema.int()),
    percent_done: Schema.Number.pipe(Schema.nonNegative()),
    status: Schema.Literal("IN_QUEUE"),
  }),
  Schema.Struct({
    id: Schema.Number.pipe(Schema.int()),
    percent_done: Schema.Number.pipe(Schema.nonNegative()),
    status: Schema.Literal("CONVERTING"),
  }),
  Schema.Struct({
    id: Schema.Number.pipe(Schema.int()),
    percent_done: Schema.Number.pipe(Schema.nonNegative()),
    size: Schema.Number.pipe(Schema.nonNegative()),
    status: Schema.Literal("COMPLETED"),
  }),
  Schema.Struct({
    id: Schema.Number.pipe(Schema.int()),
    status: Schema.Literal("ERROR"),
  }),
);

const FileConversionStatusEnvelopeSchema = Schema.Struct({
  mp4: FileConversionStatusSchema,
  status: Schema.Literal("OK"),
});

const FilesBulkConvertEnvelopeSchema = Schema.Struct({
  count: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  status: Schema.Literal("OK"),
});

export const FileActiveConversionSchema = Schema.extend(
  FileConversionStatusSchema,
  Schema.Struct({
    name: Schema.String,
  }),
);

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
  skipped: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  status: Schema.Literal("OK"),
});

export const FilesMoveErrorSchema = Schema.Struct({
  error_type: Schema.String,
  id: Schema.Number.pipe(Schema.int()),
  name: Schema.NullOr(Schema.String),
  status_code: Schema.Number.pipe(Schema.int()),
});

const FilesMoveEnvelopeSchema = Schema.Struct({
  errors: Schema.Array(FilesMoveErrorSchema),
  status: Schema.Literal("OK"),
});

export const FileExtractionStatusSchema = Schema.Literal(
  "ERROR",
  "EXTRACTED",
  "EXTRACTING",
  "NEW",
  "PASSWORD",
  "PASSWORD_OBTAINED",
  "SENT_TO_QUEUE",
);

export const FileExtractionSchema = Schema.Struct({
  files: Schema.Array(Schema.Number.pipe(Schema.int())),
  id: Schema.Number.pipe(Schema.int()),
  message: Schema.NullOr(Schema.String),
  name: Schema.String,
  num_parts: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  status: FileExtractionStatusSchema,
});

const FileExtractionsEnvelopeSchema = Schema.Struct({
  extractions: Schema.Array(FileExtractionSchema),
  status: Schema.optional(Schema.Literal("OK")),
});

const FilesBulkSelectionSchema = Schema.Struct({
  cursor: Schema.optional(Schema.String),
  excludeIds: Schema.optional(Schema.Array(Schema.Number.pipe(Schema.int()))),
  ids: Schema.optional(Schema.Array(Schema.Number.pipe(Schema.int()))),
});

const FilesNextFileSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int()),
  name: Schema.String,
  parent_id: Schema.NullOr(Schema.Number.pipe(Schema.int())),
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
export type FileMediaMetadata = Schema.Schema.Type<typeof FileMediaMetadataSchema>;
export type FileMediaInfo = Schema.Schema.Type<typeof FileMediaInfoSchema>;
export type FileBase = Schema.Schema.Type<typeof FileBaseSchema>;
export type FileBroad = Schema.Schema.Type<typeof FileBroadSchema>;
export type FileCore = FileBase;
export type FileVideoMetadata = FileMediaMetadata;
export type FileQuery = Schema.Schema.Type<typeof FileQuerySchema>;
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
  (TQuery["stream_url"] extends 1 ? { readonly stream_url: string | null } : {}) &
  (TQuery["mp4_status"] extends 1
    ? { readonly mp4_size: number | null; readonly need_convert: boolean }
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
      : { readonly video_metadata: FileMediaMetadata | null }
    : {}) &
  (TQuery["media_metadata"] extends 1
    ? { readonly media_metadata: FileMediaMetadata | null }
    : {}) &
  (TQuery["codecs"] extends 1 ? { readonly content_type_and_codecs: string | null } : {}) &
  (TQuery["media_info"] extends 1 ? { readonly media_info: FileMediaInfo | null } : {});

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

const normalizeFilesSearchQuery = (query: FilesSearchQuery): PutioQuery => {
  const type: PutioQueryValue =
    query.type === undefined || typeof query.type === "string" ? query.type : query.type.join(",");

  return {
    per_page: query.per_page,
    query: query.query,
    type,
  };
};

const selectionToForm = (selection: FilesBulkSelection, idsFieldName = "file_ids") => ({
  cursor: selection.cursor,
  exclude_ids: selection.excludeIds?.join(","),
  [idsFieldName]: selection.ids?.join(","),
});

const hasStreamUrl = (
  value: FileBroad,
): value is FileBroad & { readonly stream_url: string | null } => "stream_url" in value;

const hasMp4StreamUrl = (
  value: FileBroad,
): value is FileBroad & { readonly mp4_stream_url: string | null } => "mp4_stream_url" in value;

const hasMp4StreamUrlWhenAvailable = (
  value: FileBroad,
): value is FileBroad &
  (
    | { readonly is_mp4_available: true; readonly mp4_stream_url: string | null }
    | { readonly is_mp4_available: false }
  ) => !value.is_mp4_available || hasMp4StreamUrl(value);

const hasMp4StatusFields = (
  value: FileBroad,
): value is FileBroad & { readonly mp4_size: number | null; readonly need_convert: boolean } =>
  "mp4_size" in value && typeof value.need_convert === "boolean";

const hasVideoMetadata = (
  value: FileBroad,
): value is FileBroad & { readonly video_metadata: FileMediaMetadata | null } =>
  "video_metadata" in value;

const hasMediaMetadata = (
  value: FileBroad,
): value is FileBroad & { readonly media_metadata: FileMediaMetadata | null } =>
  "media_metadata" in value;

const hasCodecs = (
  value: FileBroad,
): value is FileBroad & { readonly content_type_and_codecs: string | null } =>
  "content_type_and_codecs" in value;

const hasMediaInfo = (
  value: FileBroad,
): value is FileBroad & { readonly media_info: FileMediaInfo | null } => "media_info" in value;

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
      ? `/v2/files/${fileId}/download/${normalizeFileName(options.name)}`
      : `/v2/files/${fileId}/download`,
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
  buildPutioUrl(baseUrl, `/v2/files/${fileId}/stream`, {
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
      ? `/v2/files/${fileId}/mp4/download/${normalizeFileName(options.name)}`
      : `/v2/files/${fileId}/mp4/download`,
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
  buildPutioUrl(baseUrl, `/v2/files/${fileId}/hls/media.m3u8`, {
    max_subtitle_count: options.maxSubtitleCount,
    oauth_token: options.oauthToken,
    original:
      typeof options.playOriginal === "boolean" ? (options.playOriginal ? 1 : 0) : undefined,
    subtitle_languages: options.subtitleLanguages?.join(","),
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
  requestJson(FilesListEnvelopeSchema, {
    method: "GET",
    path: parent === "friends" ? "/v2/files/list/items-shared-with-you" : "/v2/files/list",
    query:
      parent === "friends"
        ? query
        : {
            ...query,
            parent_id: parent,
          },
  }).pipe((effect) => withOperationErrors(effect, QueryFilesErrorSpec));

export const continueFiles = (
  cursor: string,
  query: {
    readonly per_page?: number;
  } = {},
): Effect.Effect<FileListContinuationResponse, ContinueFilesError, PutioSdkContext> =>
  requestJson(FilesListContinueEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        cursor,
      },
    },
    method: "POST",
    path: "/v2/files/list/continue",
    query,
  }).pipe((effect) => withOperationErrors(effect, ContinueFilesErrorSpec));

export function getFile(input: {
  readonly id: number;
}): Effect.Effect<FileCore, GetFileError | PutioValidationError, PutioSdkContext>;
export function getFile<TQuery extends FileQuery>(input: {
  readonly id: number;
  readonly query: TQuery;
}): Effect.Effect<FileResponseFor<TQuery>, GetFileError | PutioValidationError, PutioSdkContext>;
export function getFile(input: { readonly id: number; readonly query?: FileQuery }) {
  const effect = requestJson(FileEnvelopeSchema, {
    method: "GET",
    path: `/v2/files/${input.id}`,
    query: input.query,
  }).pipe(
    Effect.map(({ file }) => file),
    (requestEffect) => withOperationErrors(requestEffect, GetFileErrorSpec),
  );

  if (input.query === undefined) {
    return effect;
  }

  return ensureFileQueryFields(effect, input.query);
}

export const searchFiles = (
  query: FilesSearchQuery,
): Effect.Effect<FileSearchResponse, SearchFilesError, PutioSdkContext> =>
  requestJson(FilesSearchEnvelopeSchema, {
    method: "GET",
    path: "/v2/files/search",
    query: normalizeFilesSearchQuery(query),
  }).pipe((effect) => withOperationErrors(effect, SearchFilesErrorSpec));

export const continueSearch = (
  cursor: string,
  query: {
    readonly per_page?: number;
  } = {},
): Effect.Effect<FileSearchResponse, SearchFilesError, PutioSdkContext> =>
  requestJson(FilesSearchEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        cursor,
      },
    },
    method: "POST",
    path: "/v2/files/search/continue",
    query,
  }).pipe((effect) => withOperationErrors(effect, SearchFilesErrorSpec));

export const createFolder = (
  input: FileCreateFolderInput,
): Effect.Effect<FileBroad, CreateFolderError, PutioSdkContext> =>
  requestJson(FileEnvelopeSchema, {
    body: {
      type: "form",
      value: input,
    },
    method: "POST",
    path: "/v2/files/create-folder",
  }).pipe(
    Effect.map(({ file }) => file),
    (effect) => withOperationErrors(effect, CreateFolderErrorSpec),
  );

export const renameFile = (
  input: FileRenameInput,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, RenameFileError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: input,
    },
    method: "POST",
    path: "/v2/files/rename",
  }).pipe((effect) => withOperationErrors(effect, RenameFileErrorSpec));

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
  requestJson(FileDeleteResultEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        file_ids: ids.join(","),
      },
    },
    method: "POST",
    path: "/v2/files/delete",
    query: {
      partial_delete: options.partialDelete,
      skip_nonexistents: true,
      skip_owner_check: options.ignoreFileOwner,
      skip_trash: options.skipTrash,
    },
  });

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
  requestJson(FileDeleteResultEnvelopeSchema, {
    body: {
      type: "form",
      value: selectionToForm(selection),
    },
    method: "POST",
    path: "/v2/files/delete",
    query: {
      partial_delete: options.partialDelete,
      skip_nonexistents: true,
      skip_trash: options.skipTrash,
    },
  });

export const moveFiles = (
  ids: ReadonlyArray<number>,
  parentId: number,
): Effect.Effect<ReadonlyArray<FilesMoveError>, PutioSdkError, PutioSdkContext> =>
  requestJson(FilesMoveEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        file_ids: ids.join(","),
        parent_id: parentId,
      },
    },
    method: "POST",
    path: "/v2/files/move",
  }).pipe(Effect.map(({ errors }) => errors));

export const moveFileSelection = (
  selection: FilesBulkSelection,
  parentId: number,
): Effect.Effect<ReadonlyArray<FilesMoveError>, PutioSdkError, PutioSdkContext> =>
  requestJson(FilesMoveEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        ...selectionToForm(selection),
        parent_id: parentId,
      },
    },
    method: "POST",
    path: "/v2/files/move",
  }).pipe(Effect.map(({ errors }) => errors));

export const getStartFrom = (
  fileId: number,
): Effect.Effect<number, StartFromError, PutioSdkContext> =>
  requestJson(FileStartFromEnvelopeSchema, {
    method: "GET",
    path: `/v2/files/${fileId}/start-from`,
  }).pipe(
    Effect.map(({ start_from }) => start_from),
    (effect) => withOperationErrors(effect, StartFromErrorSpec),
  );

export const getDownloadUrl = (
  fileId: number,
): Effect.Effect<string, DownloadUrlError, PutioSdkContext> =>
  requestJson(FileDownloadUrlEnvelopeSchema, {
    method: "GET",
    path: `/v2/files/${fileId}/url`,
  }).pipe(
    Effect.map(({ url }) => url),
    (effect) => withOperationErrors(effect, DownloadUrlErrorSpec),
  );

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
  { readonly default: string | null; readonly subtitles: ReadonlyArray<FileSubtitle> },
  FileSubtitlesError,
  PutioSdkContext
> =>
  requestJson(FileSubtitlesEnvelopeSchema, {
    method: "GET",
    path: `/v2/files/${fileId}/subtitles`,
    query: options.languages
      ? {
          languages: options.languages.join(","),
        }
      : undefined,
  }).pipe((effect) => withOperationErrors(effect, FileSubtitlesErrorSpec));

export const setStartFrom = (
  input: FileStartFromSetInput,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, StartFromError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: {
        time: input.time,
      },
    },
    method: "POST",
    path: `/v2/files/${input.file_id}/start-from/set`,
  }).pipe((effect) => withOperationErrors(effect, StartFromErrorSpec));

export const resetStartFrom = (
  fileId: number,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, StartFromError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    method: "GET",
    path: `/v2/files/${fileId}/start-from/delete`,
  }).pipe((effect) => withOperationErrors(effect, StartFromErrorSpec));

export const getMp4Status = (
  fileId: number,
): Effect.Effect<FileConversionStatus, FileMp4Error, PutioSdkContext> =>
  requestJson(FileConversionStatusEnvelopeSchema, {
    method: "GET",
    path: `/v2/files/${fileId}/mp4`,
  }).pipe(
    Effect.map(({ mp4 }) => mp4),
    (effect) => withOperationErrors(effect, FileMp4ErrorSpec),
  );

export const convertFileToMp4 = (
  fileId: number,
): Effect.Effect<FileConversionStatus, FileMp4Error, PutioSdkContext> =>
  requestJson(FileConversionStatusEnvelopeSchema, {
    method: "POST",
    path: `/v2/files/${fileId}/mp4`,
  }).pipe(
    Effect.map(({ mp4 }) => mp4),
    (effect) => withOperationErrors(effect, FileMp4ErrorSpec),
  );

export const deleteFileMp4 = (
  fileId: number,
): Effect.Effect<void, FileMp4MutationError, PutioSdkContext> =>
  requestVoid({
    method: "DELETE",
    path: `/v2/files/${fileId}/mp4`,
  }).pipe((effect) => withOperationErrors(effect, FileMp4MutationErrorSpec));

export const putMp4ToMyFiles = (
  fileId: number,
): Effect.Effect<void, FileMp4MutationError, PutioSdkContext> =>
  requestVoid({
    method: "GET",
    path: `/v2/files/${fileId}/put-mp4-to-my-folders`,
  }).pipe((effect) => withOperationErrors(effect, FileMp4MutationErrorSpec));

export const convertFilesToMp4 = (
  ids: ReadonlyArray<number>,
): Effect.Effect<number, PutioSdkError, PutioSdkContext> =>
  requestJson(FilesBulkConvertEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        file_ids: ids.join(","),
      },
    },
    method: "POST",
    path: "/v2/files/convert_mp4",
  }).pipe(Effect.map(({ count }) => count));

export const convertFileSelectionToMp4 = (
  selection: FilesBulkSelection,
): Effect.Effect<number, PutioSdkError, PutioSdkContext> =>
  requestJson(FilesBulkConvertEnvelopeSchema, {
    body: {
      type: "form",
      value: selectionToForm(selection),
    },
    method: "POST",
    path: "/v2/files/convert_mp4",
  }).pipe(Effect.map(({ count }) => count));

export const listActiveMp4Conversions = (): Effect.Effect<
  ReadonlyArray<FileActiveConversion>,
  FileActiveConversionsError,
  PutioSdkContext
> =>
  requestJson(FileActiveConversionsEnvelopeSchema, {
    method: "GET",
    path: "/v2/mp4/queue",
  }).pipe(
    Effect.map(({ mp4s }) => mp4s),
    (effect) => withOperationErrors(effect, FileActiveConversionsErrorSpec),
  );

export const setFilesWatchStatus = (
  selection: FilesBulkSelection & {
    readonly watched: boolean;
  },
): Effect.Effect<void, FileWatchStatusError, PutioSdkContext> =>
  requestVoid({
    body: {
      type: "form",
      value: {
        ...selectionToForm(selection),
        watched: selection.watched,
      },
    },
    method: "POST",
    path: "/v2/files/watch-status",
  }).pipe((effect) => withOperationErrors(effect, FileWatchStatusErrorSpec));

export const extractFiles = (
  selection: FilesBulkSelection & {
    readonly password?: string;
  },
): Effect.Effect<ReadonlyArray<FileExtraction>, FileExtractionsError, PutioSdkContext> =>
  requestJson(FileExtractionsEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        ...selectionToForm(selection, "user_file_ids"),
        password: selection.password,
      },
    },
    method: "POST",
    path: "/v2/files/extract",
  }).pipe(
    Effect.map(({ extractions }) => extractions),
    (effect) => withOperationErrors(effect, FileExtractionsErrorSpec),
  );

export const listFileExtractions = (): Effect.Effect<
  ReadonlyArray<FileExtraction>,
  FileExtractionsError,
  PutioSdkContext
> =>
  requestJson(FileExtractionsEnvelopeSchema, {
    method: "GET",
    path: "/v2/files/extract",
  }).pipe(
    Effect.map(({ extractions }) => extractions),
    (effect) => withOperationErrors(effect, FileExtractionsErrorSpec),
  );

export const deleteFileExtraction = (
  extractionId: number,
): Effect.Effect<void, PutioSdkError, PutioSdkContext> =>
  requestVoid({
    method: "DELETE",
    path: `/v2/files/extract/${extractionId}`,
  });

export const findNextFile = (
  fileId: number,
  fileType: FileType,
): Effect.Effect<Schema.Schema.Type<typeof FilesNextFileSchema>, PutioSdkError, PutioSdkContext> =>
  requestJson(FilesNextFileEnvelopeSchema, {
    method: "GET",
    path: `/v2/files/${fileId}/next-file`,
    query: {
      file_type: fileType,
    },
  }).pipe(Effect.map(({ next_file }) => next_file));

export const findNextVideo = (
  fileId: number,
): Effect.Effect<Schema.Schema.Type<typeof FilesNextFileSchema>, PutioSdkError, PutioSdkContext> =>
  requestJson(FilesNextVideoEnvelopeSchema, {
    method: "GET",
    path: `/v2/files/${fileId}/next-video`,
  }).pipe(Effect.map(({ next_video }) => next_video));

export const createFileUploadRequest = (
  input: FileUploadInput,
  options: {
    readonly oauthToken?: string;
  } = {},
): Effect.Effect<FileUploadRequestDescriptor, PutioSdkError, PutioSdkConfig> =>
  resolveRouteContext(options.oauthToken).pipe(
    Effect.map(({ config, oauthToken }) => ({
      body: createFileUploadFormData(input),
      method: "POST" as const,
      url: buildPutioUrl(config.uploadBaseUrl ?? "https://upload.put.io", "/v2/files/upload", {
        oauth_token: oauthToken,
      }),
    })),
  );

export const uploadFile = (
  input: FileUploadInput,
  options: {
    readonly oauthToken?: string;
  } = {},
): Effect.Effect<FileUploadResult, FileUploadError | PutioValidationError, PutioSdkContext> =>
  resolveRouteContext(options.oauthToken).pipe(
    Effect.flatMap(({ config, oauthToken }) =>
      requestJson(FileUploadEnvelopeSchema, {
        auth: {
          type: "none",
        },
        baseUrl: config.uploadBaseUrl ?? "https://upload.put.io",
        body: {
          type: "form-data",
          value: createFileUploadFormData(input),
        },
        method: "POST",
        path: "/v2/files/upload",
        query: {
          oauth_token: oauthToken,
        },
      }),
    ),
    Effect.map(toUploadResult),
    (effect) => withOperationErrors(effect, FileUploadErrorSpec),
  );
