import { Effect, Schema } from "effect";

import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import { OkResponseSchema, requestJson } from "../core/http.js";

export const ZipStatusSchema = Schema.Literal("NEW", "PROCESSING", "DONE", "ERROR");

const ZipSummarySchema = Schema.Struct({
  created_at: Schema.String,
  id: Schema.Number.pipe(Schema.int(), Schema.positive()),
});

const ZipsListEnvelopeSchema = Schema.Struct({
  status: Schema.Literal("OK"),
  zips: Schema.Array(ZipSummarySchema),
});

const ZipCreateEnvelopeSchema = Schema.Struct({
  status: Schema.Literal("OK"),
  zip_id: Schema.Number.pipe(Schema.int(), Schema.positive()),
});

const ZipInfoPendingSchema = Schema.Struct({
  status: Schema.Literal("OK"),
  url: Schema.Null,
  zip_status: Schema.Literal("NEW", "PROCESSING"),
});

const ZipInfoErrorSchema = Schema.Struct({
  error_msg: Schema.String,
  status: Schema.Literal("OK"),
  url: Schema.Null,
  zip_status: Schema.Literal("ERROR"),
});

const ZipInfoDoneSchema = Schema.Struct({
  id: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  missing_files: Schema.Array(Schema.String),
  size: Schema.Number.pipe(Schema.nonNegative()),
  status: Schema.Literal("OK"),
  url: Schema.String,
  zip_status: Schema.Literal("DONE"),
});

const ZipInfoSchema = Schema.Union(ZipInfoPendingSchema, ZipInfoErrorSchema, ZipInfoDoneSchema);

type PutioSdkContext =
  | import("../core/http.js").PutioSdkConfig
  | import("@effect/platform").HttpClient.HttpClient;

export type ZipSummary = Schema.Schema.Type<typeof ZipSummarySchema>;
export type ZipCreateResponse = Schema.Schema.Type<typeof ZipCreateEnvelopeSchema>;
export type ZipInfo = Schema.Schema.Type<typeof ZipInfoSchema>;

export type CreateZipInput = {
  readonly cursor?: string;
  readonly exclude_ids?: ReadonlyArray<number>;
  readonly file_ids?: ReadonlyArray<number>;
};

const FilesReadScopeError = { errorType: "invalid_scope", statusCode: 401 as const };
const FilesWriteScopeError = { errorType: "invalid_scope", statusCode: 401 as const };

export const ListZipsErrorSpec = definePutioOperationErrorSpec({
  domain: "zips",
  operation: "list",
  knownErrors: [FilesReadScopeError],
});

export const CreateZipErrorSpec = definePutioOperationErrorSpec({
  domain: "zips",
  operation: "create",
  knownErrors: [
    { errorType: "ZIP_TOTAL_SIZE_EXCEEDED", statusCode: 403 as const },
    FilesWriteScopeError,
    { statusCode: 400 as const },
    { statusCode: 403 as const },
  ],
});

export const GetZipErrorSpec = definePutioOperationErrorSpec({
  domain: "zips",
  operation: "get",
  knownErrors: [
    { errorType: "LINK_EXPIRED", statusCode: 410 as const },
    { errorType: "ERROR_IN_ZIP", statusCode: 500 as const },
    FilesReadScopeError,
    { statusCode: 403 as const },
    { statusCode: 410 as const },
    { statusCode: 500 as const },
  ],
});

export const CancelZipErrorSpec = definePutioOperationErrorSpec({
  domain: "zips",
  operation: "cancel",
  knownErrors: [
    { errorType: "LINK_EXPIRED", statusCode: 410 as const },
    FilesWriteScopeError,
    { statusCode: 403 as const },
    { statusCode: 410 as const },
  ],
});

export type ListZipsError = PutioOperationFailure<typeof ListZipsErrorSpec>;
export type CreateZipError = PutioOperationFailure<typeof CreateZipErrorSpec>;
export type GetZipError = PutioOperationFailure<typeof GetZipErrorSpec>;
export type CancelZipError = PutioOperationFailure<typeof CancelZipErrorSpec>;

export const listZips = (): Effect.Effect<
  ReadonlyArray<ZipSummary>,
  ListZipsError,
  PutioSdkContext
> =>
  requestJson(ZipsListEnvelopeSchema, {
    method: "GET",
    path: "/v2/zips/list",
  }).pipe(
    Effect.map(({ zips }) => zips),
    (effect) => withOperationErrors(effect, ListZipsErrorSpec),
  );

export const createZip = (
  input: CreateZipInput,
): Effect.Effect<number, CreateZipError, PutioSdkContext> =>
  requestJson(ZipCreateEnvelopeSchema, {
    body: {
      type: "form",
      value: {
        cursor: input.cursor,
        exclude_ids: input.exclude_ids?.join(","),
        file_ids: input.file_ids?.join(","),
      },
    },
    method: "POST",
    path: "/v2/zips/create",
  }).pipe(
    Effect.map(({ zip_id }) => zip_id),
    (effect) => withOperationErrors(effect, CreateZipErrorSpec),
  );

export const getZip = (id: number): Effect.Effect<ZipInfo, GetZipError, PutioSdkContext> =>
  requestJson(ZipInfoSchema, {
    method: "GET",
    path: `/v2/zips/${id}`,
  }).pipe((effect) => withOperationErrors(effect, GetZipErrorSpec));

export const cancelZip = (id: number): Effect.Effect<void, CancelZipError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    method: "GET",
    path: `/v2/zips/${id}/cancel`,
  }).pipe(Effect.asVoid, (effect) => withOperationErrors(effect, CancelZipErrorSpec));
