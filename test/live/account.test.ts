import { describe, expect, test } from "vite-plus/test";

import { PutioOperationError } from "../../dist/index.js";
import { createLiveTokenClients } from "./support/harness.js";

describe("account live", () => {
  const clients = createLiveTokenClients();

  test("account info returns every requested conditional field", async () => {
    const info = await clients.oauthClient.account.getInfo({
      download_token: 1,
      features: 1,
      pas: 1,
      profitwell: 1,
      push_token: 1,
    });

    expect(info.pas?.user_hash).toBeDefined();
  });

  test("account settings decode", async () => {
    await clients.oauthClient.account.getSettings();
  });

  test("supported subtitle languages expose stable code and name fields", async () => {
    const languages = await clients.oauthClient.account.listSubtitleLanguages();

    expect(languages.length).toBeGreaterThan(0);
    expect(languages).toContainEqual({ code: "eng", name: "English" });
    expect(
      languages.every((language) => language.code.length > 0 && language.name.length > 0),
    ).toBe(true);
  });

  test("account settings theme mutation is reversible", async () => {
    const before = await clients.authClient.account.getSettings();
    const nextTheme = before.theme === "dark" ? "auto" : "dark";

    try {
      await clients.authClient.account.saveSettings({
        theme: nextTheme,
      });

      const changed = await clients.authClient.account.getSettings();
      expect(changed.theme).toBe(nextTheme);
    } finally {
      await clients.authClient.account
        .saveSettings({
          theme: before.theme,
        })
        .catch(() => undefined);

      const restored = await clients.authClient.account.getSettings();
      expect(restored.theme).toBe(before.theme);
    }
  });

  test("invalid callback url yields a typed operation error", async () => {
    const failure = clients.authClient.account.saveSettings({
      callback_url: "putio-typescript-sdk-invalid-callback",
    });

    await expect(failure).rejects.toBeInstanceOf(PutioOperationError);
    await expect(failure).rejects.toMatchObject({
      body: {
        error_type: "INVALID_CALLBACK_URL",
      },
      domain: "account",
      operation: "saveSettings",
      reason: {
        errorType: "INVALID_CALLBACK_URL",
        kind: "error_type",
      },
      status: 400,
    });
  });

  test("first-party confirmations listing succeeds", async () => {
    await clients.authClient.account.listConfirmations("password_change");
  });

  test("third-party confirmations listing rejects with a typed operation error", async () => {
    const failure = clients.oauthClient.account.listConfirmations("password_change");

    await expect(failure).rejects.toBeInstanceOf(PutioOperationError);
    await expect(failure).rejects.toMatchObject({
      body: {
        error_type: "invalid_scope",
      },
      domain: "account",
      operation: "listConfirmations",
      reason: {
        errorType: "invalid_scope",
        kind: "error_type",
      },
      status: 401,
    });
  });
});
