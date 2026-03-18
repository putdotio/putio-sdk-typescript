import { Headers } from "@effect/platform";
import { Data, Effect, Option, Schema } from "effect";

export const PutioErrorEnvelopeSchema = Schema.Struct({
  error_message: Schema.optional(Schema.String),
  error_type: Schema.optional(Schema.String),
  status_code: Schema.optional(Schema.Number.pipe(Schema.int())),
  details: Schema.optional(Schema.Unknown),
});

export type PutioErrorEnvelope = Schema.Schema.Type<typeof PutioErrorEnvelopeSchema>;

export interface PutioKnownErrorContract<
  TType extends string = string,
  TStatus extends number = number,
> {
  readonly errorType?: TType;
  readonly statusCode?: TStatus;
}

type ContractErrorType<TContract extends PutioKnownErrorContract> =
  TContract extends PutioKnownErrorContract<infer TType, number> ? TType : never;

type ContractStatusCode<TContract extends PutioKnownErrorContract> =
  TContract extends PutioKnownErrorContract<string, infer TStatus> ? TStatus : never;

export type PutioTypedErrorEnvelope<TContract extends PutioKnownErrorContract> = Omit<
  PutioErrorEnvelope,
  "error_message" | "error_type" | "status_code"
> & {
  readonly error_message?: string;
  readonly error_type?: [ContractErrorType<TContract>] extends [never]
    ? string
    : ContractErrorType<TContract>;
  readonly status_code?: [ContractStatusCode<TContract>] extends [never]
    ? number
    : ContractStatusCode<TContract>;
};

export interface PutioOperationErrorSpec<
  TDomain extends string = string,
  TOperation extends string = string,
  TContracts extends ReadonlyArray<PutioKnownErrorContract> =
    ReadonlyArray<PutioKnownErrorContract>,
> {
  readonly domain: TDomain;
  readonly operation: TOperation;
  readonly knownErrors: TContracts;
}

type OperationContractOf<TSpec extends PutioOperationErrorSpec> = TSpec["knownErrors"][number];

type PutioOperationErrorReason<TContract extends PutioKnownErrorContract> = TContract extends {
  readonly errorType: infer TType extends string;
}
  ? {
      readonly kind: "error_type";
      readonly errorType: TType;
    }
  : TContract extends { readonly statusCode: infer TStatus extends number }
    ? {
        readonly kind: "status_code";
        readonly statusCode: TStatus;
      }
    : never;

type PutioMatchableKnownErrorContract =
  | {
      readonly errorType: string;
      readonly statusCode?: number;
    }
  | {
      readonly errorType?: undefined;
      readonly statusCode: number;
    };

const isKnownContractMatch = <TContract extends PutioKnownErrorContract>(
  contract: TContract,
  error: PutioApiError | PutioAuthError,
): contract is Extract<TContract, PutioMatchableKnownErrorContract> => {
  if (contract.errorType !== undefined) {
    if (error.body.error_type !== contract.errorType) {
      return false;
    }

    return contract.statusCode === undefined || error.status === contract.statusCode;
  }

  if (contract.statusCode !== undefined) {
    return error.status === contract.statusCode;
  }

  return false;
};

const isMatchableApiError = (error: PutioSdkError): error is PutioApiError | PutioAuthError =>
  error._tag === "PutioApiError" || error._tag === "PutioAuthError";

function toOperationReason<TType extends string>(contract: {
  readonly errorType: TType;
  readonly statusCode?: number;
}): {
  readonly kind: "error_type";
  readonly errorType: TType;
};
function toOperationReason<TStatus extends number>(contract: {
  readonly errorType?: undefined;
  readonly statusCode: TStatus;
}): {
  readonly kind: "status_code";
  readonly statusCode: TStatus;
};
function toOperationReason(contract: PutioMatchableKnownErrorContract) {
  if (contract.errorType !== undefined) {
    return {
      kind: "error_type",
      errorType: contract.errorType,
    };
  }

  return {
    kind: "status_code",
    statusCode: contract.statusCode,
  };
}

export class PutioTransportError extends Data.TaggedError("PutioTransportError")<{
  readonly cause: unknown;
}> {}

export class PutioConfigurationError extends Data.TaggedError("PutioConfigurationError")<{
  readonly cause: unknown;
}> {}

export class PutioValidationError extends Data.TaggedError("PutioValidationError")<{
  readonly cause: unknown;
}> {}

export class PutioApiError extends Data.TaggedError("PutioApiError")<{
  readonly status: number;
  readonly body: PutioErrorEnvelope;
}> {}

export class PutioAuthError extends Data.TaggedError("PutioAuthError")<{
  readonly status: number;
  readonly body: PutioErrorEnvelope;
}> {}

export class PutioRateLimitError extends Data.TaggedError("PutioRateLimitError")<{
  readonly status: number;
  readonly body: PutioErrorEnvelope;
  readonly action?: string;
  readonly id?: string;
  readonly limit?: string;
  readonly remaining?: string;
  readonly retryAfter?: string;
  readonly reset?: string;
}> {}

export class PutioOperationError<
  TDomain extends string,
  TOperation extends string,
  TContract extends PutioKnownErrorContract,
> extends Data.TaggedError("PutioOperationError")<{
  readonly body: PutioTypedErrorEnvelope<TContract>;
  readonly contract: TContract;
  readonly domain: TDomain;
  readonly operation: TOperation;
  readonly reason: PutioOperationErrorReason<TContract>;
  readonly status: number;
}> {}

export type PutioSdkError =
  | PutioConfigurationError
  | PutioTransportError
  | PutioValidationError
  | PutioApiError
  | PutioAuthError
  | PutioRateLimitError;

export type PutioUnhandledSdkError =
  | PutioConfigurationError
  | PutioTransportError
  | PutioValidationError
  | PutioApiError
  | PutioAuthError
  | PutioRateLimitError;

export type PutioOperationErrorFromSpec<TSpec extends PutioOperationErrorSpec> =
  PutioOperationError<TSpec["domain"], TSpec["operation"], OperationContractOf<TSpec>>;

export type PutioOperationFailure<TSpec extends PutioOperationErrorSpec> =
  | PutioUnhandledSdkError
  | PutioOperationErrorFromSpec<TSpec>;

export const definePutioOperationErrorSpec = <
  const TDomain extends string,
  const TOperation extends string,
  const TContracts extends ReadonlyArray<PutioKnownErrorContract>,
>(
  spec: PutioOperationErrorSpec<TDomain, TOperation, TContracts>,
) => spec;

export const decodePutioErrorEnvelope = Schema.decodeUnknown(PutioErrorEnvelopeSchema);

export const fallbackPutioErrorEnvelope = (status: number): PutioErrorEnvelope => ({
  error_message: `put.io API request failed with status ${status}`,
  status_code: status,
});

export const responseRateLimitHeaders = (headers: Headers.Headers) => ({
  action: Option.getOrUndefined(Headers.get(headers, "x-ratelimit-action")),
  id: Option.getOrUndefined(Headers.get(headers, "x-ratelimit-id")),
  limit: Option.getOrUndefined(Headers.get(headers, "x-ratelimit-limit")),
  remaining: Option.getOrUndefined(Headers.get(headers, "x-ratelimit-remaining")),
  retryAfter: Option.getOrUndefined(Headers.get(headers, "retry-after")),
  reset: Option.getOrUndefined(Headers.get(headers, "x-ratelimit-reset")),
});

export const mapDecodeErrorToValidationError = (cause: unknown) =>
  new PutioValidationError({ cause });

export const mapConfigurationError = (cause: unknown) => new PutioConfigurationError({ cause });

export const mapTransportError = (cause: unknown) => new PutioTransportError({ cause });

export const makeResponseError = (
  status: number,
  headers: Headers.Headers,
  body: PutioErrorEnvelope,
): PutioSdkError => {
  if (status === 429) {
    return new PutioRateLimitError({
      status,
      body,
      ...responseRateLimitHeaders(headers),
    });
  }

  if (status === 401 || status === 403) {
    return new PutioAuthError({ status, body });
  }

  return new PutioApiError({ status, body });
};

export const parseErrorBody = (status: number, json: unknown) =>
  decodePutioErrorEnvelope(json).pipe(
    Effect.orElseSucceed(() => fallbackPutioErrorEnvelope(status)),
  );

export function withOperationErrors<
  A,
  E extends PutioSdkError,
  R,
  const TDomain extends string,
  const TOperation extends string,
  const TContracts extends ReadonlyArray<PutioKnownErrorContract>,
>(
  effect: Effect.Effect<A, E, R>,
  spec: PutioOperationErrorSpec<TDomain, TOperation, TContracts>,
): Effect.Effect<A, E | PutioOperationError<TDomain, TOperation, TContracts[number]>, R>;
export function withOperationErrors<
  const TDomain extends string,
  const TOperation extends string,
  const TContracts extends ReadonlyArray<PutioKnownErrorContract>,
>(
  spec: PutioOperationErrorSpec<TDomain, TOperation, TContracts>,
): <A, E extends PutioSdkError, R>(
  effect: Effect.Effect<A, E, R>,
) => Effect.Effect<A, E | PutioOperationError<TDomain, TOperation, TContracts[number]>, R>;
export function withOperationErrors<
  A,
  E extends PutioSdkError,
  R,
  const TDomain extends string,
  const TOperation extends string,
  const TContracts extends ReadonlyArray<PutioKnownErrorContract>,
>(
  effectOrSpec: Effect.Effect<A, E, R> | PutioOperationErrorSpec<TDomain, TOperation, TContracts>,
  maybeSpec?: PutioOperationErrorSpec<TDomain, TOperation, TContracts>,
):
  | Effect.Effect<A, E | PutioOperationError<TDomain, TOperation, TContracts[number]>, R>
  | (<A2, E2 extends PutioSdkError, R2>(
      effect: Effect.Effect<A2, E2, R2>,
    ) => Effect.Effect<A2, E2 | PutioOperationError<TDomain, TOperation, TContracts[number]>, R2>) {
  if (maybeSpec === undefined) {
    const spec = effectOrSpec as PutioOperationErrorSpec<TDomain, TOperation, TContracts>;

    return <A2, E2 extends PutioSdkError, R2>(effect: Effect.Effect<A2, E2, R2>) =>
      withOperationErrors(effect, spec);
  }

  const effect = effectOrSpec as Effect.Effect<A, E, R>;
  const spec = maybeSpec;

  return effect.pipe(
    Effect.mapError((error) => {
      if (!isMatchableApiError(error)) {
        return error;
      }

      const contract = spec.knownErrors.find((candidate) => isKnownContractMatch(candidate, error));

      if (!contract) {
        return error;
      }

      return new PutioOperationError({
        body: error.body as PutioTypedErrorEnvelope<TContracts[number]>,
        contract,
        domain: spec.domain,
        operation: spec.operation,
        reason: toOperationReason(contract),
        status: error.status,
      });
    }),
  );
}
