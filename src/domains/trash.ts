import { Effect, Schema } from "effect";

import {
  definePutioOperationErrorSpec,
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
  id: Schema.Number.pipe(Schema.int()),
  name: Schema.String,
  parent_id: Schema.NullOr(Schema.Number.pipe(Schema.int())),
  screenshot: Schema.Unknown,
  size: Schema.Number.pipe(Schema.nonNegative()),
});

const TrashListEnvelopeSchema = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  files: Schema.Array(TrashFileSchema),
  status: Schema.Literal("OK"),
  total: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  trash_size: Schema.Number.pipe(Schema.nonNegative()),
});

const TrashContinueEnvelopeSchema = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  files: Schema.Array(TrashFileSchema),
  status: Schema.Literal("OK"),
});

export type TrashFile = Schema.Schema.Type<typeof TrashFileSchema>;
export type TrashListResponse = Schema.Schema.Type<typeof TrashListEnvelopeSchema>;
export type TrashContinueResponse = Schema.Schema.Type<typeof TrashContinueEnvelopeSchema>;

export type TrashListQuery = {
  readonly per_page?: number;
};

export type TrashBulkInput =
  | {
      readonly cursor: string;
      readonly file_ids?: ReadonlyArray<number>;
      readonly useCursor?: true;
    }
  | {
      readonly cursor?: string;
      readonly file_ids: ReadonlyArray<number>;
      readonly useCursor?: false;
    };

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
  if (input.useCursor) {
    return {
      cursor: input.cursor,
      file_ids: undefined,
    };
  }

  if (!input.file_ids) {
    throw new Error("trash bulk file_ids are required when useCursor is not set");
  }

  return {
    cursor: undefined,
    file_ids: input.file_ids.join(","),
  };
};

export const listTrash = (
  query?: TrashListQuery,
): Effect.Effect<TrashListResponse, ListTrashError, PutioSdkContext> =>
  requestJson(TrashListEnvelopeSchema, {
    method: "GET",
    path: "/v2/trash/list",
    query,
  }).pipe((effect) => withOperationErrors(effect, ListTrashErrorSpec));

export const continueTrash = (
  cursor: string,
  query?: TrashListQuery,
): Effect.Effect<TrashContinueResponse, ContinueTrashError, PutioSdkContext> =>
  requestJson(TrashContinueEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        cursor,
      },
    },
    method: "POST",
    path: "/v2/trash/list/continue",
    query,
  }).pipe((effect) => withOperationErrors(effect, ContinueTrashErrorSpec));

export const restoreTrash = (
  input: TrashBulkInput,
): Effect.Effect<void, RestoreTrashError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: toBulkTrashBody(input),
    },
    method: "POST",
    path: "/v2/trash/restore",
  }).pipe(Effect.asVoid, (effect) => withOperationErrors(effect, RestoreTrashErrorSpec));

export const deleteTrash = (
  input: TrashBulkInput,
): Effect.Effect<void, DeleteTrashError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: toBulkTrashBody(input),
    },
    method: "POST",
    path: "/v2/trash/delete",
  }).pipe(Effect.asVoid, (effect) => withOperationErrors(effect, DeleteTrashErrorSpec));

export const emptyTrash = (): Effect.Effect<void, EmptyTrashError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: "/v2/trash/empty",
  }).pipe(Effect.asVoid, (effect) => withOperationErrors(effect, EmptyTrashErrorSpec));
