import { Context, Effect, Layer, Predicate, Redacted, Schema, Struct } from "effect";

import {
  DEFAULT_PUTIO_API_BASE_URL,
  DEFAULT_PUTIO_UPLOAD_BASE_URL,
  DEFAULT_PUTIO_WEB_APP_URL,
} from "./defaults.js";
import {
  mapConfigurationError,
  mapContractError,
  mapTransportError,
  mapValidationError,
  parseErrorBody,
  PutioConfigurationError,
  type PutioSdkError,
  PutioValidationError,
  toPutioResponseError,
} from "./errors.js";
import { isSuccessStatus, unparsableJsonBodyError } from "./response-body.js";
import { revealAccessToken, revealSecret } from "./secrets.js";

export type PutioQueryValue = string | number | boolean | null | undefined;

export type PutioQuery = Readonly<Record<string, PutioQueryValue>>;

export type PutioPathSegment = string | number | boolean;

export type PutioSecret = string | Redacted.Redacted<string>;

export interface PutioSdkOptions {
  readonly accessToken?: PutioSecret | undefined;
  readonly baseUrl?: string | URL | undefined;
  readonly headers?: HeadersInit | undefined;
  readonly uploadBaseUrl?: string | URL | undefined;
  readonly webAppUrl?: string | URL | undefined;
}

export interface PutioSdkResolvedConfig {
  readonly accessToken: Redacted.Redacted<string> | undefined;
  readonly baseUrl: string | URL;
  readonly headers: HeadersInit | undefined;
  readonly uploadBaseUrl: string | URL;
  readonly webAppUrl: string | URL;
}

export class PutioSdkConfig extends Context.Service<PutioSdkConfig, PutioSdkResolvedConfig>()(
  "@putdotio/sdk/PutioSdkConfig",
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

export interface PutioHttpClientService {
  readonly execute: (request: PutioHttpRequest) => Effect.Effect<PutioHttpResponse, PutioSdkError>;
}

export class PutioHttpClient extends Context.Service<PutioHttpClient, PutioHttpClientService>()(
  "@putdotio/sdk/PutioHttpClient",
) {}

export type PutioSdkContext = PutioSdkConfig | PutioHttpClient;

const redactPutioSecret = (
  secret: PutioSecret | undefined,
): Redacted.Redacted<string> | undefined => {
  if (secret === undefined) {
    return undefined;
  }

  if (Predicate.isString(secret)) {
    return secret === "" ? undefined : Redacted.make(secret);
  }

  return secret;
};

export const normalizePutioSdkOptions = (config: PutioSdkOptions): PutioSdkResolvedConfig => ({
  accessToken: redactPutioSecret(config.accessToken),
  baseUrl: config.baseUrl ?? DEFAULT_PUTIO_API_BASE_URL,
  headers: config.headers,
  uploadBaseUrl: config.uploadBaseUrl ?? DEFAULT_PUTIO_UPLOAD_BASE_URL,
  webAppUrl: config.webAppUrl ?? DEFAULT_PUTIO_WEB_APP_URL,
});

export const putioSdkLayer = (config: PutioSdkOptions) =>
  Layer.succeed(PutioSdkConfig, normalizePutioSdkOptions(config));

export const putioSdkLiveLayer = (config: PutioSdkOptions) =>
  Layer.mergeAll(putioSdkLayer(config), makePutioFetchLayer());

export const makePutioFetchLayer = (
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
) => Layer.succeed(PutioHttpClient, makePutioFetchClient(fetchImplementation));

const decodeJsonText = Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown));

export const makePutioFetchClient = (
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
): PutioHttpClientService => ({
  execute: (request) =>
    Effect.suspend(() => {
      const controller = new AbortController();

      const read = <A>(body: () => Promise<A>) =>
        Effect.tryPromise({ try: body, catch: mapTransportError }).pipe(
          Effect.onInterrupt(() => Effect.sync(() => controller.abort())),
        );

      return read(async () => {
        const response = await fetchImplementation(request.url, {
          body: request.body ?? null,
          headers: request.headers,
          method: request.method,
          signal: controller.signal,
        });

        return {
          arrayBuffer: read(() => response.arrayBuffer()),
          headers: response.headers,
          json: read(() => response.text()).pipe(
            Effect.flatMap((text) =>
              decodeJsonText(text).pipe(
                Effect.mapError(() => unparsableJsonBodyError(response.status, response.headers)),
              ),
            ),
          ),
          status: response.status,
        };
      });
    }),
});

export const encodePathSegment = (value: PutioPathSegment): string =>
  encodeURIComponent(String(value));

const absoluteUrlPattern = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

const dotSegmentPattern = /^(?:\.|%2e){1,2}$/i;

const parserRewrittenPattern = /[\\\p{Cc}]|^ | $/u;

const normalizeApiPath = (path: string): string => {
  if (absoluteUrlPattern.test(path)) {
    throw mapConfigurationError("SDK API request paths must be relative to the configured baseUrl");
  }

  if (parserRewrittenPattern.test(path)) {
    throw mapValidationError(
      "SDK API request paths must not contain backslashes, control characters, or edge spaces",
    );
  }

  const [pathname = ""] = path.split(/[?#]/, 1);

  if (pathname.split("/").some((segment) => dotSegmentPattern.test(segment))) {
    throw mapValidationError("SDK API request paths must not contain dot segments");
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
  cause instanceof PutioConfigurationError || cause instanceof PutioValidationError
    ? cause
    : mapConfigurationError(cause);

export const OkResponseSchema = Schema.Struct({
  status: Schema.Literal("OK"),
});

export type PutioAuth =
  | { readonly type: "config-token" }
  | { readonly type: "token"; readonly token: PutioSecret }
  | { readonly type: "basic"; readonly username: string; readonly password: PutioSecret }
  | { readonly type: "none" };

type PutioRequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type PutioRequestBody =
  | { readonly type: "none" }
  | { readonly type: "json"; readonly value: unknown }
  | { readonly type: "form"; readonly value: Readonly<Record<string, Schema.Json | undefined>> }
  | { readonly type: "form-data"; readonly value: FormData };

interface PutioRequestOptions {
  readonly method: PutioRequestMethod;
  readonly path: string;
  readonly baseUrl?: string | URL | undefined;
  readonly query?: PutioQuery | undefined;
  readonly headers?: HeadersInit | undefined;
  readonly auth?: PutioAuth | undefined;
  readonly body?: PutioRequestBody | undefined;
}

const decodeSuccessJson = <S extends Schema.Top>(schema: S, response: PutioHttpResponse) =>
  response.json.pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknownEffect(schema)(json).pipe(Effect.mapError(mapContractError)),
    ),
  );

const decodeFailure = (response: PutioHttpResponse, headers: Headers) =>
  response.json.pipe(
    Effect.flatMap(parseErrorBody(response.status)),
    Effect.map((body) => toPutioResponseError(response.status, headers, body)),
  );

const resolveAuthorization = (
  config: PutioSdkResolvedConfig,
  auth: PutioAuth | undefined,
): Effect.Effect<string | undefined, PutioSdkError> => {
  const resolvedAuth = auth ?? { type: "config-token" as const };

  switch (resolvedAuth.type) {
    case "none":
      return Effect.undefined;
    case "token":
      return revealSecret(resolvedAuth.token).pipe(Effect.map((token) => `Token ${token}`));
    case "basic":
      return revealSecret(resolvedAuth.password).pipe(
        Effect.flatMap((password) =>
          Effect.try({
            try: () => `Basic ${btoa(`${resolvedAuth.username}:${password}`)}`,
            catch: mapConfigurationError,
          }),
        ),
      );
    case "config-token":
      return revealAccessToken(config.accessToken).pipe(
        Effect.flatMap((token) =>
          token === undefined
            ? Effect.fail(
                mapConfigurationError(
                  "This endpoint requires an access token, but PutioSdkConfig.accessToken is missing",
                ),
              )
            : Effect.succeed(`Token ${token}`),
        ),
      );
  }
};

const normalizeFormValue = (value: Schema.Json): string => {
  if (value === null) {
    return "";
  }

  if (Predicate.isString(value)) {
    return value;
  }

  if (Predicate.isNumber(value) || Predicate.isBoolean(value)) {
    return String(value);
  }

  return JSON.stringify(value);
};

const withBody = (body: PutioRequestBody): Effect.Effect<BodyInit | undefined, PutioSdkError> => {
  switch (body.type) {
    case "none":
      return Effect.undefined;
    case "json":
      return Effect.try({
        try: () => JSON.stringify(body.value),
        catch: mapValidationError,
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

const buildRequestHeaders = (
  requestHeaders: HeadersInit | undefined,
  configHeaders: HeadersInit | undefined,
  authorization: string | undefined,
  bodyType: PutioRequestBody["type"] | "none",
): Headers => {
  const headers = new Headers(configHeaders);
  headers.delete("authorization");
  new Headers(requestHeaders).forEach((value, name) => headers.set(name, value));

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  if (authorization) {
    headers.set("authorization", authorization);
  }

  if (bodyType === "json" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return headers;
};

const makeRequest = Effect.fnUntraced(function* (
  url: string,
  options: PutioRequestOptions,
  configHeaders: HeadersInit | undefined,
  authorization?: string,
) {
  const body = options.body ?? { type: "none" as const };

  const headers = yield* Effect.try({
    try: () => buildRequestHeaders(options.headers, configHeaders, authorization, body.type),
    catch: () => mapConfigurationError("SDK request headers must be valid HTTP header values"),
  });

  const requestBody = yield* withBody(body);

  const request: PutioHttpRequest = { headers, method: options.method, url };

  return requestBody === undefined ? request : { ...request, body: requestBody };
});

const executeRequest = Effect.fn("PutioSdk.executeRequest")(function* (
  options: PutioRequestOptions,
) {
  yield* Effect.annotateCurrentSpan("http.request.method", options.method);

  const config = yield* PutioSdkConfig;
  const httpClient = yield* PutioHttpClient;
  const authorization = yield* resolveAuthorization(config, options.auth);

  const url = yield* Effect.try({
    try: () => buildPutioUrl(options.baseUrl ?? config.baseUrl, options.path, options.query),
    catch: mapUrlBuildError,
  });

  const request = yield* makeRequest(url, options, config.headers, authorization);

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
    effect.pipe(Effect.map((value) => Struct.pick(value, fields)));

export const requestArrayBuffer = (
  options: PutioRequestOptions,
): Effect.Effect<Uint8Array, PutioSdkError, PutioSdkContext> =>
  executeRequest(options).pipe(
    Effect.flatMap((response) =>
      isSuccessStatus(response.status)
        ? response.arrayBuffer.pipe(Effect.map((buffer) => new Uint8Array(buffer)))
        : decodeFailure(response, response.headers).pipe(Effect.flatMap(Effect.fail)),
    ),
  );

export const requestText = (
  options: PutioRequestOptions,
): Effect.Effect<string, PutioSdkError, PutioSdkContext> =>
  requestArrayBuffer(options).pipe(Effect.map((bytes) => new TextDecoder().decode(bytes)));

export const requestVoid = (
  options: PutioRequestOptions,
): Effect.Effect<void, PutioSdkError, PutioSdkContext> =>
  executeRequest(options).pipe(
    Effect.flatMap((response) =>
      isSuccessStatus(response.status)
        ? Effect.ignore(response.arrayBuffer)
        : decodeFailure(response, response.headers).pipe(Effect.flatMap(Effect.fail)),
    ),
  );
