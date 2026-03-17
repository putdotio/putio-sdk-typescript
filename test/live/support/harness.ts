import { test } from "vitest";

import type { FileUploadResult, createPutioSdkPromiseClient } from "../../../src/index.js";
import { hydrateLiveTokenEnv } from "./secrets.ts";
import { createPutioSdkPromiseClient as createPromiseSdkClient } from "../../../src/index.js";

type PutioSdkPromiseClientFactory = typeof createPutioSdkPromiseClient;
type PutioSdkPromiseClient = ReturnType<PutioSdkPromiseClientFactory>;
type JsonPrimitive = boolean | null | number | string;
type LiveDetails =
  | JsonPrimitive
  | readonly unknown[]
  | {
      readonly [key: string]: unknown;
    };

type OperationErrorReason = {
  readonly errorType?: unknown;
  readonly kind?: unknown;
};

type OperationErrorBody = {
  readonly error_message?: unknown;
  readonly error_type?: unknown;
};

type OperationErrorCandidate = {
  readonly _tag?: unknown;
  readonly body?: OperationErrorBody;
  readonly domain?: unknown;
  readonly message?: unknown;
  readonly name?: unknown;
  readonly operation?: unknown;
  readonly reason?: OperationErrorReason;
  readonly status?: unknown;
};

type OperationErrorExpectation = {
  readonly domain: string;
  readonly operation: string;
  readonly errorType?: string;
  readonly statusCode?: number;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

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
  config: Record<string, unknown> = {},
): Promise<PutioSdkPromiseClient> => createPromiseSdkClient(config);

export const assert = (condition: unknown, message: string): void => {
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

export const isOperationError = (
  error: unknown,
): error is OperationErrorCandidate & {
  readonly _tag: "PutioOperationError";
  readonly domain: string;
  readonly operation: string;
  readonly status: number;
} => {
  if (!isRecord(error)) {
    return false;
  }

  return (
    error._tag === "PutioOperationError" &&
    typeof error.domain === "string" &&
    typeof error.operation === "string" &&
    typeof error.status === "number"
  );
};

export const expectOperationError = (
  error: unknown,
): OperationErrorCandidate & {
  readonly _tag: "PutioOperationError";
  readonly domain: string;
  readonly operation: string;
  readonly status: number;
} => {
  if (!isOperationError(error)) {
    throw new Error("expected PutioOperationError");
  }

  return error;
};

export const isFileUploadFileResult = (
  upload: FileUploadResult,
): upload is Extract<FileUploadResult, { readonly type: "file" }> => upload.type === "file";

export const assertOperationError = (
  error: unknown,
  expected: OperationErrorExpectation,
): {
  readonly error_message: unknown;
  readonly error_type: unknown;
  readonly operation: string;
  readonly status: number;
} => {
  assert(isRecord(error), "expected error object");
  const candidate = error as OperationErrorCandidate;

  assert(candidate._tag === "PutioOperationError", "expected PutioOperationError");
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
    status: candidate.status as number,
  };
};

export const assertErrorTag = (
  error: unknown,
  expected: {
    readonly status?: number;
    readonly tag: string;
  },
): {
  readonly status: unknown;
  readonly tag: string;
} => {
  assert(isRecord(error), "expected error object");
  const candidate = error as OperationErrorCandidate;

  assert(candidate._tag === expected.tag, `expected ${expected.tag}`);

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
    test.sequential(name, async () => {
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
