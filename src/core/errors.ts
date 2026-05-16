import { Data, Effect, Schema } from "effect";

export const PutioErrorEnvelopeSchema = Schema.Struct({
  error_message: Schema.optional(Schema.String),
  error_type: Schema.optional(Schema.String),
  status_code: Schema.optional(Schema.Int),
  details: Schema.optional(Schema.Unknown),
});

export type PutioErrorEnvelope = Schema.Schema.Type<typeof PutioErrorEnvelopeSchema>;

export interface PutioKnownErrorContract<
  TType extends string = string,
  TStatus extends number = number,
> {
  readonly errorType?: TType | undefined;
  readonly statusCode?: TStatus | undefined;
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

type OperationContractOf<TSpec extends PutioOperationErrorSpec> = Extract<
  TSpec["knownErrors"][number],
  PutioKnownOperationErrorContract
>;

type OperationContractOfParts<
  TDomain extends string,
  TOperation extends string,
  TContracts extends ReadonlyArray<PutioKnownErrorContract>,
> = OperationContractOf<PutioOperationErrorSpec<TDomain, TOperation, TContracts>>;

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
): contract is Extract<TContract, PutioKnownOperationErrorContract> => {
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

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const hasOptionalString = (record: Readonly<Record<string, unknown>>, key: string): boolean =>
  !(key in record) || record[key] === undefined || typeof record[key] === "string";

const hasOptionalInteger = (record: Readonly<Record<string, unknown>>, key: string): boolean =>
  !(key in record) ||
  record[key] === undefined ||
  (typeof record[key] === "number" && Number.isInteger(record[key]));

const isKnownOperationErrorContract = (value: unknown): value is PutioKnownOperationErrorContract =>
  isRecord(value) &&
  (typeof value.errorType === "string" || typeof value.statusCode === "number") &&
  hasOptionalString(value, "errorType") &&
  hasOptionalInteger(value, "statusCode");

const isOperationReason = (
  value: unknown,
): value is PutioOperationErrorReason<PutioKnownOperationErrorContract> => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.kind === "error_type") {
    return typeof value.errorType === "string";
  }

  if (value.kind === "status_code") {
    return typeof value.statusCode === "number";
  }

  return false;
};

function toOperationReason<TContract extends { readonly errorType: string }>(
  contract: TContract,
): PutioOperationErrorReason<TContract>;
function toOperationReason<TContract extends { readonly statusCode: number }>(
  contract: TContract,
): PutioOperationErrorReason<TContract>;
function toOperationReason(
  contract: PutioKnownOperationErrorContract,
): PutioOperationErrorReason<PutioKnownOperationErrorContract> {
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

const PutioResponseErrorFields = {
  status: Schema.Int,
  body: PutioErrorEnvelopeSchema,
};

export class PutioApiError extends Schema.TaggedErrorClass<PutioApiError>()("PutioApiError", {
  ...PutioResponseErrorFields,
}) {}

export class PutioAuthError extends Schema.TaggedErrorClass<PutioAuthError>()("PutioAuthError", {
  ...PutioResponseErrorFields,
}) {}

export class PutioRateLimitError extends Schema.TaggedErrorClass<PutioRateLimitError>()(
  "PutioRateLimitError",
  {
    ...PutioResponseErrorFields,
    action: Schema.optional(Schema.String),
    id: Schema.optional(Schema.String),
    limit: Schema.optional(Schema.String),
    remaining: Schema.optional(Schema.String),
    retryAfter: Schema.optional(Schema.String),
    reset: Schema.optional(Schema.String),
  },
) {}

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

export const isPutioErrorEnvelope = (value: unknown): value is PutioErrorEnvelope =>
  isRecord(value) &&
  hasOptionalString(value, "error_message") &&
  hasOptionalString(value, "error_type") &&
  hasOptionalInteger(value, "status_code");

const hasStatusAndBody = <TTag extends string>(
  value: unknown,
  tag: TTag,
): value is {
  readonly _tag: TTag;
  readonly body: PutioErrorEnvelope;
  readonly status: number;
} =>
  isRecord(value) &&
  value._tag === tag &&
  typeof value.status === "number" &&
  isPutioErrorEnvelope(value.body);

export const isPutioApiError = (value: unknown): value is PutioApiError =>
  hasStatusAndBody(value, "PutioApiError");

export const isPutioAuthError = (value: unknown): value is PutioAuthError =>
  hasStatusAndBody(value, "PutioAuthError");

export const isPutioRateLimitError = (value: unknown): value is PutioRateLimitError =>
  hasStatusAndBody(value, "PutioRateLimitError") &&
  isRecord(value) &&
  hasOptionalString(value, "action") &&
  hasOptionalString(value, "id") &&
  hasOptionalString(value, "limit") &&
  hasOptionalString(value, "remaining") &&
  hasOptionalString(value, "retryAfter") &&
  hasOptionalString(value, "reset");

export const isPutioOperationError = (value: unknown): value is AnyPutioOperationError =>
  isRecord(value) &&
  value._tag === "PutioOperationError" &&
  isPutioErrorEnvelope(value.body) &&
  isKnownOperationErrorContract(value.contract) &&
  typeof value.domain === "string" &&
  typeof value.operation === "string" &&
  isOperationReason(value.reason) &&
  typeof value.status === "number";

export const fallbackPutioErrorEnvelope = (status: number): PutioErrorEnvelope => ({
  error_message: `put.io API request failed with status ${status}`,
  status_code: status,
});

const getHeader = (headers: Headers, name: string): string | undefined =>
  headers.get(name) ?? undefined;

export const responseRateLimitHeaders = (headers: Headers) => ({
  action: getHeader(headers, "x-ratelimit-action"),
  id: getHeader(headers, "x-ratelimit-id"),
  limit: getHeader(headers, "x-ratelimit-limit"),
  remaining: getHeader(headers, "x-ratelimit-remaining"),
  retryAfter: getHeader(headers, "retry-after"),
  reset: getHeader(headers, "x-ratelimit-reset"),
});

export const mapDecodeErrorToValidationError = (cause: unknown) =>
  new PutioValidationError({ cause });

export const mapConfigurationError = (cause: unknown) => new PutioConfigurationError({ cause });

export const mapTransportError = (cause: unknown) => new PutioTransportError({ cause });

export const makeResponseError = (
  status: number,
  headers: Headers,
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
): Effect.Effect<
  A,
  | E
  | PutioOperationError<
      TDomain,
      TOperation,
      OperationContractOfParts<TDomain, TOperation, TContracts>
    >,
  R
>;
export function withOperationErrors<
  const TDomain extends string,
  const TOperation extends string,
  const TContracts extends ReadonlyArray<PutioKnownErrorContract>,
>(
  spec: PutioOperationErrorSpec<TDomain, TOperation, TContracts>,
): <A, E extends PutioSdkError, R>(
  effect: Effect.Effect<A, E, R>,
) => Effect.Effect<
  A,
  | E
  | PutioOperationError<
      TDomain,
      TOperation,
      OperationContractOfParts<TDomain, TOperation, TContracts>
    >,
  R
>;
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
  | Effect.Effect<
      A,
      | E
      | PutioOperationError<
          TDomain,
          TOperation,
          OperationContractOfParts<TDomain, TOperation, TContracts>
        >,
      R
    >
  | (<A2, E2 extends PutioSdkError, R2>(
      effect: Effect.Effect<A2, E2, R2>,
    ) => Effect.Effect<
      A2,
      | E2
      | PutioOperationError<
          TDomain,
          TOperation,
          OperationContractOfParts<TDomain, TOperation, TContracts>
        >,
      R2
    >) {
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
        body: error.body as PutioTypedErrorEnvelope<
          OperationContractOfParts<TDomain, TOperation, TContracts>
        >,
        contract,
        domain: spec.domain,
        operation: spec.operation,
        reason: toOperationReason(contract),
        status: error.status,
      });
    }),
  );
}
