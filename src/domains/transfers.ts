import { Effect, Schema } from "effect";

import { joinCsv } from "../core/forms.js";
import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
  type PutioSdkError,
} from "../core/errors.js";
import {
  OkResponseSchema,
  requestJson,
  selectJsonField,
  selectJsonFields,
  type PutioSdkContext,
} from "../core/http.js";

export const TransferTypeSchema = Schema.Literal(
  "URL",
  "TORRENT",
  "PLAYLIST",
  "LIVE_STREAM",
  "N/A",
);

export const TransferStatusSchema = Schema.Literal(
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
);

const TransferLinkSchema = Schema.Struct({
  label: Schema.String,
  url: Schema.NullOr(Schema.String),
});

const NullableInt = Schema.NullOr(Schema.Number.pipe(Schema.int()));
const NullableNonNegativeNumber = Schema.NullOr(Schema.Number.pipe(Schema.nonNegative()));

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
  id: Schema.Number.pipe(Schema.int()),
  is_private: Schema.Boolean,
  links: Schema.optional(Schema.Array(TransferLinkSchema)),
  name: Schema.String,
  peers_connected: NullableInt,
  peers_getting_from_us: NullableInt,
  peers_sending_to_us: NullableInt,
  percent_done: NullableNonNegativeNumber,
  recorded_seconds: Schema.optional(NullableNonNegativeNumber),
  save_parent_id: Schema.Number.pipe(Schema.int()),
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

const TransferErrorSchema = Schema.extend(
  TransferBaseSchema.pipe(Schema.omit("error_message", "status")),
  Schema.Struct({
    error_message: Schema.String,
    status: Schema.Literal("ERROR"),
  }),
);

const TransferCompletedSchema = Schema.extend(
  TransferBaseSchema.pipe(Schema.omit("status")),
  Schema.Struct({
    status: Schema.Literal("COMPLETED"),
  }),
);

const TransferLiveSchema = Schema.extend(
  TransferBaseSchema.pipe(Schema.omit("recorded_seconds", "type")),
  Schema.Struct({
    recorded_seconds: Schema.Number.pipe(Schema.nonNegative()),
    type: Schema.Literal("LIVE_STREAM"),
  }),
);

const TransferTorrentSeedingSchema = Schema.extend(
  TransferBaseSchema.pipe(Schema.omit("current_ratio", "seconds_seeding", "status", "type")),
  Schema.Struct({
    current_ratio: Schema.Number.pipe(Schema.nonNegative()),
    seconds_seeding: Schema.Number.pipe(Schema.nonNegative()),
    status: Schema.Literal("SEEDING", "COMPLETED", "PREPARING_SEED"),
    type: Schema.Literal("TORRENT"),
  }),
);

export const TransferSchema = Schema.Union(
  TransferErrorSchema,
  TransferLiveSchema,
  TransferTorrentSeedingSchema,
  TransferCompletedSchema,
  TransferBaseSchema,
);

export const TransfersListQuerySchema = Schema.Struct({
  per_page: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
});

export const TransferAddInputSchema = Schema.Struct({
  callback_url: Schema.optional(Schema.String),
  save_parent_id: Schema.optional(Schema.Number.pipe(Schema.int())),
  url: Schema.String,
});

const TransferInfoItemSchema = Schema.Struct({
  error: Schema.optional(Schema.String),
  error_message: Schema.optional(Schema.String),
  file_size: Schema.Number.pipe(Schema.nonNegative()),
  human_size: Schema.String,
  name: Schema.String,
  type_name: Schema.String,
  url: Schema.String,
});

const TransfersListEnvelopeSchema = Schema.Struct({
  cursor: Schema.optional(Schema.NullOr(Schema.String)),
  status: Schema.Literal("OK"),
  total: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
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
  count: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  status: Schema.Literal("OK"),
});

const TransferInfoEnvelopeSchema = Schema.Struct({
  disk_avail: Schema.Number.pipe(Schema.nonNegative()),
  ret: Schema.Array(TransferInfoItemSchema),
  status: Schema.Literal("OK"),
});

const TransfersAddMultiErrorSchema = Schema.Struct({
  error_type: Schema.String,
  status_code: Schema.Number.pipe(Schema.int()),
  url: Schema.String,
});

const TransfersAddMultiEnvelopeSchema = Schema.Struct({
  errors: Schema.Array(TransfersAddMultiErrorSchema),
  status: Schema.Literal("OK"),
  transfers: Schema.Array(TransferSchema),
});

const TransfersCleanEnvelopeSchema = Schema.Struct({
  deleted_ids: Schema.Array(Schema.Number.pipe(Schema.int())),
  status: Schema.Literal("OK"),
});

export type TransferType = Schema.Schema.Type<typeof TransferTypeSchema>;
export type TransferStatus = Schema.Schema.Type<typeof TransferStatusSchema>;
export type TransferLink = Schema.Schema.Type<typeof TransferLinkSchema>;
export type Transfer = Schema.Schema.Type<typeof TransferSchema>;
export type TransfersListQuery = Schema.Schema.Type<typeof TransfersListQuerySchema>;
export type TransferAddInput = Schema.Schema.Type<typeof TransferAddInputSchema>;
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
  requestJson(TransfersListEnvelopeSchema, {
    method: "GET",
    path: "/v2/transfers/list",
    query,
  }).pipe(withOperationErrors(ListTransfersErrorSpec));

export const continueTransfers = (
  cursor: string,
  query: {
    readonly per_page?: number;
  } = {},
): Effect.Effect<TransfersContinueResponse, ListTransfersError, PutioSdkContext> =>
  requestJson(TransfersContinueEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        cursor,
      },
    },
    method: "POST",
    path: "/v2/transfers/list/continue",
    query,
  }).pipe(withOperationErrors(ListTransfersErrorSpec));

export const getTransfer = (
  id: number,
): Effect.Effect<Transfer, GetTransferError, PutioSdkContext> =>
  requestJson(TransferEnvelopeSchema, {
    method: "GET",
    path: `/v2/transfers/${id}`,
  }).pipe(selectJsonField("transfer"), withOperationErrors(GetTransferErrorSpec));

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
  requestJson(TransferInfoEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        urls: urls.join("\n"),
      },
    },
    method: "POST",
    path: "/v2/transfers/info",
  }).pipe(selectJsonFields("disk_avail", "ret"));

export const addTransfer = (
  input: TransferAddInput,
): Effect.Effect<Transfer, AddTransferError, PutioSdkContext> =>
  requestJson(TransferEnvelopeSchema, {
    body: {
      type: "form",
      value: input,
    },
    method: "POST",
    path: "/v2/transfers/add",
  }).pipe(selectJsonField("transfer"), withOperationErrors(AddTransferErrorSpec));

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
  requestJson(TransfersAddMultiEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        urls: JSON.stringify(inputs),
      },
    },
    method: "POST",
    path: "/v2/transfers/add-multi",
  }).pipe(selectJsonFields("errors", "transfers"), withOperationErrors(AddManyTransfersErrorSpec));

export const cancelTransfers = (
  ids: ReadonlyArray<number>,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, PutioSdkError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: {
        transfer_ids: joinCsv(ids),
      },
    },
    method: "POST",
    path: "/v2/transfers/cancel",
  });

export const cleanTransfers = (
  ids: ReadonlyArray<number> = [],
): Effect.Effect<
  {
    readonly deleted_ids: ReadonlyArray<number>;
  },
  PutioSdkError,
  PutioSdkContext
> =>
  requestJson(TransfersCleanEnvelopeSchema, {
    body: {
      type: "form",
      value: ids.length > 0 ? { transfer_ids: joinCsv(ids) } : {},
    },
    method: "POST",
    path: "/v2/transfers/clean",
  }).pipe(selectJsonFields("deleted_ids"));

export const retryTransfer = (
  id: number,
): Effect.Effect<Transfer, RetryTransferError, PutioSdkContext> =>
  requestJson(TransferEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        id,
      },
    },
    method: "POST",
    path: "/v2/transfers/retry",
  }).pipe(selectJsonField("transfer"), withOperationErrors(RetryTransferErrorSpec));

export const reannounceTransfer = (
  id: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  ReannounceTransferError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: {
        id,
      },
    },
    method: "POST",
    path: "/v2/transfers/reannounce",
  }).pipe(withOperationErrors(ReannounceTransferErrorSpec));

export const stopTransferRecording = (
  id: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  StopRecordingTransferError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: {
        transfer_id: id,
      },
    },
    method: "POST",
    path: "/v2/transfers/stop-recording",
  }).pipe(withOperationErrors(StopRecordingTransferErrorSpec));
