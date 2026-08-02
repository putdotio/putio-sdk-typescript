import { Cause, Context, Effect, Exit, Layer, ManagedRuntime, Schema } from "effect";

import {
  clearAccount,
  destroyAccount,
  getAccountInfo,
  getAccountSettings,
  listAccountSubtitleLanguages,
  listAccountConfirmations,
  saveAccountSettings,
} from "../domains/account.js";
import type {
  AccountInfoBase,
  AccountInfoBroad,
  AccountInfoQuery,
  PasInfo,
} from "../domains/account.js";
import {
  createAppSpecificPassword,
  deleteAllAppSpecificPasswords,
  deleteAppSpecificPassword,
  listAppSpecificPasswords,
} from "../domains/app-specific-passwords.js";
import {
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
} from "../domains/auth.js";
import {
  deleteConfigKey,
  getConfigKey,
  getConfigKeyWith,
  readConfig,
  readConfigWith,
  setConfigKey,
  writeConfig,
} from "../domains/config.js";
import { createDownloadLinks, getDownloadLinks } from "../domains/download-links.js";
import { clearEvents, deleteEvent, getEventTorrent, listEvents } from "../domains/events.js";
import {
  createFamilyInvite,
  joinFamily,
  listFamilyInvites,
  listFamilyMembers,
  removeFamilyMember,
} from "../domains/family.js";
import { getIftttStatus, sendIftttEvent } from "../domains/ifttt.js";
import {
  canWriteFile,
  copyFile,
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
  getFileChild,
  getHlsStreamUrl,
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
  resetFileSortSettings,
  resetStartFrom,
  searchFiles,
  setFileSort,
  setFilesWatchStatus,
  setStartFrom,
  touchFiles,
  uploadFile,
} from "../domains/files.js";
import type { FileCore, FileQuery, FileResponseFor, FileVideoMetadata } from "../domains/files.js";
import { createFriendInvite, listFriendInvites } from "../domains/friend-invites.js";
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
} from "../domains/friends.js";
import { makePutioSdkConfig, makePutioSdkLiveLayer, PutioSdkConfig } from "./http.js";
import type { PutioSdkConfigShape, PutioSdkContext } from "./http.js";
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
} from "../domains/oauth.js";
import {
  classifyPaymentChangePlanResponse,
  confirmFastspringOrder,
  createOpenNodeCharge,
  createPaddleBillingUpdatePaymentMethodTransaction,
  createPaddleWaitingPayment,
  getPaymentInfo,
  getPaddleBillingInvoiceUrl,
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
} from "../domains/payment.js";
import { getPodcastLinks } from "../domains/podcast.js";
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
} from "../domains/sharing.js";
import {
  continueTrash,
  deleteTrash,
  emptyTrash,
  listTrash,
  restoreTrash,
} from "../domains/trash.js";
import {
  addManyTransfers,
  addTransfer,
  addTransferTrackers,
  cancelTransfers,
  cleanTransfers,
  continueTransfers,
  countTransfers,
  getTransfer,
  getTransferInfo,
  getTransferTorrent,
  listTransfers,
  reannounceTransfer,
  removeTransfers,
  retryTransfer,
  stopTransferRecording,
} from "../domains/transfers.js";
import { listTunnelRoutes } from "../domains/tunnel.js";
import { cancelZip, createZip, getZip, listZips } from "../domains/zips.js";
import { mapConfigurationError } from "./errors.js";

type PutioSdkPromiseRuntime = ManagedRuntime.ManagedRuntime<PutioSdkContext, never>;
type PutioSdkPromiseRuntimeConfig = Omit<PutioSdkConfigShape, "accessToken">;

interface PutioSdkPromiseState {
  accessToken: string | undefined;
  readonly runtimeConfig: PutioSdkPromiseRuntimeConfig;
}

const promiseClientRuntimeCache = new WeakMap<PutioSdkPromiseState, PutioSdkPromiseRuntime>();
const disposedPromiseClientStates = new WeakSet<PutioSdkPromiseState>();

const getPromiseClientRuntime = (state: PutioSdkPromiseState): PutioSdkPromiseRuntime => {
  if (disposedPromiseClientStates.has(state)) {
    throw mapConfigurationError(
      "This Promise client has been disposed and can no longer execute SDK effects",
    );
  }

  const cachedRuntime = promiseClientRuntimeCache.get(state);

  if (cachedRuntime) {
    return cachedRuntime;
  }

  const runtime = ManagedRuntime.make(makePutioSdkLiveLayer(state.runtimeConfig));
  promiseClientRuntimeCache.set(state, runtime);
  return runtime;
};

const disposePromiseClientRuntime = async (state: PutioSdkPromiseState): Promise<void> => {
  disposedPromiseClientStates.add(state);

  const runtime = promiseClientRuntimeCache.get(state);
  promiseClientRuntimeCache.delete(state);

  if (!runtime) {
    return;
  }

  await runtime.dispose();
};

const rejectWithSdkFailure = <A, E>(exit: Exit.Exit<A, E>): Promise<A> =>
  Exit.match(exit, {
    onSuccess: (value) => Promise.resolve(value),
    onFailure: (cause) => {
      const failure = cause.reasons.find(Cause.isFailReason);

      if (failure) {
        return Promise.reject(failure.error);
      }

      return Promise.reject(Cause.squash(cause));
    },
  });

const provideSdk = async <A, E>(
  state: PutioSdkPromiseState,
  effect: Effect.Effect<A, E, PutioSdkContext>,
) => {
  const operationConfig = {
    ...state.runtimeConfig,
    accessToken: state.accessToken,
  };
  const operation = Effect.provideService(effect, PutioSdkConfig, operationConfig);

  return rejectWithSdkFailure(await getPromiseClientRuntime(state).runPromiseExit(operation));
};

const snapshotUrl = (value: string | URL | undefined): string | URL | undefined =>
  typeof value === "string" || value === undefined ? value : new URL(value.href);

type PromiseOperation<T> = T extends (...args: infer Args) => infer Result
  ? Result extends Effect.Effect<infer Success, infer _Error, infer _Requirements>
    ? (...args: Args) => Promise<Success>
    : T
  : T extends object
    ? { [Key in keyof T]: PromiseOperation<T[Key]> }
    : T;

const cloneOperationTree = <T extends object>(tree: T): T =>
  Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      typeof value === "function" ? value : cloneOperationTree(value as object),
    ]),
  ) as T;

const makePromiseOperationTree = <T extends object>(
  tree: T,
  state: PutioSdkPromiseState,
): PromiseOperation<T> =>
  Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      typeof value === "function"
        ? (...args: ReadonlyArray<unknown>) => {
            const result: unknown = Reflect.apply(value, undefined, args);

            return Effect.isEffect(result)
              ? provideSdk(state, result as Effect.Effect<unknown, unknown, PutioSdkContext>)
              : result;
          }
        : makePromiseOperationTree(value as object, state),
    ]),
  ) as PromiseOperation<T>;

const sharedOperationTree = {
  account: {
    appSpecificPasswords: {
      create: createAppSpecificPassword,
      delete: deleteAppSpecificPassword,
      deleteAll: deleteAllAppSpecificPasswords,
      list: listAppSpecificPasswords,
    },
    clear: clearAccount,
    destroy: destroyAccount,
    getInfo: getAccountInfo,
    getSettings: getAccountSettings,
    listSubtitleLanguages: listAccountSubtitleLanguages,
    listConfirmations: listAccountConfirmations,
    saveSettings: saveAccountSettings,
  },
  auth: {
    buildLoginUrl: buildAuthLoginUrl,
    checkCodeMatch,
    clients,
    exchangeAuthorizationCode: exchangeOAuthAuthorizationCode,
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
  podcast: {
    getLinks: getPodcastLinks,
  },
  files: {
    canWrite: canWriteFile,
    continue: continueFiles,
    continueSearch,
    copy: copyFile,
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
    getChild: getFileChild,
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
    resetSortSettings: resetFileSortSettings,
    resetStartFrom,
    search: searchFiles,
    setSort: setFileSort,
    setWatchStatus: setFilesWatchStatus,
    setStartFrom,
    touch: touchFiles,
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
      createOpenNodeCharge,
      createPaddleBillingUpdatePaymentMethodTransaction,
      getPaddleBillingInvoiceUrl,
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
    addTrackers: addTransferTrackers,
    cancel: cancelTransfers,
    clean: cleanTransfers,
    continue: continueTransfers,
    count: countTransfers,
    get: getTransfer,
    getTorrent: getTransferTorrent,
    info: getTransferInfo,
    list: listTransfers,
    reannounce: reannounceTransfer,
    remove: removeTransfers,
    retry: retryTransfer,
    stopRecording: stopTransferRecording,
  },
  zips: {
    cancel: cancelZip,
    create: createZip,
    get: getZip,
    list: listZips,
  },
};

export const createPutioSdkEffectClient = () => cloneOperationTree(sharedOperationTree);

export type PutioSdkEffectClient = ReturnType<typeof createPutioSdkEffectClient>;

export class PutioSdk extends Context.Service<PutioSdk, PutioSdkEffectClient>()("PutioSdk") {}

export const makePutioSdkEffectClientLayer = () =>
  Layer.succeed(PutioSdk, createPutioSdkEffectClient());

export const makePutioSdkLiveClientLayer = (config: PutioSdkConfigShape) =>
  Layer.mergeAll(makePutioSdkEffectClientLayer(), makePutioSdkLiveLayer(config));

export const createPutioSdkPromiseClient = (initialConfig: PutioSdkConfigShape = {}) => {
  const normalizedConfig = makePutioSdkConfig({
    ...initialConfig,
    baseUrl: snapshotUrl(initialConfig.baseUrl),
    uploadBaseUrl: snapshotUrl(initialConfig.uploadBaseUrl),
    webAppUrl: snapshotUrl(initialConfig.webAppUrl),
  });
  const runtimeConfig: PutioSdkPromiseRuntimeConfig = {
    baseUrl: normalizedConfig.baseUrl,
    uploadBaseUrl: normalizedConfig.uploadBaseUrl,
    webAppUrl: normalizedConfig.webAppUrl,
  };
  const config: PutioSdkPromiseState = {
    accessToken: initialConfig.accessToken,
    runtimeConfig,
  };

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
    readonly platform?: "web" | "ios";
  }): Promise<AccountInfoBase & { readonly user_hash?: string }>;
  function getInfo(query: {
    readonly pas: 1;
  }): Promise<AccountInfoBase & { readonly pas: PasInfo }>;
  function getInfo(query: {
    readonly profitwell: 1;
  }): Promise<AccountInfoBase & { readonly paddle_user_id: number | string | null }>;
  function getInfo(query: {
    readonly push_token: 1;
  }): Promise<AccountInfoBase & { readonly push_token: string }>;
  function getInfo(): Promise<AccountInfoBroad>;
  function getInfo(query: AccountInfoQuery): Promise<AccountInfoBroad>;
  function getInfo(query: AccountInfoQuery = {}) {
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

  function getChildByName(input: {
    readonly name: string;
    readonly parentId: number;
  }): Promise<FileCore>;
  function getChildByName<TQuery extends FileQuery>(input: {
    readonly name: string;
    readonly parentId: number;
    readonly query: TQuery;
  }): Promise<FileResponseFor<TQuery>>;
  function getChildByName(input: {
    readonly name: string;
    readonly parentId: number;
    readonly query?: FileQuery;
  }) {
    return provideSdk(config, getFileChild(input));
  }

  const operations = makePromiseOperationTree(sharedOperationTree, config);

  return {
    dispose: () => disposePromiseClientRuntime(config),
    setAccessToken: (accessToken: string | undefined): void => {
      config.accessToken = accessToken;
    },
    ...operations,
    account: {
      ...operations.account,
      getInfo,
    },
    auth: {
      ...operations.auth,
      buildLoginUrl: (options: Parameters<typeof buildAuthLoginUrl>[0]) =>
        buildAuthLoginUrl({
          ...options,
          webAppUrl: options.webAppUrl ?? config.runtimeConfig.webAppUrl,
        }),
    },
    config: {
      ...operations.config,
      getKeyWith: <A>(key: string, schema: Schema.ConstraintDecoder<A, never>): Promise<A> =>
        provideSdk(config, getConfigKeyWith(key, schema)),
      readWith: <A>(schema: Schema.ConstraintDecoder<A, never>): Promise<A> =>
        provideSdk(config, readConfigWith(schema)),
    },
    files: {
      ...operations.files,
      createUploadFormData: createFileUploadFormData,
      get: getFileById,
      getChild: getChildByName,
    },
  };
};

export type PutioSdkPromiseClient = ReturnType<typeof createPutioSdkPromiseClient>;
