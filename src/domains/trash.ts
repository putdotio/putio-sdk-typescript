import { Effect, Schema } from "effect";

import { joinCsv } from "../core/forms.js";
import {
  definePutioOperationErrorSpec,
  mapDecodeErrorToValidationError,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import { FileTypeSchema } from "./files.js";
import { OkResponseSchema, requestJson, type PutioSdkContext } from "../core/http.js";

export const TrashFileSchema = Schema.Struct({
  content_type: Schema.NullOr(Schema.String),
  created_at: Schema.String,
  deleted_at: Schema.String,
  expiration_date: Schema.String,
  extension: Schema.NullOr(Schema.String),
  file_type: FileTypeSchema,
  first_accessed_at: Schema.NullOr(Schema.String),
  folder_type: Schema.Literal("REGULAR"),
  icon: Schema.NullOr(Schema.String),
  id: Schema.Int,
  name: Schema.String,
  parent_id: Schema.NullOr(Schema.Int),
  screenshot: Schema.Unknown,
  size: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
});

const TrashListEnvelopeSchema = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  files: Schema.Array(TrashFileSchema),
  status: Schema.Literal("OK"),
  total: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  trash_size: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
});

const TrashContinueEnvelopeSchema = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  files: Schema.Array(TrashFileSchema),
  status: Schema.Literal("OK"),
});

export type TrashFile = Schema.Schema.Type<typeof TrashFileSchema>;
export type TrashListResponse = Schema.Schema.Type<typeof TrashListEnvelopeSchema>;
export type TrashContinueResponse = Schema.Schema.Type<typeof TrashContinueEnvelopeSchema>;
const PositiveIdSchema = Schema.Int.check(Schema.isGreaterThan(0));
const NonEmptyStringSchema = Schema.String.check(Schema.isMinLength(1));
const TrashListQuerySchema = Schema.Struct({
  per_page: Schema.optional(PositiveIdSchema),
});
const TrashCursorBulkInputSchema = Schema.Struct({
  cursor: NonEmptyStringSchema,
  file_ids: Schema.optional(Schema.Never),
  useCursor: Schema.Literal(true),
});
const TrashIdsBulkInputSchema = Schema.Struct({
  cursor: Schema.optional(Schema.Never),
  file_ids: Schema.Array(PositiveIdSchema).check(Schema.isMinLength(1)),
  useCursor: Schema.optional(Schema.Literal(false)),
});
const TrashBulkInputSchema = Schema.Union([TrashCursorBulkInputSchema, TrashIdsBulkInputSchema]);
const TrashContinueInputSchema = Schema.Struct({
  cursor: NonEmptyStringSchema,
  query: TrashListQuerySchema,
});
export type TrashListQuery = Schema.Schema.Type<typeof TrashListQuerySchema>;
export type TrashBulkInput = Schema.Schema.Type<typeof TrashBulkInputSchema>;

const RestrictedReadError = { errorType: "invalid_scope", statusCode: 401 as const };
const RestrictedWriteError = { errorType: "invalid_scope", statusCode: 401 as const };

export const ListTrashErrorSpec = definePutioOperationErrorSpec({
  domain: "trash",
  operation: "list",
  knownErrors: [RestrictedReadError],
});

export const ContinueTrashErrorSpec = definePutioOperationErrorSpec({
  domain: "trash",
  operation: "continue",
  knownErrors: [RestrictedReadError, { statusCode: 400 as const }],
});

export const RestoreTrashErrorSpec = definePutioOperationErrorSpec({
  domain: "trash",
  operation: "restore",
  knownErrors: [
    { errorType: "TRASH_FILE_NOT_FOUND", statusCode: 404 as const },
    { errorType: "TRASH_LOCK_TIMEOUT", statusCode: 400 as const },
    { errorType: "TRASH_INCOMPLETE_TRASH", statusCode: 400 as const },
    { errorType: "TRASH_RESTORE_TOO_MANY_FILES", statusCode: 400 as const },
    RestrictedWriteError,
    { statusCode: 400 as const },
    { statusCode: 404 as const },
  ],
});

export const DeleteTrashErrorSpec = definePutioOperationErrorSpec({
  domain: "trash",
  operation: "delete",
  knownErrors: [
    { errorType: "TRASH_FILE_NOT_FOUND", statusCode: 404 as const },
    { errorType: "TRASH_LOCK_TIMEOUT", statusCode: 400 as const },
    RestrictedWriteError,
    { statusCode: 400 as const },
    { statusCode: 404 as const },
  ],
});

export const EmptyTrashErrorSpec = definePutioOperationErrorSpec({
  domain: "trash",
  operation: "empty",
  knownErrors: [
    { errorType: "TRASH_LOCK_TIMEOUT", statusCode: 400 as const },
    RestrictedWriteError,
  ],
});

export type ListTrashError = PutioOperationFailure<typeof ListTrashErrorSpec>;
export type ContinueTrashError = PutioOperationFailure<typeof ContinueTrashErrorSpec>;
export type RestoreTrashError = PutioOperationFailure<typeof RestoreTrashErrorSpec>;
export type DeleteTrashError = PutioOperationFailure<typeof DeleteTrashErrorSpec>;
export type EmptyTrashError = PutioOperationFailure<typeof EmptyTrashErrorSpec>;

const toBulkTrashBody = (input: TrashBulkInput) => {
  if (input.useCursor === true) {
    return {
      cursor: input.cursor,
      file_ids: undefined,
    };
  }
  return {
    cursor: undefined,
    file_ids: joinCsv(input.file_ids),
  };
};

export const listTrash = (
  query: TrashListQuery = {},
): Effect.Effect<TrashListResponse, ListTrashError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(TrashListQuerySchema)(query).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedQuery) =>
      requestJson(TrashListEnvelopeSchema, {
        method: "GET",
        path: "/v2/trash/list",
        query: decodedQuery,
      }),
    ),
    withOperationErrors(ListTrashErrorSpec),
  );

export const continueTrash = (
  cursor: string,
  query: TrashListQuery = {},
): Effect.Effect<TrashContinueResponse, ContinueTrashError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(TrashContinueInputSchema)({ cursor, query }).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedInput) =>
      requestJson(TrashContinueEnvelopeSchema, {
        body: {
          type: "form",
          value: {
            cursor: decodedInput.cursor,
          },
        },
        method: "POST",
        path: "/v2/trash/list/continue",
        query: decodedInput.query,
      }),
    ),
    withOperationErrors(ContinueTrashErrorSpec),
  );

export const restoreTrash = (
  input: TrashBulkInput,
): Effect.Effect<void, RestoreTrashError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(TrashBulkInputSchema)(input).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedInput) =>
      requestJson(OkResponseSchema, {
        body: {
          type: "form",
          value: toBulkTrashBody(decodedInput),
        },
        method: "POST",
        path: "/v2/trash/restore",
      }),
    ),
    Effect.asVoid,
    withOperationErrors(RestoreTrashErrorSpec),
  );

export const deleteTrash = (
  input: TrashBulkInput,
): Effect.Effect<void, DeleteTrashError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(TrashBulkInputSchema)(input).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedInput) =>
      requestJson(OkResponseSchema, {
        body: {
          type: "form",
          value: toBulkTrashBody(decodedInput),
        },
        method: "POST",
        path: "/v2/trash/delete",
      }),
    ),
    Effect.asVoid,
    withOperationErrors(DeleteTrashErrorSpec),
  );

export const emptyTrash = (): Effect.Effect<void, EmptyTrashError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: "/v2/trash/empty",
  }).pipe(Effect.asVoid, withOperationErrors(EmptyTrashErrorSpec));
