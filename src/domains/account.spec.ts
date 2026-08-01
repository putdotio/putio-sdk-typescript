import { PutioOperationError, PutioValidationError } from "../core/errors.js";
import {
  clearAccount,
  destroyAccount,
  getAccountInfo,
  getAccountSettings,
  listAccountSubtitleLanguages,
  listAccountConfirmations,
  saveAccountSettings,
} from "./account.js";
import { describe, expect, it } from "vite-plus/test";

import {
  expectFailure,
  getFormBody,
  getJsonBody,
  jsonResponse,
  runSdkEffect,
  runSdkExit,
} from "../../test/support/sdk-test.js";

const accountSettings = {
  beta_user: false,
  callback_url: null,
  dark_theme: true,
  default_download_folder: 0,
  dont_autoselect_subtitles: false,
  fluid_layout: true,
  hide_subtitles: false,
  history_enabled: true,
  is_invisible: false,
  locale: "en",
  login_mails_enabled: true,
  next_episode: true,
  pushover_token: null,
  show_optimistic_usage: false,
  sort_by: "NAME_ASC",
  start_from: true,
  subtitle_languages: ["en", null],
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
  it("decodes account info and enforces requested-field contracts", async () => {
    const info = await runSdkEffect(
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

    const fullInfo = await runSdkEffect(
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

    expect(fullInfo.features.beta).toBe(true);
    expect(fullInfo.user_hash).toBe("intercom-user");
    expect(fullInfo.paddle_user_id).toBe("ctm_99");

    const intercomInfo = await runSdkEffect(
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

    const exit = await runSdkExit(
      getAccountInfo({
        push_token: 1,
      }),
      () =>
        jsonResponse({
          info: baseAccountInfo,
          status: "OK",
        }),
      { accessToken: "token-123" },
    );

    const error = expectFailure(exit);
    expect(error).toBeInstanceOf(PutioValidationError);
    expect(error).toMatchObject({
      _tag: "PutioValidationError",
      cause: 'Expected put.io to include "push_token" because it was requested',
    });

    for (const [query, expectedCause] of [
      [{ features: 1 }, 'Expected put.io to include "features" because it was requested'],
      [{ profitwell: 1 }, 'Expected put.io to include "paddle_user_id" because it was requested'],
    ] as const) {
      const missingExit = await runSdkExit(
        getAccountInfo(query),
        () =>
          jsonResponse({
            info: baseAccountInfo,
            status: "OK",
          }),
        { accessToken: "token-123" },
      );

      expect(expectFailure(missingExit)).toMatchObject({
        _tag: "PutioValidationError",
        cause: expectedCause,
      });
    }
  });

  it("reads and saves account settings", async () => {
    const settings = await runSdkEffect(
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

    const result = await runSdkEffect(
      saveAccountSettings({
        username: "sdk-user",
      }),
      (request) => {
        expect(request.url).toBe("https://api.put.io/v2/account/settings");
        expect(getJsonBody(request)).toEqual({
          username: "sdk-user",
        });

        return jsonResponse({ status: "OK" });
      },
      { accessToken: "token-123" },
    );

    expect(result).toEqual({ status: "OK" });

    const twoFactorResult = await runSdkEffect(
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
  });

  it("rejects invalid account request inputs before transport", async () => {
    let requestCount = 0;
    const handler = () => {
      requestCount += 1;
      return jsonResponse({ status: "OK" });
    };

    const invalidQuery = expectFailure(
      await runSdkExit(
        // @ts-expect-error JavaScript callers can still supply invalid query flags.
        getAccountInfo({ download_token: 2 }),
        handler,
      ),
    );
    const invalidNestedSettings = expectFailure(
      await runSdkExit(
        saveAccountSettings({
          two_factor_enabled: {
            code: "123456",
            // @ts-expect-error JavaScript callers can still supply invalid nested values.
            enable: "yes",
          },
        }),
        handler,
      ),
    );
    const invalidSubtitleCount = expectFailure(
      await runSdkExit(
        saveAccountSettings({
          subtitle_languages: ["en", "tr", "de"],
        }),
        handler,
      ),
    );
    const unknownSetting = expectFailure(
      await runSdkExit(
        // @ts-expect-error JavaScript callers can supply unknown settings.
        saveAccountSettings({ unknown_setting: true }),
        handler,
      ),
    );
    const incompleteClearOptions = expectFailure(
      await runSdkExit(
        // @ts-expect-error JavaScript callers can omit required clear flags.
        clearAccount({ files: true }),
        handler,
      ),
    );
    const invalidPassword = expectFailure(
      await runSdkExit(
        // @ts-expect-error JavaScript callers can supply non-string passwords.
        destroyAccount(123),
        handler,
      ),
    );
    const emptyPassword = expectFailure(await runSdkExit(destroyAccount(""), handler));
    const invalidConfirmationSubject = expectFailure(
      await runSdkExit(
        // @ts-expect-error JavaScript callers can supply unknown confirmation subjects.
        listAccountConfirmations("username_change"),
        handler,
      ),
    );

    expect(invalidQuery).toBeInstanceOf(PutioValidationError);
    expect(invalidNestedSettings).toBeInstanceOf(PutioValidationError);
    expect(invalidSubtitleCount).toBeInstanceOf(PutioValidationError);
    expect(unknownSetting).toBeInstanceOf(PutioValidationError);
    expect(incompleteClearOptions).toBeInstanceOf(PutioValidationError);
    expect(invalidPassword).toBeInstanceOf(PutioValidationError);
    expect(emptyPassword).toBeInstanceOf(PutioValidationError);
    expect(invalidConfirmationSubject).toBeInstanceOf(PutioValidationError);
    expect(requestCount).toBe(0);
  });

  it("lists supported subtitle languages", async () => {
    const languages = await runSdkEffect(
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

    const invalidExit = await runSdkExit(
      listAccountSubtitleLanguages(),
      () =>
        jsonResponse({
          languages: [{ code: "eng" }],
          status: "OK",
        }),
      { accessToken: "token-123" },
    );

    expect(expectFailure(invalidExit)).toBeInstanceOf(PutioValidationError);
  });

  it("maps account operation failures and form mutations", async () => {
    const failure = await runSdkExit(
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
    );

    const error = expectFailure(failure);
    expect(error).toBeInstanceOf(PutioOperationError);
    expect(error).toMatchObject({
      _tag: "PutioOperationError",
      domain: "account",
      operation: "listConfirmations",
    });

    const clearResult = await runSdkEffect(
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

    const destroyResult = await runSdkEffect(
      destroyAccount("secret"),
      (request) => {
        expect(getFormBody(request).get("current_password")).toBe("secret");
        return jsonResponse({ status: "OK" });
      },
      { accessToken: "token-123" },
    );

    expect(destroyResult).toEqual({ status: "OK" });
  });
});
