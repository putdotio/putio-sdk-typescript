import { Predicate } from "effect";

const nonEmptyString = (value: unknown): string | undefined =>
  Predicate.isString(value) && value.trim().length > 0 ? value.trim() : undefined;

export const formatLiveError = (error: unknown): string => {
  if (error instanceof Error) {
    const message = nonEmptyString(error.message);
    if (message !== undefined) {
      return `${error.name}: ${message}`;
    }
  }

  if (Predicate.isObject(error)) {
    const tag = nonEmptyString(error._tag) ?? nonEmptyString(error.name);
    const status = Predicate.isNumber(error.status) ? String(error.status) : undefined;
    const body = Predicate.isObject(error.body) ? error.body : undefined;
    const errorType = body === undefined ? undefined : nonEmptyString(body.error_type);
    const retryAfter = nonEmptyString(error.retryAfter);
    const reset = nonEmptyString(error.reset);
    const action = nonEmptyString(error.action);
    const details = [
      tag,
      status === undefined ? undefined : `status=${status}`,
      errorType,
      retryAfter === undefined ? undefined : `retryAfter=${retryAfter}`,
      reset === undefined ? undefined : `reset=${reset}`,
      action === undefined ? undefined : `action=${action}`,
    ]
      .filter(Predicate.isString)
      .join(" ");

    if (details.length > 0) {
      return details;
    }

    if ("cause" in error) {
      return formatLiveError(error.cause);
    }
  }

  return "Unknown live test failure";
};
