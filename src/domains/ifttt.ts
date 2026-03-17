import { Effect, Schema } from "effect";

import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import {
  OkResponseSchema,
  requestJson,
  selectJsonFields,
  type PutioSdkContext,
} from "../core/http.js";

const IFTTTStatusEnvelopeSchema = Schema.Struct({
  enabled: Schema.Boolean,
  status: Schema.Literal("OK"),
});

export type IftttEventType = "playback_started" | "playback_stopped" | (string & {});

export type IftttEventInput =
  | {
      readonly clientName?: string;
      readonly eventType: "playback_started" | "playback_stopped";
      readonly ingredients: {
        readonly file_id: number;
        readonly file_name: string;
        readonly file_type: string;
      };
    }
  | {
      readonly clientName?: string;
      readonly eventType: IftttEventType;
      readonly ingredients: Record<string, unknown>;
    };

export const GetIftttStatusErrorSpec = definePutioOperationErrorSpec({
  domain: "ifttt",
  operation: "getStatus",
  knownErrors: [{ statusCode: 402 as const }],
});

export const SendIftttEventErrorSpec = definePutioOperationErrorSpec({
  domain: "ifttt",
  operation: "sendEvent",
  knownErrors: [
    { errorType: "INVALID_EVENT_TYPE", statusCode: 400 as const },
    { errorType: "MISSING_INGREDIENTS", statusCode: 400 as const },
    { errorType: "invalid_scope", statusCode: 401 as const },
    { statusCode: 402 as const },
    { statusCode: 400 as const },
  ],
});

export type GetIftttStatusError = PutioOperationFailure<typeof GetIftttStatusErrorSpec>;
export type SendIftttEventError = PutioOperationFailure<typeof SendIftttEventErrorSpec>;

export const getIftttStatus = (): Effect.Effect<
  { readonly enabled: boolean },
  GetIftttStatusError,
  PutioSdkContext
> =>
  requestJson(IFTTTStatusEnvelopeSchema, {
    method: "GET",
    path: "/v2/ifttt-client/status",
  }).pipe(selectJsonFields("enabled"), withOperationErrors(GetIftttStatusErrorSpec));

export const sendIftttEvent = (
  input: IftttEventInput,
): Effect.Effect<void, SendIftttEventError, PutioSdkContext> =>
  requestJson(OkResponseSchema, {
    body: {
      type: "form",
      value: {
        client_name: input.clientName,
        event_type: input.eventType,
        ingredients: input.ingredients,
      },
    },
    method: "POST",
    path: "/v2/ifttt-client/event",
  }).pipe(Effect.asVoid, withOperationErrors(SendIftttEventErrorSpec));
