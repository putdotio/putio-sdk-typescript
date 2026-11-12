import { Data, Effect, Predicate, Schema } from "effect";
import { dual, flow } from "effect/Function";

export const PutioErrorEnvelopeSchema = Schema.Struct({
  status: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
  error_message: Schema.optional(Schema.String),
  error_type: Schema.optional(Schema.String),
  error_uri: Schema.optional(Schema.String),
  error_id: Schema.optional(Schema.NullOr(Schema.String)),
  extra: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  status_code: Schema.optional(Schema.Int),
  details: Schema.optional(Schema.Unknown),
});

export type PutioErrorEnvelope = Schema.Schema.Type<typeof PutioErrorEnvelopeSchema>;

export interface PutioKnownErrorContract<
  TType extends string = string,
  TStatus extends number = number,
  TBody extends PutioErrorEnvelope = PutioErrorEnvelope,
> {
  readonly bodySchema?: Schema.Schema<TBody> | undefined;
  readonly errorType?: TType | undefined;
  readonly statusCode?: TStatus | undefined;
}

type ContractErrorType<TContract extends PutioKnownErrorContract> =
  TContract extends PutioKnownErrorContract<infer TType, number> ? TType : never;

type ContractStatusCode<TContract extends PutioKnownErrorContract> =
  TContract extends PutioKnownErrorContract<string, infer TStatus> ? TStatus : never;

type ContractBody<TContract extends PutioKnownErrorContract> = TContract extends {
  readonly bodySchema: Schema.Schema<infer TBody extends PutioErrorEnvelope>;
}
  ? TBody
  : PutioErrorEnvelope;

export type PutioTypedErrorEnvelope<TContract extends PutioKnownErrorContract> =
  TContract extends PutioKnownErrorContract
    ? Omit<ContractBody<TContract>, "error_message" | "error_type" | "status_code"> & {
        readonly error_message?: string;
        readonly error_type?: [ContractErrorType<TContract>] extends [never]
          ? string
          : ContractErrorType<TContract>;
        readonly status_code?: [ContractStatusCode<TContract>] extends [never]
          ? number
          : ContractStatusCode<TContract>;
      }
    : never;

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

type KnownOperationContractOf<TContracts extends ReadonlyArray<PutioKnownErrorContract>> = Extract<
  TContracts[number],
  PutioKnownOperationErrorContract
>;

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

export type PutioKnownOperationErrorContract =
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
): contract is TContract & PutioKnownOperationErrorContract => {
  if (contract.bodySchema !== undefined && !Schema.is(contract.bodySchema)(error.body)) {
    return false;
  }

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
  Predicate.isTagged(error, "PutioApiError") || Predicate.isTagged(error, "PutioAuthError");

const PutioKnownOperationErrorContractSchema = Schema.Union([
  Schema.Struct({
    errorType: Schema.String,
    statusCode: Schema.optional(Schema.Int),
  }),
  Schema.Struct({
    errorType: Schema.optional(Schema.Undefined),
    statusCode: Schema.Int,
  }),
]);

const PutioOperationErrorReasonSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("error_type"),
    errorType: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("status_code"),
    statusCode: Schema.Int,
  }),
]);

const toOperationReason = (
  contract: PutioKnownOperationErrorContract,
): PutioOperationErrorReason<PutioKnownOperationErrorContract> => {
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
};

const CauseErrorFields = {
  cause: Schema.Defect(),
};

export class PutioTransportError extends Schema.TaggedError<
  PutioTransportError,
  { readonly brand: unique symbol }
>()("PutioTransportError", { ...CauseErrorFields }) {}

export class PutioConfigurationError extends Schema.TaggedError<
  PutioConfigurationError,
  { readonly brand: unique symbol }
>()("PutioConfigurationError", { ...CauseErrorFields }) {}

export class PutioValidationError extends Schema.TaggedError<
  PutioValidationError,
  { readonly brand: unique symbol }
>()("PutioValidationError", { ...CauseErrorFields }) {}

export class PutioContractError extends Schema.TaggedError<
  PutioContractError,
  { readonly brand: unique symbol }
>()("PutioContractError", {
  cause: Schema.optional(Schema.Defect()),
  missingField: Schema.optional(Schema.String),
}) {}

const RateLimitHeaderFields = {
  action: Schema.optional(Schema.String),
  id: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.String),
  remaining: Schema.optional(Schema.String),
  retryAfter: Schema.optional(Schema.String),
  retryAfterSeconds: Schema.optional(Schema.Finite),
  reset: Schema.optional(Schema.String),
};

const PutioResponseErrorFields = {
  status: Schema.Int,
  body: PutioErrorEnvelopeSchema,
  cause: Schema.optional(Schema.Defect()),
};

export class PutioApiError extends Schema.TaggedError<
  PutioApiError,
  { readonly brand: unique symbol }
>()("PutioApiError", {
  ...PutioResponseErrorFields,
}) {}

export class PutioAuthError extends Schema.TaggedError<
  PutioAuthError,
  { readonly brand: unique symbol }
>()("PutioAuthError", {
  ...PutioResponseErrorFields,
}) {}

export class PutioRateLimitError extends Schema.TaggedError<
  PutioRateLimitError,
  { readonly brand: unique symbol }
>()("PutioRateLimitError", { ...PutioResponseErrorFields, ...RateLimitHeaderFields }) {}

export class PutioOperationError<
  TDomain extends string,
  TOperation extends string,
  TContract extends PutioKnownOperationErrorContract,
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
  | PutioContractError
  | PutioApiError
  | PutioAuthError
  | PutioRateLimitError;

export type PutioUnhandledSdkError = PutioSdkError;

export type PutioOperationErrorFromSpec<TSpec extends PutioOperationErrorSpec> =
  PutioOperationError<
    TSpec["domain"],
    TSpec["operation"],
    KnownOperationContractOf<TSpec["knownErrors"]>
  >;

export type PutioOperationFailure<TSpec extends PutioOperationErrorSpec> =
  | PutioUnhandledSdkError
  | PutioOperationErrorFromSpec<TSpec>;

export type AnyPutioOperationError = PutioOperationError<
  string,
  string,
  PutioKnownOperationErrorContract
>;

export const definePutioOperationErrorSpec = <
  const TDomain extends string,
  const TOperation extends string,
  const TContracts extends ReadonlyArray<PutioKnownErrorContract>,
>(
  spec: PutioOperationErrorSpec<TDomain, TOperation, TContracts>,
) => spec;

export const decodePutioErrorEnvelope = Schema.decodeUnknownEffect(PutioErrorEnvelopeSchema);

const isPutioErrorEnvelopeValue = Schema.is(PutioErrorEnvelopeSchema);

export const isPutioErrorEnvelope = (value: unknown): value is PutioErrorEnvelope =>
  isPutioErrorEnvelopeValue(value);

const PutioOperationErrorValueSchema = Schema.TaggedStruct("PutioOperationError", {
  body: PutioResponseErrorFields.body,
  status: PutioResponseErrorFields.status,
  contract: PutioKnownOperationErrorContractSchema,
  domain: Schema.String,
  operation: Schema.String,
  reason: PutioOperationErrorReasonSchema,
});

const PutioTransportErrorValueSchema = Schema.Struct(PutioTransportError.fields);

const PutioConfigurationErrorValueSchema = Schema.Struct(PutioConfigurationError.fields);

const PutioValidationErrorValueSchema = Schema.Struct(PutioValidationError.fields);

const PutioContractErrorValueSchema = Schema.Struct(PutioContractError.fields);

const PutioApiErrorValueSchema = Schema.Struct(PutioApiError.fields);

const PutioAuthErrorValueSchema = Schema.Struct(PutioAuthError.fields);

const PutioRateLimitErrorValueSchema = Schema.Struct(PutioRateLimitError.fields);

export type PutioTransportErrorValue = typeof PutioTransportErrorValueSchema.Type;

export type PutioConfigurationErrorValue = typeof PutioConfigurationErrorValueSchema.Type;

export type PutioValidationErrorValue = typeof PutioValidationErrorValueSchema.Type;

export type PutioContractErrorValue = typeof PutioContractErrorValueSchema.Type;

export type PutioApiErrorValue = typeof PutioApiErrorValueSchema.Type;

export type PutioAuthErrorValue = typeof PutioAuthErrorValueSchema.Type;

export type PutioRateLimitErrorValue = typeof PutioRateLimitErrorValueSchema.Type;

export type PutioOperationErrorValue = typeof PutioOperationErrorValueSchema.Type;

export const isPutioTransportError = Schema.is(PutioTransportErrorValueSchema);

export const isPutioConfigurationError = Schema.is(PutioConfigurationErrorValueSchema);

export const isPutioValidationError = Schema.is(PutioValidationErrorValueSchema);

export const isPutioContractError = Schema.is(PutioContractErrorValueSchema);

export const isPutioApiError = Schema.is(PutioApiErrorValueSchema);

export const isPutioAuthError = Schema.is(PutioAuthErrorValueSchema);

export const isPutioRateLimitError = Schema.is(PutioRateLimitErrorValueSchema);

export const isPutioOperationError = Schema.is(PutioOperationErrorValueSchema);

export const fallbackPutioErrorEnvelope = (status: number): PutioErrorEnvelope => ({
  error_message: `put.io API request failed with status ${status}`,
  status_code: status,
});

const getHeader = (headers: Headers, name: string): string | undefined =>
  headers.get(name) ?? undefined;

const deltaSecondsPattern = /^\d+$/;

const httpDatePattern =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

const parseRetryAfterSeconds = (value: string | undefined): number | undefined => {
  const trimmed = value?.trim();

  if (trimmed === undefined) {
    return undefined;
  }

  if (deltaSecondsPattern.test(trimmed)) {
    const seconds = Number(trimmed);

    return Number.isSafeInteger(seconds) ? seconds : undefined;
  }

  if (!httpDatePattern.test(trimmed)) {
    return undefined;
  }

  const retryAt = Date.parse(trimmed);

  return Number.isNaN(retryAt) ? undefined : Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
};

export const responseRateLimitHeaders = (headers: Headers) => {
  const retryAfter = getHeader(headers, "retry-after");

  return {
    action: getHeader(headers, "x-ratelimit-action"),
    id: getHeader(headers, "x-ratelimit-id"),
    limit: getHeader(headers, "x-ratelimit-limit"),
    remaining: getHeader(headers, "x-ratelimit-remaining"),
    retryAfter,
    retryAfterSeconds: parseRetryAfterSeconds(retryAfter),
    reset: getHeader(headers, "x-ratelimit-reset"),
  };
};

export const mapValidationError = (cause: unknown) => new PutioValidationError({ cause });

export const mapContractError = (cause: unknown) => new PutioContractError({ cause });

export const mapConfigurationError = (cause: unknown) => new PutioConfigurationError({ cause });

export const mapTransportError = (cause: unknown) => new PutioTransportError({ cause });

export const toPutioResponseError = (
  status: number,
  headers: Headers,
  body: PutioErrorEnvelope,
  cause?: unknown,
): PutioSdkError => {
  if (status === 429) {
    return new PutioRateLimitError({
      status,
      body,
      ...responseRateLimitHeaders(headers),
      cause,
    });
  }

  if (status === 401 || status === 403) {
    return new PutioAuthError({ status, body, cause });
  }

  return new PutioApiError({ status, body, cause });
};

export const parseErrorBody = (status: number) =>
  flow(
    decodePutioErrorEnvelope,
    Effect.orElseSucceed(() => fallbackPutioErrorEnvelope(status)),
  );

export const withOperationErrors: {
  <
    const TDomain extends string,
    const TOperation extends string,
    const TContracts extends ReadonlyArray<PutioKnownErrorContract>,
  >(
    spec: PutioOperationErrorSpec<TDomain, TOperation, TContracts>,
  ): <A, E extends PutioSdkError, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<
    A,
    E | PutioOperationError<TDomain, TOperation, KnownOperationContractOf<TContracts>>,
    R
  >;
  <
    A,
    E extends PutioSdkError,
    R,
    const TDomain extends string,
    const TOperation extends string,
    const TContracts extends ReadonlyArray<PutioKnownErrorContract>,
  >(
    effect: Effect.Effect<A, E, R>,
    spec: PutioOperationErrorSpec<TDomain, TOperation, TContracts>,
  ): Effect.Effect<
    A,
    E | PutioOperationError<TDomain, TOperation, KnownOperationContractOf<TContracts>>,
    R
  >;
} = dual(
  2,
  <A, E extends PutioSdkError, R>(
    effect: Effect.Effect<A, E, R>,
    spec: PutioOperationErrorSpec,
  ): Effect.Effect<A, E | AnyPutioOperationError, R> =>
    effect.pipe(
      Effect.mapError((error) => {
        if (!isMatchableApiError(error)) {
          return error;
        }

        const contract = spec.knownErrors.find((candidate) =>
          isKnownContractMatch(candidate, error),
        );

        if (!contract) {
          return error;
        }

        return new PutioOperationError({
          body: error.body,
          contract,
          domain: spec.domain,
          operation: spec.operation,
          reason: toOperationReason(contract),
          status: error.status,
        });
      }),
    ),
);
