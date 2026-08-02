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
  : never;

type OperationBoundary = "input-free" | "pure" | "validated";
type Operation = (...args: never[]) => unknown;
const operationEntryMarker = Symbol("PutioSdkOperationEntry");
interface OperationEntry<T extends Operation> {
  readonly [operationEntryMarker]: true;
  readonly boundary: OperationBoundary;
  readonly run: T;
}

type EffectOperation<T extends Operation> =
  ReturnType<T> extends Effect.Effect<infer _Success, infer _Error, infer _Requirements>
    ? T
    : never;

type InputFreeEffectOperation<T extends Operation> =
  Parameters<T> extends [] ? EffectOperation<T> : never;

type ValidatedEffectOperation<T extends Operation> =
  Parameters<T> extends [] ? never : EffectOperation<T>;

type EffectReturnMember<T> =
  T extends Effect.Effect<infer _Success, infer _Error, infer _Requirements> ? T : never;

type PureOperation<T extends Operation> = [EffectReturnMember<ReturnType<T>>] extends [never]
  ? T
  : never;

const operationAtBoundary = <T extends Operation>(
  run: T,
  boundary: OperationBoundary,
): OperationEntry<T> => {
  const entry = { boundary, run };
  Object.defineProperty(entry, operationEntryMarker, { value: true });
  return Object.freeze(entry) as OperationEntry<T>;
};

const inputFree = <T extends Operation>(
  operation: InputFreeEffectOperation<T>,
): OperationEntry<T> => operationAtBoundary(operation, "input-free");

const pure = <T extends Operation>(operation: PureOperation<T>): OperationEntry<T> =>
  operationAtBoundary(operation, "pure");

const validated = <T extends Operation>(
  operation: ValidatedEffectOperation<T>,
): OperationEntry<T> => operationAtBoundary(operation, "validated");

type EffectOperationTree<T> =
  T extends OperationEntry<infer TOperation>
    ? TOperation
    : T extends object
      ? { [Key in keyof T]: EffectOperationTree<T[Key]> }
      : never;

type PromiseOperationTree<T> =
  T extends OperationEntry<infer TOperation>
    ? PromiseOperation<TOperation>
    : T extends object
      ? { [Key in keyof T]: PromiseOperationTree<T[Key]> }
      : never;

const isOperationEntry = (value: unknown): value is OperationEntry<Operation> =>
  typeof value === "object" &&
  value !== null &&
  Object.getPrototypeOf(value) === Object.prototype &&
  Object.isFrozen(value) &&
  Object.hasOwn(value, operationEntryMarker) &&
  value[operationEntryMarker] === true &&
  Object.hasOwn(value, "boundary") &&
  Object.hasOwn(value, "run") &&
  Reflect.ownKeys(value).length === 3 &&
  (value.boundary === "input-free" ||
    value.boundary === "pure" ||
    value.boundary === "validated") &&
  typeof value.run === "function";

const runClassifiedOperation = (
  entry: OperationEntry<Operation>,
  args: ReadonlyArray<unknown>,
): unknown => {
  const result: unknown = Reflect.apply(entry.run, undefined, args);

  if (entry.boundary === "pure") {
    if (Effect.isEffect(result)) {
      throw new TypeError("Pure SDK operation returned an Effect");
    }

    return result;
  }

  if (!Effect.isEffect(result)) {
    throw new TypeError(`${entry.boundary} SDK operation did not return an Effect`);
  }

  return result;
};

const cloneOperationTree = <T extends object>(tree: T): EffectOperationTree<T> =>
  Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      isOperationEntry(value) ? value.run : cloneOperationTree(value as object),
    ]),
  ) as EffectOperationTree<T>;

const runPromiseOperation = (
  entry: OperationEntry<Operation>,
  state: PutioSdkPromiseState,
  args: ReadonlyArray<unknown>,
): unknown => {
  const result = runClassifiedOperation(entry, args);

  return entry.boundary === "pure"
    ? result
    : provideSdk(state, result as Effect.Effect<unknown, unknown, PutioSdkContext>);
};

const makePromiseOperationTree = <T extends object>(
  tree: T,
  state: PutioSdkPromiseState,
): PromiseOperationTree<T> =>
  Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      isOperationEntry(value)
        ? (...args: ReadonlyArray<unknown>) => runPromiseOperation(value, state, args)
        : makePromiseOperationTree(value as object, state),
    ]),
  ) as PromiseOperationTree<T>;

const assertClassifiedOperationTree = (tree: object, parentPath = ""): void => {
  const entries = Object.entries(tree);

  if (Object.getPrototypeOf(tree) !== Object.prototype || entries.length === 0) {
    throw new TypeError(
      `SDK operation namespace ${parentPath || "<root>"} is not a non-empty plain object`,
    );
  }

  for (const [key, value] of entries) {
    const path = parentPath ? `${parentPath}.${key}` : key;

    if (isOperationEntry(value)) {
      continue;
    }

    if (typeof value === "object" && value !== null) {
      assertClassifiedOperationTree(value as object, path);
    } else {
      throw new TypeError(`SDK operation ${path} has no request-boundary classification`);
    }
  }
};

const sharedOperationTree = {
  account: {
    appSpecificPasswords: {
      create: validated(createAppSpecificPassword),
      delete: validated(deleteAppSpecificPassword),
      deleteAll: inputFree(deleteAllAppSpecificPasswords),
      list: inputFree(listAppSpecificPasswords),
    },
    clear: validated(clearAccount),
    destroy: validated(destroyAccount),
    getInfo: validated(getAccountInfo),
    getSettings: inputFree(getAccountSettings),
    listSubtitleLanguages: inputFree(listAccountSubtitleLanguages),
    listConfirmations: validated(listAccountConfirmations),
    saveSettings: validated(saveAccountSettings),
  },
  auth: {
    buildLoginUrl: pure(buildAuthLoginUrl),
    checkCodeMatch: validated(checkCodeMatch),
    clients: inputFree(clients),
    exchangeAuthorizationCode: validated(exchangeOAuthAuthorizationCode),
    exists: validated(exists),
    forgotPassword: validated(forgotPassword),
    getCode: validated(getCode),
    getFamilyInvite: validated(getFamilyInvite),
    getFriendInvite: validated(getFriendInvite),
    getGiftCard: validated(getGiftCard),
    getVoucher: validated(getVoucher),
    grants: inputFree(grants),
    linkDevice: validated(linkDevice),
    login: validated(login),
    logout: inputFree(logout),
    register: validated(register),
    resetPassword: validated(resetPassword),
    revokeAllClients: inputFree(revokeAllClients),
    revokeApp: validated(revokeApp),
    revokeClient: validated(revokeClient),
    twoFactor: {
      generateTOTP: inputFree(generateTOTP),
      getRecoveryCodes: inputFree(getRecoveryCodes),
      regenerateRecoveryCodes: inputFree(regenerateRecoveryCodes),
      verifyTOTP: validated(verifyTOTP),
    },
    validateToken: validated(validateToken),
  },
  config: {
    deleteKey: validated(deleteConfigKey),
    getKey: validated(getConfigKey),
    getKeyWith: validated(getConfigKeyWith),
    read: inputFree(readConfig),
    readWith: validated(readConfigWith),
    setKey: validated(setConfigKey),
    write: validated(writeConfig),
  },
  downloadLinks: {
    create: validated(createDownloadLinks),
    get: validated(getDownloadLinks),
  },
  events: {
    clear: inputFree(clearEvents),
    delete: validated(deleteEvent),
    getTorrent: validated(getEventTorrent),
    list: validated(listEvents),
  },
  family: {
    createInvite: inputFree(createFamilyInvite),
    join: validated(joinFamily),
    listInvites: inputFree(listFamilyInvites),
    listMembers: inputFree(listFamilyMembers),
    removeMember: validated(removeFamilyMember),
  },
  ifttt: {
    getStatus: inputFree(getIftttStatus),
    sendEvent: validated(sendIftttEvent),
  },
  podcast: {
    getLinks: validated(getPodcastLinks),
  },
  files: {
    canWrite: validated(canWriteFile),
    continue: validated(continueFiles),
    continueSearch: validated(continueSearch),
    copy: validated(copyFile),
    convertToMp4: validated(convertFileToMp4),
    convertManyToMp4: validated(convertFilesToMp4),
    convertSelectionToMp4: validated(convertFileSelectionToMp4),
    createUploadRequest: validated(createFileUploadRequest),
    createFolder: validated(createFolder),
    deleteExtraction: validated(deleteFileExtraction),
    deleteMp4: validated(deleteFileMp4),
    deleteSelection: validated(deleteFileSelection),
    delete: validated(deleteFiles),
    extract: validated(extractFiles),
    findNext: validated(findNextFile),
    findNextVideo: validated(findNextVideo),
    getApiContentUrl: validated(getApiContentUrl),
    getApiDownloadUrl: validated(getApiDownloadUrl),
    getApiMp4DownloadUrl: validated(getApiMp4DownloadUrl),
    get: validated(getFile),
    getChild: validated(getFileChild),
    getDownloadUrl: validated(getDownloadUrl),
    getHlsStreamUrl: validated(getHlsStreamUrl),
    getMp4Status: validated(getMp4Status),
    getStartFrom: validated(getStartFrom),
    list: validated(queryFiles),
    listActiveConversions: inputFree(listActiveMp4Conversions),
    listExtractions: inputFree(listFileExtractions),
    listSubtitles: validated(listFileSubtitles),
    move: validated(moveFiles),
    moveSelection: validated(moveFileSelection),
    putMp4ToMyFiles: validated(putMp4ToMyFiles),
    rename: validated(renameFile),
    resetSortSettings: inputFree(resetFileSortSettings),
    resetStartFrom: validated(resetStartFrom),
    search: validated(searchFiles),
    setSort: validated(setFileSort),
    setWatchStatus: validated(setFilesWatchStatus),
    setStartFrom: validated(setStartFrom),
    touch: validated(touchFiles),
    upload: validated(uploadFile),
  },
  friendInvites: {
    create: inputFree(createFriendInvite),
    list: inputFree(listFriendInvites),
  },
  friends: {
    approve: validated(approveFriendRequest),
    countWaitingRequests: inputFree(countWaitingRequests),
    deny: validated(denyFriendRequest),
    list: inputFree(listFriends),
    listSentRequests: inputFree(listSentRequests),
    listWaitingRequests: inputFree(listWaitingRequests),
    remove: validated(removeFriend),
    search: validated(searchFriends),
    sendRequest: validated(sendFriendRequest),
    sharedFolder: validated(getFriendSharedFolder),
  },
  oauth: {
    buildAuthorizeUrl: pure(buildOAuthAuthorizeUrl),
    buildIconUrl: pure(buildOAuthAppIconUrl),
    create: validated(createOAuthApp),
    delete: validated(deleteOAuthApp),
    get: validated(getOAuthApp),
    getPopularApps: inputFree(getPopularOAuthApps),
    query: inputFree(queryOAuthApps),
    regenerateToken: validated(regenerateOAuthAppToken),
    setIcon: validated(setOAuthAppIcon),
    update: validated(updateOAuthApp),
  },
  payment: {
    changePlan: {
      classifyResponse: pure(classifyPaymentChangePlanResponse),
      preview: validated(previewPaymentChangePlan),
      submit: validated(submitPaymentChangePlan),
    },
    confirmFastspringOrder: validated(confirmFastspringOrder),
    getInfo: inputFree(getPaymentInfo),
    listHistory: validated(listPaymentHistory),
    listInvites: inputFree(listPaymentInvites),
    listOptions: inputFree(listPaymentOptions),
    listPlans: inputFree(listPaymentPlans),
    methods: {
      addPaddleWaitingPayment: validated(createPaddleWaitingPayment),
      createOpenNodeCharge: validated(createOpenNodeCharge),
      createPaddleBillingUpdatePaymentMethodTransaction: validated(
        createPaddleBillingUpdatePaymentMethodTransaction,
      ),
      getPaddleBillingInvoiceUrl: validated(getPaddleBillingInvoiceUrl),
    },
    report: validated(reportPayments),
    stopSubscription: inputFree(stopPaymentSubscription),
    voucher: {
      getInfo: validated(getPaymentVoucherInfo),
      redeem: validated(redeemPaymentVoucher),
    },
  },
  rss: {
    clearLogs: validated(clearRssFeedLogs),
    create: validated(createRssFeed),
    delete: validated(deleteRssFeed),
    get: validated(getRssFeed),
    list: inputFree(listRssFeeds),
    listItems: validated(listRssFeedItems),
    pause: validated(pauseRssFeed),
    resume: validated(resumeRssFeed),
    retryAll: validated(retryAllRssFeedItems),
    retryItem: validated(retryRssFeedItem),
    update: validated(updateRssFeed),
  },
  sharing: {
    clone: validated(cloneSharedFiles),
    getCloneInfo: validated(getSharingCloneInfo),
    getSharedWith: validated(getSharedWith),
    listSharedFiles: inputFree(listSharedFiles),
    publicAccess: {
      continueFiles: validated(continuePublicShareFiles),
      get: inputFree(getPublicShare),
      getFileUrl: validated(getPublicShareFileUrl),
      listFiles: validated(listPublicShareFiles),
    },
    publicShares: {
      create: validated(createPublicShare),
      delete: validated(deletePublicShare),
      list: inputFree(listPublicShares),
    },
    shareFiles: validated(shareFiles),
    unshare: validated(unshareFile),
  },
  tunnel: {
    listRoutes: inputFree(listTunnelRoutes),
  },
  trash: {
    continue: validated(continueTrash),
    delete: validated(deleteTrash),
    empty: inputFree(emptyTrash),
    list: validated(listTrash),
    restore: validated(restoreTrash),
  },
  transfers: {
    add: validated(addTransfer),
    addMany: validated(addManyTransfers),
    addTrackers: validated(addTransferTrackers),
    cancel: validated(cancelTransfers),
    clean: validated(cleanTransfers),
    continue: validated(continueTransfers),
    count: inputFree(countTransfers),
    get: validated(getTransfer),
    getTorrent: validated(getTransferTorrent),
    info: validated(getTransferInfo),
    list: validated(listTransfers),
    reannounce: validated(reannounceTransfer),
    remove: validated(removeTransfers),
    retry: validated(retryTransfer),
    stopRecording: validated(stopTransferRecording),
  },
  zips: {
    cancel: validated(cancelZip),
    create: validated(createZip),
    get: validated(getZip),
    list: inputFree(listZips),
  },
};

assertClassifiedOperationTree(sharedOperationTree);

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
