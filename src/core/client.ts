import { FetchHttpClient } from "@effect/platform";
import { Cause, Effect, Exit, Layer, ManagedRuntime, Option, Schema } from "effect";

import {
  clearAccount,
  destroyAccount,
  getAccountInfo,
  getAccountSettings,
  listAccountConfirmations,
  saveAccountSettings,
  type AccountInfoBase,
  type AccountInfoQuery,
  type AccountSettings,
  type AccountConfirmation,
  type AccountInfoBroad,
  type PasInfo,
  type SaveAccountSettingsPayload,
  type AccountClearOptions,
} from "../domains/account.js";
import {
  buildAuthLoginUrl,
  checkCodeMatch,
  clients,
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
  type GenerateTOTPResponse,
  type LoginResponse,
  type RegisterInput,
  type TwoFactorRecoveryCodes,
  type ValidateTokenResponse,
  type VerifyTOTPResponse,
} from "../domains/auth.js";
import {
  deleteConfigKey,
  getConfigKey,
  getConfigKeyWith,
  readConfig,
  readConfigWith,
  setConfigKey,
  writeConfig,
  type PutioJsonObject,
  type PutioJsonValue,
} from "../domains/config.js";
import {
  createDownloadLinks,
  getDownloadLinks,
  type DownloadLinksCreateInput,
  type DownloadLinksInfo,
} from "../domains/download-links.js";
import {
  clearEvents,
  deleteEvent,
  getEventTorrent,
  listEvents,
  type EventsListQuery,
  type EventsListResponse,
} from "../domains/events.js";
import {
  createFamilyInvite,
  joinFamily,
  listFamilyInvites,
  listFamilyMembers,
  removeFamilyMember,
  type FamilyInvitesResponse,
  type FamilyMember,
} from "../domains/family.js";
import { getIftttStatus, sendIftttEvent, type IftttEventInput } from "../domains/ifttt.js";
import {
  createFileUploadFormData,
  createFileUploadRequest,
  continueFiles,
  continueSearch,
  convertFileToMp4,
  convertFileSelectionToMp4,
  convertFilesToMp4,
  createFolder,
  deleteFileExtraction,
  deleteFileMp4,
  deleteFileSelection,
  deleteFiles,
  extractFiles,
  findNextFile,
  findNextVideo,
  getApiContentUrl,
  getApiDownloadUrl,
  getApiMp4DownloadUrl,
  getDownloadUrl,
  getHlsStreamUrl,
  type FileConversionStatus,
  type FileCore,
  type FileActiveConversion,
  type FileExtraction,
  type FileListContinuationResponse,
  type FileSubtitle,
  getFile,
  getMp4Status,
  getStartFrom,
  listActiveMp4Conversions,
  listFileExtractions,
  listFileSubtitles,
  moveFiles,
  moveFileSelection,
  putMp4ToMyFiles,
  queryFiles,
  renameFile,
  resetStartFrom,
  searchFiles,
  setFilesWatchStatus,
  setStartFrom,
  uploadFile,
  type FileListResponse,
  type FileQuery,
  type FilesMoveError,
  type FilesSearchQuery,
  type FileSearchResponse,
  type FileVideoMetadata,
  type FilesListQuery,
} from "../domains/files.js";
import {
  createFriendInvite,
  listFriendInvites,
  type FriendInvite,
} from "../domains/friend-invites.js";
import {
  approveFriendRequest,
  countWaitingRequests,
  denyFriendRequest,
  getFriendSharedFolder,
  listFriends,
  listSentRequests,
  listWaitingRequests,
  removeFriend,
  searchFriends,
  sendFriendRequest,
  type Friend,
  type FriendBase,
  type UserSearchResult,
} from "../domains/friends.js";
import { makePutioSdkLayer, type PutioSdkConfigShape, type PutioSdkContext } from "./http.js";
import {
  buildOAuthAppIconUrl,
  buildOAuthAuthorizeUrl,
  createOAuthApp,
  deleteOAuthApp,
  getOAuthApp,
  getPopularOAuthApps,
  queryOAuthApps,
  regenerateOAuthAppToken,
  setOAuthAppIcon,
  updateOAuthApp,
  type MyOAuthApp,
  type OAuthApp,
  type OAuthAppCreateInput,
  type OAuthAppUpdateInput,
  type OAuthAppSession,
  type PopularOAuthApp,
} from "../domains/oauth.js";
import {
  classifyPaymentChangePlanResponse,
  confirmFastspringOrder,
  createCoinbaseCharge,
  createNanoPaymentRequest,
  createOpenNodeCharge,
  createPaddleWaitingPayment,
  getPaymentInfo,
  getPaymentVoucherInfo,
  listPaymentHistory,
  listPaymentInvites,
  listPaymentOptions,
  listPaymentPlans,
  previewPaymentChangePlan,
  redeemPaymentVoucher,
  reportPayments,
  stopPaymentSubscription,
  submitPaymentChangePlan,
  type PaymentChangePlanPreview,
  type PaymentChangePlanPreviewInput,
  type PaymentChangePlanSubmitInput,
  type PaymentChangePlanSubmitResponse,
  type PaymentHistoryItem,
  type PaymentHistoryQuery,
  type PaymentInfo,
  type PaymentInvite,
  type PaymentOption,
  type PaymentPaddleWaitingPaymentInput,
  type PaymentPlanGroup,
  type PaymentVoucherInfo,
} from "../domains/payment.js";
import {
  clearRssFeedLogs,
  createRssFeed,
  deleteRssFeed,
  getRssFeed,
  listRssFeedItems,
  listRssFeeds,
  pauseRssFeed,
  resumeRssFeed,
  retryAllRssFeedItems,
  retryRssFeedItem,
  updateRssFeed,
  type RssFeed,
  type RssFeedItem,
  type RssFeedParams,
} from "../domains/rss.js";
import {
  cloneSharedFiles,
  continuePublicShareFiles,
  createPublicShare,
  deletePublicShare,
  getPublicShare,
  getPublicShareFileUrl,
  getSharedWith,
  getSharingCloneInfo,
  listPublicShareFiles,
  listPublicShares,
  listSharedFiles,
  shareFiles,
  unshareFile,
  type PublicShare,
  type PublicShareListQuery,
  type SharedFile,
  type SharedFileSharedWith,
  type SharingCloneInfo,
  type SharingShareInput,
} from "../domains/sharing.js";
import {
  continueTrash,
  deleteTrash,
  emptyTrash,
  listTrash,
  restoreTrash,
  type TrashBulkInput,
  type TrashContinueResponse,
  type TrashListQuery,
  type TrashListResponse,
} from "../domains/trash.js";
import {
  addManyTransfers,
  addTransfer,
  cancelTransfers,
  cleanTransfers,
  continueTransfers,
  countTransfers,
  getTransfer,
  getTransferInfo,
  listTransfers,
  reannounceTransfer,
  retryTransfer,
  stopTransferRecording,
  type Transfer,
  type TransferAddInput,
  type TransferInfoItem,
  type TransfersAddMultiError,
  type TransfersContinueResponse,
  type TransfersListQuery,
  type TransfersListResponse,
} from "../domains/transfers.js";
import { listTunnelRoutes, type TunnelRoute } from "../domains/tunnel.js";
import {
  cancelZip,
  createZip,
  getZip,
  listZips,
  type CreateZipInput,
  type ZipInfo,
  type ZipSummary,
} from "../domains/zips.js";
import { mapConfigurationError } from "./errors.js";

type PutioSdkPromiseRuntime = ManagedRuntime.ManagedRuntime<PutioSdkContext, never>;

const promiseClientRuntimeCache = new WeakMap<PutioSdkConfigShape, PutioSdkPromiseRuntime>();
const disposedPromiseClientConfigs = new WeakSet<PutioSdkConfigShape>();

const getPromiseClientRuntime = (config: PutioSdkConfigShape): PutioSdkPromiseRuntime => {
  if (disposedPromiseClientConfigs.has(config)) {
    throw mapConfigurationError(
      "This Promise client has been disposed and can no longer execute SDK effects",
    );
  }

  const cachedRuntime = promiseClientRuntimeCache.get(config);

  if (cachedRuntime) {
    return cachedRuntime;
  }

  const runtime = ManagedRuntime.make(
    Layer.mergeAll(makePutioSdkLayer(config), FetchHttpClient.layer),
  );
  promiseClientRuntimeCache.set(config, runtime);
  return runtime;
};

const disposePromiseClientRuntime = async (config: PutioSdkConfigShape): Promise<void> => {
  disposedPromiseClientConfigs.add(config);

  const runtime = promiseClientRuntimeCache.get(config);
  promiseClientRuntimeCache.delete(config);

  if (!runtime) {
    return;
  }

  await runtime.dispose();
};

const rejectWithSdkFailure = <A, E>(exit: Exit.Exit<A, E>): Promise<A> =>
  Exit.match(exit, {
    onSuccess: (value) => Promise.resolve(value),
    onFailure: (cause) => {
      const failure = Cause.failureOption(cause);

      if (Option.isSome(failure)) {
        return Promise.reject(failure.value);
      }

      return Promise.reject(Cause.squash(cause));
    },
  });

const provideSdk = async <A, E>(
  config: PutioSdkConfigShape,
  effect: Effect.Effect<A, E, PutioSdkContext>,
) => rejectWithSdkFailure(await getPromiseClientRuntime(config).runPromiseExit(effect));

export const createPutioSdkEffectClient = () => ({
  account: {
    clear: clearAccount,
    destroy: destroyAccount,
    getInfo: getAccountInfo,
    getSettings: getAccountSettings,
    listConfirmations: listAccountConfirmations,
    saveSettings: saveAccountSettings,
  },
  auth: {
    buildLoginUrl: buildAuthLoginUrl,
    checkCodeMatch,
    clients,
    exists,
    forgotPassword,
    getCode,
    getFamilyInvite,
    getFriendInvite,
    getGiftCard,
    getVoucher,
    grants,
    linkDevice,
    login,
    logout,
    register,
    resetPassword,
    revokeAllClients,
    revokeApp,
    revokeClient,
    twoFactor: {
      generateTOTP,
      getRecoveryCodes,
      regenerateRecoveryCodes,
      verifyTOTP,
    },
    validateToken,
  },
  config: {
    deleteKey: deleteConfigKey,
    getKey: getConfigKey,
    getKeyWith: getConfigKeyWith,
    read: readConfig,
    readWith: readConfigWith,
    setKey: setConfigKey,
    write: writeConfig,
  },
  downloadLinks: {
    create: createDownloadLinks,
    get: getDownloadLinks,
  },
  events: {
    clear: clearEvents,
    delete: deleteEvent,
    getTorrent: getEventTorrent,
    list: listEvents,
  },
  family: {
    createInvite: createFamilyInvite,
    join: joinFamily,
    listInvites: listFamilyInvites,
    listMembers: listFamilyMembers,
    removeMember: removeFamilyMember,
  },
  ifttt: {
    getStatus: getIftttStatus,
    sendEvent: sendIftttEvent,
  },
  files: {
    continue: continueFiles,
    continueSearch,
    convertToMp4: convertFileToMp4,
    convertManyToMp4: convertFilesToMp4,
    convertSelectionToMp4: convertFileSelectionToMp4,
    createUploadRequest: createFileUploadRequest,
    createFolder,
    deleteExtraction: deleteFileExtraction,
    deleteMp4: deleteFileMp4,
    deleteSelection: deleteFileSelection,
    delete: deleteFiles,
    extract: extractFiles,
    findNext: findNextFile,
    findNextVideo,
    getApiContentUrl,
    getApiDownloadUrl,
    getApiMp4DownloadUrl,
    get: getFile,
    getDownloadUrl,
    getHlsStreamUrl,
    getMp4Status,
    getStartFrom,
    list: queryFiles,
    listActiveConversions: listActiveMp4Conversions,
    listExtractions: listFileExtractions,
    listSubtitles: listFileSubtitles,
    move: moveFiles,
    moveSelection: moveFileSelection,
    putMp4ToMyFiles,
    rename: renameFile,
    resetStartFrom,
    search: searchFiles,
    setWatchStatus: setFilesWatchStatus,
    setStartFrom,
    upload: uploadFile,
  },
  friendInvites: {
    create: createFriendInvite,
    list: listFriendInvites,
  },
  friends: {
    approve: approveFriendRequest,
    countWaitingRequests,
    deny: denyFriendRequest,
    list: listFriends,
    listSentRequests,
    listWaitingRequests,
    remove: removeFriend,
    search: searchFriends,
    sendRequest: sendFriendRequest,
    sharedFolder: getFriendSharedFolder,
  },
  oauth: {
    buildAuthorizeUrl: buildOAuthAuthorizeUrl,
    buildIconUrl: buildOAuthAppIconUrl,
    create: createOAuthApp,
    delete: deleteOAuthApp,
    get: getOAuthApp,
    getPopularApps: getPopularOAuthApps,
    query: queryOAuthApps,
    regenerateToken: regenerateOAuthAppToken,
    setIcon: setOAuthAppIcon,
    update: updateOAuthApp,
  },
  payment: {
    changePlan: {
      classifyResponse: classifyPaymentChangePlanResponse,
      preview: previewPaymentChangePlan,
      submit: submitPaymentChangePlan,
    },
    confirmFastspringOrder,
    getInfo: getPaymentInfo,
    listHistory: listPaymentHistory,
    listInvites: listPaymentInvites,
    listOptions: listPaymentOptions,
    listPlans: listPaymentPlans,
    methods: {
      addPaddleWaitingPayment: createPaddleWaitingPayment,
      createCoinbaseCharge,
      createNanoPaymentRequest,
      createOpenNodeCharge,
    },
    report: reportPayments,
    stopSubscription: stopPaymentSubscription,
    voucher: {
      getInfo: getPaymentVoucherInfo,
      redeem: redeemPaymentVoucher,
    },
  },
  rss: {
    clearLogs: clearRssFeedLogs,
    create: createRssFeed,
    delete: deleteRssFeed,
    get: getRssFeed,
    list: listRssFeeds,
    listItems: listRssFeedItems,
    pause: pauseRssFeed,
    resume: resumeRssFeed,
    retryAll: retryAllRssFeedItems,
    retryItem: retryRssFeedItem,
    update: updateRssFeed,
  },
  sharing: {
    clone: cloneSharedFiles,
    getCloneInfo: getSharingCloneInfo,
    getSharedWith,
    listSharedFiles,
    publicAccess: {
      continueFiles: continuePublicShareFiles,
      get: getPublicShare,
      getFileUrl: getPublicShareFileUrl,
      listFiles: listPublicShareFiles,
    },
    publicShares: {
      create: createPublicShare,
      delete: deletePublicShare,
      list: listPublicShares,
    },
    shareFiles,
    unshare: unshareFile,
  },
  tunnel: {
    listRoutes: listTunnelRoutes,
  },
  trash: {
    continue: continueTrash,
    delete: deleteTrash,
    empty: emptyTrash,
    list: listTrash,
    restore: restoreTrash,
  },
  transfers: {
    add: addTransfer,
    addMany: addManyTransfers,
    cancel: cancelTransfers,
    clean: cleanTransfers,
    continue: continueTransfers,
    count: countTransfers,
    get: getTransfer,
    info: getTransferInfo,
    list: listTransfers,
    reannounce: reannounceTransfer,
    retry: retryTransfer,
    stopRecording: stopTransferRecording,
  },
  zips: {
    cancel: cancelZip,
    create: createZip,
    get: getZip,
    list: listZips,
  },
});

export const createPutioSdkPromiseClient = (initialConfig: PutioSdkConfigShape = {}) => {
  const config = { ...initialConfig };

  function getInfo(query: {
    readonly download_token: 1;
    readonly pas: 1;
  }): Promise<AccountInfoBase & { readonly download_token: string; readonly pas: PasInfo }>;
  function getInfo(query: {
    readonly download_token: 1;
  }): Promise<AccountInfoBase & { readonly download_token: string }>;
  function getInfo(query: {
    readonly features: 1;
  }): Promise<AccountInfoBase & { readonly features: Record<string, boolean> }>;
  function getInfo(query: {
    readonly intercom: 1;
    readonly platform?: string;
  }): Promise<AccountInfoBase & { readonly user_hash: string }>;
  function getInfo(query: {
    readonly pas: 1;
  }): Promise<AccountInfoBase & { readonly pas: PasInfo }>;
  function getInfo(query: {
    readonly profitwell: 1;
  }): Promise<AccountInfoBase & { readonly paddle_user_id: number | null }>;
  function getInfo(query: {
    readonly push_token: 1;
  }): Promise<AccountInfoBase & { readonly push_token: string }>;
  function getInfo(query: AccountInfoQuery): Promise<AccountInfoBroad>;
  function getInfo(query: AccountInfoQuery) {
    return provideSdk(config, getAccountInfo(query));
  }

  function getFileById(input: {
    readonly id: number;
    readonly query: { readonly stream_url: 1; readonly video_metadata: 1 };
  }): Promise<
    FileCore & {
      readonly stream_url: string | null;
      readonly video_metadata: FileVideoMetadata;
    }
  >;
  function getFileById(input: {
    readonly id: number;
    readonly query: { readonly mp4_stream_url: 1 };
  }): Promise<
    FileCore &
      (
        | {
            readonly is_mp4_available: true;
            readonly mp4_stream_url: string | null;
            readonly mp4_size: number | null;
            readonly need_convert: boolean;
          }
        | {
            readonly is_mp4_available: false;
            readonly mp4_size: number | null;
            readonly need_convert: boolean;
          }
      )
  >;
  function getFileById(input: {
    readonly id: number;
    readonly query?: FileQuery;
  }): Promise<FileCore>;
  function getFileById(input: { readonly id: number; readonly query?: FileQuery }) {
    return provideSdk(config, getFile(input));
  }

  return {
    dispose: () => disposePromiseClientRuntime(config),
    account: {
      clear: (options: AccountClearOptions) => provideSdk(config, clearAccount(options)),
      destroy: (currentPassword: string) => provideSdk(config, destroyAccount(currentPassword)),
      getInfo,
      getSettings: (): Promise<AccountSettings> => provideSdk(config, getAccountSettings()),
      listConfirmations: (subject?: AccountConfirmation["subject"]) =>
        provideSdk(config, listAccountConfirmations(subject)),
      saveSettings: (payload: SaveAccountSettingsPayload) =>
        provideSdk(config, saveAccountSettings(payload)),
    },
    auth: {
      buildLoginUrl: buildAuthLoginUrl,
      checkCodeMatch: (code: string) => provideSdk(config, checkCodeMatch(code)),
      clients: (): Promise<ReadonlyArray<OAuthAppSession>> => provideSdk(config, clients()),
      exists: (key: "mail" | "username", value: string) => provideSdk(config, exists(key, value)),
      forgotPassword: (mail: string) => provideSdk(config, forgotPassword(mail)),
      getCode: (input: { readonly appId: number | string; readonly clientName?: string }) =>
        provideSdk(config, getCode(input)),
      getFamilyInvite: (code: string) => provideSdk(config, getFamilyInvite(code)),
      getFriendInvite: (code: string) => provideSdk(config, getFriendInvite(code)),
      getGiftCard: (code: string) => provideSdk(config, getGiftCard(code)),
      getVoucher: (code: string) => provideSdk(config, getVoucher(code)),
      grants: (): Promise<ReadonlyArray<OAuthApp>> => provideSdk(config, grants()),
      linkDevice: (code: string) => provideSdk(config, linkDevice(code)),
      login: (input: {
        readonly clientId: string | number;
        readonly clientSecret: string;
        readonly password: string;
        readonly username: string;
        readonly clientName?: string;
        readonly fingerprint?: string;
      }): Promise<LoginResponse> => provideSdk(config, login(input)),
      logout: () => provideSdk(config, logout()),
      register: (input: RegisterInput) => provideSdk(config, register(input)),
      resetPassword: (key: string, password: string) =>
        provideSdk(config, resetPassword(key, password)),
      revokeAllClients: () => provideSdk(config, revokeAllClients()),
      revokeApp: (id: number) => provideSdk(config, revokeApp(id)),
      revokeClient: (id: number) => provideSdk(config, revokeClient(id)),
      twoFactor: {
        generateTOTP: (): Promise<GenerateTOTPResponse> => provideSdk(config, generateTOTP()),
        getRecoveryCodes: (): Promise<TwoFactorRecoveryCodes> =>
          provideSdk(config, getRecoveryCodes()),
        regenerateRecoveryCodes: (): Promise<TwoFactorRecoveryCodes> =>
          provideSdk(config, regenerateRecoveryCodes()),
        verifyTOTP: (twoFactorScopedToken: string, code: string): Promise<VerifyTOTPResponse> =>
          provideSdk(config, verifyTOTP(twoFactorScopedToken, code)),
      },
      validateToken: (token: string): Promise<ValidateTokenResponse> =>
        provideSdk(config, validateToken(token)),
    },
    config: {
      deleteKey: (key: string) => provideSdk(config, deleteConfigKey(key)),
      getKey: (key: string): Promise<PutioJsonValue> => provideSdk(config, getConfigKey(key)),
      getKeyWith: <A, I>(key: string, schema: Schema.Schema<A, I, never>): Promise<A> =>
        provideSdk(config, getConfigKeyWith(key, schema)),
      read: (): Promise<PutioJsonObject> => provideSdk(config, readConfig()),
      readWith: <A, I>(schema: Schema.Schema<A, I, never>): Promise<A> =>
        provideSdk(config, readConfigWith(schema)),
      setKey: (key: string, value: PutioJsonValue) => provideSdk(config, setConfigKey(key, value)),
      write: (value: PutioJsonObject) => provideSdk(config, writeConfig(value)),
    },
    downloadLinks: {
      create: (input?: DownloadLinksCreateInput): Promise<{ readonly id: number }> =>
        provideSdk(config, createDownloadLinks(input)),
      get: (id: number): Promise<DownloadLinksInfo> => provideSdk(config, getDownloadLinks(id)),
    },
    events: {
      clear: () => provideSdk(config, clearEvents()),
      delete: (id: number) => provideSdk(config, deleteEvent(id)),
      getTorrent: (id: number): Promise<Uint8Array> => provideSdk(config, getEventTorrent(id)),
      list: (query?: EventsListQuery): Promise<EventsListResponse> =>
        provideSdk(config, listEvents(query)),
    },
    family: {
      createInvite: (): Promise<{ readonly code: string }> =>
        provideSdk(config, createFamilyInvite()),
      join: (inviteCode: string) => provideSdk(config, joinFamily(inviteCode)),
      listInvites: (): Promise<FamilyInvitesResponse> => provideSdk(config, listFamilyInvites()),
      listMembers: (): Promise<ReadonlyArray<FamilyMember>> =>
        provideSdk(config, listFamilyMembers()),
      removeMember: (username: string) => provideSdk(config, removeFamilyMember(username)),
    },
    ifttt: {
      getStatus: (): Promise<{ readonly enabled: boolean }> => provideSdk(config, getIftttStatus()),
      sendEvent: (input: IftttEventInput) => provideSdk(config, sendIftttEvent(input)),
    },
    files: {
      continue: (
        cursor: string,
        query?: { readonly per_page?: number },
      ): Promise<FileListContinuationResponse> => provideSdk(config, continueFiles(cursor, query)),
      continueSearch: (
        cursor: string,
        query?: { readonly per_page?: number },
      ): Promise<FileSearchResponse> => provideSdk(config, continueSearch(cursor, query)),
      convertManyToMp4: (ids: ReadonlyArray<number>): Promise<number> =>
        provideSdk(config, convertFilesToMp4(ids)),
      convertSelectionToMp4: (selection: {
        readonly cursor?: string;
        readonly excludeIds?: ReadonlyArray<number>;
        readonly ids?: ReadonlyArray<number>;
      }): Promise<number> => provideSdk(config, convertFileSelectionToMp4(selection)),
      createUploadFormData: createFileUploadFormData,
      createUploadRequest: (input: {
        readonly file: Blob;
        readonly fileName?: string;
        readonly parentId?: number;
      }): Promise<{
        readonly body: FormData;
        readonly method: "POST";
        readonly url: string;
      }> => provideSdk(config, createFileUploadRequest(input)),
      convertToMp4: (fileId: number): Promise<FileConversionStatus> =>
        provideSdk(config, convertFileToMp4(fileId)),
      createFolder: (input: {
        readonly name?: string;
        readonly parent_id?: number;
        readonly path?: string;
      }) => provideSdk(config, createFolder(input)),
      deleteExtraction: (extractionId: number) =>
        provideSdk(config, deleteFileExtraction(extractionId)),
      deleteMp4: (fileId: number) => provideSdk(config, deleteFileMp4(fileId)),
      deleteSelection: (
        selection: {
          readonly cursor?: string;
          readonly excludeIds?: ReadonlyArray<number>;
          readonly ids?: ReadonlyArray<number>;
        },
        options?: {
          readonly partialDelete?: boolean;
          readonly skipTrash?: boolean;
        },
      ) => provideSdk(config, deleteFileSelection(selection, options)),
      delete: (
        ids: ReadonlyArray<number>,
        options?: {
          readonly ignoreFileOwner?: boolean;
          readonly partialDelete?: boolean;
          readonly skipTrash?: boolean;
        },
      ) => provideSdk(config, deleteFiles(ids, options)),
      extract: (selection: {
        readonly cursor?: string;
        readonly excludeIds?: ReadonlyArray<number>;
        readonly ids?: ReadonlyArray<number>;
        readonly password?: string;
      }): Promise<ReadonlyArray<FileExtraction>> => provideSdk(config, extractFiles(selection)),
      findNext: (
        fileId: number,
        fileType:
          | "FOLDER"
          | "FILE"
          | "AUDIO"
          | "VIDEO"
          | "IMAGE"
          | "ARCHIVE"
          | "PDF"
          | "TEXT"
          | "SWF",
      ) => provideSdk(config, findNextFile(fileId, fileType)),
      findNextVideo: (fileId: number) => provideSdk(config, findNextVideo(fileId)),
      getApiContentUrl: (
        fileId: number,
        options?: { readonly oauthToken?: string; readonly useTunnel?: boolean },
      ): Promise<string> => provideSdk(config, getApiContentUrl(fileId, options)),
      getApiDownloadUrl: (
        fileId: number,
        options?: {
          readonly name?: string;
          readonly oauthToken?: string;
          readonly useTunnel?: boolean;
        },
      ): Promise<string> => provideSdk(config, getApiDownloadUrl(fileId, options)),
      getApiMp4DownloadUrl: (
        fileId: number,
        options?: {
          readonly convert?: boolean;
          readonly name?: string;
          readonly oauthToken?: string;
          readonly useTunnel?: boolean;
        },
      ): Promise<string> => provideSdk(config, getApiMp4DownloadUrl(fileId, options)),
      get: getFileById,
      getDownloadUrl: (fileId: number): Promise<string> =>
        provideSdk(config, getDownloadUrl(fileId)),
      getHlsStreamUrl: (
        fileId: number,
        options?: {
          readonly maxSubtitleCount?: number;
          readonly oauthToken?: string;
          readonly playOriginal?: boolean;
          readonly subtitleLanguages?: ReadonlyArray<string>;
        },
      ): Promise<string> => provideSdk(config, getHlsStreamUrl(fileId, options)),
      getMp4Status: (fileId: number): Promise<FileConversionStatus> =>
        provideSdk(config, getMp4Status(fileId)),
      getStartFrom: (fileId: number): Promise<number> => provideSdk(config, getStartFrom(fileId)),
      list: (parent: number | "friends", query?: FilesListQuery): Promise<FileListResponse> =>
        provideSdk(config, queryFiles(parent, query)),
      listActiveConversions: (): Promise<ReadonlyArray<FileActiveConversion>> =>
        provideSdk(config, listActiveMp4Conversions()),
      listExtractions: (): Promise<ReadonlyArray<FileExtraction>> =>
        provideSdk(config, listFileExtractions()),
      listSubtitles: (
        fileId: number,
        options?: { readonly languages?: ReadonlyArray<string> },
      ): Promise<{
        readonly default: string | null;
        readonly subtitles: ReadonlyArray<FileSubtitle>;
      }> => provideSdk(config, listFileSubtitles(fileId, options)),
      move: (
        ids: ReadonlyArray<number>,
        parentId: number,
      ): Promise<ReadonlyArray<FilesMoveError>> => provideSdk(config, moveFiles(ids, parentId)),
      moveSelection: (
        selection: {
          readonly cursor?: string;
          readonly excludeIds?: ReadonlyArray<number>;
          readonly ids?: ReadonlyArray<number>;
        },
        parentId: number,
      ): Promise<ReadonlyArray<FilesMoveError>> =>
        provideSdk(config, moveFileSelection(selection, parentId)),
      putMp4ToMyFiles: (fileId: number) => provideSdk(config, putMp4ToMyFiles(fileId)),
      rename: (input: { readonly file_id: number; readonly name: string }) =>
        provideSdk(config, renameFile(input)),
      resetStartFrom: (fileId: number) => provideSdk(config, resetStartFrom(fileId)),
      search: (query: FilesSearchQuery): Promise<FileSearchResponse> =>
        provideSdk(config, searchFiles(query)),
      setWatchStatus: (selection: {
        readonly cursor?: string;
        readonly excludeIds?: ReadonlyArray<number>;
        readonly ids?: ReadonlyArray<number>;
        readonly watched: boolean;
      }) => provideSdk(config, setFilesWatchStatus(selection)),
      setStartFrom: (input: { readonly file_id: number; readonly time: number }) =>
        provideSdk(config, setStartFrom(input)),
      upload: (input: {
        readonly file: Blob;
        readonly fileName?: string;
        readonly parentId?: number;
      }) => provideSdk(config, uploadFile(input)),
    },
    friendInvites: {
      create: (): Promise<{ readonly code: string }> => provideSdk(config, createFriendInvite()),
      list: (): Promise<{
        readonly invites: ReadonlyArray<FriendInvite>;
        readonly remaining_limit: number;
      }> => provideSdk(config, listFriendInvites()),
    },
    friends: {
      approve: (username: string) => provideSdk(config, approveFriendRequest(username)),
      countWaitingRequests: (): Promise<number> => provideSdk(config, countWaitingRequests()),
      deny: (username: string) => provideSdk(config, denyFriendRequest(username)),
      list: (): Promise<{
        readonly friends: ReadonlyArray<Friend>;
        readonly total: number;
      }> => provideSdk(config, listFriends()),
      listSentRequests: (): Promise<ReadonlyArray<FriendBase>> =>
        provideSdk(config, listSentRequests()),
      listWaitingRequests: (): Promise<ReadonlyArray<FriendBase>> =>
        provideSdk(config, listWaitingRequests()),
      remove: (username: string) => provideSdk(config, removeFriend(username)),
      search: (username: string): Promise<ReadonlyArray<UserSearchResult>> =>
        provideSdk(config, searchFriends(username)),
      sendRequest: (username: string) => provideSdk(config, sendFriendRequest(username)),
      sharedFolder: (username: string): Promise<FileCore | null> =>
        provideSdk(config, getFriendSharedFolder(username)),
    },
    oauth: {
      buildAuthorizeUrl: buildOAuthAuthorizeUrl,
      buildIconUrl: buildOAuthAppIconUrl,
      create: (input: OAuthAppCreateInput) => provideSdk(config, createOAuthApp(input)),
      delete: (id: number) => provideSdk(config, deleteOAuthApp(id)),
      get: (id: number, options?: { readonly edit?: boolean }) =>
        provideSdk(config, getOAuthApp(id, options)),
      getPopularApps: (): Promise<ReadonlyArray<PopularOAuthApp>> =>
        provideSdk(config, getPopularOAuthApps()),
      query: (): Promise<ReadonlyArray<MyOAuthApp>> => provideSdk(config, queryOAuthApps()),
      regenerateToken: (id: number) => provideSdk(config, regenerateOAuthAppToken(id)),
      setIcon: (id: number, input: { readonly icon: Blob }) =>
        provideSdk(config, setOAuthAppIcon(id, input)),
      update: (input: OAuthAppUpdateInput) => provideSdk(config, updateOAuthApp(input)),
    },
    payment: {
      changePlan: {
        classifyResponse: classifyPaymentChangePlanResponse,
        preview: (input: PaymentChangePlanPreviewInput): Promise<PaymentChangePlanPreview> =>
          provideSdk(config, previewPaymentChangePlan(input)),
        submit: (input: PaymentChangePlanSubmitInput): Promise<PaymentChangePlanSubmitResponse> =>
          provideSdk(config, submitPaymentChangePlan(input)),
      },
      confirmFastspringOrder: (reference: string): Promise<boolean> =>
        provideSdk(config, confirmFastspringOrder(reference)),
      getInfo: (): Promise<PaymentInfo> => provideSdk(config, getPaymentInfo()),
      listHistory: (query?: PaymentHistoryQuery): Promise<ReadonlyArray<PaymentHistoryItem>> =>
        provideSdk(config, listPaymentHistory(query)),
      listInvites: (): Promise<ReadonlyArray<PaymentInvite>> =>
        provideSdk(config, listPaymentInvites()),
      listOptions: (): Promise<ReadonlyArray<PaymentOption>> =>
        provideSdk(config, listPaymentOptions()),
      listPlans: (): Promise<ReadonlyArray<PaymentPlanGroup>> =>
        provideSdk(config, listPaymentPlans()),
      methods: {
        addPaddleWaitingPayment: (input: PaymentPaddleWaitingPaymentInput) =>
          provideSdk(config, createPaddleWaitingPayment(input)),
        createCoinbaseCharge: (planPath: string): Promise<string> =>
          provideSdk(config, createCoinbaseCharge(planPath)),
        createNanoPaymentRequest: (planCode: string): Promise<string> =>
          provideSdk(config, createNanoPaymentRequest(planCode)),
        createOpenNodeCharge: (planPath: string): Promise<string> =>
          provideSdk(config, createOpenNodeCharge(planPath)),
      },
      report: (paymentIds: ReadonlyArray<number>) => provideSdk(config, reportPayments(paymentIds)),
      stopSubscription: () => provideSdk(config, stopPaymentSubscription()),
      voucher: {
        getInfo: (code: string): Promise<PaymentVoucherInfo> =>
          provideSdk(config, getPaymentVoucherInfo(code)),
        redeem: (code: string) => provideSdk(config, redeemPaymentVoucher(code)),
      },
    },
    rss: {
      clearLogs: (id: number) => provideSdk(config, clearRssFeedLogs(id)),
      create: (params: RssFeedParams): Promise<RssFeed> =>
        provideSdk(config, createRssFeed(params)),
      delete: (id: number) => provideSdk(config, deleteRssFeed(id)),
      get: (id: number): Promise<RssFeed> => provideSdk(config, getRssFeed(id)),
      list: (): Promise<ReadonlyArray<RssFeed>> => provideSdk(config, listRssFeeds()),
      listItems: (
        id: number,
      ): Promise<{ readonly feed: RssFeed; readonly items: ReadonlyArray<RssFeedItem> }> =>
        provideSdk(config, listRssFeedItems(id)),
      pause: (id: number) => provideSdk(config, pauseRssFeed(id)),
      resume: (id: number) => provideSdk(config, resumeRssFeed(id)),
      retryAll: (id: number) => provideSdk(config, retryAllRssFeedItems(id)),
      retryItem: (feedId: number, itemId: number) =>
        provideSdk(config, retryRssFeedItem(feedId, itemId)),
      update: (id: number, params: RssFeedParams) => provideSdk(config, updateRssFeed(id, params)),
    },
    sharing: {
      clone: (input?: {
        readonly cursor?: string;
        readonly excludeIds?: ReadonlyArray<number>;
        readonly ids?: ReadonlyArray<number>;
        readonly parentId?: number;
      }): Promise<{ readonly id: number }> => provideSdk(config, cloneSharedFiles(input)),
      getCloneInfo: (id: number): Promise<SharingCloneInfo> =>
        provideSdk(config, getSharingCloneInfo(id)),
      getSharedWith: (fileId: number): Promise<SharedFileSharedWith> =>
        provideSdk(config, getSharedWith(fileId)),
      listSharedFiles: (): Promise<ReadonlyArray<SharedFile>> =>
        provideSdk(config, listSharedFiles()),
      publicAccess: {
        continueFiles: (cursor: string, query?: { readonly per_page?: number }) =>
          provideSdk(config, continuePublicShareFiles(cursor, query)),
        get: (): Promise<PublicShare> => provideSdk(config, getPublicShare()),
        getFileUrl: (fileId: number): Promise<string> =>
          provideSdk(config, getPublicShareFileUrl(fileId)),
        listFiles: (query?: PublicShareListQuery) =>
          provideSdk(config, listPublicShareFiles(query)),
      },
      publicShares: {
        create: (fileId: number): Promise<PublicShare> =>
          provideSdk(config, createPublicShare(fileId)),
        delete: (id: number) => provideSdk(config, deletePublicShare(id)),
        list: (): Promise<ReadonlyArray<PublicShare>> => provideSdk(config, listPublicShares()),
      },
      shareFiles: (input: SharingShareInput) => provideSdk(config, shareFiles(input)),
      unshare: (input: {
        readonly fileId: number;
        readonly shares?: ReadonlyArray<number | string>;
      }) => provideSdk(config, unshareFile(input)),
    },
    tunnel: {
      listRoutes: (): Promise<ReadonlyArray<TunnelRoute>> => provideSdk(config, listTunnelRoutes()),
    },
    trash: {
      continue: (cursor: string, query?: TrashListQuery): Promise<TrashContinueResponse> =>
        provideSdk(config, continueTrash(cursor, query)),
      delete: (input: TrashBulkInput) => provideSdk(config, deleteTrash(input)),
      empty: () => provideSdk(config, emptyTrash()),
      list: (query?: TrashListQuery): Promise<TrashListResponse> =>
        provideSdk(config, listTrash(query)),
      restore: (input: TrashBulkInput) => provideSdk(config, restoreTrash(input)),
    },
    transfers: {
      add: (input: TransferAddInput): Promise<Transfer> => provideSdk(config, addTransfer(input)),
      addMany: (
        inputs: ReadonlyArray<TransferAddInput>,
      ): Promise<{
        readonly errors: ReadonlyArray<TransfersAddMultiError>;
        readonly transfers: ReadonlyArray<Transfer>;
      }> => provideSdk(config, addManyTransfers(inputs)),
      cancel: (ids: ReadonlyArray<number>) => provideSdk(config, cancelTransfers(ids)),
      clean: (ids?: ReadonlyArray<number>) => provideSdk(config, cleanTransfers(ids)),
      continue: (
        cursor: string,
        query?: { readonly per_page?: number },
      ): Promise<TransfersContinueResponse> => provideSdk(config, continueTransfers(cursor, query)),
      count: (): Promise<number> => provideSdk(config, countTransfers()),
      get: (id: number): Promise<Transfer> => provideSdk(config, getTransfer(id)),
      info: (
        urls: ReadonlyArray<string>,
      ): Promise<{ readonly disk_avail: number; readonly ret: ReadonlyArray<TransferInfoItem> }> =>
        provideSdk(config, getTransferInfo(urls)),
      list: (query?: TransfersListQuery): Promise<TransfersListResponse> =>
        provideSdk(config, listTransfers(query)),
      reannounce: (id: number) => provideSdk(config, reannounceTransfer(id)),
      retry: (id: number): Promise<Transfer> => provideSdk(config, retryTransfer(id)),
      stopRecording: (id: number) => provideSdk(config, stopTransferRecording(id)),
    },
    zips: {
      cancel: (id: number) => provideSdk(config, cancelZip(id)),
      create: (input: CreateZipInput): Promise<number> => provideSdk(config, createZip(input)),
      get: (id: number): Promise<ZipInfo> => provideSdk(config, getZip(id)),
      list: (): Promise<ReadonlyArray<ZipSummary>> => provideSdk(config, listZips()),
    },
  };
};
