import { Headers, HttpClient, HttpClientResponse } from "@effect/platform";
import type * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import { Cause, Effect, Exit, Option } from "effect";

import {
  makePutioSdkLayer,
  type PutioSdkConfigShape,
  type PutioSdkContext,
} from "../../src/core/http.js";

export type MockRequestHandler = (request: HttpClientRequest.HttpClientRequest) => Response;

export const expectFailure = <E>(exit: Exit.Exit<unknown, E>): E => {
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected the effect to fail.");
  }

  const failure = Cause.failureOption(exit.cause);

  if (Option.isNone(failure)) {
    throw Cause.squash(exit.cause);
  }

  return failure.value;
};

export const jsonResponse = (
  body: unknown,
  init: Omit<ResponseInit, "headers"> & {
    readonly headers?: Headers.Headers | Headers.Input | ResponseInit["headers"];
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

const makeMockHttpClient = (handler: MockRequestHandler) =>
  HttpClient.make((request) =>
    Effect.succeed(HttpClientResponse.fromWeb(request, handler(request))),
  );

export const provideSdkTest = <A, E>(
  effect: Effect.Effect<A, E, PutioSdkContext>,
  handler: MockRequestHandler,
  config: PutioSdkConfigShape = {},
) =>
  effect.pipe(
    Effect.provideService(HttpClient.HttpClient, makeMockHttpClient(handler)),
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

export const getAuthorizationHeader = (request: HttpClientRequest.HttpClientRequest) =>
  Option.getOrUndefined(Headers.get(request.headers, "authorization"));

export const getBodyText = (request: HttpClientRequest.HttpClientRequest): string | null => {
  if (request.body._tag === "Empty") {
    return null;
  }

  if (request.body._tag === "Uint8Array") {
    return typeof request.body.body === "string"
      ? request.body.body
      : new TextDecoder().decode(request.body.body);
  }

  return null;
};

export const getJsonBody = <T>(request: HttpClientRequest.HttpClientRequest): T => {
  const body = getBodyText(request);

  if (body === null) {
    throw new Error("Expected a JSON body.");
  }

  return JSON.parse(body) as T;
};

export const getFormBody = (request: HttpClientRequest.HttpClientRequest): URLSearchParams => {
  const body = getBodyText(request);

  if (body === null) {
    throw new Error("Expected a form body.");
  }

  return new URLSearchParams(body);
};

export const getFormDataBody = (request: HttpClientRequest.HttpClientRequest): FormData => {
  if (request.body._tag !== "FormData") {
    throw new Error("Expected a FormData body.");
  }

  return request.body.formData;
};
