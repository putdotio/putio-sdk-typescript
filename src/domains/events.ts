import { Effect, Schema } from "effect";

import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import { OkResponseSchema, requestArrayBuffer, requestJson } from "../core/http.js";

const HistoryEventBaseSchema = Schema.Struct({
  created_at: Schema.String,
  id: Schema.Number.pipe(Schema.int()),
  type: Schema.String,
  user_id: Schema.Number.pipe(Schema.int()),
});

const HistoryFileEventSchema = Schema.extend(
  HistoryEventBaseSchema,
  Schema.Struct({
    file_id: Schema.Number.pipe(Schema.int()),
    file_name: Schema.String,
    file_size: Schema.Number.pipe(Schema.nonNegative()),
  }),
);

const HistoryTransferEventSchema = Schema.extend(
  HistoryEventBaseSchema,
  Schema.Struct({
    source: Schema.String,
    transfer_name: Schema.String,
  }),
);

export const HistoryFileSharedEventSchema = Schema.extend(
  HistoryFileEventSchema.pipe(Schema.omit("type")),
  Schema.Struct({
    sharing_user_name: Schema.String,
    type: Schema.Literal("file_shared"),
  }),
);

export const HistoryUploadEventSchema = Schema.extend(
  HistoryFileEventSchema.pipe(Schema.omit("type")),
  Schema.Struct({
    type: Schema.Literal("upload"),
  }),
);

export const HistoryFileFromRssDeletedEventSchema = Schema.extend(
  HistoryFileEventSchema.pipe(Schema.omit("type")),
  Schema.Struct({
    file_source: Schema.String,
    type: Schema.Literal("file_from_rss_deleted_for_space"),
  }),
);

export const HistoryTransferCompletedEventSchema = Schema.extend(
  HistoryTransferEventSchema.pipe(Schema.omit("type")),
  Schema.Struct({
    file_id: Schema.Number.pipe(Schema.int()),
    transfer_size: Schema.Number.pipe(Schema.nonNegative()),
    type: Schema.Literal("transfer_completed"),
  }),
);

export const HistoryTransferErrorEventSchema = Schema.extend(
  HistoryTransferEventSchema.pipe(Schema.omit("type")),
  Schema.Struct({
    type: Schema.Literal("transfer_error"),
  }),
);

export const HistoryTransferFromRssErrorEventSchema = Schema.extend(
  HistoryEventBaseSchema.pipe(Schema.omit("type")),
  Schema.Struct({
    rss_id: Schema.Number.pipe(Schema.int()),
    transfer_name: Schema.String,
    type: Schema.Literal("transfer_from_rss_error"),
  }),
);

export const HistoryTransferCallbackErrorEventSchema = Schema.extend(
  HistoryEventBaseSchema.pipe(Schema.omit("type")),
  Schema.Struct({
    message: Schema.String,
    transfer_id: Schema.Number.pipe(Schema.int()),
    transfer_name: Schema.String,
    type: Schema.Literal("transfer_callback_error"),
  }),
);

export const HistoryPrivateTorrentPinEventSchema = Schema.extend(
  HistoryEventBaseSchema.pipe(Schema.omit("type")),
  Schema.Struct({
    new_host_ip: Schema.String,
    pinned_host_ip: Schema.String,
    type: Schema.Literal("private_torrent_pin"),
    user_download_name: Schema.String,
  }),
);

export const HistoryRssFilterPausedEventSchema = Schema.extend(
  HistoryEventBaseSchema.pipe(Schema.omit("type")),
  Schema.Struct({
    rss_filter_id: Schema.Number.pipe(Schema.int()),
    rss_filter_title: Schema.String,
    type: Schema.Literal("rss_filter_paused"),
  }),
);

export const HistoryVoucherEventSchema = Schema.extend(
  HistoryEventBaseSchema.pipe(Schema.omit("type")),
  Schema.Struct({
    type: Schema.Literal("voucher"),
    voucher: Schema.Number.pipe(Schema.int()),
    voucher_owner_id: Schema.Number.pipe(Schema.int()),
    voucher_owner_name: Schema.String,
  }),
);

export const HistoryZipCreatedEventSchema = Schema.extend(
  HistoryEventBaseSchema.pipe(Schema.omit("type")),
  Schema.Struct({
    type: Schema.Literal("zip_created"),
    zip_id: Schema.Number.pipe(Schema.int()),
    zip_size: Schema.Number.pipe(Schema.nonNegative()),
  }),
);

export const HistoryKnownEventTypeSchema = Schema.Literal(
  "file_shared",
  "upload",
  "file_from_rss_deleted_for_space",
  "transfer_completed",
  "transfer_error",
  "transfer_from_rss_error",
  "transfer_callback_error",
  "private_torrent_pin",
  "rss_filter_paused",
  "voucher",
  "zip_created",
);

export const HistoryEventSchema = Schema.Union(
  HistoryFileSharedEventSchema,
  HistoryUploadEventSchema,
  HistoryFileFromRssDeletedEventSchema,
  HistoryTransferCompletedEventSchema,
  HistoryTransferErrorEventSchema,
  HistoryTransferFromRssErrorEventSchema,
  HistoryTransferCallbackErrorEventSchema,
  HistoryPrivateTorrentPinEventSchema,
  HistoryRssFilterPausedEventSchema,
  HistoryVoucherEventSchema,
  HistoryZipCreatedEventSchema,
  HistoryEventBaseSchema,
);

export const EventsListQuerySchema = Schema.Struct({
  before: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  per_page: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
});

const EventsListEnvelopeSchema = Schema.Struct({
  events: Schema.Array(HistoryEventSchema),
  has_more: Schema.Boolean,
  status: Schema.Literal("OK"),
});

type PutioSdkContext =
  | import("../core/http.js").PutioSdkConfig
  | import("@effect/platform").HttpClient.HttpClient;

export type HistoryKnownEventType = Schema.Schema.Type<typeof HistoryKnownEventTypeSchema>;
export type HistoryEvent = Schema.Schema.Type<typeof HistoryEventSchema>;
export type EventsListQuery = Schema.Schema.Type<typeof EventsListQuerySchema>;
export type EventsListResponse = Schema.Schema.Type<typeof EventsListEnvelopeSchema>;
export type HistoryFileSharedEvent = Schema.Schema.Type<typeof HistoryFileSharedEventSchema>;
export type HistoryTransferCompletedEvent = Schema.Schema.Type<
  typeof HistoryTransferCompletedEventSchema
>;
export type HistoryZipCreatedEvent = Schema.Schema.Type<typeof HistoryZipCreatedEventSchema>;

export const ListEventsErrorSpec = definePutioOperationErrorSpec({
  domain: "events",
  operation: "list",
  knownErrors: [
    { errorType: "INVALID_PER_PAGE", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
  ],
});

export const DeleteEventErrorSpec = definePutioOperationErrorSpec({
  domain: "events",
  operation: "delete",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export const ClearEventsErrorSpec = definePutioOperationErrorSpec({
  domain: "events",
  operation: "clear",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export const GetEventTorrentErrorSpec = definePutioOperationErrorSpec({
  domain: "events",
  operation: "getTorrent",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { errorType: "INVALID_EVENT", statusCode: 500 as const },
    { statusCode: 404 as const },
    { statusCode: 500 as const },
  ],
});

export type ListEventsError = PutioOperationFailure<typeof ListEventsErrorSpec>;
export type DeleteEventError = PutioOperationFailure<typeof DeleteEventErrorSpec>;
export type ClearEventsError = PutioOperationFailure<typeof ClearEventsErrorSpec>;
export type GetEventTorrentError = PutioOperationFailure<typeof GetEventTorrentErrorSpec>;

export const listEvents = (
  query: EventsListQuery = {},
): Effect.Effect<EventsListResponse, ListEventsError, PutioSdkContext> =>
  requestJson(EventsListEnvelopeSchema, {
    method: "GET",
    path: "/v2/events/list",
    query,
  }).pipe((effect) => withOperationErrors(effect, ListEventsErrorSpec));

export const deleteEvent = (
  id: number,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, DeleteEventError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: `/v2/events/delete/${id}`,
  }).pipe((effect) => withOperationErrors(effect, DeleteEventErrorSpec));

export const clearEvents = (): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  ClearEventsError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: "/v2/events/delete",
  }).pipe((effect) => withOperationErrors(effect, ClearEventsErrorSpec));

export const getEventTorrent = (
  id: number,
): Effect.Effect<Uint8Array, GetEventTorrentError, PutioSdkContext> =>
  requestArrayBuffer({
    method: "GET",
    path: `/v2/events/${id}/torrent`,
  }).pipe((effect) => withOperationErrors(effect, GetEventTorrentErrorSpec));
