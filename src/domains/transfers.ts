import { Effect, Schema } from "effect";
import { joinCsv } from "../core/forms.js";
import { NonEmptyStringSchema, PositiveIntegerSchema, decodeAndRun } from "../core/validation.js";
import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
  type PutioSdkError,
} from "../core/errors.js";
import {
  OkResponseSchema,
  encodePathSegment,
  requestArrayBuffer,
  requestJson,
  selectJsonField,
  selectJsonFields,
  type PutioSdkContext,
} from "../core/http.js";
const TransferIdSchema = PositiveIntegerSchema;
const TransferIdsSchema = Schema.Array(TransferIdSchema).check(Schema.isMinLength(1));
export const TransferTypeSchema = Schema.Literals([
  "URL",
  "TORRENT",
  "PLAYLIST",
  "LIVE_STREAM",
  "N/A",
]);
export const TransferStatusSchema = Schema.Literals([
  "WAITING",
  "PREPARING_DOWNLOAD",
  "IN_QUEUE",
  "DOWNLOADING",
  "WAITING_FOR_COMPLETE_QUEUE",
  "WAITING_FOR_DOWNLOADER",
  "COMPLETING",
  "STOPPING",
  "SEEDING",
  "COMPLETED",
  "ERROR",
  "PREPARING_SEED",
]);
const TransferLinkSchema = Schema.Struct({
  label: Schema.String,
  url: Schema.NullOr(Schema.String),
});
const NullableInt = Schema.NullOr(Schema.Int);
const NullableNonNegativeNumber = Schema.NullOr(
  Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
);
export const TransferBaseSchema = Schema.Struct({
  availability: NullableNonNegativeNumber,
  callback_url: Schema.NullOr(Schema.String),
  client_ip: Schema.NullOr(Schema.String),
  completion_percent: NullableNonNegativeNumber,
  created_at: Schema.String,
  created_torrent: Schema.Boolean,
  current_ratio: NullableNonNegativeNumber,
  download_id: NullableInt,
  down_speed: NullableNonNegativeNumber,
  downloaded: NullableNonNegativeNumber,
  error_message: Schema.NullOr(Schema.String),
  estimated_time: NullableNonNegativeNumber,
  file_id: NullableInt,
  finished_at: Schema.NullOr(Schema.String),
  hash: Schema.NullOr(Schema.String),
  id: Schema.Int,
  is_private: Schema.Boolean,
  links: Schema.optional(Schema.Array(TransferLinkSchema)),
  name: Schema.String,
  peers_connected: NullableInt,
  peers_getting_from_us: NullableInt,
  peers_sending_to_us: NullableInt,
  percent_done: NullableNonNegativeNumber,
  recorded_seconds: Schema.optional(NullableNonNegativeNumber),
  save_parent_id: Schema.Int,
  seconds_seeding: NullableNonNegativeNumber,
  simulated: Schema.Boolean,
  size: NullableNonNegativeNumber,
  source: Schema.String,
  started_at: Schema.NullOr(Schema.String),
  status: TransferStatusSchema,
  subscription_id: NullableInt,
  torrent_link: Schema.NullOr(Schema.String),
  tracker: Schema.NullOr(Schema.String),
  tracker_message: Schema.NullOr(Schema.String),
  type: TransferTypeSchema,
  uploaded: NullableNonNegativeNumber,
  up_speed: NullableNonNegativeNumber,
  userfile_exists: Schema.optional(Schema.Boolean),
});
const TransferErrorSchema = TransferBaseSchema.mapFields(
  ({ error_message: _errorMessage, status: _status, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    error_message: Schema.String,
    status: Schema.Literal("ERROR"),
  }),
);
const TransferCompletedSchema = TransferBaseSchema.mapFields(
  ({ status: _status, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    status: Schema.Literal("COMPLETED"),
  }),
);
const TransferLiveSchema = TransferBaseSchema.mapFields(
  ({ recorded_seconds: _recordedSeconds, type: _type, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    recorded_seconds: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
    type: Schema.Literal("LIVE_STREAM"),
  }),
);
const TransferTorrentSeedingSchema = TransferBaseSchema.mapFields(
  ({
    current_ratio: _currentRatio,
    seconds_seeding: _secondsSeeding,
    status: _status,
    type: _type,
    ...fields
  }) => fields,
).pipe(
  Schema.fieldsAssign({
    current_ratio: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
    seconds_seeding: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
    status: Schema.Literals(["SEEDING", "COMPLETED", "PREPARING_SEED"]),
    type: Schema.Literal("TORRENT"),
  }),
);
export const TransferSchema = Schema.Union([
  TransferErrorSchema,
  TransferLiveSchema,
  TransferTorrentSeedingSchema,
  TransferCompletedSchema,
  TransferBaseSchema,
]);
export const TransfersListQuerySchema = Schema.Struct({
  per_page: Schema.optional(PositiveIntegerSchema),
});
export const TransferAddInputSchema = Schema.Struct({
  callback_url: Schema.optional(NonEmptyStringSchema),
  save_parent_id: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  url: NonEmptyStringSchema,
});
const TransferContinueInputSchema = Schema.Struct({
  cursor: NonEmptyStringSchema,
  query: TransfersListQuerySchema,
});
const TransferInfoUrlSchema = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isPattern(/^[^\r\n]+$/),
);
const TransferInfoUrlsSchema = Schema.Array(TransferInfoUrlSchema).check(Schema.isMinLength(1));
const TransferAddManyInputSchema = Schema.Array(TransferAddInputSchema).check(
  Schema.isMinLength(1),
);
const TransferCleanIdsSchema = Schema.Array(TransferIdSchema);
const TrackerSchema = Schema.String.check(Schema.isPattern(/^[^,\s]+$/));
export const TransferAddTrackersInputSchema = Schema.Struct({
  trackers: Schema.Array(TrackerSchema).check(Schema.isMinLength(1)),
  transferId: TransferIdSchema,
});
const TransferRemoveIdsInputSchema = Schema.Struct({
  filter: Schema.optional(Schema.Never),
  ids: TransferIdsSchema,
});
const TransferRemoveFilterInputSchema = Schema.Struct({
  filter: Schema.Literals(["all", "completed"]),
  ids: Schema.optional(Schema.Never),
});
export const TransferRemoveInputSchema = Schema.Union([
  TransferRemoveIdsInputSchema,
  TransferRemoveFilterInputSchema,
]);
const TransferInfoItemSchema = Schema.Struct({
  error: Schema.optional(Schema.String),
  error_message: Schema.optional(Schema.String),
  file_size: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  human_size: Schema.String,
  name: Schema.String,
  type_name: Schema.String,
  url: Schema.String,
});
const TransfersListEnvelopeSchema = Schema.Struct({
  cursor: Schema.optional(Schema.NullOr(Schema.String)),
  status: Schema.Literal("OK"),
  total: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  transfers: Schema.Array(TransferSchema),
});
const TransfersContinueEnvelopeSchema = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  status: Schema.Literal("OK"),
  transfers: Schema.Array(TransferSchema),
});
const TransferEnvelopeSchema = Schema.Struct({
  status: Schema.Literal("OK"),
  transfer: TransferSchema,
});
const TransferCountEnvelopeSchema = Schema.Struct({
  count: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  status: Schema.Literal("OK"),
});
const TransferInfoEnvelopeSchema = Schema.Struct({
  disk_avail: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  ret: Schema.Array(TransferInfoItemSchema),
  status: Schema.Literal("OK"),
});
const TransfersAddMultiErrorSchema = Schema.Struct({
  error_type: Schema.String,
  status_code: Schema.Int,
  url: Schema.String,
});
const TransfersAddMultiEnvelopeSchema = Schema.Struct({
  errors: Schema.Array(TransfersAddMultiErrorSchema),
  status: Schema.Literal("OK"),
  transfers: Schema.Array(TransferSchema),
});
const TransfersCleanEnvelopeSchema = Schema.Struct({
  deleted_ids: Schema.Array(Schema.Int),
  status: Schema.Literal("OK"),
});
export type TransferType = Schema.Schema.Type<typeof TransferTypeSchema>;
export type TransferStatus = Schema.Schema.Type<typeof TransferStatusSchema>;
export type TransferLink = Schema.Schema.Type<typeof TransferLinkSchema>;
export type Transfer = Schema.Schema.Type<typeof TransferSchema>;
export type TransfersListQuery = Schema.Schema.Type<typeof TransfersListQuerySchema>;
export type TransferAddInput = Schema.Schema.Type<typeof TransferAddInputSchema>;
export type TransferAddTrackersInput = Schema.Schema.Type<typeof TransferAddTrackersInputSchema>;
export type TransferRemoveInput = Schema.Schema.Type<typeof TransferRemoveInputSchema>;
export type TransferInfoItem = Schema.Schema.Type<typeof TransferInfoItemSchema>;
export type TransfersListResponse = Schema.Schema.Type<typeof TransfersListEnvelopeSchema>;
export type TransfersContinueResponse = Schema.Schema.Type<typeof TransfersContinueEnvelopeSchema>;
export type TransfersAddMultiError = Schema.Schema.Type<typeof TransfersAddMultiErrorSchema>;
export const ListTransfersErrorSpec = definePutioOperationErrorSpec({
  domain: "transfers",
  operation: "list",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
  ],
});
export const GetTransferErrorSpec = definePutioOperationErrorSpec({
  domain: "transfers",
  operation: "get",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});
export const GetTransferTorrentErrorSpec = definePutioOperationErrorSpec({
  domain: "transfers",
  operation: "getTorrent",
  knownErrors: [
    { errorType: "NOT_TORRENT", statusCode: 400 as const },
    { errorType: "IS_MAGNET", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});
export const AddTransferTrackersErrorSpec = definePutioOperationErrorSpec({
  domain: "transfers",
  operation: "addTrackers",
  knownErrors: [
    { errorType: "NO_TRACKERS", statusCode: 400 as const },
    { errorType: "TORRENT_NOT_ACTIVE", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 402 as const },
    { errorType: "TRANSFER_NOT_FOUND", statusCode: 404 as const },
    { errorType: "TRANSFER_INVALID", statusCode: 500 as const },
    { errorType: "TORRENT_NOT_READY", statusCode: 500 as const },
  ],
});
export const RemoveTransfersErrorSpec = definePutioOperationErrorSpec({
  domain: "transfers",
  operation: "remove",
  knownErrors: [
    { statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
  ],
});
export const AddTransferErrorSpec = definePutioOperationErrorSpec({
  domain: "transfers",
  operation: "add",
  knownErrors: [
    { errorType: "EMPTY_URL", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
    { statusCode: 404 as const },
  ],
});
export const AddManyTransfersErrorSpec = definePutioOperationErrorSpec({
  domain: "transfers",
  operation: "addMany",
  knownErrors: [
    { errorType: "TOO_MANY_URLS", statusCode: 403 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
  ],
});
export const RetryTransferErrorSpec = definePutioOperationErrorSpec({
  domain: "transfers",
  operation: "retry",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
    { statusCode: 403 as const },
    { statusCode: 404 as const },
  ],
});
export const ReannounceTransferErrorSpec = definePutioOperationErrorSpec({
  domain: "transfers",
  operation: "reannounce",
  knownErrors: [
    { errorType: "NOT_TORRENT", statusCode: 400 as const },
    { errorType: "TORRENT_NOT_ACTIVE", statusCode: 400 as const },
    { errorType: "BadRequest", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
    { statusCode: 404 as const },
    { statusCode: 500 as const },
  ],
});
export const StopRecordingTransferErrorSpec = definePutioOperationErrorSpec({
  domain: "transfers",
  operation: "stopRecording",
  knownErrors: [
    { errorType: "NOT_RECORDING", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
    { statusCode: 404 as const },
  ],
});
export type ListTransfersError = PutioOperationFailure<typeof ListTransfersErrorSpec>;
export type GetTransferError = PutioOperationFailure<typeof GetTransferErrorSpec>;
export type GetTransferTorrentError = PutioOperationFailure<typeof GetTransferTorrentErrorSpec>;
export type AddTransferTrackersError = PutioOperationFailure<typeof AddTransferTrackersErrorSpec>;
export type RemoveTransfersError = PutioOperationFailure<typeof RemoveTransfersErrorSpec>;
export type AddTransferError = PutioOperationFailure<typeof AddTransferErrorSpec>;
export type AddManyTransfersError = PutioOperationFailure<typeof AddManyTransfersErrorSpec>;
export type RetryTransferError = PutioOperationFailure<typeof RetryTransferErrorSpec>;
export type ReannounceTransferError = PutioOperationFailure<typeof ReannounceTransferErrorSpec>;
export type StopRecordingTransferError = PutioOperationFailure<
  typeof StopRecordingTransferErrorSpec
>;
export const listTransfers = (
  query: TransfersListQuery = {},
): Effect.Effect<TransfersListResponse, ListTransfersError, PutioSdkContext> =>
  decodeAndRun(TransfersListQuerySchema, query, (decodedQuery) =>
    requestJson(TransfersListEnvelopeSchema, {
      method: "GET",
      path: "/v2/transfers/list",
      query: decodedQuery,
    }),
  ).pipe(withOperationErrors(ListTransfersErrorSpec));
export const continueTransfers = (
  cursor: string,
  query: TransfersListQuery = {},
): Effect.Effect<TransfersContinueResponse, ListTransfersError, PutioSdkContext> =>
  decodeAndRun(TransferContinueInputSchema, { cursor, query }, (decodedInput) =>
    requestJson(TransfersContinueEnvelopeSchema, {
      body: {
        type: "form",
        value: {
          cursor: decodedInput.cursor,
        },
      },
      method: "POST",
      path: "/v2/transfers/list/continue",
      query: decodedInput.query,
    }),
  ).pipe(withOperationErrors(ListTransfersErrorSpec));
export const getTransfer = (
  id: number,
): Effect.Effect<Transfer, GetTransferError, PutioSdkContext> =>
  decodeAndRun(TransferIdSchema, id, (decodedId) =>
    requestJson(TransferEnvelopeSchema, {
      method: "GET",
      path: `/v2/transfers/${encodePathSegment(decodedId)}`,
    }).pipe(selectJsonField("transfer")),
  ).pipe(withOperationErrors(GetTransferErrorSpec));
export const getTransferTorrent = (
  id: number,
): Effect.Effect<Uint8Array, GetTransferTorrentError, PutioSdkContext> =>
  decodeAndRun(TransferIdSchema, id, (decodedId) =>
    requestArrayBuffer({
      method: "GET",
      path: `/v2/transfers/${encodePathSegment(decodedId)}/torrent`,
    }),
  ).pipe(withOperationErrors(GetTransferTorrentErrorSpec));
export const countTransfers = (): Effect.Effect<number, PutioSdkError, PutioSdkContext> =>
  requestJson(TransferCountEnvelopeSchema, {
    method: "GET",
    path: "/v2/transfers/count",
  }).pipe(selectJsonField("count"));
export const getTransferInfo = (
  urls: ReadonlyArray<string>,
): Effect.Effect<
  {
    readonly disk_avail: number;
    readonly ret: ReadonlyArray<TransferInfoItem>;
  },
  PutioSdkError,
  PutioSdkContext
> =>
  decodeAndRun(TransferInfoUrlsSchema, urls, (decodedUrls) =>
    requestJson(TransferInfoEnvelopeSchema, {
      body: {
        type: "form",
        value: {
          urls: decodedUrls.join("\n"),
        },
      },
      method: "POST",
      path: "/v2/transfers/info",
    }).pipe(selectJsonFields("disk_avail", "ret")),
  );
export const addTransfer = (
  input: TransferAddInput,
): Effect.Effect<Transfer, AddTransferError, PutioSdkContext> =>
  decodeAndRun(TransferAddInputSchema, input, (decodedInput) =>
    requestJson(TransferEnvelopeSchema, {
      body: {
        type: "form",
        value: decodedInput,
      },
      method: "POST",
      path: "/v2/transfers/add",
    }).pipe(selectJsonField("transfer")),
  ).pipe(withOperationErrors(AddTransferErrorSpec));
export const addManyTransfers = (
  inputs: ReadonlyArray<TransferAddInput>,
): Effect.Effect<
  {
    readonly errors: ReadonlyArray<TransfersAddMultiError>;
    readonly transfers: ReadonlyArray<Transfer>;
  },
  AddManyTransfersError,
  PutioSdkContext
> =>
  decodeAndRun(TransferAddManyInputSchema, inputs, (decodedInputs) =>
    requestJson(TransfersAddMultiEnvelopeSchema, {
      body: {
        type: "form",
        value: {
          urls: JSON.stringify(decodedInputs),
        },
      },
      method: "POST",
      path: "/v2/transfers/add-multi",
    }).pipe(selectJsonFields("errors", "transfers")),
  ).pipe(withOperationErrors(AddManyTransfersErrorSpec));
export const addTransferTrackers = (
  input: TransferAddTrackersInput,
): Effect.Effect<void, AddTransferTrackersError, PutioSdkContext> =>
  decodeAndRun(TransferAddTrackersInputSchema, input, (decodedInput) =>
    requestJson(OkResponseSchema, {
      body: {
        type: "form",
        value: {
          trackers: joinCsv(decodedInput.trackers),
        },
      },
      method: "POST",
      path: `/v2/transfers/add-trackers/${encodePathSegment(decodedInput.transferId)}`,
    }),
  ).pipe(Effect.asVoid, withOperationErrors(AddTransferTrackersErrorSpec));
export const cancelTransfers = (
  ids: ReadonlyArray<number>,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, PutioSdkError, PutioSdkContext> =>
  decodeAndRun(TransferIdsSchema, ids, (decodedIds) =>
    requestJson(OkResponseSchema, {
      body: {
        type: "form",
        value: {
          transfer_ids: joinCsv(decodedIds),
        },
      },
      method: "POST",
      path: "/v2/transfers/cancel",
    }),
  );
export const cleanTransfers = (
  ids: ReadonlyArray<number> = [],
): Effect.Effect<
  {
    readonly deleted_ids: ReadonlyArray<number>;
  },
  PutioSdkError,
  PutioSdkContext
> =>
  decodeAndRun(TransferCleanIdsSchema, ids, (decodedIds) =>
    requestJson(TransfersCleanEnvelopeSchema, {
      body: {
        type: "form",
        value: decodedIds.length > 0 ? { transfer_ids: joinCsv(decodedIds) } : {},
      },
      method: "POST",
      path: "/v2/transfers/clean",
    }).pipe(selectJsonFields("deleted_ids")),
  );
export const removeTransfers = (
  input: TransferRemoveInput,
): Effect.Effect<void, RemoveTransfersError, PutioSdkContext> =>
  decodeAndRun(TransferRemoveInputSchema, input, (decodedInput) =>
    requestJson(OkResponseSchema, {
      body: {
        type: "form",
        value:
          decodedInput.ids !== undefined
            ? { transfer_ids: joinCsv(decodedInput.ids) }
            : { remove_filter: decodedInput.filter },
      },
      method: "POST",
      path: "/v2/transfers/remove",
    }),
  ).pipe(Effect.asVoid, withOperationErrors(RemoveTransfersErrorSpec));
export const retryTransfer = (
  id: number,
): Effect.Effect<Transfer, RetryTransferError, PutioSdkContext> =>
  decodeAndRun(TransferIdSchema, id, (decodedId) =>
    requestJson(TransferEnvelopeSchema, {
      body: {
        type: "form",
        value: {
          id: decodedId,
        },
      },
      method: "POST",
      path: "/v2/transfers/retry",
    }).pipe(selectJsonField("transfer")),
  ).pipe(withOperationErrors(RetryTransferErrorSpec));
export const reannounceTransfer = (
  id: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  ReannounceTransferError,
  PutioSdkContext
> =>
  decodeAndRun(TransferIdSchema, id, (decodedId) =>
    requestJson(OkResponseSchema, {
      body: {
        type: "form",
        value: {
          id: decodedId,
        },
      },
      method: "POST",
      path: "/v2/transfers/reannounce",
    }),
  ).pipe(withOperationErrors(ReannounceTransferErrorSpec));
export const stopTransferRecording = (
  id: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  StopRecordingTransferError,
  PutioSdkContext
> =>
  decodeAndRun(TransferIdSchema, id, (decodedId) =>
    requestJson(OkResponseSchema, {
      body: {
        type: "form",
        value: {
          transfer_id: decodedId,
        },
      },
      method: "POST",
      path: "/v2/transfers/stop-recording",
    }),
  ).pipe(withOperationErrors(StopRecordingTransferErrorSpec));
