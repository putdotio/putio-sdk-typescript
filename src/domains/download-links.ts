import { Effect, Schema } from "effect";

import { toCursorSelectionForm } from "../core/forms.js";
import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import { requestJson, selectJsonFields, type PutioSdkContext } from "../core/http.js";

export const DownloadLinksStatusSchema = Schema.Literal("NEW", "PROCESSING", "DONE", "ERROR");

export const DownloadLinksCreateInputSchema = Schema.Struct({
  cursor: Schema.optional(Schema.String),
  excludeIds: Schema.optional(Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative()))),
  ids: Schema.optional(Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative()))),
});

export const DownloadLinksPayloadSchema = Schema.Struct({
  download_links: Schema.Array(Schema.String),
  media_links: Schema.Array(Schema.String),
  mp4_links: Schema.Array(Schema.String),
});

const DownloadLinksCreateEnvelopeSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.positive()),
  status: Schema.Literal("OK"),
});

const DownloadLinksPendingEnvelopeSchema = Schema.Struct({
  error_msg: Schema.optional(Schema.NullOr(Schema.String)),
  links: Schema.Null,
  links_status: Schema.Literal("NEW", "PROCESSING"),
  status: Schema.Literal("OK"),
});

const DownloadLinksDoneEnvelopeSchema = Schema.Struct({
  error_msg: Schema.optional(Schema.NullOr(Schema.String)),
  links: DownloadLinksPayloadSchema,
  links_status: Schema.Literal("DONE"),
  status: Schema.Literal("OK"),
});

const DownloadLinksErrorEnvelopeSchema = Schema.Struct({
  error_msg: Schema.String,
  links: Schema.Null,
  links_status: Schema.Literal("ERROR"),
  status: Schema.Literal("OK"),
});

export const DownloadLinksInfoSchema = Schema.Union(
  DownloadLinksPendingEnvelopeSchema,
  DownloadLinksDoneEnvelopeSchema,
  DownloadLinksErrorEnvelopeSchema,
);

export type DownloadLinksStatus = Schema.Schema.Type<typeof DownloadLinksStatusSchema>;
export type DownloadLinksCreateInput = Schema.Schema.Type<typeof DownloadLinksCreateInputSchema>;
export type DownloadLinksPayload = Schema.Schema.Type<typeof DownloadLinksPayloadSchema>;
export type DownloadLinksInfo = Schema.Schema.Type<typeof DownloadLinksInfoSchema>;

export const CreateDownloadLinksErrorSpec = definePutioOperationErrorSpec({
  domain: "downloadLinks",
  operation: "create",
  knownErrors: [
    { errorType: "DownloadLinksConcurrentLimit", statusCode: 400 as const },
    { errorType: "DownloadLinksTooManyFilesRequested", statusCode: 400 as const },
    { errorType: "DownloadLinksTooManyChildrenRequested", statusCode: 400 as const },
    { errorType: "BadRequest", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 400 as const },
  ],
});

export const GetDownloadLinksErrorSpec = definePutioOperationErrorSpec({
  domain: "downloadLinks",
  operation: "get",
  knownErrors: [
    { errorType: "LINKS_NOT_FOUND", statusCode: 404 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 404 as const },
  ],
});

export type CreateDownloadLinksError = PutioOperationFailure<typeof CreateDownloadLinksErrorSpec>;
export type GetDownloadLinksError = PutioOperationFailure<typeof GetDownloadLinksErrorSpec>;

export const createDownloadLinks = (
  input: DownloadLinksCreateInput = {},
): Effect.Effect<
  {
    readonly id: number;
  },
  CreateDownloadLinksError,
  PutioSdkContext
> =>
  requestJson(DownloadLinksCreateEnvelopeSchema, {
    body: {
      type: "form",
      value: toCursorSelectionForm(input),
    },
    method: "POST",
    path: "/v2/download_links/create",
  }).pipe(selectJsonFields("id"), withOperationErrors(CreateDownloadLinksErrorSpec));

export const getDownloadLinks = (
  id: number,
): Effect.Effect<DownloadLinksInfo, GetDownloadLinksError, PutioSdkContext> =>
  requestJson(DownloadLinksInfoSchema, {
    method: "GET",
    path: `/v2/download_links/${id}`,
  }).pipe(withOperationErrors(GetDownloadLinksErrorSpec));
