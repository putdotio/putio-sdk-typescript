import { Effect, Schema } from "effect";

import {
  definePutioOperationErrorSpec,
  withOperationErrors,
  type PutioOperationFailure,
} from "../core/errors.js";
import { requestJson } from "../core/http.js";

export const TunnelRouteSchema = Schema.Struct({
  description: Schema.String,
  hosts: Schema.Array(Schema.String),
  name: Schema.String,
});

const TunnelRoutesEnvelopeSchema = Schema.Struct({
  routes: Schema.Array(TunnelRouteSchema),
  status: Schema.Literal("OK"),
});

type PutioSdkContext =
  | import("../core/http.js").PutioSdkConfig
  | import("@effect/platform").HttpClient.HttpClient;

export type TunnelRoute = Schema.Schema.Type<typeof TunnelRouteSchema>;

export const ListTunnelRoutesErrorSpec = definePutioOperationErrorSpec({
  domain: "tunnel",
  operation: "listRoutes",
  knownErrors: [{ errorType: "invalid_scope", statusCode: 401 as const }],
});

export type ListTunnelRoutesError = PutioOperationFailure<typeof ListTunnelRoutesErrorSpec>;

export const listTunnelRoutes = (): Effect.Effect<
  ReadonlyArray<TunnelRoute>,
  ListTunnelRoutesError,
  PutioSdkContext
> =>
  requestJson(TunnelRoutesEnvelopeSchema, {
    method: "GET",
    path: "/v2/tunnel/routes",
  }).pipe(
    Effect.map(({ routes }) => routes),
    (effect) => withOperationErrors(effect, ListTunnelRoutesErrorSpec),
  );
