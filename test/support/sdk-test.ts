import { Cause, Effect, Exit } from "effect";

import { PutioTransportError } from "../../src/core/errors.js";
import {
  PutioHttpClient,
  makePutioSdkLayer,
  type PutioHttpClientShape,
  type PutioHttpRequest,
  type PutioSdkConfigShape,
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

export const jsonResponse = (
  body: unknown,
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

const makeMockHttpClient = (handler: MockRequestHandler): PutioHttpClientShape => ({
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

const provideSdkTest = <A, E>(
  effect: Effect.Effect<A, E, PutioSdkContext>,
  handler: MockRequestHandler,
  config: PutioSdkConfigShape = {},
) =>
  effect.pipe(
    Effect.provideService(PutioHttpClient, makeMockHttpClient(handler)),
    Effect.provide(makePutioSdkLayer(config)),
  );

export const runSdkEffect = <A, E>(
  effect: Effect.Effect<A, E, PutioSdkContext>,
  handler: MockRequestHandler,
  config: PutioSdkConfigShape = {},
) => Effect.runPromise(provideSdkTest(effect, handler, config));

export const runSdkExit = <A, E>(
  effect: Effect.Effect<A, E, PutioSdkContext>,
  handler: MockRequestHandler,
  config: PutioSdkConfigShape = {},
) => Effect.runPromiseExit(provideSdkTest(effect, handler, config));

export const runConfigEffect = <A, E>(
  effect: Effect.Effect<A, E, import("../../src/core/http.js").PutioSdkConfig>,
  config: PutioSdkConfigShape = {},
) => Effect.runPromise(effect.pipe(Effect.provide(makePutioSdkLayer(config))));

export const runConfigExit = <A, E>(
  effect: Effect.Effect<A, E, import("../../src/core/http.js").PutioSdkConfig>,
  config: PutioSdkConfigShape = {},
) => Effect.runPromiseExit(effect.pipe(Effect.provide(makePutioSdkLayer(config))));

export const getAuthorizationHeader = (request: PutioHttpRequest) =>
  request.headers.get("authorization") ?? undefined;

const getBodyText = (request: PutioHttpRequest): string | null => {
  if (!request.body) {
    return null;
  }

  if (typeof request.body === "string") {
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

export const getJsonBody = <T>(request: PutioHttpRequest): T => {
  const body = getBodyText(request);

  if (body === null) {
    throw new Error("Expected a JSON body.");
  }

  return JSON.parse(body) as T;
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
