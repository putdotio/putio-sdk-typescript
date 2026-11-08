import { Option, Schema } from "effect";

import {
  createPutioSdkPromiseClient,
  type FileUploadResult,
  type PutioSdkPromiseClient,
} from "../../../dist/index.js";
import { readLiveTokens, type PutioLiveTokens } from "./secrets.ts";

const OperationErrorSchema = Schema.Struct({
  _tag: Schema.Literal("PutioOperationError"),
  body: Schema.optional(
    Schema.Struct({
      error_message: Schema.optional(Schema.String),
      error_type: Schema.optional(Schema.String),
    }),
  ),
  domain: Schema.String,
  operation: Schema.String,
  reason: Schema.optional(
    Schema.Struct({
      errorType: Schema.optional(Schema.String),
      kind: Schema.String,
    }),
  ),
  status: Schema.Number,
});

type OperationError = typeof OperationErrorSchema.Type;

const TaggedErrorSchema = Schema.Struct({
  _tag: Schema.String,
  status: Schema.optional(Schema.Number),
});

type TaggedError = typeof TaggedErrorSchema.Type;

type OperationErrorExpectation = {
  readonly domain: string;
  readonly operation: string;
  readonly errorType?: string;
  readonly statusCode?: number;
};

type ErrorTagExpectation = {
  readonly status?: number;
  readonly tag: string;
};

type LiveTokenClients = {
  readonly authClient: PutioSdkPromiseClient;
  readonly oauthClient: PutioSdkPromiseClient;
  readonly tokens: PutioLiveTokens;
};

export const createLiveTokenClients = (): LiveTokenClients => {
  const tokens = readLiveTokens();

  return {
    authClient: createPutioSdkPromiseClient({ accessToken: tokens.firstPartyToken }),
    oauthClient: createPutioSdkPromiseClient({ accessToken: tokens.thirdPartyToken }),
    tokens,
  };
};

export const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

export function assertPresent<T>(value: T, message: string): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }

  return value;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const expectOperationError = (cause: unknown): OperationError =>
  Option.getOrThrowWith(
    Schema.decodeUnknownOption(OperationErrorSchema)(cause),
    () => new Error("expected PutioOperationError", { cause }),
  );

export const isFileUploadFileResult = (
  upload: FileUploadResult,
): upload is Extract<FileUploadResult, { readonly type: "file" }> => upload.type === "file";

export const assertOperationError = (
  cause: unknown,
  expected: OperationErrorExpectation,
): OperationError => {
  const error = expectOperationError(cause);

  assert(error.domain === expected.domain, `expected domain ${expected.domain}`);
  assert(error.operation === expected.operation, `expected operation ${expected.operation}`);

  if (expected.errorType !== undefined) {
    assert(
      error.reason?.kind === "error_type" && error.reason.errorType === expected.errorType,
      `expected error type ${expected.errorType}`,
    );
    assert(
      error.body?.error_type === undefined || error.body.error_type === expected.errorType,
      `expected body.error_type ${expected.errorType}`,
    );
  }

  if (expected.statusCode !== undefined) {
    assert(error.status === expected.statusCode, `expected status ${expected.statusCode}`);
  }

  return error;
};

export const assertErrorTag = (cause: unknown, expected: ErrorTagExpectation): TaggedError => {
  const error = Option.getOrThrowWith(
    Schema.decodeUnknownOption(TaggedErrorSchema)(cause),
    () => new Error("expected a tagged error", { cause }),
  );

  assert(error._tag === expected.tag, `expected ${expected.tag}`);

  if (expected.status !== undefined) {
    assert(error.status === expected.status, `expected status ${expected.status}`);
  }

  return error;
};

export const rejectsWith = <T>(
  promise: Promise<unknown>,
  inspect: (cause: unknown) => T,
): Promise<T> =>
  promise.then(() => {
    throw new Error("expected the call to fail");
  }, inspect);

export const rejectsWithOperationError = (
  promise: Promise<unknown>,
  expected: OperationErrorExpectation,
): Promise<OperationError> =>
  rejectsWith(promise, (cause) => assertOperationError(cause, expected));

export const rejectsWithErrorTag = (
  promise: Promise<unknown>,
  expected: ErrorTagExpectation,
): Promise<TaggedError> => rejectsWith(promise, (cause) => assertErrorTag(cause, expected));
