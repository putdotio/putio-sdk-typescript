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
  PutioConfigurationError,
  type PutioSdkError,
} from "./errors.js";

export type PutioQueryValue = string | number | boolean | null | undefined;

export type PutioQuery = Readonly<Record<string, PutioQueryValue>>;

export type PutioPathSegment = string | number | boolean;

export interface PutioSdkConfigShape {
  readonly accessToken?: string;
  readonly baseUrl?: string | URL;
  readonly uploadBaseUrl?: string | URL;
  readonly webAppUrl?: string | URL;
}

export class PutioSdkConfig extends Context.Service<PutioSdkConfig, PutioSdkConfigShape>()(
  "PutioSdkConfig",
) {}

export interface PutioHttpRequest {
  readonly body?: BodyInit;
  readonly headers: Headers;
  readonly method: PutioRequestMethod;
  readonly url: string;
}

export interface PutioHttpResponse {
  readonly arrayBuffer: Effect.Effect<ArrayBuffer, PutioSdkError>;
  readonly headers: Headers;
  readonly json: Effect.Effect<unknown, PutioSdkError>;
  readonly status: number;
}

export interface PutioHttpClientShape {
  readonly execute: (request: PutioHttpRequest) => Effect.Effect<PutioHttpResponse, PutioSdkError>;
}

export class PutioHttpClient extends Context.Service<PutioHttpClient, PutioHttpClientShape>()(
  "PutioHttpClient",
) {}

export type PutioSdkContext = PutioSdkConfig | PutioHttpClient;

export const makePutioSdkConfig = (config: PutioSdkConfigShape): PutioSdkConfigShape => ({
  accessToken: config.accessToken,
  baseUrl: config.baseUrl ?? DEFAULT_PUTIO_API_BASE_URL,
  uploadBaseUrl: config.uploadBaseUrl ?? DEFAULT_PUTIO_UPLOAD_BASE_URL,
  webAppUrl: config.webAppUrl ?? DEFAULT_PUTIO_WEB_APP_URL,
});

export const makePutioSdkLayer = (config: PutioSdkConfigShape) =>
  Layer.succeed(PutioSdkConfig, makePutioSdkConfig(config));

export const makePutioSdkLiveLayer = (config: PutioSdkConfigShape) =>
  Layer.mergeAll(makePutioSdkLayer(config), makePutioFetchLayer());

export const makePutioFetchLayer = (
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
) => Layer.succeed(PutioHttpClient, makePutioFetchClient(fetchImplementation));

export const makePutioFetchClient = (
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
): PutioHttpClientShape => ({
  execute: (request) =>
    Effect.tryPromise({
      try: async (signal) => {
        const response = await fetchImplementation(request.url, {
          body: request.body,
          headers: request.headers,
          method: request.method,
          signal,
        });

        return {
          arrayBuffer: Effect.tryPromise({
            try: () => response.arrayBuffer(),
            catch: mapTransportError,
          }),
          headers: response.headers,
          json: Effect.tryPromise({
            try: () => response.json(),
            catch: mapTransportError,
          }),
          status: response.status,
        };
      },
      catch: mapTransportError,
    }),
});

export const encodePathSegment = (value: PutioPathSegment): string =>
  encodeURIComponent(String(value));

const absoluteUrlPattern = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

const normalizeApiPath = (path: string): string => {
  if (absoluteUrlPattern.test(path)) {
    throw mapConfigurationError("SDK API request paths must be relative to the configured baseUrl");
  }

  return path.startsWith("/") ? path : `/${path}`;
};

export const buildPutioUrl = (baseUrl: string | URL, path: string, query?: PutioQuery): string => {
  const url = new URL(normalizeApiPath(path), baseUrl);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
};

const mapUrlBuildError = (cause: unknown) =>
  cause instanceof PutioConfigurationError ? cause : mapConfigurationError(cause);

export const OkResponseSchema = Schema.Struct({
  status: Schema.Literal("OK"),
});

export type PutioAuth =
  | { readonly type: "config-token" }
  | { readonly type: "token"; readonly token: string }
  | { readonly type: "basic"; readonly username: string; readonly password: string }
  | { readonly type: "none" };

type PutioRequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type PutioRequestBody =
  | { readonly type: "none" }
  | { readonly type: "json"; readonly value: unknown }
  | { readonly type: "form"; readonly value: Record<string, unknown> }
  | { readonly type: "form-data"; readonly value: FormData };

interface PutioRequestOptions {
  readonly method: PutioRequestMethod;
  readonly path: string;
  readonly baseUrl?: string | URL;
  readonly query?: PutioQuery;
  readonly headers?: HeadersInit;
  readonly auth?: PutioAuth;
  readonly body?: PutioRequestBody;
}

const isSuccessStatus = (status: number) => status >= 200 && status < 300;

const decodeSuccessJson = <S extends Schema.Top>(schema: S, response: PutioHttpResponse) =>
  response.json.pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError(mapDecodeErrorToValidationError),
  );

const decodeFailure = (response: PutioHttpResponse, headers: Headers) =>
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

const withBody = (body: PutioRequestBody): Effect.Effect<BodyInit | undefined, PutioSdkError> => {
  switch (body.type) {
    case "none":
      return Effect.succeed(undefined);
    case "json":
      return Effect.try({
        try: () => JSON.stringify(body.value),
        catch: mapDecodeErrorToValidationError,
      });
    case "form":
      return Effect.succeed(
        new URLSearchParams(
          Object.entries(body.value).flatMap(([key, value]) =>
            value === undefined ? [] : [[key, normalizeFormValue(value)]],
          ),
        ),
      );
    case "form-data":
      return Effect.succeed(body.value);
  }
};

const makeRequest = (url: string, options: PutioRequestOptions, authorization?: string) =>
  Effect.gen(function* () {
    const headers = new Headers(options.headers);

    const body = options.body ?? { type: "none" as const };
    headers.set("accept", "application/json");

    if (authorization) {
      headers.set("authorization", authorization);
    }

    if (body.type === "json" && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    return {
      body: yield* withBody(body),
      headers,
      method: options.method,
      url,
    };
  });

const executeRequest = (options: PutioRequestOptions) =>
  Effect.gen(function* () {
    const config = yield* PutioSdkConfig;
    const httpClient = yield* PutioHttpClient;
    const authorization = yield* resolveAuthorization(config, options.auth);
    const url = yield* Effect.try({
      try: () =>
        buildPutioUrl(
          options.baseUrl ?? config.baseUrl ?? DEFAULT_PUTIO_API_BASE_URL,
          options.path,
          options.query,
        ),
      catch: mapUrlBuildError,
    });
    const request = yield* makeRequest(url, options, authorization);

    return yield* httpClient.execute(request);
  });

export const requestJson = <S extends Schema.Top>(
  schema: S,
  options: PutioRequestOptions,
): Effect.Effect<S["Type"], PutioSdkError, PutioSdkContext | S["DecodingServices"]> =>
  executeRequest(options).pipe(
    Effect.flatMap((response) =>
      isSuccessStatus(response.status)
        ? decodeSuccessJson(schema, response)
        : decodeFailure(response, response.headers).pipe(Effect.flatMap(Effect.fail)),
    ),
  );

export const selectJsonField =
  <K extends string>(field: K) =>
  <A extends { readonly [P in K]: unknown }, E, R>(
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<A[K], E, R> =>
    effect.pipe(Effect.map((value) => value[field]));

export const selectJsonFields =
  <const K extends readonly string[]>(...fields: K) =>
  <A extends { readonly [P in K[number]]: unknown }, E, R>(
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<Pick<A, K[number]>, E, R> =>
    effect.pipe(
      Effect.map(
        (value) =>
          Object.fromEntries(fields.map((field) => [field, value[field as K[number]]])) as Pick<
            A,
            K[number]
          >,
      ),
    );

export const requestArrayBuffer = (
  options: PutioRequestOptions,
): Effect.Effect<Uint8Array, PutioSdkError, PutioSdkContext> =>
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
): Effect.Effect<void, PutioSdkError, PutioSdkContext> =>
  executeRequest(options).pipe(
    Effect.flatMap((response) =>
      isSuccessStatus(response.status)
        ? Effect.void
        : decodeFailure(response, response.headers).pipe(Effect.flatMap(Effect.fail)),
    ),
  );
