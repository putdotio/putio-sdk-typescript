import {
  PutioApiError,
  PutioAuthError,
  type PutioErrorEnvelope,
  PutioOperationError,
  PutioRateLimitError,
  type PutioKnownErrorContract,
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

export interface LocalizedErrorParams {
  readonly message: string;
  readonly recoverySuggestion: LocalizedErrorRecoverySuggestion;
  readonly underlyingError: unknown;
  readonly meta?: Record<string, unknown>;
}

export class LocalizedError extends Error {
  readonly recoverySuggestion: LocalizedErrorRecoverySuggestion;

  readonly underlyingError: unknown;

  readonly meta: Record<string, unknown>;

  constructor(params: LocalizedErrorParams) {
    super(params.message);
    this.name = "LocalizedError";
    this.recoverySuggestion = params.recoverySuggestion;
    this.underlyingError = params.underlyingError;
    this.meta = params.meta ?? {};
  }
}

type StatusAndBodyError =
  | PutioApiError
  | PutioAuthError
  | PutioRateLimitError
  | PutioOperationError<string, string, PutioKnownErrorContract>;

export type PutioLocalizableError = {
  readonly _tag?: string;
  readonly body: PutioErrorEnvelope;
  readonly status?: number;
};

export type PutioErrorWithBody = StatusAndBodyError;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isPutioErrorEnvelope = (value: unknown): value is PutioErrorEnvelope =>
  isObject(value) && ("status_code" in value || "error_type" in value || "error_message" in value);

const isPutioErrorWithBody = (value: unknown): value is PutioLocalizableError =>
  isObject(value) && "body" in value && isPutioErrorEnvelope(value.body);

const normalizePutioError = (
  error: PutioErrorEnvelope | PutioLocalizableError,
): PutioLocalizableError => {
  if (isPutioErrorEnvelope(error)) {
    return {
      _tag: "PutioErrorEnvelope",
      body: error,
      status: error.status_code,
    };
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

export type ErrorLocalizerFn = (error: unknown) => LocalizedError;

export const isErrorLocalizer = (fn: unknown): fn is ErrorLocalizerFn => {
  try {
    return typeof fn === "function" && fn(new Error("test")) instanceof LocalizedError;
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

    if (isPutioErrorWithBody(error) || isPutioErrorEnvelope(error)) {
      const apiError = normalizePutioError(error);

      const byErrorType = localizers.find(
        (localizer): localizer is APIErrorByErrorTypeLocalizer =>
          localizer.kind === "api_error_type" && localizer.error_type === apiError.body.error_type,
      );

      if (byErrorType) {
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

      const byStatusCode = localizers.find(
        (localizer): localizer is APIErrorByStatusCodeLocalizer =>
          localizer.kind === "api_status_code" &&
          localizer.status_code === apiError.body.status_code,
      );

      if (byStatusCode) {
        return new LocalizedError({
          underlyingError: apiError,
          ...byStatusCode.localize(apiError),
        });
      }
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
