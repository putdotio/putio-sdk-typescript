import { PutioOperationError, PutioValidationError } from "../core/errors.js";
import {
  OAuthAuthorizationCodeExchangeError,
  buildAuthLoginUrl,
  checkCodeMatch,
  clients,
  exchangeOAuthAuthorizationCode,
  exists,
  forgotPassword,
  generateTOTP,
  getCode,
  getFamilyInvite,
  getFriendInvite,
  getGiftCard,
  getRecoveryCodes,
  getVoucher,
  grants,
  linkDevice,
  login,
  logout,
  regenerateRecoveryCodes,
  register,
  resetPassword,
  revokeAllClients,
  revokeApp,
  revokeClient,
  validateToken,
  verifyTOTP,
} from "./auth.js";
import { describe, expect, it } from "vite-plus/test";

import {
  expectFailure,
  getAuthorizationHeader,
  getFormBody,
  jsonResponse,
  runSdkEffect,
  runSdkExit,
} from "../../test/support/sdk-test.js";

describe("auth domain", () => {
  it("builds the hosted login URL", () => {
    expect(
      buildAuthLoginUrl({
        clientId: 42,
        clientName: "Codex",
        redirectUri: "https://example.com/callback",
        state: "state-123",
      }),
    ).toBe(
      "https://app.put.io/authenticate?client_id=42&client_name=Codex&isolated=1&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&response_type=token&state=state-123",
    );
  });

  it("exchanges OAuth authorization codes without sending configured credentials", async () => {
    await expect(
      runSdkEffect(
        exchangeOAuthAuthorizationCode({
          clientId: 123,
          clientSecret: "client-secret",
          code: "authorization-code",
          redirectUri: "myapp://callback",
        }),
        (request) => {
          const body = getFormBody(request);

          expect(request.method).toBe("POST");
          expect(request.url).toBe("https://api.put.io/v2/oauth2/access_token");
          expect(getAuthorizationHeader(request)).toBeUndefined();
          expect(body.get("client_id")).toBe("123");
          expect(body.get("client_secret")).toBe("client-secret");
          expect(body.get("code")).toBe("authorization-code");
          expect(body.get("grant_type")).toBe("authorization_code");
          expect(body.get("redirect_uri")).toBe("myapp://callback");

          return jsonResponse({ access_token: "exchanged-token" });
        },
        { accessToken: "configured-token" },
      ),
    ).resolves.toBe("exchanged-token");
  });

  it("maps OAuth authorization-code failures and redacts invalid inputs", async () => {
    const denied = expectFailure(
      await runSdkExit(
        exchangeOAuthAuthorizationCode({
          clientId: 123,
          clientSecret: "client-secret",
          code: "denied-code",
        }),
        () => jsonResponse({ error: "access_denied" }, { status: 400 }),
      ),
    );

    expect(denied).toBeInstanceOf(OAuthAuthorizationCodeExchangeError);
    expect(denied).toMatchObject({
      _tag: "OAuthAuthorizationCodeExchangeError",
      code: "access_denied",
      status: 400,
    });

    let requestCount = 0;
    const sensitiveSecret = "highly-sensitive-client-secret";
    const invalid = expectFailure(
      await runSdkExit(
        exchangeOAuthAuthorizationCode({
          clientId: 123,
          clientSecret: sensitiveSecret,
          code: "",
        }),
        () => {
          requestCount += 1;
          return jsonResponse({ access_token: "unexpected" });
        },
      ),
    );

    expect(invalid).toBeInstanceOf(PutioValidationError);
    expect(JSON.stringify(invalid)).not.toContain(sensitiveSecret);
    expect(requestCount).toBe(0);
  });

  it("covers the main auth flows", async () => {
    const authApp = {
      app: {
        callback: "https://example.com/callback",
        description: "sdk app",
        has_icon: false,
        hidden: true,
        id: 7,
        name: "SDK App",
        secret: "secret",
        website: "https://example.com",
      },
      status: "OK",
    };

    const loginResult = await runSdkEffect(
      login({
        callbackUrl: "https://example.com/callback",
        clientId: 42,
        clientName: "Codex",
        clientSecret: "secret",
        fingerprint: "fingerprint-1",
        password: "pass",
        username: "sdk",
      }),
      (request) => {
        expect(request.url).toBe(
          "https://api.put.io/v2/oauth2/authorizations/clients/42/fingerprint-1?callback_url=https%3A%2F%2Fexample.com%2Fcallback&client_name=Codex&client_secret=secret",
        );
        expect(getAuthorizationHeader(request)).toBe("Basic c2RrOnBhc3M=");

        return jsonResponse({
          access_token: "token-123",
          user_id: 1,
        });
      },
    );

    expect(loginResult).toEqual({
      access_token: "token-123",
      user_id: 1,
    });

    expect(
      await runSdkEffect(logout(), () => jsonResponse({ status: "OK" }), {
        accessToken: "token-123",
      }),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(
        register({
          client_id: 42,
          mail: "sdk@put.io",
          password: "secret",
          username: "sdk",
        }),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/registration/register");
          expect(getAuthorizationHeader(request)).toBeUndefined();
          expect(getFormBody(request).get("username")).toBe("sdk");
          return jsonResponse({ access_token: "registered", status: "OK" });
        },
      ),
    ).toEqual({ access_token: "registered" });

    expect(
      await runSdkEffect(exists("username", "sdk"), (request) => {
        expect(request.url).toBe("https://api.put.io/v2/registration/exists/username?value=sdk");
        return jsonResponse({ exists: true, status: "OK" });
      }),
    ).toBe(true);

    expect(
      await runSdkEffect(getVoucher("voucher"), () =>
        jsonResponse({ status: "OK", voucher: { days: 7, owner: "sdk" } }),
      ),
    ).toEqual({ days: 7, owner: "sdk" });

    expect(
      await runSdkEffect(getGiftCard("gift"), () =>
        jsonResponse({ gift_card: { days: 30, plan: true }, status: "OK" }),
      ),
    ).toEqual({ days: 30, plan: true });

    expect(
      await runSdkEffect(getFamilyInvite("family"), () =>
        jsonResponse({ invite: { owner: "owner", plan: "family" }, status: "OK" }),
      ),
    ).toEqual({ owner: "owner", plan: "family" });

    expect(
      await runSdkEffect(getFriendInvite("friend"), () =>
        jsonResponse({
          invite: {
            inviter: "owner",
            plan: { code: "pro", name: "Pro", period: 30 },
          },
          status: "OK",
        }),
      ),
    ).toEqual({
      inviter: "owner",
      plan: { code: "pro", name: "Pro", period: 30 },
    });

    expect(
      await runSdkEffect(forgotPassword("sdk@put.io"), (request) => {
        expect(getFormBody(request).get("mail")).toBe("sdk@put.io");
        return jsonResponse({ status: "OK" });
      }),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(resetPassword("key-1", "secret"), (request) => {
        const body = getFormBody(request);
        expect(body.get("key")).toBe("key-1");
        expect(body.get("password")).toBe("secret");
        return jsonResponse({ access_token: "reset-token", status: "OK" });
      }),
    ).toEqual({ access_token: "reset-token" });

    expect(
      await runSdkEffect(getCode({ appId: 9, clientName: "TV" }), (request) => {
        expect(request.url).toBe("https://api.put.io/v2/oauth2/oob/code?app_id=9&client_name=TV");
        return jsonResponse({
          code: "PUTIO1",
          qr_code_url: "https://api.put.io/qrcode/PUTIO1",
          status: "OK",
        });
      }),
    ).toEqual({
      code: "PUTIO1",
      qr_code_url: "https://api.put.io/qrcode/PUTIO1",
    });

    expect(
      await runSdkEffect(checkCodeMatch("PUTIO1"), () =>
        jsonResponse({ oauth_token: "oauth-token", status: "OK" }),
      ),
    ).toBe("oauth-token");

    expect(
      await runSdkEffect(
        linkDevice("PUTIO1"),
        (request) => {
          expect(getFormBody(request).get("code")).toBe("PUTIO1");
          return jsonResponse(authApp);
        },
        { accessToken: "token-123" },
      ),
    ).toEqual({
      description: "sdk app",
      has_icon: false,
      id: 7,
      name: "SDK App",
      website: "https://example.com",
    });

    expect(
      await runSdkEffect(grants(), () => jsonResponse({ apps: [authApp.app], status: "OK" }), {
        accessToken: "token-123",
      }),
    ).toHaveLength(1);

    expect(
      await runSdkEffect(
        clients(),
        () =>
          jsonResponse({
            clients: [
              {
                active: true,
                app_id: 7,
                app_name: "SDK App",
                client_name: "TV",
                created_at: "2026-03-17T00:00:00Z",
                id: 8,
                ip_address: "127.0.0.1",
                last_used_at: null,
                note: null,
                user_agent: "Agent",
              },
            ],
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toHaveLength(1);

    expect(
      await runSdkEffect(revokeApp(7), () => jsonResponse({ status: "OK" }), {
        accessToken: "token-123",
      }),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(revokeClient(8), () => jsonResponse({ status: "OK" }), {
        accessToken: "token-123",
      }),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(revokeAllClients(), () => jsonResponse({ status: "OK" }), {
        accessToken: "token-123",
      }),
    ).toEqual({ status: "OK" });

    expect(
      await runSdkEffect(validateToken("token-123"), (request) => {
        expect(request.url).toBe("https://api.put.io/v2/oauth2/validate?oauth_token=token-123");
        return jsonResponse({
          result: true,
          token_id: 1,
          token_scope: "default",
          user_id: 1,
        });
      }),
    ).toMatchObject({ result: true, token_scope: "default" });

    expect(
      await runSdkEffect(
        generateTOTP(),
        () =>
          jsonResponse({
            recovery_codes: { codes: [{ code: "abc", used_at: null }], created_at: "2026-03-17" },
            secret: "secret",
            status: "OK",
            uri: "otpauth://totp/sdk",
          }),
        { accessToken: "token-123" },
      ),
    ).toEqual({
      recovery_codes: { codes: [{ code: "abc", used_at: null }], created_at: "2026-03-17" },
      secret: "secret",
      uri: "otpauth://totp/sdk",
    });

    expect(
      await runSdkEffect(verifyTOTP("temp-token", "123456"), (request) => {
        expect(request.url).toBe(
          "https://api.put.io/v2/two_factor/verify/totp?oauth_token=temp-token",
        );
        expect(getFormBody(request).get("code")).toBe("123456");
        return jsonResponse({
          status: "OK",
          token: "verified-token",
          user_id: 1,
        });
      }),
    ).toEqual({
      token: "verified-token",
      user_id: 1,
    });

    expect(
      await runSdkEffect(
        getRecoveryCodes(),
        () =>
          jsonResponse({
            recovery_codes: { codes: [{ code: "abc", used_at: null }], created_at: "2026-03-17" },
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toEqual({
      codes: [{ code: "abc", used_at: null }],
      created_at: "2026-03-17",
    });

    expect(
      await runSdkEffect(
        regenerateRecoveryCodes(),
        () =>
          jsonResponse({
            recovery_codes: { codes: [{ code: "xyz", used_at: null }], created_at: "2026-03-18" },
            status: "OK",
          }),
        { accessToken: "token-123" },
      ),
    ).toEqual({
      codes: [{ code: "xyz", used_at: null }],
      created_at: "2026-03-18",
    });
  });

  it("rejects invalid auth inputs before transport without exposing credentials", async () => {
    let requestCount = 0;
    const handler = () => {
      requestCount += 1;
      return jsonResponse({ status: "OK" });
    };
    const sensitiveSecret = "sensitive-client-secret";
    const sensitivePassword = "sensitive-password";
    const failures = await Promise.all([
      runSdkExit(
        login({
          clientId: 42,
          clientSecret: sensitiveSecret,
          password: sensitivePassword,
          username: "",
        }),
        handler,
      ),
      runSdkExit(
        register({
          client_id: 42,
          mail: "sdk@put.io",
          password: sensitivePassword,
          username: "",
        }),
        handler,
      ),
      runSdkExit(
        register({
          client_id: 42,
          mail: "sdk@put.io",
          password: sensitivePassword,
          // @ts-expect-error JavaScript callers can provide unknown request properties.
          unexpected: true,
          username: "sdk",
        }),
        handler,
      ),
      runSdkExit(exists("username", ""), handler),
      // @ts-expect-error JavaScript callers can provide unsupported lookup keys.
      runSdkExit(exists("phone", "sdk"), handler),
      runSdkExit(getVoucher(""), handler),
      runSdkExit(getGiftCard(""), handler),
      runSdkExit(getFamilyInvite(""), handler),
      runSdkExit(getFriendInvite(""), handler),
      runSdkExit(forgotPassword(""), handler),
      runSdkExit(resetPassword("", sensitivePassword), handler),
      runSdkExit(getCode({ appId: 0 }), handler),
      runSdkExit(checkCodeMatch(""), handler),
      runSdkExit(linkDevice(""), handler),
      runSdkExit(revokeApp(0), handler),
      runSdkExit(revokeClient(1.5), handler),
      runSdkExit(validateToken(""), handler),
      runSdkExit(verifyTOTP("", "123456"), handler),
      runSdkExit(verifyTOTP("temporary-token", ""), handler),
    ]);

    const errors = failures.map(expectFailure);
    expect(errors.every((error) => error instanceof PutioValidationError)).toBe(true);
    expect(JSON.stringify(errors)).not.toContain(sensitiveSecret);
    expect(JSON.stringify(errors)).not.toContain(sensitivePassword);
    expect(requestCount).toBe(0);
  });

  it("maps auth operation errors", async () => {
    const exit = await runSdkExit(
      register({
        client_id: 42,
        mail: "sdk@put.io",
        password: "secret",
        username: "sdk",
      }),
      () =>
        jsonResponse(
          {
            error_message: "Username exists",
            error_type: "USERNAME_EXISTS",
            status_code: 400,
          },
          { status: 400 },
        ),
    );

    const error = expectFailure(exit);
    expect(error).toBeInstanceOf(PutioOperationError);
    expect(error).toMatchObject({
      _tag: "PutioOperationError",
      domain: "auth",
      operation: "register",
    });
  });
});
