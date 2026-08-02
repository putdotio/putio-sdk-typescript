import { describe, expect, it } from "vite-plus/test";

import { PutioAuthError, PutioOperationError, PutioValidationError } from "../core/errors.js";
import {
  expectFailure,
  getFormBody,
  jsonResponse,
  runSdkEffect,
  runSdkExit,
} from "../../test/support/sdk-test.js";
import {
  createAppSpecificPassword,
  deleteAllAppSpecificPasswords,
  deleteAppSpecificPassword,
  listAppSpecificPasswords,
} from "./app-specific-passwords.js";

const appSpecificPassword = {
  created_at: "2026-08-01T10:00:00Z",
  id: 42,
  ip_address: null,
  last_used_at: null,
  note: "Laptop",
};

describe("app-specific password boundaries", () => {
  it("creates a password once and sends the trimmed note", async () => {
    expect(
      await runSdkEffect(
        createAppSpecificPassword({ note: "  Laptop  " }),
        (request) => {
          expect(request.method).toBe("POST");
          expect(request.url).toBe("https://api.put.io/v2/app_specific_password/create");
          expect(getFormBody(request).get("note")).toBe("Laptop");

          return jsonResponse({
            ...appSpecificPassword,
            password: "one-time-password",
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      ),
    ).toEqual({
      ...appSpecificPassword,
      password: "one-time-password",
    });
  });

  it("lists metadata without requiring a password or last-used timestamp", async () => {
    expect(
      await runSdkEffect(
        listAppSpecificPasswords(),
        (request) => {
          expect(request.method).toBe("GET");
          expect(request.url).toBe("https://api.put.io/v2/app_specific_password/list");

          return jsonResponse({
            passwords: [
              appSpecificPassword,
              {
                ...appSpecificPassword,
                id: 43,
                ip_address: "2001:db8::X",
                last_used_at: "2026-08-01T11:00:00Z",
                note: "Media server",
              },
            ],
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      ),
    ).toEqual([
      appSpecificPassword,
      {
        ...appSpecificPassword,
        id: 43,
        ip_address: "2001:db8::X",
        last_used_at: "2026-08-01T11:00:00Z",
        note: "Media server",
      },
    ]);
  });

  it("rejects malformed masked IP addresses from the API", async () => {
    const failure = expectFailure(
      await runSdkExit(
        listAppSpecificPasswords(),
        () =>
          jsonResponse({
            passwords: [{ ...appSpecificPassword, ip_address: "not-an-ip.XXX" }],
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    );

    expect(failure).toBeInstanceOf(PutioValidationError);
  });

  it("rejects invalid create and delete inputs before transport", async () => {
    let requestCount = 0;
    const handler = () => {
      requestCount += 1;
      return jsonResponse({ status: "OK" });
    };

    const missingNote = expectFailure(
      await runSdkExit(createAppSpecificPassword({ note: "   " }), handler, {
        accessToken: "token-123",
      }),
    );
    const longNote = expectFailure(
      await runSdkExit(createAppSpecificPassword({ note: "x".repeat(256) }), handler, {
        accessToken: "token-123",
      }),
    );
    const invalidId = expectFailure(
      await runSdkExit(deleteAppSpecificPassword(0), handler, {
        accessToken: "token-123",
      }),
    );

    expect(missingNote).toBeInstanceOf(PutioValidationError);
    expect(longNote).toBeInstanceOf(PutioValidationError);
    expect(invalidId).toBeInstanceOf(PutioValidationError);
    expect(requestCount).toBe(0);
  });

  it("types create failures and preserves structured limits", async () => {
    const failure = expectFailure(
      await runSdkExit(
        createAppSpecificPassword({ note: "Laptop" }),
        () =>
          jsonResponse(
            {
              error_message: "Maximum 10 app-specific passwords are allowed.",
              error_type: "TOO_MANY_APP_SPECIFIC_PASSWORDS",
              extra: { limit: 10 },
              status_code: 403,
            },
            { status: 403 },
          ),
        { accessToken: "token-123" },
      ),
    );

    expect(failure).toBeInstanceOf(PutioOperationError);
    expect(failure).toMatchObject({
      body: {
        error_type: "TOO_MANY_APP_SPECIFIC_PASSWORDS",
        extra: { limit: 10 },
      },
      domain: "account",
      operation: "appSpecificPasswords.create",
      reason: {
        errorType: "TOO_MANY_APP_SPECIFIC_PASSWORDS",
        kind: "error_type",
      },
      status: 403,
    });

    if (
      !(failure instanceof PutioOperationError) ||
      failure.body.error_type !== "TOO_MANY_APP_SPECIFIC_PASSWORDS"
    ) {
      throw new Error("Expected a typed app-specific password quota failure.");
    }

    const limit: number = failure.body.extra.limit;
    expect(limit).toBe(10);
  });

  it("does not classify malformed quota metadata as a typed operation error", async () => {
    const failure = expectFailure(
      await runSdkExit(
        createAppSpecificPassword({ note: "Laptop" }),
        () =>
          jsonResponse(
            {
              error_message: "Quota reached.",
              error_type: "TOO_MANY_APP_SPECIFIC_PASSWORDS",
              extra: { limit: "10" },
              status_code: 403,
            },
            { status: 403 },
          ),
        { accessToken: "token-123" },
      ),
    );

    expect(failure).toBeInstanceOf(PutioAuthError);
    expect(failure).not.toBeInstanceOf(PutioOperationError);
  });

  it("deletes one or all app-specific passwords", async () => {
    await expect(
      runSdkEffect(
        deleteAppSpecificPassword(42),
        (request) => {
          expect(request.method).toBe("POST");
          expect(request.url).toBe("https://api.put.io/v2/app_specific_password/42/delete");
          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).resolves.toBeUndefined();

    await expect(
      runSdkEffect(
        deleteAllAppSpecificPasswords(),
        (request) => {
          expect(request.method).toBe("POST");
          expect(request.url).toBe("https://api.put.io/v2/app_specific_password/delete_all");
          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      ),
    ).resolves.toBeUndefined();
  });
});
