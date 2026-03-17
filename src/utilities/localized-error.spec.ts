import { describe, expect, it } from "vitest";

import {
  PutioApiError,
  PutioOperationError,
  definePutioOperationErrorSpec,
} from "../core/errors.js";
import {
  LocalizedError,
  createLocalizeError,
  isErrorLocalizer,
  type GenericErrorLocalizer,
} from "./localized-error.js";

const genericErrorLocalizer: GenericErrorLocalizer = {
  kind: "generic",
  localize: () => ({
    message: "message",
    recoverySuggestion: {
      description: "description",
      type: "instruction",
    },
  }),
};

describe("utility localized error", () => {
  it("throws when no localizer matches", () => {
    const localizeError = createLocalizeError([]);
    expect(() => localizeError(undefined)).toThrowError();
  });

  it("returns a localized error from a generic localizer", () => {
    const localizeError = createLocalizeError([genericErrorLocalizer]);
    expect(localizeError(undefined)).toBeInstanceOf(LocalizedError);
  });

  it("localizes sdk errors by status code and error type", () => {
    const apiError = new PutioApiError({
      body: {
        error_message: "bad request",
        error_type: "TEST",
        status_code: 400,
      },
      status: 400,
    });

    const localizeError = createLocalizeError([
      genericErrorLocalizer,
      {
        kind: "api_status_code",
        localize: () => ({
          message: "status message",
          recoverySuggestion: {
            description: "status description",
            type: "instruction",
          },
        }),
        status_code: 400,
      },
      {
        error_type: "TEST",
        kind: "api_error_type",
        localize: () => ({
          message: "type message",
          recoverySuggestion: {
            description: "type description",
            type: "instruction",
          },
        }),
      },
    ]);

    expect(localizeError(apiError).message).toBe("type message");
  });

  it("localizes operation errors and preserves meta", () => {
    const spec = definePutioOperationErrorSpec({
      domain: "files",
      knownErrors: [{ errorType: "FILE_LOST", statusCode: 400 }] as const,
      operation: "move",
    });
    const [contract] = spec.knownErrors;
    const operationError = new PutioOperationError({
      body: {
        error_message: "lost",
        error_type: "FILE_LOST",
        status_code: 400,
      },
      contract,
      domain: "files",
      operation: "move",
      reason: {
        errorType: "FILE_LOST",
        kind: "error_type",
      },
      status: 400,
    });

    const localizeError = createLocalizeError([
      genericErrorLocalizer,
      {
        kind: "api_error_type",
        error_type: "FILE_LOST",
        localize: () => ({
          message: "localized",
          meta: { fileId: 42 },
          recoverySuggestion: {
            description: "recover",
            type: "instruction",
          },
        }),
      },
    ]);

    expect(localizeError(operationError).meta).toEqual({ fileId: 42 });
  });

  it("accepts raw putio error envelopes", () => {
    const localizeError = createLocalizeError([
      genericErrorLocalizer,
      {
        kind: "api_error_type",
        error_type: "TEST",
        localize: () => ({
          message: "raw envelope",
          recoverySuggestion: {
            description: "recover",
            type: "instruction",
          },
        }),
      },
    ]);

    expect(
      localizeError({
        error_message: "bad request",
        error_type: "TEST",
        status_code: 400,
      }).message,
    ).toBe("raw envelope");
  });

  it("supports match-condition localizers", () => {
    const localizeError = createLocalizeError([
      genericErrorLocalizer,
      {
        kind: "match_condition",
        match: (error: { foo: string }) => error.foo === "bar",
        localize: () => ({
          message: "match",
          recoverySuggestion: {
            description: "recover",
            type: "instruction",
          },
        }),
      },
    ]);

    expect(localizeError({ foo: "bar" }).message).toBe("match");
  });

  it("detects error localizer functions", () => {
    expect(
      isErrorLocalizer(
        () =>
          new LocalizedError({
            message: "message",
            recoverySuggestion: {
              description: "description",
              type: "instruction",
            },
            underlyingError: undefined,
          }),
      ),
    ).toBe(true);
  });
});
