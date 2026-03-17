import { Effect, Schema } from "effect";

import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import { OkResponseSchema, requestJson, type PutioSdkContext } from "../core/http.js";

export const RssFeedSchema = Schema.Struct({
  created_at: Schema.String,
  delete_old_files: Schema.Boolean,
  extract: Schema.Boolean,
  failed_item_count: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  id: Schema.Number.pipe(Schema.int(), Schema.positive()),
  keyword: Schema.NullOr(Schema.String),
  last_error: Schema.NullOr(Schema.String),
  last_fetch: Schema.NullOr(Schema.String),
  parent_dir_id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  parentdirid: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  paused: Schema.Boolean,
  paused_at: Schema.NullOr(Schema.String),
  rss_source_url: Schema.String,
  start_at: Schema.NullOr(Schema.String),
  title: Schema.String,
  unwanted_keywords: Schema.String,
  updated_at: Schema.String,
});

export const RssFeedParamsSchema = Schema.Struct({
  delete_old_files: Schema.optional(Schema.Boolean),
  dont_process_whole_feed: Schema.optional(Schema.Boolean),
  keyword: Schema.optional(Schema.NullOr(Schema.String)),
  parent_dir_id: Schema.optional(
    Schema.Union(Schema.Number.pipe(Schema.int(), Schema.nonNegative()), Schema.Literal("newf")),
  ),
  rss_source_url: Schema.String,
  title: Schema.String,
  unwanted_keywords: Schema.optional(Schema.String),
});

const RssFeedItemBaseSchema = Schema.Struct({
  detected_date: Schema.String,
  id: Schema.Number.pipe(Schema.int(), Schema.positive()),
  processed_at: Schema.String,
  publish_date: Schema.NullOr(Schema.String),
  title: Schema.String,
});

export const RssFeedItemSucceededSchema = Schema.extend(
  RssFeedItemBaseSchema,
  Schema.Struct({
    is_failed: Schema.Literal(false),
    user_file_id: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  }),
);

export const RssFeedItemFailedSchema = Schema.extend(
  RssFeedItemBaseSchema,
  Schema.Struct({
    failure_reason: Schema.String,
    is_failed: Schema.Literal(true),
  }),
);

export const RssFeedItemSchema = Schema.Union(RssFeedItemSucceededSchema, RssFeedItemFailedSchema);

const RssFeedsEnvelopeSchema = Schema.Struct({
  feeds: Schema.Array(RssFeedSchema),
  status: Schema.Literal("OK"),
});

const RssFeedEnvelopeSchema = Schema.Struct({
  feed: RssFeedSchema,
  status: Schema.Literal("OK"),
});

const RssFeedItemsEnvelopeSchema = Schema.Struct({
  feed: RssFeedSchema,
  items: Schema.Array(RssFeedItemSchema),
  status: Schema.Literal("OK"),
});

export type RssFeed = Schema.Schema.Type<typeof RssFeedSchema>;
export type RssFeedParams = Schema.Schema.Type<typeof RssFeedParamsSchema>;
export type RssFeedItem = Schema.Schema.Type<typeof RssFeedItemSchema>;

export const ListRssFeedsErrorSpec = definePutioOperationErrorSpec({
  domain: "rss",
  operation: "list",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export const GetRssFeedErrorSpec = definePutioOperationErrorSpec({
  domain: "rss",
  operation: "get",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { errorType: "NotFound", statusCode: 404 as const },
    { statusCode: 404 as const },
  ],
});

export const CreateRssFeedErrorSpec = definePutioOperationErrorSpec({
  domain: "rss",
  operation: "create",
  knownErrors: [
    { errorType: "URL_REQUIRED", statusCode: 400 as const },
    { errorType: "URL_NOT_VALID", statusCode: 400 as const },
    { errorType: "FEED_CANNOT_FETCHED", statusCode: 400 as const },
    { errorType: "FEED_CANNOT_PARSED", statusCode: 400 as const },
    { errorType: "TITLE_REQUIRED", statusCode: 400 as const },
    { errorType: "TOO_MANY_RSS_FEEDS", statusCode: 403 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
    { statusCode: 402 as const },
    { statusCode: 403 as const },
  ],
});

export const UpdateRssFeedErrorSpec = definePutioOperationErrorSpec({
  domain: "rss",
  operation: "update",
  knownErrors: [
    { errorType: "URL_NOT_VALID", statusCode: 400 as const },
    { errorType: "FEED_CANNOT_FETCHED", statusCode: 400 as const },
    { errorType: "FEED_CANNOT_PARSED", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { errorType: "NotFound", statusCode: 404 as const },
    { statusCode: 400 as const },
    { statusCode: 402 as const },
    { statusCode: 404 as const },
  ],
});

export const PauseRssFeedErrorSpec = definePutioOperationErrorSpec({
  domain: "rss",
  operation: "pause",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { errorType: "NotFound", statusCode: 404 as const },
    { statusCode: 404 as const },
  ],
});

export const ResumeRssFeedErrorSpec = definePutioOperationErrorSpec({
  domain: "rss",
  operation: "resume",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { errorType: "NotFound", statusCode: 404 as const },
    { statusCode: 402 as const },
    { statusCode: 404 as const },
  ],
});

export const DeleteRssFeedErrorSpec = definePutioOperationErrorSpec({
  domain: "rss",
  operation: "delete",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { errorType: "NotFound", statusCode: 404 as const },
    { statusCode: 404 as const },
  ],
});

export const ListRssFeedItemsErrorSpec = definePutioOperationErrorSpec({
  domain: "rss",
  operation: "listItems",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { errorType: "NotFound", statusCode: 404 as const },
    { statusCode: 404 as const },
  ],
});

export const ClearRssFeedLogsErrorSpec = definePutioOperationErrorSpec({
  domain: "rss",
  operation: "clearLogs",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { errorType: "NotFound", statusCode: 404 as const },
    { statusCode: 404 as const },
  ],
});

export const RetryRssFeedItemErrorSpec = definePutioOperationErrorSpec({
  domain: "rss",
  operation: "retryItem",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { errorType: "NotFound", statusCode: 404 as const },
    { statusCode: 402 as const },
    { statusCode: 403 as const },
    { statusCode: 404 as const },
  ],
});

export const RetryAllRssFeedItemsErrorSpec = definePutioOperationErrorSpec({
  domain: "rss",
  operation: "retryAll",
  knownErrors: [
    { errorType: "invalid_scope", statusCode: 401 as const },
    { errorType: "NotFound", statusCode: 404 as const },
    { statusCode: 402 as const },
    { statusCode: 404 as const },
  ],
});

export type ListRssFeedsError = PutioOperationFailure<typeof ListRssFeedsErrorSpec>;
export type GetRssFeedError = PutioOperationFailure<typeof GetRssFeedErrorSpec>;
export type CreateRssFeedError = PutioOperationFailure<typeof CreateRssFeedErrorSpec>;
export type UpdateRssFeedError = PutioOperationFailure<typeof UpdateRssFeedErrorSpec>;
export type PauseRssFeedError = PutioOperationFailure<typeof PauseRssFeedErrorSpec>;
export type ResumeRssFeedError = PutioOperationFailure<typeof ResumeRssFeedErrorSpec>;
export type DeleteRssFeedError = PutioOperationFailure<typeof DeleteRssFeedErrorSpec>;
export type ListRssFeedItemsError = PutioOperationFailure<typeof ListRssFeedItemsErrorSpec>;
export type ClearRssFeedLogsError = PutioOperationFailure<typeof ClearRssFeedLogsErrorSpec>;
export type RetryRssFeedItemError = PutioOperationFailure<typeof RetryRssFeedItemErrorSpec>;
export type RetryAllRssFeedItemsError = PutioOperationFailure<typeof RetryAllRssFeedItemsErrorSpec>;

const toCreateBody = (params: RssFeedParams) => ({
  delete_old_files: params.delete_old_files ? "on" : undefined,
  dont_process_whole_feed: params.dont_process_whole_feed,
  keyword: params.keyword ?? undefined,
  parent_dir_id: params.parent_dir_id,
  rss_source_url: params.rss_source_url,
  title: params.title,
  unwanted_keywords: params.unwanted_keywords ?? "",
});

const toUpdateBody = (params: RssFeedParams) => ({
  delete_old_files: params.delete_old_files,
  dont_process_whole_feed: params.dont_process_whole_feed,
  keyword: params.keyword ?? undefined,
  parent_dir_id: params.parent_dir_id,
  rss_source_url: params.rss_source_url,
  title: params.title,
  unwanted_keywords: params.unwanted_keywords ?? "",
});

export const listRssFeeds = (): Effect.Effect<
  ReadonlyArray<RssFeed>,
  ListRssFeedsError,
  PutioSdkContext
> =>
  requestJson(RssFeedsEnvelopeSchema, {
    method: "GET",
    path: "/v2/rss/list",
  }).pipe(
    Effect.map(({ feeds }) => feeds),
    (effect) => withOperationErrors(effect, ListRssFeedsErrorSpec),
  );

export const getRssFeed = (id: number): Effect.Effect<RssFeed, GetRssFeedError, PutioSdkContext> =>
  requestJson(RssFeedEnvelopeSchema, {
    method: "GET",
    path: `/v2/rss/${id}`,
  }).pipe(
    Effect.map(({ feed }) => feed),
    (effect) => withOperationErrors(effect, GetRssFeedErrorSpec),
  );

export const createRssFeed = (
  params: RssFeedParams,
): Effect.Effect<RssFeed, CreateRssFeedError, PutioSdkContext> =>
  requestJson(RssFeedEnvelopeSchema, {
    body: {
      type: "form",
      value: toCreateBody(params),
    },
    method: "POST",
    path: "/v2/rss/create",
  }).pipe(
    Effect.map(({ feed }) => feed),
    (effect) => withOperationErrors(effect, CreateRssFeedErrorSpec),
  );

export const updateRssFeed = (
  id: number,
  params: RssFeedParams,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  UpdateRssFeedError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: toUpdateBody(params),
    },
    method: "POST",
    path: `/v2/rss/${id}`,
  }).pipe((effect) => withOperationErrors(effect, UpdateRssFeedErrorSpec));

export const pauseRssFeed = (
  id: number,
): Effect.Effect<Schema.Schema.Type<typeof OkResponseSchema>, PauseRssFeedError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: `/v2/rss/${id}/pause`,
  }).pipe((effect) => withOperationErrors(effect, PauseRssFeedErrorSpec));

export const resumeRssFeed = (
  id: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  ResumeRssFeedError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: `/v2/rss/${id}/resume`,
  }).pipe((effect) => withOperationErrors(effect, ResumeRssFeedErrorSpec));

export const deleteRssFeed = (
  id: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  DeleteRssFeedError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: `/v2/rss/${id}/delete`,
  }).pipe((effect) => withOperationErrors(effect, DeleteRssFeedErrorSpec));

export const listRssFeedItems = (
  id: number,
): Effect.Effect<
  {
    readonly feed: RssFeed;
    readonly items: ReadonlyArray<RssFeedItem>;
  },
  ListRssFeedItemsError,
  PutioSdkContext
> =>
  requestJson(RssFeedItemsEnvelopeSchema, {
    method: "GET",
    path: `/v2/rss/${id}/items`,
  }).pipe(
    Effect.map(({ feed, items }) => ({ feed, items })),
    (effect) => withOperationErrors(effect, ListRssFeedItemsErrorSpec),
  );

export const clearRssFeedLogs = (
  id: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  ClearRssFeedLogsError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: `/v2/rss/${id}/clear-log`,
  }).pipe((effect) => withOperationErrors(effect, ClearRssFeedLogsErrorSpec));

export const retryRssFeedItem = (
  feedId: number,
  itemId: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  RetryRssFeedItemError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: `/v2/rss/${feedId}/items/${itemId}/retry`,
  }).pipe((effect) => withOperationErrors(effect, RetryRssFeedItemErrorSpec));

export const retryAllRssFeedItems = (
  feedId: number,
): Effect.Effect<
  Schema.Schema.Type<typeof OkResponseSchema>,
  RetryAllRssFeedItemsError,
  PutioSdkContext
> =>
  requestJson(OkResponseSchema, {
    method: "POST",
    path: `/v2/rss/${feedId}/retry-all`,
  }).pipe((effect) => withOperationErrors(effect, RetryAllRssFeedItemsErrorSpec));
