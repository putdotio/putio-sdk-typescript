import {
  fallbackPutioErrorEnvelope,
  mapContractError,
  type PutioSdkError,
  toPutioResponseError,
} from "./errors.js";

export const isSuccessStatus = (status: number) => status >= 200 && status < 300;

export const unparsableJsonBodyError = (status: number, headers: Headers): PutioSdkError =>
  isSuccessStatus(status)
    ? mapContractError(new SyntaxError("The HTTP response body is not valid JSON"))
    : toPutioResponseError(
        status,
        headers,
        fallbackPutioErrorEnvelope(status),
        new SyntaxError("The HTTP error response body is not valid JSON"),
      );
