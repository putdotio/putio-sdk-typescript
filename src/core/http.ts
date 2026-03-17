import { Headers, HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform";
import { Context, Effect, Layer, Schema } from "effect";

import {
  DEFAULT_PUTIO_API_BASE_URL,
  DEFAULT_PUTIO_UPLOAD_BASE_URL,
  DEFAULT_PUTIO_WEB_APP_URL,
} from "./defaults.js";
import {
  fallbackPutioErrorEnvelope,
  makeResponseError,
  mapConfigurationError,
  mapDecodeErrorToValidationError,
  mapTransportError,
  parseErrorBody,
  type PutioSdkError,
} from "./errors.js";

export type PutioQueryValue = string | number | boolean | null | undefined;

export type PutioQuery = Readonly<Record<string, PutioQueryValue>>;

export interface PutioSdkConfigShape {
  readonly accessToken?: string;
  readonly baseUrl?: string | URL;
  readonly uploadBaseUrl?: string | URL;
  readonly webAppUrl?: string | URL;
}

export class PutioSdkConfig extends Context.Tag("PutioSdkConfig")<
  PutioSdkConfig,
  PutioSdkConfigShape
>() {}

export const makePutioSdkConfig = (config: PutioSdkConfigShape): PutioSdkConfigShape => ({
  accessToken: config.accessToken,
  baseUrl: config.baseUrl ?? DEFAULT_PUTIO_API_BASE_URL,
  uploadBaseUrl: config.uploadBaseUrl ?? DEFAULT_PUTIO_UPLOAD_BASE_URL,
  webAppUrl: config.webAppUrl ?? DEFAULT_PUTIO_WEB_APP_URL,
});

export const makePutioSdkLayer = (config: PutioSdkConfigShape) =>
  Layer.succeed(PutioSdkConfig, makePutioSdkConfig(config));

export const buildPutioUrl = (baseUrl: string | URL, path: string, query?: PutioQuery): string => {
  const url = new URL(path, baseUrl);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
};

export const OkResponseSchema = Schema.Struct({
  status: Schema.Literal("OK"),
});

export type PutioAuth =
  | { readonly type: "config-token" }
  | { readonly type: "token"; readonly token: string }
  | { readonly type: "basic"; readonly username: string; readonly password: string }
  | { readonly type: "none" };

type PutioRequestBody =
  | { readonly type: "none" }
  | { readonly type: "json"; readonly value: unknown }
  | { readonly type: "form"; readonly value: Record<string, unknown> }
  | { readonly type: "form-data"; readonly value: FormData };

interface PutioRequestOptions {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly baseUrl?: string | URL;
  readonly query?: PutioQuery;
  readonly headers?: Headers.Input;
  readonly auth?: PutioAuth;
  readonly body?: PutioRequestBody;
}

type PutioSdkHttpContext = PutioSdkConfig | HttpClient.HttpClient;

const isSuccessStatus = (status: number) => status >= 200 && status < 300;

const decodeSuccessJson = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  response: HttpClientResponse.HttpClientResponse,
) =>
  HttpClientResponse.schemaBodyJson(schema)(response).pipe(
    Effect.mapError(mapDecodeErrorToValidationError),
  );

const decodeFailure = (response: HttpClientResponse.HttpClientResponse, headers: Headers.Headers) =>
  response.json.pipe(
    Effect.flatMap((json) => parseErrorBody(response.status, json)),
    Effect.orElseSucceed(() => fallbackPutioErrorEnvelope(response.status)),
    Effect.map((body) => makeResponseError(response.status, headers, body)),
  );

const toBasicAuthorization = (username: string, password: string) => {
  if (typeof globalThis.btoa === "function") {
    return `Basic ${globalThis.btoa(`${username}:${password}`)}`;
  }

  throw mapConfigurationError(
    "This runtime does not provide btoa(), so Basic auth cannot be encoded safely",
  );
};

const resolveAuthorization = (
  config: PutioSdkConfigShape,
  auth: PutioAuth | undefined,
): Effect.Effect<string | undefined, PutioSdkError> => {
  const resolvedAuth = auth ?? { type: "config-token" as const };

  switch (resolvedAuth.type) {
    case "none":
      return Effect.succeed(undefined);
    case "token":
      return Effect.succeed(`Token ${resolvedAuth.token}`);
    case "basic":
      return Effect.try({
        try: () => toBasicAuthorization(resolvedAuth.username, resolvedAuth.password),
        catch: mapConfigurationError,
      });
    case "config-token":
      if (!config.accessToken) {
        return Effect.fail(
          mapConfigurationError(
            "This endpoint requires an access token, but PutioSdkConfig.accessToken is missing",
          ),
        );
      }

      return Effect.succeed(`Token ${config.accessToken}`);
  }
};

const normalizeFormValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
};

const withBody = (
  request: HttpClientRequest.HttpClientRequest,
  body: PutioRequestBody,
): Effect.Effect<HttpClientRequest.HttpClientRequest, PutioSdkError> => {
  switch (body.type) {
    case "none":
      return Effect.succeed(request);
    case "json":
      return HttpClientRequest.bodyJson(request, body.value).pipe(
        Effect.mapError(mapDecodeErrorToValidationError),
      );
    case "form":
      return Effect.succeed(
        HttpClientRequest.bodyUrlParams(
          request,
          Object.fromEntries(
            Object.entries(body.value).flatMap(([key, value]) =>
              value === undefined ? [] : [[key, normalizeFormValue(value)]],
            ),
          ),
        ),
      );
    case "form-data":
      return Effect.succeed(HttpClientRequest.bodyFormData(request, body.value));
  }
};

const makeRequest = (url: string, options: PutioRequestOptions, authorization?: string) =>
  Effect.gen(function* () {
    const headers = authorization
      ? Headers.set(Headers.fromInput(options.headers), "authorization", authorization)
      : Headers.fromInput(options.headers);

    const body = options.body ?? { type: "none" as const };
    const request = HttpClientRequest.make(options.method)(url, {
      acceptJson: true,
      headers,
    });

    return yield* withBody(request, body);
  });

const executeRequest = (options: PutioRequestOptions) =>
  Effect.gen(function* () {
    const config = yield* PutioSdkConfig;
    const authorization = yield* resolveAuthorization(config, options.auth);
    const url = buildPutioUrl(
      options.baseUrl ?? config.baseUrl ?? DEFAULT_PUTIO_API_BASE_URL,
      options.path,
      options.query,
    );
    const request = yield* makeRequest(url, options, authorization);

    return yield* HttpClient.execute(request).pipe(Effect.mapError(mapTransportError));
  });

export const requestJson = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  options: PutioRequestOptions,
): Effect.Effect<A, PutioSdkError, PutioSdkHttpContext | R> =>
  executeRequest(options).pipe(
    Effect.flatMap((response) =>
      isSuccessStatus(response.status)
        ? decodeSuccessJson(schema, response)
        : decodeFailure(response, response.headers).pipe(Effect.flatMap(Effect.fail)),
    ),
  );

export const requestArrayBuffer = (
  options: PutioRequestOptions,
): Effect.Effect<Uint8Array, PutioSdkError, PutioSdkHttpContext> =>
  executeRequest(options).pipe(
    Effect.flatMap((response) =>
      isSuccessStatus(response.status)
        ? response.arrayBuffer.pipe(
            Effect.mapError(mapTransportError),
            Effect.map((buffer) => new Uint8Array(buffer)),
          )
        : decodeFailure(response, response.headers).pipe(Effect.flatMap(Effect.fail)),
    ),
  );

export const requestVoid = (
  options: PutioRequestOptions,
): Effect.Effect<void, PutioSdkError, PutioSdkHttpContext> =>
  executeRequest(options).pipe(
    Effect.flatMap((response) =>
      isSuccessStatus(response.status)
        ? Effect.void
        : decodeFailure(response, response.headers).pipe(Effect.flatMap(Effect.fail)),
    ),
  );
