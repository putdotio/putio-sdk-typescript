import { Cause, Effect, Exit, Layer, Predicate, Schema } from "effect";

import { PutioTransportError } from "../../src/core/errors.js";
import {
  PutioHttpClient,
  PutioSdkConfig,
  putioSdkLayer,
  type PutioHttpClientService,
  type PutioHttpRequest,
  type PutioSdkOptions,
  type PutioSdkContext,
} from "../../src/core/http.js";

export type MockRequestHandler = (request: PutioHttpRequest) => Response;

export const expectFailure = <E>(exit: Exit.Exit<unknown, E>): E => {
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected the effect to fail.");
  }

  const failure = exit.cause.reasons.find(Cause.isFailReason);

  if (!failure) {
    throw Cause.squash(exit.cause);
  }

  return failure.error;
};

export const jsonResponse = <TBody>(
  body: TBody,
  init: Omit<ResponseInit, "headers"> & {
    readonly headers?: ResponseInit["headers"];
  } = {},
): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...Object.fromEntries(new globalThis.Headers(init.headers).entries()),
    },
  });

export const emptyResponse = (init: ResponseInit = {}): Response => new Response(null, init);

export const arrayBufferResponse = (body: ArrayLike<number>, init: ResponseInit = {}): Response =>
  new Response(new Uint8Array(Array.from(body)), init);

const makeMockHttpClient = (handler: MockRequestHandler): PutioHttpClientService => ({
  execute: (request) => {
    const response = handler(request);

    return Effect.succeed({
      arrayBuffer: Effect.tryPromise({
        try: () => response.arrayBuffer(),
        catch: (cause) => new PutioTransportError({ cause }),
      }),
      headers: response.headers,
      json: Effect.tryPromise({
        try: () => response.json(),
        catch: (cause) => new PutioTransportError({ cause }),
      }),
      status: response.status,
    });
  },
});

export const provideMockTransport =
  (handler: MockRequestHandler) =>
  <A, E, R>(layer: Layer.Layer<A, E, R>) =>
    Layer.provide(layer, Layer.succeed(PutioHttpClient, makeMockHttpClient(handler)));

export const provideSdk = <A, E>(
  effect: Effect.Effect<A, E, PutioSdkContext>,
  handler: MockRequestHandler,
  config: PutioSdkOptions = {},
) =>
  effect.pipe(
    Effect.provideService(PutioHttpClient, makeMockHttpClient(handler)),
    Effect.provide(putioSdkLayer(config)),
  );

export const provideConfig = <A, E>(
  effect: Effect.Effect<A, E, PutioSdkConfig>,
  config: PutioSdkOptions = {},
) => effect.pipe(Effect.provide(putioSdkLayer(config)));

export const getAuthorizationHeader = (request: PutioHttpRequest) =>
  request.headers.get("authorization") ?? undefined;

const getBodyText = (request: PutioHttpRequest): string | null => {
  if (!request.body) {
    return null;
  }

  if (Predicate.isString(request.body)) {
    return request.body;
  }

  if (request.body instanceof URLSearchParams) {
    return request.body.toString();
  }

  if (request.body instanceof Uint8Array) {
    return new TextDecoder().decode(request.body);
  }

  throw new Error("Expected a textual request body.");
};

const decodeJsonBody = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Json));

export const getJsonBody = (request: PutioHttpRequest): Schema.Json => {
  const body = getBodyText(request);

  if (body === null) {
    throw new Error("Expected a JSON body.");
  }

  return decodeJsonBody(body);
};

export const getFormBody = (request: PutioHttpRequest): URLSearchParams => {
  const body = getBodyText(request);

  if (body === null) {
    throw new Error("Expected a form body.");
  }

  return new URLSearchParams(body);
};

export const getFormDataBody = (request: PutioHttpRequest): FormData => {
  if (!(request.body instanceof FormData)) {
    throw new Error("Expected a FormData body.");
  }

  return request.body;
};
