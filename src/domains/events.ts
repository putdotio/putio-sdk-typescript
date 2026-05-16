import { Effect, Schema } from "effect";
import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import {
  OkResponseSchema,
  encodePathSegment,
  requestArrayBuffer,
  requestJson,
  type PutioSdkContext,
} from "../core/http.js";
const HistoryEventBaseSchema = Schema.Struct({
  created_at: Schema.String,
  id: Schema.Int,
  type: Schema.String,
  user_id: Schema.Int,
});
const HistoryFileEventSchema = HistoryEventBaseSchema.pipe(
  Schema.fieldsAssign({
    file_id: Schema.Int,
    file_name: Schema.String,
    file_size: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
);
const HistoryTransferEventSchema = HistoryEventBaseSchema.pipe(
  Schema.fieldsAssign({
    source: Schema.String,
    transfer_name: Schema.String,
  }),
);
export const HistoryFileSharedEventSchema = HistoryFileEventSchema.mapFields(
  ({ type: _type, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    sharing_user_name: Schema.String,
    type: Schema.Literal("file_shared"),
  }),
);
export const HistoryUploadEventSchema = HistoryFileEventSchema.mapFields(
  ({ type: _type, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    type: Schema.Literal("upload"),
  }),
);
export const HistoryFileFromRssDeletedEventSchema = HistoryFileEventSchema.mapFields(
  ({ type: _type, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    file_source: Schema.String,
    type: Schema.Literal("file_from_rss_deleted_for_space"),
  }),
);
export const HistoryTransferCompletedEventSchema = HistoryTransferEventSchema.mapFields(
  ({ type: _type, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    file_id: Schema.Int,
    transfer_size: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
    type: Schema.Literal("transfer_completed"),
  }),
);
export const HistoryTransferErrorEventSchema = HistoryTransferEventSchema.mapFields(
  ({ type: _type, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    type: Schema.Literal("transfer_error"),
  }),
);
export const HistoryTransferFromRssErrorEventSchema = HistoryEventBaseSchema.mapFields(
  ({ type: _type, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    rss_id: Schema.Int,
    transfer_name: Schema.String,
    type: Schema.Literal("transfer_from_rss_error"),
  }),
);
export const HistoryTransferCallbackErrorEventSchema = HistoryEventBaseSchema.mapFields(
  ({ type: _type, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    message: Schema.String,
    transfer_id: Schema.Int,
    transfer_name: Schema.String,
    type: Schema.Literal("transfer_callback_error"),
  }),
);
export const HistoryPrivateTorrentPinEventSchema = HistoryEventBaseSchema.mapFields(
  ({ type: _type, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    new_host_ip: Schema.String,
    pinned_host_ip: Schema.String,
    type: Schema.Literal("private_torrent_pin"),
    user_download_name: Schema.String,
  }),
);
export const HistoryRssFilterPausedEventSchema = HistoryEventBaseSchema.mapFields(
  ({ type: _type, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    rss_filter_id: Schema.Int,
    rss_filter_title: Schema.String,
    type: Schema.Literal("rss_filter_paused"),
  }),
);
export const HistoryVoucherEventSchema = HistoryEventBaseSchema.mapFields(
  ({ type: _type, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    type: Schema.Literal("voucher"),
    voucher: Schema.Int,
    voucher_owner_id: Schema.Int,
    voucher_owner_name: Schema.String,
  }),
);
export const HistoryZipCreatedEventSchema = HistoryEventBaseSchema.mapFields(
  ({ type: _type, ...fields }) => fields,
).pipe(
  Schema.fieldsAssign({
    type: Schema.Literal("zip_created"),
    zip_id: Schema.Int,
    zip_size: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
);
export const HistoryKnownEventTypeSchema = Schema.Literals([
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
]);
export const HistoryEventSchema = Schema.Union([
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
]);
export const EventsListQuerySchema = Schema.Struct({
  before: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0))),
  per_page: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0))),
});
const EventsListEnvelopeSchema = Schema.Struct({
  events: Schema.Array(HistoryEventSchema),
  has_more: Schema.Boolean,
  status: Schema.Literal("OK"),
});
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
  }).pipe(withOperationErrors(ListEventsErrorSpec));
export const deleteEvent = (
  id: number,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, DeleteEventError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: `/v2/events/delete/${encodePathSegment(id)}`,
  }).pipe(withOperationErrors(DeleteEventErrorSpec));
export const clearEvents = (): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  ClearEventsError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: "/v2/events/delete",
  }).pipe(withOperationErrors(ClearEventsErrorSpec));
export const getEventTorrent = (
  id: number,
): Effect.Effect<Uint8Array, GetEventTorrentError, PutioSdkContext> =>
  requestArrayBuffer({
    method: "GET",
    path: `/v2/events/${encodePathSegment(id)}/torrent`,
  }).pipe(withOperationErrors(GetEventTorrentErrorSpec));
