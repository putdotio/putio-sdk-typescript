import { Data, Predicate, Schema } from "effect";

import {
  PutioApiError,
  PutioAuthError,
  type PutioErrorEnvelope,
  PutioErrorEnvelopeSchema,
  PutioOperationError,
  PutioRateLimitError,
  type PutioKnownOperationErrorContract,
} from "../core/errors.js";

export type LocalizedErrorRecoverySuggestionTypeInstruction = {
  readonly type: "instruction";
  readonly description: string;
};

export type LocalizedErrorRecoverySuggestionTypeAction = {
  readonly type: "action";
  readonly description: string;
  readonly trigger: {
    readonly label: string;
    readonly callback: () => void;
  };
};

export type LocalizedErrorRecoverySuggestionTypeCaptcha = {
  readonly type: "captcha";
  readonly description: string;
};

export type LocalizedErrorRecoverySuggestion =
  | LocalizedErrorRecoverySuggestionTypeInstruction
  | LocalizedErrorRecoverySuggestionTypeAction
  | LocalizedErrorRecoverySuggestionTypeCaptcha;

export type LocalizedErrorMeta = Record<string, Schema.Json | undefined>;

export interface LocalizedErrorParams {
  readonly message: string;
  readonly recoverySuggestion: LocalizedErrorRecoverySuggestion;
  readonly underlyingError: unknown;
  readonly meta?: LocalizedErrorMeta;
}

export class LocalizedError extends Error {
  readonly recoverySuggestion: LocalizedErrorRecoverySuggestion;

  readonly underlyingError: unknown;

  readonly meta: LocalizedErrorMeta;

  constructor(params: LocalizedErrorParams) {
    super(params.message);
    this.name = "LocalizedError";
    this.recoverySuggestion = params.recoverySuggestion;
    this.underlyingError = params.underlyingError;
    this.meta = params.meta ?? {};
  }
}

export type PutioErrorWithBody =
  | PutioApiError
  | PutioAuthError
  | PutioRateLimitError
  | PutioOperationError<string, string, PutioKnownOperationErrorContract>;

export type PutioLocalizableError = {
  readonly _tag?: string;
  readonly body: PutioErrorEnvelope;
  readonly status?: number;
};

class LocalizablePutioErrorEnvelope extends Data.TaggedClass("PutioErrorEnvelope")<{
  readonly body: PutioErrorEnvelope;
  readonly status: number | undefined;
}> {}

const isLocalizablePutioErrorEnvelope = Schema.is(
  PutioErrorEnvelopeSchema.check(
    Schema.makeFilter(
      (envelope) =>
        "status_code" in envelope || "error_type" in envelope || "error_message" in envelope,
      { expected: "a put.io error envelope with a status code, error type, or error message" },
    ),
  ),
);

const isPutioErrorWithBody = Schema.is(Schema.Struct({ body: PutioErrorEnvelopeSchema }));

const normalizePutioError = (
  error: PutioErrorEnvelope | PutioLocalizableError,
): PutioLocalizableError => {
  if (isLocalizablePutioErrorEnvelope(error)) {
    return new LocalizablePutioErrorEnvelope({ body: error, status: error.status_code });
  }

  return error;
};

export type LocalizeErrorFn<E> = (
  error: E,
) => Pick<LocalizedErrorParams, "message" | "recoverySuggestion" | "meta">;

export type APIErrorByStatusCodeLocalizer = {
  readonly kind: "api_status_code";
  readonly status_code: number;
  readonly localize: LocalizeErrorFn<PutioLocalizableError>;
};

export type APIErrorByErrorTypeLocalizer = {
  readonly kind: "api_error_type";
  readonly error_type: string;
  readonly localize: LocalizeErrorFn<PutioLocalizableError>;
};

export type MatchConditionLocalizer<E> = {
  readonly kind: "match_condition";
  readonly match: (error: E) => boolean;
  readonly localize: LocalizeErrorFn<E>;
};

export type GenericErrorLocalizer = {
  readonly kind: "generic";
  readonly localize: LocalizeErrorFn<unknown>;
};

export type ErrorLocalizer<E> =
  | APIErrorByStatusCodeLocalizer
  | APIErrorByErrorTypeLocalizer
  | MatchConditionLocalizer<E>
  | GenericErrorLocalizer;

export type ErrorLocalizerFn = <E>(error: E) => LocalizedError;

export const isErrorLocalizer = (fn: unknown): fn is ErrorLocalizerFn => {
  try {
    return Predicate.isFunction(fn) && fn(new Error("test")) instanceof LocalizedError;
  } catch {
    return false;
  }
};

export const createLocalizeError =
  <GlobalError>(globalLocalizers: ReadonlyArray<ErrorLocalizer<GlobalError>>) =>
  <ScopedError extends GlobalError>(
    error: ScopedError,
    scopedLocalizers: ReadonlyArray<ErrorLocalizer<ScopedError>> = [],
  ): LocalizedError => {
    const localizers = [...scopedLocalizers, ...globalLocalizers];

    const apiError =
      isPutioErrorWithBody(error) || isLocalizablePutioErrorEnvelope(error)
        ? normalizePutioError(error)
        : undefined;

    const byErrorType =
      apiError &&
      localizers.find(
        (localizer): localizer is APIErrorByErrorTypeLocalizer =>
          localizer.kind === "api_error_type" && localizer.error_type === apiError.body.error_type,
      );

    if (apiError && byErrorType) {
      return new LocalizedError({
        underlyingError: apiError,
        ...byErrorType.localize(apiError),
      });
    }

    const byMatchCondition = localizers.find(
      (localizer): localizer is MatchConditionLocalizer<ScopedError> =>
        localizer.kind === "match_condition" && localizer.match(error),
    );

    if (byMatchCondition) {
      return new LocalizedError({
        underlyingError: error,
        ...byMatchCondition.localize(error),
      });
    }

    const byStatusCode =
      apiError &&
      localizers.find(
        (localizer): localizer is APIErrorByStatusCodeLocalizer =>
          localizer.kind === "api_status_code" &&
          localizer.status_code === apiError.body.status_code,
      );

    if (apiError && byStatusCode) {
      return new LocalizedError({
        underlyingError: apiError,
        ...byStatusCode.localize(apiError),
      });
    }

    const genericLocalizer = localizers.find(
      (localizer): localizer is GenericErrorLocalizer => localizer.kind === "generic",
    );

    if (genericLocalizer) {
      return new LocalizedError({
        underlyingError: error,
        ...genericLocalizer.localize(error),
      });
    }

    throw new Error(`No localizer found for error: ${String(error)}`);
  };
