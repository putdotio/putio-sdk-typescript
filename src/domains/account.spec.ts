import { Effect } from "effect";
import { PutioOperationError, PutioValidationError, PutioContractError } from "../core/errors.js";
import {
  clearAccount,
  destroyAccount,
  getAccountInfo,
  getAccountSettings,
  listAccountSubtitleLanguages,
  listAccountConfirmations,
  saveAccountSettings,
  type AccountInfoBroad,
  type AccountInfoQuery,
  type PasInfo,
} from "./account.js";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import { createPutioSdkPromiseClient } from "../core/client.js";

import {
  expectFailure,
  getFormBody,
  getJsonBody,
  jsonResponse,
  provideSdk,
} from "../../test/support/sdk-test.js";

const accountSettings = {
  beta_user: false,
  callback_url: null,
  dark_theme: true,
  default_download_folder: 0,
  diagnostics_enabled: false,
  dont_autoselect_subtitles: false,
  fluid_layout: true,
  hide_subtitles: false,
  history_enabled: true,
  is_invisible: false,
  locale: "en",
  login_mails_enabled: true,
  next_episode: true,
  product_analytics_enabled: true,
  pushover_token: null,
  show_optimistic_usage: false,
  sort_by: "NAME_ASC",
  start_from: true,
  subtitle_languages: ["en", null],
  support_widget_enabled: false,
  theater_mode: false,
  theme: "dark" as const,
  transfer_sort_by: null,
  trash_enabled: true,
  tunnel_route_name: null,
  two_factor_enabled: false,
  use_private_download_ip: false,
  use_start_from: true,
  video_player: null,
};

const baseAccountInfo = {
  account_status: "active" as const,
  avatar_url: "https://app.put.io/avatar.png",
  can_create_sub_account: false,
  disk: {
    avail: 100,
    size: 200,
    used: 100,
  },
  files_will_be_deleted_at: null,
  is_eligible_for_friend_invitation: true,
  is_sub_account: false,
  mail: "sdk@put.io",
  monthly_bandwidth_usage: 0,
  password_last_changed_at: null,
  private_download_host_ip: null,
  settings: accountSettings,
  trash_size: 0,
  user_id: 1,
  username: "sdk",
  warnings: {},
};

describe("account domain", () => {
  it.effect("decodes account info and enforces requested-field contracts", () =>
    Effect.gen(function* () {
      const info = yield* provideSdk(
        getAccountInfo({
          download_token: 1,
          pas: 1,
        }),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/account/info?download_token=1&pas=1");

          return jsonResponse({
            info: {
              ...baseAccountInfo,
              download_token: "token-123",
              pas: {
                user_hash: "user-hash",
              },
            },
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      );

      expect(info.download_token).toBe("token-123");
      expect(info.pas.user_hash).toBe("user-hash");

      const fullInfo = yield* provideSdk(
        getAccountInfo({
          features: 1,
          intercom: 1,
          profitwell: 1,
        }),
        (request) => {
          expect(request.url).toBe(
            "https://api.put.io/v2/account/info?features=1&intercom=1&profitwell=1",
          );

          return jsonResponse({
            info: {
              ...baseAccountInfo,
              features: {
                beta: true,
              },
              paddle_user_id: "ctm_99",
              user_hash: "intercom-user",
            },
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      );

      expect(fullInfo.features?.beta).toBe(true);
      expect(fullInfo.user_hash).toBe("intercom-user");
      expect(fullInfo.paddle_user_id).toBe("ctm_99");

      const intercomInfo = yield* provideSdk(
        getAccountInfo({
          intercom: 1,
          platform: "ios",
        }),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/account/info?intercom=1&platform=ios");

          return jsonResponse({ info: baseAccountInfo, status: "OK" });
        },
        { accessToken: "token-123" },
      );

      expect(intercomInfo.user_hash).toBeUndefined();

      const exit = yield* Effect.exit(
        provideSdk(
          getAccountInfo({
            push_token: 1,
          }),
          () =>
            jsonResponse({
              info: baseAccountInfo,
              status: "OK",
            }),
          { accessToken: "token-123" },
        ),
      );

      const error = expectFailure(exit);
      expect(error).toBeInstanceOf(PutioContractError);
      expect(error).toMatchObject({
        missingField: "push_token",
      });

      for (const [query, expectedField] of [
        [{ download_token: 1 }, "download_token"],
        [{ features: 1 }, "features"],
        [{ pas: 1 }, "pas"],
        [{ profitwell: 1 }, "paddle_user_id"],
      ] as const) {
        const missingExit = yield* Effect.exit(
          provideSdk(
            getAccountInfo(query),
            () =>
              jsonResponse({
                info: baseAccountInfo,
                status: "OK",
              }),
            { accessToken: "token-123" },
          ),
        );

        expect(expectFailure(missingExit)).toBeInstanceOf(PutioContractError);
        expect(expectFailure(missingExit)).toMatchObject({
          missingField: expectedField,
        });
      }
    }),
  );

  it("types account info from any combination of requested fields", () => {
    type Result<TQuery extends AccountInfoQuery> = Effect.Success<
      ReturnType<typeof getAccountInfo<TQuery>>
    >;

    const combined = getAccountInfo({ download_token: 1, features: 1, push_token: 1 });

    expectTypeOf<Effect.Success<typeof combined>["download_token"]>().toEqualTypeOf<string>();
    expectTypeOf<Effect.Success<typeof combined>["push_token"]>().toEqualTypeOf<string>();
    expectTypeOf<Effect.Success<typeof combined>["features"]>().toExtend<Record<string, boolean>>();
    expectTypeOf<Effect.Success<typeof combined>["pas"]>().toEqualTypeOf<PasInfo | undefined>();

    const widenedQuery: AccountInfoQuery = { download_token: 1 };

    expectTypeOf(getAccountInfo(widenedQuery)).toEqualTypeOf(getAccountInfo());
    expectTypeOf<Result<AccountInfoQuery>>().toEqualTypeOf<AccountInfoBroad>();
    expectTypeOf<Result<AccountInfoQuery>["download_token"]>().toEqualTypeOf<string | undefined>();

    const client = createPutioSdkPromiseClient();

    expectTypeOf(
      client.account.getInfo<{ readonly features: 1; readonly pas: 1 }>,
    ).returns.resolves.toExtend<{
      readonly features: Record<string, boolean>;
      readonly pas: PasInfo;
    }>();
    expectTypeOf(
      client.account.getInfo<AccountInfoQuery>,
    ).returns.resolves.toEqualTypeOf<AccountInfoBroad>();
  });

  it.effect("reads and saves account settings", () =>
    Effect.gen(function* () {
      const settings = yield* provideSdk(
        getAccountSettings(),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/account/settings");

          return jsonResponse({
            settings: accountSettings,
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      );

      expect(settings.locale).toBe("en");
      expect(settings.diagnostics_enabled).toBe(false);
      expect(settings.product_analytics_enabled).toBe(true);
      expect(settings).not.toHaveProperty("support_widget_enabled");

      const result = yield* provideSdk(
        saveAccountSettings({
          diagnostics_enabled: false,
          username: "sdk-user",
        }),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/account/settings");
          expect(getJsonBody(request)).toEqual({
            diagnostics_enabled: false,
            username: "sdk-user",
          });

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      expect(result).toEqual({ status: "OK" });

      const combinedResult = yield* provideSdk(
        saveAccountSettings({
          current_password: "current-secret",
          locale: "tr",
          mail: "sdk-next@put.io",
          theme: "auto",
          username: "sdk-next",
        }),
        (request) => {
          expect(getJsonBody(request)).toEqual({
            current_password: "current-secret",
            locale: "tr",
            mail: "sdk-next@put.io",
            theme: "auto",
            username: "sdk-next",
          });

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      expect(combinedResult).toEqual({ status: "OK" });

      const twoFactorResult = yield* provideSdk(
        saveAccountSettings({
          two_factor_enabled: {
            code: "123456",
            enable: true,
          },
        }),
        (request) => {
          expect(getJsonBody(request)).toEqual({
            two_factor_enabled: {
              code: "123456",
              enable: true,
            },
          });

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      expect(twoFactorResult).toEqual({ status: "OK" });
    }),
  );

  it.effect("rejects invalid account request inputs before transport", () =>
    Effect.gen(function* () {
      let requestCount = 0;

      const handler = () => {
        requestCount += 1;

        return jsonResponse({ status: "OK" });
      };

      const invalidQuery = expectFailure(
        yield* Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can still supply invalid query flags.
            getAccountInfo({ download_token: 2 }),
            handler,
          ),
        ),
      );

      const invalidNestedSettings = expectFailure(
        yield* Effect.exit(
          provideSdk(
            saveAccountSettings({
              two_factor_enabled: {
                code: "123456",
                // @ts-expect-error JavaScript callers can still supply invalid nested values.
                enable: "yes",
              },
            }),
            handler,
          ),
        ),
      );

      const sensitiveSettings = "settings-secret-value";

      const invalidSensitiveSettings = expectFailure(
        yield* Effect.exit(
          provideSdk(
            saveAccountSettings({
              current_password: sensitiveSettings,
              // @ts-expect-error JavaScript callers can supply non-string mail values.
              mail: { value: sensitiveSettings },
            }),
            handler,
          ),
        ),
      );

      const invalidSubtitleCount = expectFailure(
        yield* Effect.exit(
          provideSdk(
            saveAccountSettings({
              subtitle_languages: ["en", "tr", "de"],
            }),
            handler,
          ),
        ),
      );

      const unknownSetting = expectFailure(
        yield* Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can supply unknown settings.
            saveAccountSettings({ unknown_setting: true }),
            handler,
          ),
        ),
      );

      const incompleteClearOptions = expectFailure(
        yield* Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can omit required clear flags.
            clearAccount({ files: true }),
            handler,
          ),
        ),
      );

      const invalidPassword = expectFailure(
        yield* Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can supply non-string passwords.
            destroyAccount({ value: "destroy-secret-value" }),
            handler,
          ),
        ),
      );

      const emptyPassword = expectFailure(
        yield* Effect.exit(provideSdk(destroyAccount(""), handler)),
      );

      const invalidConfirmationSubject = expectFailure(
        yield* Effect.exit(
          provideSdk(
            // @ts-expect-error JavaScript callers can supply unknown confirmation subjects.
            listAccountConfirmations("username_change"),
            handler,
          ),
        ),
      );

      expect(invalidQuery).toBeInstanceOf(PutioValidationError);
      expect(invalidNestedSettings).toBeInstanceOf(PutioValidationError);
      expect(invalidSensitiveSettings).toMatchObject({
        cause: {
          domain: "account",
          operation: "saveSettings",
          reason: "Invalid request input",
        },
      });
      expect(JSON.stringify(invalidSensitiveSettings)).not.toContain(sensitiveSettings);
      expect(invalidSubtitleCount).toBeInstanceOf(PutioValidationError);
      expect(unknownSetting).toBeInstanceOf(PutioValidationError);
      expect(incompleteClearOptions).toBeInstanceOf(PutioValidationError);
      expect(invalidPassword).toBeInstanceOf(PutioValidationError);
      expect(invalidPassword).toMatchObject({
        cause: {
          domain: "account",
          operation: "destroy",
          reason: "Invalid request input",
        },
      });
      expect(JSON.stringify(invalidPassword)).not.toContain("destroy-secret-value");
      expect(emptyPassword).toBeInstanceOf(PutioValidationError);
      expect(invalidConfirmationSubject).toBeInstanceOf(PutioValidationError);
      expect(requestCount).toBe(0);
    }),
  );

  it.effect("lists supported subtitle languages", () =>
    Effect.gen(function* () {
      const languages = yield* provideSdk(
        listAccountSubtitleLanguages(),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/account/subtitle_languages");

          return jsonResponse({
            languages: [
              { code: "eng", name: "English" },
              { code: "tur", name: "Turkish" },
            ],
            status: "OK",
          });
        },
        { accessToken: "token-123" },
      );

      expect(languages).toEqual([
        { code: "eng", name: "English" },
        { code: "tur", name: "Turkish" },
      ]);

      const invalidExit = yield* Effect.exit(
        provideSdk(
          listAccountSubtitleLanguages(),
          () =>
            jsonResponse({
              languages: [{ code: "eng" }],
              status: "OK",
            }),
          { accessToken: "token-123" },
        ),
      );

      expect(expectFailure(invalidExit)).toBeInstanceOf(PutioContractError);
    }),
  );

  it.effect("maps account operation failures and form mutations", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.exit(
        provideSdk(
          listAccountConfirmations("mail_change"),
          (request) => {
            expect(request.url).toBe(
              "https://api.put.io/v2/account/confirmation/list?type=mail_change",
            );

            return jsonResponse(
              {
                error_message: "Unauthorized",
                error_type: "invalid_scope",
                status_code: 401,
              },
              { status: 401 },
            );
          },
          { accessToken: "token-123" },
        ),
      );

      const error = expectFailure(failure);
      expect(error).toBeInstanceOf(PutioOperationError);
      expect(error).toMatchObject({
        domain: "account",
        operation: "listConfirmations",
      });

      const clearResult = yield* provideSdk(
        clearAccount({
          active_transfers: true,
          files: true,
          finished_transfers: false,
          friends: false,
          history: true,
          rss_feeds: false,
          rss_logs: false,
          trash: true,
        }),
        (request) => {
          const body = getFormBody(request);
          expect(request.url).toBe("https://api.put.io/v2/account/clear");
          expect(body.get("active_transfers")).toBe("true");
          expect(body.get("files")).toBe("true");
          expect(body.get("trash")).toBe("true");

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      expect(clearResult).toEqual({ status: "OK" });

      const destroyResult = yield* provideSdk(
        destroyAccount("secret"),
        (request) => {
          expect(getFormBody(request).get("current_password")).toBe("secret");

          return jsonResponse({ status: "OK" });
        },
        { accessToken: "token-123" },
      );

      expect(destroyResult).toEqual({ status: "OK" });
    }),
  );
});
