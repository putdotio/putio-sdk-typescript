import { describe, expect, test } from "vite-plus/test";

import { createLiveTokenClients } from "./support/helpers.js";

describe.sequential("account live", () => {
  const clients = createLiveTokenClients();

  test("account info returns the expected conditional fields", async () => {
    const info = await clients.oauthClient.account.getInfo({
      download_token: 1,
      features: 1,
      pas: 1,
      profitwell: 1,
      push_token: 1,
    });

    expect(typeof info.download_token).toBe("string");
    expect(typeof info.push_token).toBe("string");
    expect(info.features).toBeTruthy();
    expect(info.pas).toBeTruthy();
    expect(typeof info.pas?.user_hash).toBe("string");
    expect(Object.prototype.hasOwnProperty.call(info, "paddle_user_id")).toBe(true);
    expect(Array.isArray(info.settings.subtitle_languages)).toBe(true);
  });

  test("account settings preserve nullable fields", async () => {
    const settings = await clients.oauthClient.account.getSettings();

    expect(Array.isArray(settings.subtitle_languages)).toBe(true);
    expect(settings.callback_url === null || typeof settings.callback_url === "string").toBe(true);
    expect(settings.locale === null || typeof settings.locale === "string").toBe(true);
    expect(
      settings.transfer_sort_by === null || typeof settings.transfer_sort_by === "string",
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
    await expect(
      clients.authClient.account.saveSettings({
        callback_url: "codex-invalid-callback",
      }),
    ).rejects.toMatchObject({
      _tag: "PutioOperationError",
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
    const confirmations = await clients.authClient.account.listConfirmations("password_change");

    expect(Array.isArray(confirmations)).toBe(true);
  });

  test("third-party confirmations listing rejects with a typed operation error", async () => {
    await expect(
      clients.oauthClient.account.listConfirmations("password_change"),
    ).rejects.toMatchObject({
      _tag: "PutioOperationError",
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
