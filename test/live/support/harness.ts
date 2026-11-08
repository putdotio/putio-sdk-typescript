import { Option, Predicate, Schema } from "effect";
import { test } from "vite-plus/test";

import type { FileUploadResult, PutioSdkPromiseClient } from "../../../dist/index.js";
import { hydrateLiveTokenEnv } from "./secrets.ts";
import { createPutioSdkPromiseClient as createPromiseSdkClient } from "../../../dist/index.js";

type JsonPrimitive = boolean | null | number | string;

type LiveDetailsRecord = {
  readonly [key: string]: LiveDetails | undefined;
};

type LiveDetails = JsonPrimitive | readonly LiveDetails[] | LiveDetailsRecord;

type PromiseClientConfig = Parameters<typeof createPromiseSdkClient>[0];

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

type OperationErrorExpectation = {
  readonly domain: string;
  readonly operation: string;
  readonly errorType?: string;
  readonly statusCode?: number;
};

type OperationErrorDetails = {
  readonly error_message: string | undefined;
  readonly error_type: string | undefined;
  readonly operation: string;
  readonly status: number;
};

type ErrorTagExpectation = {
  readonly status?: number;
  readonly tag: string;
};

type ErrorTagDetails = {
  readonly status: number | undefined;
  readonly tag: string;
};

type LiveHarness = {
  readonly assert: typeof assert;
  readonly assertErrorTag: typeof assertErrorTag;
  readonly assertOperationError: typeof assertOperationError;
  readonly checks: readonly [];
  readonly finish: () => void;
  readonly run: (name: string, fn: () => LiveDetails | Promise<LiveDetails>) => Promise<void>;
  readonly sleep: typeof sleep;
};

export const requireEnv = (keys: readonly string[]): void => {
  for (const key of keys) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
};

export const createClients = async <TClientEnvMap extends Readonly<Record<string, string>>>(
  clientEnvMap: TClientEnvMap,
): Promise<{ [TKey in keyof TClientEnvMap]: PutioSdkPromiseClient }> => {
  hydrateLiveTokenEnv();

  const envKeys = [...new Set(Object.values(clientEnvMap))];
  requireEnv(envKeys);

  // SAFETY: Object.fromEntries maps every own key of clientEnvMap to a client, so the result has exactly the keys of TClientEnvMap.
  return Object.fromEntries(
    Object.entries(clientEnvMap).map(([clientName, envKey]) => [
      clientName,
      createPromiseSdkClient({
        accessToken: process.env[envKey],
      }),
    ]),
  ) as { [TKey in keyof TClientEnvMap]: PutioSdkPromiseClient };
};

export const createPromiseClient = async (
  config: PromiseClientConfig = {},
): Promise<PutioSdkPromiseClient> => createPromiseSdkClient(config);

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

const decodeOperationError = (cause: unknown): OperationError =>
  Option.getOrThrowWith(
    Schema.decodeUnknownOption(OperationErrorSchema)(cause),
    () => new Error("expected PutioOperationError", { cause }),
  );

export const expectOperationError = (cause: unknown): OperationError => decodeOperationError(cause);

export const isFileUploadFileResult = (
  upload: FileUploadResult,
): upload is Extract<FileUploadResult, { readonly type: "file" }> => upload.type === "file";

export const assertOperationError = (
  cause: unknown,
  expected: OperationErrorExpectation,
): OperationErrorDetails => {
  assert(Predicate.isTagged(cause, "PutioOperationError"), "expected PutioOperationError");

  const candidate = decodeOperationError(cause);

  assert(candidate.domain === expected.domain, `expected domain ${expected.domain}`);
  assert(candidate.operation === expected.operation, `expected operation ${expected.operation}`);

  if (expected.errorType !== undefined) {
    assert(candidate.reason?.kind === "error_type", "expected error_type reason");
    const reason = assertPresent(candidate.reason, "expected error_type reason");
    assert(reason.errorType === expected.errorType, `expected error type ${expected.errorType}`);

    if (candidate.body?.error_type !== undefined) {
      assert(
        candidate.body.error_type === expected.errorType,
        `expected body.error_type ${expected.errorType}`,
      );
    }
  }

  if (expected.statusCode !== undefined) {
    assert(candidate.status === expected.statusCode, `expected status ${expected.statusCode}`);
  }

  return {
    error_message: candidate.body?.error_message,
    error_type: candidate.body?.error_type,
    operation: expected.operation,
    status: candidate.status,
  };
};

export const assertErrorTag = (cause: unknown, expected: ErrorTagExpectation): ErrorTagDetails => {
  const candidate = Option.getOrThrowWith(
    Schema.decodeUnknownOption(TaggedErrorSchema)(cause),
    () => new Error("expected error object", { cause }),
  );

  assert(Predicate.isTagged(candidate, expected.tag), `expected ${expected.tag}`);

  if (expected.status !== undefined) {
    assert(candidate.status === expected.status, `expected status ${expected.status}`);
  }

  return {
    status: candidate.status,
    tag: expected.tag,
  };
};

export const createLiveHarness = (_label: string): LiveHarness => {
  const run = async (name: string, fn: () => LiveDetails | Promise<LiveDetails>) => {
    test(name, async () => {
      await fn();
    });
  };

  return {
    assert,
    assertErrorTag,
    assertOperationError,
    checks: [],
    finish: () => undefined,
    run,
    sleep,
  };
};
