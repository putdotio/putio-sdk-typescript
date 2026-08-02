import { Effect, Schema } from "effect";

import { joinCsv } from "../core/forms.js";
import { mapDecodeErrorToValidationError, type PutioSdkError } from "../core/errors.js";
import { requestJson, selectJsonFields, type PutioSdkContext } from "../core/http.js";

export const PodcastLinkTypeSchema = Schema.Literals(["all", "audio", "video", "mp4"]);
export const PodcastGetLinksInputSchema = Schema.Struct({
  parentId: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  types: Schema.optional(Schema.Array(PodcastLinkTypeSchema).check(Schema.isMinLength(1))),
});
export const PodcastLinksSchema = Schema.Struct({
  all: Schema.optional(Schema.String),
  audio: Schema.optional(Schema.String),
  video: Schema.optional(Schema.String),
  mp4: Schema.optional(Schema.String),
});
const PodcastLinksEnvelopeSchema = Schema.Struct({
  links: PodcastLinksSchema,
  status: Schema.Literal("OK"),
  token: Schema.String,
});

export type PodcastLinkType = Schema.Schema.Type<typeof PodcastLinkTypeSchema>;
export type PodcastGetLinksInput = Schema.Schema.Type<typeof PodcastGetLinksInputSchema>;
export type PodcastLinks = Schema.Schema.Type<typeof PodcastLinksSchema>;
export type PodcastLinksResponse = Pick<
  Schema.Schema.Type<typeof PodcastLinksEnvelopeSchema>,
  "links" | "token"
>;

export const getPodcastLinks = (
  input: PodcastGetLinksInput,
): Effect.Effect<PodcastLinksResponse, PutioSdkError, PutioSdkContext> =>
  Schema.decodeUnknownEffect(PodcastGetLinksInputSchema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
    Effect.flatMap((decodedInput) =>
      requestJson(PodcastLinksEnvelopeSchema, {
        method: "GET",
        path: "/v2/podcast/links",
        query: {
          parent_id: decodedInput.parentId,
          type: decodedInput.types ? joinCsv(decodedInput.types) : undefined,
        },
      }),
    ),
    selectJsonFields("links", "token"),
  );
