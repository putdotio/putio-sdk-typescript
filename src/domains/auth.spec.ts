import { Effect } from "effect";
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
import { describe, expect, it } from "@effect/vitest";

import {
  expectFailure,
  getAuthorizationHeader,
  getFormBody,
  jsonResponse,
  provideSdk,
} from "../../test/support/sdk-test.js";

const renderErrorForSecretCheck = (error: Error): string =>
  `${String(error)}\n${error.stack ?? ""}\n${JSON.stringify(error)}`;

describe("auth domain", () => {
  it("builds the hosted login URL", () => {
    expect(
      buildAuthLoginUrl({
        clientId: 42,
        clientName: "putio-typescript-sdk",
        redirectUri: "https://example.com/callback",
        state: "state-123",
      }),
    ).toBe(
      "https://app.put.io/authenticate?client_id=42&client_name=putio-typescript-sdk&isolated=1&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&response_type=token&state=state-123",
    );
  });

  it.effect("exchanges OAuth authorization codes without sending configured credentials", () =>
    Effect.gen(function* () {
      expect(
        yield* provideSdk(
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
      ).toBe("exchanged-token");
    }),
  );

  it.effect("maps OAuth authorization-code failures and redacts invalid inputs", () =>
    Effect.gen(function* () {
      const denied = expectFailure(
        yield* Effect.exit(
          provideSdk(
            exchangeOAuthAuthorizationCode({
              clientId: 123,
              clientSecret: "client-secret",
              code: "denied-code",
            }),
            () => jsonResponse({ error: "access_denied" }, { status: 400 }),
          ),
        ),
      );

      expect(denied).toBeInstanceOf(OAuthAuthorizationCodeExchangeError);
      expect(denied).toMatchObject({
        code: "access_denied",
        status: 400,
      });

      let requestCount = 0;
      const sensitiveSecret = "highly-sensitive-client-secret";

      const invalid = expectFailure(
        yield* Effect.exit(
          provideSdk(
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
        ),
      );

      expect(invalid).toBeInstanceOf(PutioValidationError);
      expect(renderErrorForSecretCheck(invalid)).not.toContain(sensitiveSecret);
      expect(requestCount).toBe(0);
    }),
  );

  it.effect("covers the main auth flows", () =>
    Effect.gen(function* () {
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

      const loginResult = yield* provideSdk(
        login({
          callbackUrl: "https://example.com/callback",
          clientId: 42,
          clientName: "putio-typescript-sdk",
          clientSecret: "secret",
          fingerprint: "fingerprint-1",
          password: "pass",
          username: "sdk",
        }),
        (request) => {
          expect(request.url).toBe(
            "https://api.put.io/v2/oauth2/authorizations/clients/42/fingerprint-1?callback_url=https%3A%2F%2Fexample.com%2Fcallback&client_name=putio-typescript-sdk&client_secret=secret",
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
        yield* provideSdk(logout(), () => jsonResponse({ status: "OK" }), {
          accessToken: "token-123",
        }),
      ).toEqual({ status: "OK" });

      expect(
        yield* provideSdk(
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
        yield* provideSdk(exists("username", "sdk"), (request) => {
          expect(request.url).toBe("https://api.put.io/v2/registration/exists/username?value=sdk");

          return jsonResponse({ exists: true, status: "OK" });
        }),
      ).toBe(true);

      expect(
        yield* provideSdk(getVoucher("voucher"), () =>
          jsonResponse({ status: "OK", voucher: { days: 7, owner: "sdk" } }),
        ),
      ).toEqual({ days: 7, owner: "sdk" });

      expect(
        yield* provideSdk(getGiftCard("gift"), () =>
          jsonResponse({ gift_card: { days: 30, plan: true }, status: "OK" }),
        ),
      ).toEqual({ days: 30, plan: true });

      expect(
        yield* provideSdk(getFamilyInvite("family"), () =>
          jsonResponse({ invite: { owner: "owner", plan: "family" }, status: "OK" }),
        ),
      ).toEqual({ owner: "owner", plan: "family" });

      expect(
        yield* provideSdk(getFriendInvite("friend"), () =>
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
        yield* provideSdk(forgotPassword("sdk@put.io"), (request) => {
          expect(getFormBody(request).get("mail")).toBe("sdk@put.io");

          return jsonResponse({ status: "OK" });
        }),
      ).toEqual({ status: "OK" });

      expect(
        yield* provideSdk(resetPassword("key-1", "secret"), (request) => {
          const body = getFormBody(request);
          expect(body.get("key")).toBe("key-1");
          expect(body.get("password")).toBe("secret");

          return jsonResponse({ access_token: "reset-token", status: "OK" });
        }),
      ).toEqual({ access_token: "reset-token" });

      expect(
        yield* provideSdk(getCode({ appId: 9, clientName: "TV" }), (request) => {
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
        yield* provideSdk(checkCodeMatch("PUTIO1"), () =>
          jsonResponse({ oauth_token: "oauth-token", status: "OK" }),
        ),
      ).toBe("oauth-token");

      expect(
        yield* provideSdk(
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
        yield* provideSdk(grants(), () => jsonResponse({ apps: [authApp.app], status: "OK" }), {
          accessToken: "token-123",
        }),
      ).toHaveLength(1);

      expect(
        yield* provideSdk(
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
        yield* provideSdk(revokeApp(7), () => jsonResponse({ status: "OK" }), {
          accessToken: "token-123",
        }),
      ).toEqual({ status: "OK" });

      expect(
        yield* provideSdk(revokeClient(8), () => jsonResponse({ status: "OK" }), {
          accessToken: "token-123",
        }),
      ).toEqual({ status: "OK" });

      expect(
        yield* provideSdk(revokeAllClients(), () => jsonResponse({ status: "OK" }), {
          accessToken: "token-123",
        }),
      ).toEqual({ status: "OK" });

      expect(
        yield* provideSdk(validateToken("token-123"), (request) => {
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
        yield* provideSdk(
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
        yield* provideSdk(verifyTOTP("temp-token", "123456"), (request) => {
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
        yield* provideSdk(
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
        yield* provideSdk(
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
    }),
  );

  it.effect("sends the registration analytics choice as the literal strings the API accepts", () =>
    Effect.gen(function* () {
      const sentValue = (productAnalyticsEnabled?: boolean) =>
        Effect.gen(function* () {
          let value: string | null = null;
          yield* provideSdk(
            register({
              client_id: 42,
              mail: "sdk@put.io",
              password: "secret",
              product_analytics_enabled: productAnalyticsEnabled,
              username: "sdk",
            }),
            (request) => {
              value = getFormBody(request).get("product_analytics_enabled");

              return jsonResponse({ access_token: "registered", status: "OK" });
            },
          );

          return value;
        });

      expect(yield* sentValue(true)).toBe("true");
      expect(yield* sentValue(false)).toBe("false");
      expect(yield* sentValue(undefined)).toBeNull();
    }),
  );

  it.effect("rejects invalid auth inputs before transport without exposing credentials", () =>
    Effect.gen(function* () {
      let requestCount = 0;

      const handler = () => {
        requestCount += 1;

        return jsonResponse({ status: "OK" });
      };

      const sensitiveSecret = "sensitive-client-secret";
      const sensitivePassword = "sensitive-password";

      const failures = yield* Effect.all([
        Effect.exit(
          provideSdk(
            login({
              clientId: 42,
              clientSecret: sensitiveSecret,
              password: sensitivePassword,
              username: "",
            }),
            handler,
          ),
        ),
        Effect.exit(
          provideSdk(
            register({
              client_id: 42,
              mail: "sdk@put.io",
              password: sensitivePassword,
              username: "",
            }),
            handler,
          ),
        ),
        Effect.exit(
          provideSdk(
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
        ),
        Effect.exit(provideSdk(exists("username", ""), handler)),
        // @ts-expect-error JavaScript callers can provide unsupported lookup keys.
        Effect.exit(provideSdk(exists("phone", "sdk"), handler)),
        Effect.exit(provideSdk(getVoucher(""), handler)),
        Effect.exit(provideSdk(getGiftCard(""), handler)),
        Effect.exit(provideSdk(getFamilyInvite(""), handler)),
        Effect.exit(provideSdk(getFriendInvite(""), handler)),
        Effect.exit(provideSdk(forgotPassword(""), handler)),
        Effect.exit(provideSdk(resetPassword("", sensitivePassword), handler)),
        Effect.exit(provideSdk(getCode({ appId: 0 }), handler)),
        Effect.exit(provideSdk(checkCodeMatch(""), handler)),
        Effect.exit(provideSdk(linkDevice(""), handler)),
        Effect.exit(provideSdk(revokeApp(0), handler)),
        Effect.exit(provideSdk(revokeClient(1.5), handler)),
        Effect.exit(provideSdk(validateToken(""), handler)),
        Effect.exit(provideSdk(verifyTOTP("", "123456"), handler)),
        Effect.exit(provideSdk(verifyTOTP("temporary-token", ""), handler)),
      ]);

      const errors = failures.map(expectFailure<Error>);
      const renderedErrors = errors.map(renderErrorForSecretCheck).join("\n");
      expect(errors.every((error) => error instanceof PutioValidationError)).toBe(true);
      expect(renderedErrors).not.toContain(sensitiveSecret);
      expect(renderedErrors).not.toContain(sensitivePassword);
      expect(requestCount).toBe(0);
    }),
  );

  it.effect("maps auth operation errors", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        provideSdk(
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
        ),
      );

      const error = expectFailure(exit);
      expect(error).toBeInstanceOf(PutioOperationError);
      expect(error).toMatchObject({
        domain: "auth",
        operation: "register",
      });
    }),
  );
});
