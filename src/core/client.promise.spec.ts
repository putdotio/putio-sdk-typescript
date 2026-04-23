import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("../domains/account.js", async () => {
  const { Effect } = await import("effect");

  return {
    clearAccount: vi.fn((options) => Effect.succeed({ cleared: options })),
    destroyAccount: vi.fn((password) => Effect.succeed({ destroyed: password })),
    getAccountInfo: vi.fn((query) => Effect.succeed({ id: 1, query, username: "sdk-user" })),
    getAccountSettings: vi.fn(() => Effect.succeed({ locale: "en" })),
    listAccountConfirmations: vi.fn((subject) => Effect.succeed([{ subject }])),
    saveAccountSettings: vi.fn((payload) => Effect.succeed({ saved: payload })),
  };
});

vi.mock("../domains/auth.js", async () => {
  const { Effect } = await import("effect");

  return {
    buildAuthLoginUrl: vi.fn(({ state }) => `https://app.put.io/authenticate?state=${state}`),
    checkCodeMatch: vi.fn((code) => Effect.succeed(code === "MATCH")),
    clients: vi.fn(() => Effect.succeed([{ id: 1, name: "cli" }])),
    exists: vi.fn((key, value) => Effect.succeed(key === "username" && value === "sdk-user")),
    forgotPassword: vi.fn((mail) => Effect.succeed({ mail, status: "OK" })),
    generateTOTP: vi.fn(() =>
      Effect.succeed({
        secret: "secret",
        uri: "otpauth://totp",
        recovery_codes: { codes: [], created_at: "2026-03-15" },
      }),
    ),
    getCode: vi.fn((input) =>
      Effect.succeed({ code: `CODE-${input.appId}`, qr_code_url: "https://api.put.io/qr" }),
    ),
    getFamilyInvite: vi.fn((code) => Effect.succeed({ owner: code, plan: "family" })),
    getFriendInvite: vi.fn((code) =>
      Effect.succeed({ inviter: code, plan: { code: "pro", name: "Pro", period: 30 } }),
    ),
    getGiftCard: vi.fn((code) => Effect.succeed({ days: 30, plan: code === "gift" })),
    getRecoveryCodes: vi.fn(() =>
      Effect.succeed({ codes: [{ code: "abc", used_at: null }], created_at: "2026-03-15" }),
    ),
    getVoucher: vi.fn((code) => Effect.succeed({ days: 7, owner: code })),
    grants: vi.fn(() => Effect.succeed([{ id: 5, name: "calendar" }])),
    linkDevice: vi.fn((code) => Effect.succeed({ id: 9, name: code })),
    login: vi.fn((input) =>
      Effect.succeed({ access_token: "token", user_id: Number(input.clientId) }),
    ),
    logout: vi.fn(() => Effect.succeed({ status: "OK" })),
    regenerateRecoveryCodes: vi.fn(() =>
      Effect.succeed({ codes: [{ code: "xyz", used_at: null }], created_at: "2026-03-16" }),
    ),
    register: vi.fn((input) => Effect.succeed({ access_token: `${input.username}-token` })),
    resetPassword: vi.fn((key, password) => Effect.succeed({ key, password })),
    revokeAllClients: vi.fn(() => Effect.succeed({ status: "OK" })),
    revokeApp: vi.fn((id) => Effect.succeed({ revokedApp: id })),
    revokeClient: vi.fn((id) => Effect.succeed({ revokedClient: id })),
    validateToken: vi.fn((token) =>
      Effect.succeed({ result: true, token_id: 1, token_scope: "default", user_id: token.length }),
    ),
    verifyTOTP: vi.fn((token, code) => Effect.succeed({ token: `${token}:${code}`, user_id: 1 })),
  };
});

vi.mock("../domains/config.js", async () => {
  const { Effect } = await import("effect");

  return {
    deleteConfigKey: vi.fn((key) => Effect.succeed({ deleted: key })),
    getConfigKey: vi.fn((key) => Effect.succeed(key === "theme" ? "dark" : true)),
    getConfigKeyWith: vi.fn((key) => Effect.succeed({ decoded: key })),
    readConfig: vi.fn(() => Effect.succeed({ theme: "dark" })),
    readConfigWith: vi.fn(() => Effect.succeed({ decoded: true })),
    setConfigKey: vi.fn((key, value) => Effect.succeed({ key, value })),
    writeConfig: vi.fn((value) => Effect.succeed(value)),
  };
});

vi.mock("../domains/download-links.js", async () => {
  const { Effect } = await import("effect");

  return {
    createDownloadLinks: vi.fn((input) => Effect.succeed({ id: input?.file_ids?.[0] ?? 1 })),
    getDownloadLinks: vi.fn((id) => Effect.succeed({ id, links: [] })),
  };
});

vi.mock("../domains/events.js", async () => {
  const { Effect } = await import("effect");

  return {
    clearEvents: vi.fn(() => Effect.succeed({ status: "OK" })),
    deleteEvent: vi.fn((id) => Effect.succeed({ deleted: id })),
    getEventTorrent: vi.fn((id) => Effect.succeed(Uint8Array.from([id]))),
    listEvents: vi.fn((query) =>
      Effect.succeed({
        events: [{ id: 1, type: "upload", user_id: 1, created_at: "2026-03-15" }],
        has_more: false,
        query,
      }),
    ),
  };
});

vi.mock("../domains/family.js", async () => {
  const { Effect } = await import("effect");

  return {
    createFamilyInvite: vi.fn(() => Effect.succeed({ code: "family-code" })),
    joinFamily: vi.fn((inviteCode) => Effect.succeed({ inviteCode, status: "joined" })),
    listFamilyInvites: vi.fn(() => Effect.succeed({ invites: [] })),
    listFamilyMembers: vi.fn(() => Effect.succeed([{ username: "sdk-user" }])),
    removeFamilyMember: vi.fn((username) => Effect.succeed({ removed: username })),
  };
});

vi.mock("../domains/ifttt.js", async () => {
  const { Effect } = await import("effect");

  return {
    getIftttStatus: vi.fn(() => Effect.succeed({ enabled: true })),
    sendIftttEvent: vi.fn((input) => Effect.succeed({ sent: input.event })),
  };
});

vi.mock("../domains/files.js", async () => {
  const { Effect } = await import("effect");

  return {
    continueFiles: vi.fn((cursor, query) => Effect.succeed({ cursor, files: [], query })),
    continueSearch: vi.fn((cursor, query) =>
      Effect.succeed({ cursor, files: [], query, total: 0 }),
    ),
    convertFileToMp4: vi.fn((fileId) =>
      Effect.succeed({ id: fileId, status: "COMPLETED", percent_done: 100, size: 123 }),
    ),
    convertFileSelectionToMp4: vi.fn((selection) => Effect.succeed((selection.ids ?? []).length)),
    convertFilesToMp4: vi.fn((ids) => Effect.succeed(ids.length)),
    createFileUploadFormData: vi.fn((input) => {
      const form = new FormData();
      form.set("file", input.file, input.fileName ?? "upload.bin");
      return form;
    }),
    createFileUploadRequest: vi.fn((input) =>
      Effect.succeed({
        body: new FormData(),
        method: "POST",
        url: `https://upload.put.io/${input.fileName ?? "file"}`,
      }),
    ),
    createFolder: vi.fn((input) =>
      Effect.succeed({ created: input.name ?? input.path ?? "folder" }),
    ),
    deleteFileExtraction: vi.fn((id) => Effect.succeed({ deletedExtraction: id })),
    deleteFileMp4: vi.fn((fileId) => Effect.succeed({ deletedMp4: fileId })),
    deleteFileSelection: vi.fn((selection, options) => Effect.succeed({ selection, options })),
    deleteFiles: vi.fn((ids, options) => Effect.succeed({ ids, options })),
    extractFiles: vi.fn((selection) =>
      Effect.succeed([
        {
          id: 1,
          files: selection.ids ?? [],
          message: null,
          name: "archive.zip",
          num_parts: 1,
          status: "NEW",
        },
      ]),
    ),
    findNextFile: vi.fn((fileId, fileType) =>
      Effect.succeed({ id: fileId + 1, name: `${fileType}-next`, parent_id: 0 }),
    ),
    findNextVideo: vi.fn((fileId) =>
      Effect.succeed({ id: fileId + 1, name: "next-video", parent_id: 0 }),
    ),
    getApiContentUrl: vi.fn((fileId) =>
      Effect.succeed(`https://api.put.io/files/${fileId}/stream`),
    ),
    getApiDownloadUrl: vi.fn((fileId) =>
      Effect.succeed(`https://api.put.io/files/${fileId}/download`),
    ),
    getApiMp4DownloadUrl: vi.fn((fileId) =>
      Effect.succeed(`https://api.put.io/files/${fileId}/mp4/download`),
    ),
    getDownloadUrl: vi.fn((fileId) => Effect.succeed(`https://download.put.io/${fileId}`)),
    getFile: vi.fn((input) => Effect.succeed({ id: input.id, name: "file", file_type: "FILE" })),
    getHlsStreamUrl: vi.fn((fileId) =>
      Effect.succeed(`https://api.put.io/files/${fileId}/hls/media.m3u8`),
    ),
    getMp4Status: vi.fn((fileId) =>
      Effect.succeed({ id: fileId, status: "COMPLETED", percent_done: 100, size: 100 }),
    ),
    getStartFrom: vi.fn((fileId) => Effect.succeed(fileId)),
    listActiveMp4Conversions: vi.fn(() =>
      Effect.succeed([{ id: 1, name: "video.mp4", status: "CONVERTING", percent_done: 50 }]),
    ),
    listFileExtractions: vi.fn(() =>
      Effect.succeed([
        {
          id: 1,
          files: [1],
          message: null,
          name: "archive.zip",
          num_parts: 1,
          status: "EXTRACTED",
        },
      ]),
    ),
    listFileSubtitles: vi.fn((fileId) =>
      Effect.succeed({
        default: null,
        subtitles: [
          {
            format: "srt",
            key: `${fileId}`,
            language: "English",
            language_code: "en",
            name: "English",
            source: "opensubtitles",
            url: "https://subtitle",
          },
        ],
      }),
    ),
    moveFileSelection: vi.fn((selection, parentId) =>
      Effect.succeed(
        [{ id: parentId, name: "move-selection", status_code: 400, error_type: "noop" }].slice(
          0,
          selection.ids ? 0 : 1,
        ),
      ),
    ),
    moveFiles: vi.fn((ids: ReadonlyArray<number>, parentId: number) =>
      Effect.succeed(
        ids.map((id: number) => ({
          error_type: "noop",
          id,
          name: `file-${id}`,
          status_code: parentId,
        })),
      ),
    ),
    putMp4ToMyFiles: vi.fn((fileId) => Effect.succeed({ movedMp4: fileId })),
    queryFiles: vi.fn((parent, query) =>
      Effect.succeed({ breadcrumbs: [], cursor: null, files: [], parent, query, total: 0 }),
    ),
    renameFile: vi.fn((input) => Effect.succeed({ renamed: input })),
    resetStartFrom: vi.fn((fileId) => Effect.succeed({ reset: fileId })),
    searchFiles: vi.fn((query) => Effect.succeed({ cursor: null, files: [], query, total: 0 })),
    setFilesWatchStatus: vi.fn((selection) => Effect.succeed({ watched: selection.watched })),
    setStartFrom: vi.fn((input) => Effect.succeed({ start_from: input.time })),
    uploadFile: vi.fn((input) =>
      Effect.succeed({ type: "file", file: { id: 1, name: input.fileName ?? "upload.bin" } }),
    ),
  };
});

vi.mock("../domains/friend-invites.js", async () => {
  const { Effect } = await import("effect");

  return {
    createFriendInvite: vi.fn(() => Effect.succeed({ code: "friend-code" })),
    listFriendInvites: vi.fn(() =>
      Effect.succeed({ invites: [{ code: "friend-code" }], remaining_limit: 3 }),
    ),
  };
});

vi.mock("../domains/friends.js", async () => {
  const { Effect } = await import("effect");

  return {
    approveFriendRequest: vi.fn((username) => Effect.succeed({ approved: username })),
    countWaitingRequests: vi.fn(() => Effect.succeed(2)),
    denyFriendRequest: vi.fn((username) => Effect.succeed({ denied: username })),
    getFriendSharedFolder: vi.fn((username) => Effect.succeed({ id: 1, name: username })),
    listFriends: vi.fn(() => Effect.succeed({ friends: [{ username: "sdk-user" }], total: 1 })),
    listSentRequests: vi.fn(() => Effect.succeed([{ username: "sent" }])),
    listWaitingRequests: vi.fn(() => Effect.succeed([{ username: "waiting" }])),
    removeFriend: vi.fn((username) => Effect.succeed({ removed: username })),
    searchFriends: vi.fn((username) => Effect.succeed([{ username }])),
    sendFriendRequest: vi.fn((username) => Effect.succeed({ sent: username })),
  };
});

vi.mock("../domains/oauth.js", async () => {
  const { Effect } = await import("effect");

  return {
    buildOAuthAppIconUrl: vi.fn(({ id }) => `https://api.put.io/oauth/apps/${id}/icon`),
    buildOAuthAuthorizeUrl: vi.fn(
      ({ oauthToken }) => `https://api.put.io/oauth2/authorize?oauth_token=${oauthToken}`,
    ),
    createOAuthApp: vi.fn((input) => Effect.succeed({ id: 1, ...input })),
    deleteOAuthApp: vi.fn((id) => Effect.succeed({ deleted: id })),
    getOAuthApp: vi.fn((id, options) => Effect.succeed({ id, edit: options?.edit ?? false })),
    getPopularOAuthApps: vi.fn(() => Effect.succeed([{ id: 1, name: "Popular" }])),
    queryOAuthApps: vi.fn(() => Effect.succeed([{ id: 1, name: "Mine" }])),
    regenerateOAuthAppToken: vi.fn((id) => Effect.succeed({ id, token: "new-token" })),
    setOAuthAppIcon: vi.fn((id) => Effect.succeed({ id, status: "updated" })),
    updateOAuthApp: vi.fn((input) => Effect.succeed(input)),
  };
});

vi.mock("../domains/payment.js", async () => {
  const { Effect } = await import("effect");

  return {
    classifyPaymentChangePlanResponse: vi.fn((input) => ({ classified: input })),
    confirmFastspringOrder: vi.fn((reference) => Effect.succeed(reference === "ok")),
    createCoinbaseCharge: vi.fn((planPath) => Effect.succeed(`coinbase:${planPath}`)),
    createNanoPaymentRequest: vi.fn((planCode) => Effect.succeed(`nano:${planCode}`)),
    createOpenNodeCharge: vi.fn((planPath) => Effect.succeed(`opennode:${planPath}`)),
    createPaddleWaitingPayment: vi.fn((input) => Effect.succeed({ waiting: input })),
    getPaymentInfo: vi.fn(() => Effect.succeed({ active: true })),
    getPaymentVoucherInfo: vi.fn((code) => Effect.succeed({ code, valid: true })),
    listPaymentHistory: vi.fn((query) => Effect.succeed([{ id: 1, query }])),
    listPaymentInvites: vi.fn(() => Effect.succeed([{ code: "invite" }])),
    listPaymentOptions: vi.fn(() => Effect.succeed([{ key: "card" }])),
    listPaymentPlans: vi.fn(() => Effect.succeed([{ code: "pro" }])),
    previewPaymentChangePlan: vi.fn((input) => Effect.succeed({ preview: input })),
    redeemPaymentVoucher: vi.fn((code) => Effect.succeed({ redeemed: code })),
    reportPayments: vi.fn((paymentIds) => Effect.succeed({ reported: paymentIds })),
    stopPaymentSubscription: vi.fn(() => Effect.succeed({ stopped: true })),
    submitPaymentChangePlan: vi.fn((input) => Effect.succeed({ submitted: input })),
  };
});

vi.mock("../domains/rss.js", async () => {
  const { Effect } = await import("effect");

  return {
    clearRssFeedLogs: vi.fn((id) => Effect.succeed({ cleared: id })),
    createRssFeed: vi.fn((params) => Effect.succeed({ id: 1, ...params })),
    deleteRssFeed: vi.fn((id) => Effect.succeed({ deleted: id })),
    getRssFeed: vi.fn((id) => Effect.succeed({ id, title: "feed" })),
    listRssFeedItems: vi.fn((id) => Effect.succeed({ feed: { id, title: "feed" }, items: [] })),
    listRssFeeds: vi.fn(() => Effect.succeed([{ id: 1, title: "feed" }])),
    pauseRssFeed: vi.fn((id) => Effect.succeed({ paused: id })),
    resumeRssFeed: vi.fn((id) => Effect.succeed({ resumed: id })),
    retryAllRssFeedItems: vi.fn((id) => Effect.succeed({ retriedAll: id })),
    retryRssFeedItem: vi.fn((feedId, itemId) => Effect.succeed({ feedId, itemId })),
    updateRssFeed: vi.fn((id, params) => Effect.succeed({ id, ...params })),
  };
});

vi.mock("../domains/sharing.js", async () => {
  const { Effect } = await import("effect");

  return {
    cloneSharedFiles: vi.fn((input) => Effect.succeed({ id: input?.ids?.[0] ?? 1 })),
    continuePublicShareFiles: vi.fn((cursor, query) =>
      Effect.succeed({ cursor, files: [], query }),
    ),
    createPublicShare: vi.fn((fileId) => Effect.succeed({ id: fileId })),
    deletePublicShare: vi.fn((id) => Effect.succeed({ deleted: id })),
    getPublicShare: vi.fn(() => Effect.succeed({ id: 1 })),
    getPublicShareFileUrl: vi.fn((fileId) => Effect.succeed(`https://public.put.io/${fileId}`)),
    getSharedWith: vi.fn((fileId) => Effect.succeed({ fileId, users: [] })),
    getSharingCloneInfo: vi.fn((id) => Effect.succeed({ id, state: "ready" })),
    listPublicShareFiles: vi.fn((query) => Effect.succeed({ cursor: null, files: [], query })),
    listPublicShares: vi.fn(() => Effect.succeed([{ id: 1 }])),
    listSharedFiles: vi.fn(() => Effect.succeed([{ id: 1 }])),
    shareFiles: vi.fn((input) => Effect.succeed({ shared: input })),
    unshareFile: vi.fn((input) => Effect.succeed({ unshared: input })),
  };
});

vi.mock("../domains/transfers.js", async () => {
  const { Effect } = await import("effect");

  const transfer = {
    availability: 1,
    callback_url: null,
    client_ip: null,
    completion_percent: 100,
    created_at: "2026-03-15",
    created_torrent: false,
    current_ratio: null,
    download_id: null,
    down_speed: 0,
    downloaded: 100,
    error_message: null,
    estimated_time: 0,
    file_id: 1,
    finished_at: null,
    hash: null,
    id: 1,
    is_private: false,
    name: "transfer",
    peers_connected: 0,
    peers_getting_from_us: 0,
    peers_sending_to_us: 0,
    percent_done: 100,
    save_parent_id: 0,
    seconds_seeding: null,
    simulated: false,
    size: 100,
    source: "https://example.com/file",
    started_at: null,
    status: "COMPLETED",
    subscription_id: null,
    torrent_link: null,
    tracker: null,
    tracker_message: null,
    type: "URL",
    uploaded: 0,
    up_speed: 0,
  };

  return {
    addManyTransfers: vi.fn((inputs: ReadonlyArray<{ readonly url: string }>) =>
      Effect.succeed({
        errors: [],
        transfers: inputs.map((_input: { readonly url: string }, index: number) => ({
          ...transfer,
          id: index + 1,
        })),
      }),
    ),
    addTransfer: vi.fn((input) => Effect.succeed({ ...transfer, source: input.url })),
    cancelTransfers: vi.fn((ids) => Effect.succeed({ cancelled: ids })),
    cleanTransfers: vi.fn((ids = []) => Effect.succeed({ deleted_ids: ids })),
    continueTransfers: vi.fn((cursor, query) =>
      Effect.succeed({ cursor, transfers: [transfer], query }),
    ),
    countTransfers: vi.fn(() => Effect.succeed(1)),
    getTransfer: vi.fn((id) => Effect.succeed({ ...transfer, id })),
    getTransferInfo: vi.fn((urls: ReadonlyArray<string>) =>
      Effect.succeed({
        disk_avail: 1000,
        ret: urls.map((url: string) => ({
          file_size: 1,
          human_size: "1 B",
          name: url,
          type_name: "url",
          url,
        })),
      }),
    ),
    listTransfers: vi.fn((query) =>
      Effect.succeed({ cursor: null, total: 1, transfers: [transfer], query }),
    ),
    reannounceTransfer: vi.fn((id) => Effect.succeed({ reannounced: id })),
    retryTransfer: vi.fn((id) => Effect.succeed({ ...transfer, id })),
    stopTransferRecording: vi.fn((id) => Effect.succeed({ stoppedRecording: id })),
  };
});

vi.mock("../domains/tunnel.js", async () => {
  const { Effect } = await import("effect");

  return {
    listTunnelRoutes: vi.fn(() => Effect.succeed([{ host: "tunnel.put.io" }])),
  };
});

vi.mock("../domains/trash.js", async () => {
  const { Effect } = await import("effect");

  return {
    continueTrash: vi.fn((cursor, query) => Effect.succeed({ cursor, files: [], query })),
    deleteTrash: vi.fn((input) => Effect.succeed({ deleted: input })),
    emptyTrash: vi.fn(() => Effect.succeed({ emptied: true })),
    listTrash: vi.fn((query) => Effect.succeed({ cursor: null, files: [], query })),
    restoreTrash: vi.fn((input) => Effect.succeed({ restored: input })),
  };
});

vi.mock("../domains/zips.js", async () => {
  const { Effect } = await import("effect");

  return {
    cancelZip: vi.fn((id) => Effect.succeed({ cancelled: id })),
    createZip: vi.fn((input) => Effect.succeed(input.file_ids?.[0] ?? 1)),
    getZip: vi.fn((id) => Effect.succeed({ id, status: "ready" })),
    listZips: vi.fn(() => Effect.succeed([{ id: 1 }])),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("sdk promise client adapters", () => {
  it("routes a broad namespace surface through the promise client", async () => {
    const { createPutioSdkPromiseClient } = await import("./client.js");

    const client = createPutioSdkPromiseClient({
      accessToken: "token-123",
      baseUrl: "https://api.put.io",
      uploadBaseUrl: "https://upload.put.io",
    });

    expect(await client.account.clear({ everywhere: true } as never)).toEqual({
      cleared: { everywhere: true },
    });
    expect(await client.account.destroy("secret")).toEqual({ destroyed: "secret" });
    expect(await client.account.getInfo({ download_token: 1 })).toMatchObject({ id: 1 });
    expect(await client.account.getSettings()).toEqual({ locale: "en" });
    expect(await client.account.listConfirmations("mail_change")).toEqual([
      { subject: "mail_change" },
    ]);
    expect(await client.account.saveSettings({ locale: "en" } as never)).toEqual({
      saved: { locale: "en" },
    });

    expect(
      client.auth.buildLoginUrl({ clientId: 1, redirectUri: "https://app", state: "abc" }),
    ).toContain("state=abc");
    expect(await client.auth.checkCodeMatch("MATCH")).toBe(true);
    expect(await client.auth.clients()).toEqual([{ id: 1, name: "cli" }]);
    expect(await client.auth.exists("username", "sdk-user")).toBe(true);
    expect(await client.auth.forgotPassword("a@put.io")).toEqual({
      mail: "a@put.io",
      status: "OK",
    });
    expect(await client.auth.getCode({ appId: 8993 })).toMatchObject({ code: "CODE-8993" });
    expect(await client.auth.getVoucher("voucher")).toEqual({ days: 7, owner: "voucher" });
    expect(await client.auth.getGiftCard("gift")).toEqual({ days: 30, plan: true });
    expect(await client.auth.getFamilyInvite("owner")).toEqual({ owner: "owner", plan: "family" });
    expect(await client.auth.getFriendInvite("friend")).toMatchObject({ inviter: "friend" });
    expect(await client.auth.grants()).toEqual([{ id: 5, name: "calendar" }]);
    expect(await client.auth.linkDevice("code")).toEqual({ id: 9, name: "code" });
    expect(
      await client.auth.login({
        clientId: 1,
        clientSecret: "secret",
        password: "pass",
        username: "user",
      }),
    ).toEqual({ access_token: "token", user_id: 1 });
    expect(await client.auth.logout()).toEqual({ status: "OK" });
    expect(
      await client.auth.register({
        client_id: 1,
        mail: "a@put.io",
        password: "pass",
        username: "user",
      }),
    ).toEqual({ access_token: "user-token" });
    expect(await client.auth.resetPassword("key", "next")).toEqual({
      key: "key",
      password: "next",
    });
    expect(await client.auth.revokeApp(3)).toEqual({ revokedApp: 3 });
    expect(await client.auth.revokeClient(4)).toEqual({ revokedClient: 4 });
    expect(await client.auth.revokeAllClients()).toEqual({ status: "OK" });
    expect(await client.auth.validateToken("token-123")).toMatchObject({ result: true });
    expect(await client.auth.twoFactor.generateTOTP()).toMatchObject({ secret: "secret" });
    expect(await client.auth.twoFactor.getRecoveryCodes()).toMatchObject({
      codes: [{ code: "abc", used_at: null }],
    });
    expect(await client.auth.twoFactor.regenerateRecoveryCodes()).toMatchObject({
      codes: [{ code: "xyz", used_at: null }],
    });
    expect(await client.auth.twoFactor.verifyTOTP("token", "123456")).toEqual({
      token: "token:123456",
      user_id: 1,
    });

    expect(await client.config.getKey("theme")).toBe("dark");
    expect(await client.config.getKeyWith("feature", {} as never)).toEqual({ decoded: "feature" });
    expect(await client.config.read()).toEqual({ theme: "dark" });
    expect(await client.config.readWith({} as never)).toEqual({ decoded: true });
    expect(await client.config.setKey("theme", "light")).toEqual({ key: "theme", value: "light" });
    expect(await client.config.write({ theme: "light" })).toEqual({ theme: "light" });
    expect(await client.config.deleteKey("theme")).toEqual({ deleted: "theme" });

    expect(await client.downloadLinks.create({ file_ids: [9] } as never)).toEqual({ id: 9 });
    expect(await client.downloadLinks.get(9)).toEqual({ id: 9, links: [] });

    expect(await client.events.list({ per_page: 10 })).toMatchObject({ has_more: false });
    expect(await client.events.delete(2)).toEqual({ deleted: 2 });
    expect(await client.events.clear()).toEqual({ status: "OK" });
    expect(Array.from(await client.events.getTorrent(7))).toEqual([7]);

    expect(await client.family.createInvite()).toEqual({ code: "family-code" });
    expect(await client.family.join("invite")).toEqual({ inviteCode: "invite", status: "joined" });
    expect(await client.family.listInvites()).toEqual({ invites: [] });
    expect(await client.family.listMembers()).toEqual([{ username: "sdk-user" }]);
    expect(await client.family.removeMember("friend")).toEqual({ removed: "friend" });

    expect(await client.ifttt.getStatus()).toEqual({ enabled: true });
    expect(await client.ifttt.sendEvent({ event: "finished" } as never)).toEqual({
      sent: "finished",
    });

    const uploadForm = client.files.createUploadFormData({
      file: new Blob(["hello"]),
      fileName: "hello.txt",
    });
    expect(uploadForm.get("file")).toBeInstanceOf(File);
    expect(
      await client.files.createUploadRequest({ file: new Blob(["hello"]), fileName: "hello.txt" }),
    ).toMatchObject({ method: "POST" });
    expect(await client.files.list(0, { per_page: 20 } as never)).toMatchObject({ parent: 0 });
    expect(await client.files.continue("cursor", { per_page: 20 })).toMatchObject({
      cursor: "cursor",
    });
    expect(await client.files.search({ query: "movie" } as never)).toMatchObject({ total: 0 });
    expect(await client.files.continueSearch("cursor", { per_page: 20 })).toMatchObject({
      cursor: "cursor",
    });
    expect(await client.files.createFolder({ name: "folder" })).toEqual({ created: "folder" });
    expect(await client.files.rename({ file_id: 1, name: "renamed" })).toEqual({
      renamed: { file_id: 1, name: "renamed" },
    });
    expect(await client.files.delete([1], { skipTrash: true })).toEqual({
      ids: [1],
      options: { skipTrash: true },
    });
    expect(await client.files.deleteSelection({ ids: [1] }, { partialDelete: true })).toEqual({
      selection: { ids: [1] },
      options: { partialDelete: true },
    });
    expect(await client.files.move([1, 2], 9)).toHaveLength(2);
    expect(await client.files.moveSelection({ ids: [1] }, 9)).toEqual([]);
    expect(await client.files.get({ id: 4 })).toMatchObject({ id: 4 });
    expect(await client.files.getDownloadUrl(4)).toBe("https://download.put.io/4");
    expect(await client.files.getApiDownloadUrl(4)).toBe("https://api.put.io/files/4/download");
    expect(await client.files.getApiContentUrl(4)).toBe("https://api.put.io/files/4/stream");
    expect(await client.files.getApiMp4DownloadUrl(4)).toBe(
      "https://api.put.io/files/4/mp4/download",
    );
    expect(await client.files.getHlsStreamUrl(4)).toBe("https://api.put.io/files/4/hls/media.m3u8");
    expect(await client.files.getStartFrom(4)).toBe(4);
    expect(await client.files.setStartFrom({ file_id: 4, time: 95 })).toEqual({
      start_from: 95,
    });
    expect(await client.files.resetStartFrom(4)).toEqual({ reset: 4 });
    expect(await client.files.getMp4Status(4)).toMatchObject({ id: 4, status: "COMPLETED" });
    expect(await client.files.convertToMp4(4)).toMatchObject({ id: 4 });
    expect(await client.files.convertManyToMp4([1, 2, 3])).toBe(3);
    expect(await client.files.convertSelectionToMp4({ ids: [1, 2] })).toBe(2);
    expect(await client.files.listActiveConversions()).toHaveLength(1);
    expect(await client.files.listExtractions()).toHaveLength(1);
    expect(await client.files.extract({ ids: [1] })).toHaveLength(1);
    expect(await client.files.deleteExtraction(10)).toEqual({ deletedExtraction: 10 });
    expect(await client.files.findNext(4, "VIDEO")).toMatchObject({ id: 5 });
    expect(await client.files.findNextVideo(4)).toMatchObject({ id: 5 });
    expect(await client.files.listSubtitles(4)).toMatchObject({ subtitles: [{ key: "4" }] });
    expect(await client.files.setWatchStatus({ ids: [1], watched: true })).toEqual({
      watched: true,
    });
    expect(await client.files.putMp4ToMyFiles(4)).toEqual({ movedMp4: 4 });
    expect(await client.files.deleteMp4(4)).toEqual({ deletedMp4: 4 });
    expect(
      await client.files.upload({ file: new Blob(["hello"]), fileName: "hello.txt" }),
    ).toMatchObject({
      type: "file",
    });

    expect(await client.friendInvites.create()).toEqual({ code: "friend-code" });
    expect(await client.friendInvites.list()).toEqual({
      invites: [{ code: "friend-code" }],
      remaining_limit: 3,
    });

    expect(await client.friends.approve("friend")).toEqual({ approved: "friend" });
    expect(await client.friends.countWaitingRequests()).toBe(2);
    expect(await client.friends.deny("friend")).toEqual({ denied: "friend" });
    expect(await client.friends.list()).toEqual({ friends: [{ username: "sdk-user" }], total: 1 });
    expect(await client.friends.listSentRequests()).toEqual([{ username: "sent" }]);
    expect(await client.friends.listWaitingRequests()).toEqual([{ username: "waiting" }]);
    expect(await client.friends.remove("friend")).toEqual({ removed: "friend" });
    expect(await client.friends.search("sdk-user")).toEqual([{ username: "sdk-user" }]);
    expect(await client.friends.sendRequest("friend")).toEqual({ sent: "friend" });
    expect(await client.friends.sharedFolder("friend")).toEqual({ id: 1, name: "friend" });

    expect(client.oauth.buildAuthorizeUrl({ oauthToken: "token-123" })).toContain(
      "oauth_token=token-123",
    );
    expect(client.oauth.buildIconUrl({ id: 9, oauthToken: "token-123" })).toContain("/9/icon");
    expect(await client.oauth.create({ name: "Test" } as never)).toMatchObject({
      id: 1,
      name: "Test",
    });
    expect(await client.oauth.delete(9)).toEqual({ deleted: 9 });
    expect(await client.oauth.get(9, { edit: true })).toEqual({ id: 9, edit: true });
    expect(await client.oauth.getPopularApps()).toEqual([{ id: 1, name: "Popular" }]);
    expect(await client.oauth.query()).toEqual([{ id: 1, name: "Mine" }]);
    expect(await client.oauth.regenerateToken(9)).toEqual({ id: 9, token: "new-token" });
    expect(await client.oauth.setIcon(9, { icon: new Blob(["icon"]) })).toEqual({
      id: 9,
      status: "updated",
    });
    expect(await client.oauth.update({ id: 9, name: "Updated" } as never)).toEqual({
      id: 9,
      name: "Updated",
    });

    expect(client.payment.changePlan.classifyResponse({ status: "OK", urls: [] })).toEqual({
      classified: { status: "OK", urls: [] },
    });
    expect(await client.payment.changePlan.preview({ plan: "pro" } as never)).toEqual({
      preview: { plan: "pro" },
    });
    expect(await client.payment.changePlan.submit({ plan: "pro" } as never)).toEqual({
      submitted: { plan: "pro" },
    });
    expect(await client.payment.confirmFastspringOrder("ok")).toBe(true);
    expect(await client.payment.getInfo()).toEqual({ active: true });
    expect(await client.payment.listHistory({ page: 1 } as never)).toEqual([
      { id: 1, query: { page: 1 } },
    ]);
    expect(await client.payment.listInvites()).toEqual([{ code: "invite" }]);
    expect(await client.payment.listOptions()).toEqual([{ key: "card" }]);
    expect(await client.payment.listPlans()).toEqual([{ code: "pro" }]);
    expect(await client.payment.methods.addPaddleWaitingPayment({ plan: "pro" } as never)).toEqual({
      waiting: { plan: "pro" },
    });
    expect(await client.payment.methods.createCoinbaseCharge("pro")).toBe("coinbase:pro");
    expect(await client.payment.methods.createNanoPaymentRequest("nano")).toBe("nano:nano");
    expect(await client.payment.methods.createOpenNodeCharge("pro")).toBe("opennode:pro");
    expect(await client.payment.report([1, 2])).toEqual({ reported: [1, 2] });
    expect(await client.payment.stopSubscription()).toEqual({ stopped: true });
    expect(await client.payment.voucher.getInfo("voucher")).toEqual({
      code: "voucher",
      valid: true,
    });
    expect(await client.payment.voucher.redeem("voucher")).toEqual({ redeemed: "voucher" });

    expect(await client.rss.clearLogs(1)).toEqual({ cleared: 1 });
    expect(await client.rss.create({ title: "feed" } as never)).toMatchObject({
      id: 1,
      title: "feed",
    });
    expect(await client.rss.delete(1)).toEqual({ deleted: 1 });
    expect(await client.rss.get(1)).toEqual({ id: 1, title: "feed" });
    expect(await client.rss.list()).toEqual([{ id: 1, title: "feed" }]);
    expect(await client.rss.listItems(1)).toMatchObject({ feed: { id: 1, title: "feed" } });
    expect(await client.rss.pause(1)).toEqual({ paused: 1 });
    expect(await client.rss.resume(1)).toEqual({ resumed: 1 });
    expect(await client.rss.retryAll(1)).toEqual({ retriedAll: 1 });
    expect(await client.rss.retryItem(1, 2)).toEqual({ feedId: 1, itemId: 2 });
    expect(await client.rss.update(1, { title: "updated" } as never)).toMatchObject({
      id: 1,
      title: "updated",
    });

    expect(await client.sharing.clone({ ids: [5] })).toEqual({ id: 5 });
    expect(await client.sharing.getCloneInfo(5)).toEqual({ id: 5, state: "ready" });
    expect(await client.sharing.getSharedWith(5)).toEqual({ fileId: 5, users: [] });
    expect(await client.sharing.listSharedFiles()).toEqual([{ id: 1 }]);
    expect(await client.sharing.publicAccess.continueFiles("cursor")).toMatchObject({
      cursor: "cursor",
    });
    expect(await client.sharing.publicAccess.get()).toEqual({ id: 1 });
    expect(await client.sharing.publicAccess.getFileUrl(5)).toBe("https://public.put.io/5");
    expect(await client.sharing.publicAccess.listFiles({ per_page: 10 } as never)).toMatchObject({
      cursor: null,
    });
    expect(await client.sharing.publicShares.create(5)).toEqual({ id: 5 });
    expect(await client.sharing.publicShares.delete(5)).toEqual({ deleted: 5 });
    expect(await client.sharing.publicShares.list()).toEqual([{ id: 1 }]);
    expect(await client.sharing.shareFiles({ file_ids: [1] } as never)).toEqual({
      shared: { file_ids: [1] },
    });
    expect(await client.sharing.unshare({ fileId: 1, shares: [2] })).toEqual({
      unshared: { fileId: 1, shares: [2] },
    });

    expect(await client.tunnel.listRoutes()).toEqual([{ host: "tunnel.put.io" }]);

    expect(await client.trash.continue("cursor")).toMatchObject({ cursor: "cursor" });
    expect(await client.trash.delete({ ids: [1] } as never)).toEqual({ deleted: { ids: [1] } });
    expect(await client.trash.empty()).toEqual({ emptied: true });
    expect(await client.trash.list({ per_page: 10 } as never)).toMatchObject({ cursor: null });
    expect(await client.trash.restore({ ids: [1] } as never)).toEqual({
      restored: { ids: [1] },
    });

    expect(await client.transfers.add({ url: "https://example.com/file" })).toMatchObject({
      source: "https://example.com/file",
    });
    expect(await client.transfers.addMany([{ url: "https://example.com/a" }])).toMatchObject({
      errors: [],
    });
    expect(await client.transfers.cancel([1, 2])).toEqual({ cancelled: [1, 2] });
    expect(await client.transfers.clean([1])).toEqual({ deleted_ids: [1] });
    expect(await client.transfers.continue("cursor")).toMatchObject({ cursor: "cursor" });
    expect(await client.transfers.count()).toBe(1);
    expect(await client.transfers.get(1)).toMatchObject({ id: 1 });
    expect(await client.transfers.info(["https://example.com/a"])).toMatchObject({
      disk_avail: 1000,
    });
    expect(await client.transfers.list({ per_page: 10 })).toMatchObject({ total: 1 });
    expect(await client.transfers.reannounce(1)).toEqual({ reannounced: 1 });
    expect(await client.transfers.retry(1)).toMatchObject({ id: 1 });
    expect(await client.transfers.stopRecording(1)).toEqual({ stoppedRecording: 1 });

    expect(await client.zips.cancel(1)).toEqual({ cancelled: 1 });
    expect(await client.zips.create({ file_ids: [8] })).toBe(8);
    expect(await client.zips.get(1)).toEqual({ id: 1, status: "ready" });
    expect(await client.zips.list()).toEqual([{ id: 1 }]);
  });
});
