import { Cause, Context, Effect, Exit, Layer, ManagedRuntime, Predicate, Schema } from "effect";

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
  AccountInfoBroad,
  AccountInfoQuery,
  AccountInfoResponseFor,
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
  getHlsMasterPlaylist,
  getHlsStreamUrl,
  getXspfPlaylistUrl,
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
import type {
  FileBroad,
  FileCore,
  FileListResponse,
  FileListResponseFor,
  FileQuery,
  FileResponseFor,
  FilesListQuery,
} from "../domains/files.js";
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
import {
  normalizePutioSdkOptions,
  PutioHttpClient,
  PutioSdkConfig,
  putioSdkLiveLayer,
} from "./http.js";
import type {
  PutioHttpClientService,
  PutioSdkContext,
  PutioSdkOptions,
  PutioSdkResolvedConfig,
  PutioSecret,
} from "./http.js";
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
import type { PublicShareListQuery } from "../domains/sharing.js";
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
import type {
  TransfersListQuery,
  TransfersListResponse,
  TransfersListResponseFor,
} from "../domains/transfers.js";
import { removeRateLimitBan } from "../domains/rate-limits.js";
import { listTunnelRoutes } from "../domains/tunnel.js";
import { cancelZip, createZip, getZip, listZips } from "../domains/zips.js";
import { mapConfigurationError } from "./errors.js";

interface PutioSdkPromiseState {
  config: PutioSdkResolvedConfig;
  disposed: boolean;
  runtime: ManagedRuntime.ManagedRuntime<PutioSdkContext, never> | undefined;
}

const getPromiseClientRuntime = (state: PutioSdkPromiseState) => {
  if (state.disposed) {
    throw mapConfigurationError(
      "This Promise client has been disposed and can no longer execute SDK effects",
    );
  }

  state.runtime ??= ManagedRuntime.make(
    putioSdkLiveLayer({ ...state.config, accessToken: undefined }),
  );

  return state.runtime;
};

const disposePromiseClientRuntime = async (state: PutioSdkPromiseState): Promise<void> => {
  const { runtime } = state;
  state.disposed = true;
  state.runtime = undefined;
  await runtime?.dispose();
};

interface PutioSdkPromiseRunner {
  readonly signal: AbortSignal | undefined;
  readonly state: PutioSdkPromiseState;
}

const provideSdk = async <A, E>(
  { signal, state }: PutioSdkPromiseRunner,
  effect: Effect.Effect<A, E, PutioSdkContext>,
): Promise<A> => {
  const runtime = getPromiseClientRuntime(state);
  const configured = Effect.provideService(effect, PutioSdkConfig, state.config);

  if (signal === undefined) {
    return runtime.runPromise(configured);
  }

  if (signal.aborted) {
    throw signal.reason;
  }

  const exit = await runtime.runPromiseExit(configured, { signal });

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  throw signal.aborted && Cause.hasInterruptsOnly(exit.cause)
    ? signal.reason
    : Cause.squash(exit.cause);
};

const snapshotUrl = (value: string | URL | undefined): string | URL | undefined =>
  Predicate.isString(value) || value === undefined ? value : new URL(value.href);

const snapshotHeaders = (value: HeadersInit | undefined): HeadersInit | undefined =>
  value === undefined ? undefined : [...new Headers(value)];

interface OperationKind {
  readonly Success: unknown;
  readonly Failure: unknown;
  readonly Requirements: unknown;
  readonly Result: unknown;
}

interface ContextualEffectKind extends OperationKind {
  readonly Result: Effect.Effect<this["Success"], this["Failure"], this["Requirements"]>;
}

interface ProvidedEffectKind extends OperationKind {
  readonly Result: Effect.Effect<
    this["Success"],
    this["Failure"],
    Exclude<this["Requirements"], PutioSdkContext>
  >;
}

interface PromiseKind extends OperationKind {
  readonly Result: Promise<this["Success"]>;
}

type OperationResult<Kind extends OperationKind, Success, Failure, Requirements> = (Kind & {
  readonly Success: Success;
  readonly Failure: Failure;
  readonly Requirements: Requirements;
})["Result"];

type Operation = (...args: never[]) => void;

type SdkEffect = Effect.Effect<unknown, unknown, PutioSdkContext>;

type SdkEffectOperation = (...args: never[]) => SdkEffect;

type ResultOf<
  Kind extends OperationKind,
  TOperation extends SdkEffectOperation,
  Success,
> = OperationResult<
  Kind,
  Success,
  Effect.Error<ReturnType<TOperation>>,
  Effect.Services<ReturnType<TOperation>>
>;

interface AccountGetInfo<Kind extends OperationKind> {
  <TQuery extends AccountInfoQuery>(
    query: TQuery,
  ): ResultOf<Kind, typeof getAccountInfo, AccountInfoResponseFor<TQuery>>;
  (query?: AccountInfoQuery): ResultOf<Kind, typeof getAccountInfo, AccountInfoBroad>;
}

interface ConfigGetKeyWith<Kind extends OperationKind> {
  <A>(
    key: string,
    schema: Schema.ConstraintDecoder<A, never>,
  ): ResultOf<Kind, typeof getConfigKeyWith, A>;
}

interface ConfigReadWith<Kind extends OperationKind> {
  <A>(schema: Schema.ConstraintDecoder<A, never>): ResultOf<Kind, typeof readConfigWith, A>;
}

interface FileGet<Kind extends OperationKind> {
  (input: { readonly id: number }): ResultOf<Kind, typeof getFile, FileCore>;
  <TQuery extends FileQuery>(input: {
    readonly id: number;
    readonly query: TQuery;
  }): ResultOf<Kind, typeof getFile, FileResponseFor<TQuery>>;
  (input: {
    readonly id: number;
    readonly query?: FileQuery | undefined;
  }): ResultOf<Kind, typeof getFile, FileBroad>;
}

interface FileGetChild<Kind extends OperationKind> {
  (input: {
    readonly name: string;
    readonly parentId: number;
  }): ResultOf<Kind, typeof getFileChild, FileCore>;
  <TQuery extends FileQuery>(input: {
    readonly name: string;
    readonly parentId: number;
    readonly query: TQuery;
  }): ResultOf<Kind, typeof getFileChild, FileResponseFor<TQuery>>;
  (input: {
    readonly name: string;
    readonly parentId: number;
    readonly query?: FileQuery | undefined;
  }): ResultOf<Kind, typeof getFileChild, FileBroad>;
}

interface FileList<Kind extends OperationKind> {
  <TQuery extends FilesListQuery>(
    parent: number | "friends",
    query: TQuery,
  ): ResultOf<Kind, typeof queryFiles, FileListResponseFor<TQuery>>;
  (
    parent: number | "friends",
    query?: FilesListQuery,
  ): ResultOf<Kind, typeof queryFiles, FileListResponse>;
}

interface PublicShareListFiles<Kind extends OperationKind> {
  <TQuery extends PublicShareListQuery>(
    query: TQuery,
  ): ResultOf<Kind, typeof listPublicShareFiles, FileListResponseFor<TQuery>>;
  (query?: PublicShareListQuery): ResultOf<Kind, typeof listPublicShareFiles, FileListResponse>;
}

interface TransferList<Kind extends OperationKind> {
  <TQuery extends TransfersListQuery>(
    query: TQuery,
  ): ResultOf<Kind, typeof listTransfers, TransfersListResponseFor<TQuery>>;
  (query?: TransfersListQuery): ResultOf<Kind, typeof listTransfers, TransfersListResponse>;
}

interface SignedOperations<Kind extends OperationKind> {
  account: {
    getInfo: AccountGetInfo<Kind>;
  };
  config: {
    getKeyWith: ConfigGetKeyWith<Kind>;
    readWith: ConfigReadWith<Kind>;
  };
  files: {
    get: FileGet<Kind>;
    getChild: FileGetChild<Kind>;
    list: FileList<Kind>;
  };
  sharing: {
    publicAccess: {
      listFiles: PublicShareListFiles<Kind>;
    };
  };
  transfers: {
    list: TransferList<Kind>;
  };
}

type ProvideSdkEffect = (effect: SdkEffect) => void;

class OperationEntry<T extends Operation> {
  constructor(
    readonly run: T,
    readonly bind: (provide: ProvideSdkEffect) => (...args: Parameters<T>) => void,
  ) {}
}

type EffectReturnMember<T> =
  T extends Effect.Effect<infer _Success, infer _Error, infer _Requirements> ? T : never;

type PureOperation<T extends Operation> = [EffectReturnMember<ReturnType<T>>] extends [never]
  ? T
  : never;

const effect = <T extends SdkEffectOperation>(operation: T): OperationEntry<T> =>
  new OperationEntry(
    operation,
    (provide) =>
      (...args: Parameters<T>) =>
        provide(operation(...args)),
  );

const pure = <T extends Operation>(operation: T & PureOperation<T>): OperationEntry<T> =>
  new OperationEntry(operation, () => operation);

interface OperationNamespace {
  readonly [key: string]: OperationNamespace | OperationEntry<Operation>;
}

interface ClientNamespace {
  readonly [key: string]: ClientNamespace | Operation;
}

type EffectOperationTree<T> =
  T extends OperationEntry<infer TOperation>
    ? TOperation
    : T extends object
      ? { [Key in keyof T]: EffectOperationTree<T[Key]> }
      : never;

type OperationFor<Kind extends OperationKind, T> = T extends (...args: infer Args) => infer Result
  ? Result extends Effect.Effect<infer Success, infer Failure, infer Requirements>
    ? (...args: Args) => OperationResult<Kind, Success, Failure, Requirements>
    : T
  : never;

type OperationTreeFor<Kind extends OperationKind, T, Signed> =
  T extends OperationEntry<infer TOperation>
    ? OperationFor<Kind, TOperation>
    : T extends object
      ? {
          [Key in keyof T]: Key extends keyof Signed
            ? Signed[Key] extends Operation
              ? Signed[Key]
              : OperationTreeFor<Kind, T[Key], Signed[Key]>
            : OperationTreeFor<Kind, T[Key], unknown>;
        }
      : never;

const mapOperationTree = (
  tree: OperationNamespace,
  toOperation: (entry: OperationEntry<Operation>) => Operation,
): ClientNamespace =>
  Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      value instanceof OperationEntry ? toOperation(value) : mapOperationTree(value, toOperation),
    ]),
  );

const sharedOperationTree = {
  account: {
    appSpecificPasswords: {
      create: effect(createAppSpecificPassword),
      delete: effect(deleteAppSpecificPassword),
      deleteAll: effect(deleteAllAppSpecificPasswords),
      list: effect(listAppSpecificPasswords),
    },
    clear: effect(clearAccount),
    destroy: effect(destroyAccount),
    getInfo: effect(getAccountInfo satisfies AccountGetInfo<ContextualEffectKind>),
    getSettings: effect(getAccountSettings),
    listSubtitleLanguages: effect(listAccountSubtitleLanguages),
    listConfirmations: effect(listAccountConfirmations),
    saveSettings: effect(saveAccountSettings),
  },
  auth: {
    buildLoginUrl: pure(buildAuthLoginUrl),
    checkCodeMatch: effect(checkCodeMatch),
    clients: effect(clients),
    exchangeAuthorizationCode: effect(exchangeOAuthAuthorizationCode),
    exists: effect(exists),
    forgotPassword: effect(forgotPassword),
    getCode: effect(getCode),
    getFamilyInvite: effect(getFamilyInvite),
    getFriendInvite: effect(getFriendInvite),
    getGiftCard: effect(getGiftCard),
    getVoucher: effect(getVoucher),
    grants: effect(grants),
    linkDevice: effect(linkDevice),
    login: effect(login),
    logout: effect(logout),
    register: effect(register),
    resetPassword: effect(resetPassword),
    revokeAllClients: effect(revokeAllClients),
    revokeApp: effect(revokeApp),
    revokeClient: effect(revokeClient),
    twoFactor: {
      generateTOTP: effect(generateTOTP),
      getRecoveryCodes: effect(getRecoveryCodes),
      regenerateRecoveryCodes: effect(regenerateRecoveryCodes),
      verifyTOTP: effect(verifyTOTP),
    },
    validateToken: effect(validateToken),
  },
  config: {
    deleteKey: effect(deleteConfigKey),
    getKey: effect(getConfigKey),
    getKeyWith: effect(getConfigKeyWith satisfies ConfigGetKeyWith<ContextualEffectKind>),
    read: effect(readConfig),
    readWith: effect(readConfigWith satisfies ConfigReadWith<ContextualEffectKind>),
    setKey: effect(setConfigKey),
    write: effect(writeConfig),
  },
  downloadLinks: {
    create: effect(createDownloadLinks),
    get: effect(getDownloadLinks),
  },
  events: {
    clear: effect(clearEvents),
    delete: effect(deleteEvent),
    getTorrent: effect(getEventTorrent),
    list: effect(listEvents),
  },
  family: {
    createInvite: effect(createFamilyInvite),
    join: effect(joinFamily),
    listInvites: effect(listFamilyInvites),
    listMembers: effect(listFamilyMembers),
    removeMember: effect(removeFamilyMember),
  },
  ifttt: {
    getStatus: effect(getIftttStatus),
    sendEvent: effect(sendIftttEvent),
  },
  podcast: {
    getLinks: effect(getPodcastLinks),
  },
  files: {
    canWrite: effect(canWriteFile),
    continue: effect(continueFiles),
    continueSearch: effect(continueSearch),
    copy: effect(copyFile),
    convertToMp4: effect(convertFileToMp4),
    convertManyToMp4: effect(convertFilesToMp4),
    convertSelectionToMp4: effect(convertFileSelectionToMp4),
    createUploadRequest: effect(createFileUploadRequest),
    createFolder: effect(createFolder),
    deleteExtraction: effect(deleteFileExtraction),
    deleteMp4: effect(deleteFileMp4),
    deleteSelection: effect(deleteFileSelection),
    delete: effect(deleteFiles),
    extract: effect(extractFiles),
    findNext: effect(findNextFile),
    findNextVideo: effect(findNextVideo),
    getApiContentUrl: effect(getApiContentUrl),
    getApiDownloadUrl: effect(getApiDownloadUrl),
    getApiMp4DownloadUrl: effect(getApiMp4DownloadUrl),
    get: effect(getFile satisfies FileGet<ContextualEffectKind>),
    getChild: effect(getFileChild satisfies FileGetChild<ContextualEffectKind>),
    getDownloadUrl: effect(getDownloadUrl),
    getHlsMasterPlaylist: effect(getHlsMasterPlaylist),
    getHlsStreamUrl: effect(getHlsStreamUrl),
    getXspfPlaylistUrl: effect(getXspfPlaylistUrl),
    getMp4Status: effect(getMp4Status),
    getStartFrom: effect(getStartFrom),
    list: effect(queryFiles satisfies FileList<ContextualEffectKind>),
    listActiveConversions: effect(listActiveMp4Conversions),
    listExtractions: effect(listFileExtractions),
    listSubtitles: effect(listFileSubtitles),
    move: effect(moveFiles),
    moveSelection: effect(moveFileSelection),
    putMp4ToMyFiles: effect(putMp4ToMyFiles),
    rename: effect(renameFile),
    resetSortSettings: effect(resetFileSortSettings),
    resetStartFrom: effect(resetStartFrom),
    search: effect(searchFiles),
    setSort: effect(setFileSort),
    setWatchStatus: effect(setFilesWatchStatus),
    setStartFrom: effect(setStartFrom),
    touch: effect(touchFiles),
    upload: effect(uploadFile),
  },
  friendInvites: {
    create: effect(createFriendInvite),
    list: effect(listFriendInvites),
  },
  friends: {
    approve: effect(approveFriendRequest),
    countWaitingRequests: effect(countWaitingRequests),
    deny: effect(denyFriendRequest),
    list: effect(listFriends),
    listSentRequests: effect(listSentRequests),
    listWaitingRequests: effect(listWaitingRequests),
    remove: effect(removeFriend),
    search: effect(searchFriends),
    sendRequest: effect(sendFriendRequest),
    sharedFolder: effect(getFriendSharedFolder),
  },
  oauth: {
    buildAuthorizeUrl: pure(buildOAuthAuthorizeUrl),
    buildIconUrl: pure(buildOAuthAppIconUrl),
    create: effect(createOAuthApp),
    delete: effect(deleteOAuthApp),
    get: effect(getOAuthApp),
    getPopularApps: effect(getPopularOAuthApps),
    query: effect(queryOAuthApps),
    regenerateToken: effect(regenerateOAuthAppToken),
    setIcon: effect(setOAuthAppIcon),
    update: effect(updateOAuthApp),
  },
  payment: {
    changePlan: {
      classifyResponse: pure(classifyPaymentChangePlanResponse),
      preview: effect(previewPaymentChangePlan),
      submit: effect(submitPaymentChangePlan),
    },
    confirmFastspringOrder: effect(confirmFastspringOrder),
    getInfo: effect(getPaymentInfo),
    listHistory: effect(listPaymentHistory),
    listInvites: effect(listPaymentInvites),
    listOptions: effect(listPaymentOptions),
    listPlans: effect(listPaymentPlans),
    methods: {
      addPaddleWaitingPayment: effect(createPaddleWaitingPayment),
      createOpenNodeCharge: effect(createOpenNodeCharge),
      createPaddleBillingUpdatePaymentMethodTransaction: effect(
        createPaddleBillingUpdatePaymentMethodTransaction,
      ),
      getPaddleBillingInvoiceUrl: effect(getPaddleBillingInvoiceUrl),
    },
    report: effect(reportPayments),
    stopSubscription: effect(stopPaymentSubscription),
    voucher: {
      getInfo: effect(getPaymentVoucherInfo),
      redeem: effect(redeemPaymentVoucher),
    },
  },
  rateLimits: {
    removeBan: effect(removeRateLimitBan),
  },
  rss: {
    clearLogs: effect(clearRssFeedLogs),
    create: effect(createRssFeed),
    delete: effect(deleteRssFeed),
    get: effect(getRssFeed),
    list: effect(listRssFeeds),
    listItems: effect(listRssFeedItems),
    pause: effect(pauseRssFeed),
    resume: effect(resumeRssFeed),
    retryAll: effect(retryAllRssFeedItems),
    retryItem: effect(retryRssFeedItem),
    update: effect(updateRssFeed),
  },
  sharing: {
    clone: effect(cloneSharedFiles),
    getCloneInfo: effect(getSharingCloneInfo),
    getSharedWith: effect(getSharedWith),
    listSharedFiles: effect(listSharedFiles),
    publicAccess: {
      continueFiles: effect(continuePublicShareFiles),
      get: effect(getPublicShare),
      getFileUrl: effect(getPublicShareFileUrl),
      listFiles: effect(listPublicShareFiles satisfies PublicShareListFiles<ContextualEffectKind>),
    },
    publicShares: {
      create: effect(createPublicShare),
      delete: effect(deletePublicShare),
      list: effect(listPublicShares),
    },
    shareFiles: effect(shareFiles),
    unshare: effect(unshareFile),
  },
  tunnel: {
    listRoutes: effect(listTunnelRoutes),
  },
  trash: {
    continue: effect(continueTrash),
    delete: effect(deleteTrash),
    empty: effect(emptyTrash),
    list: effect(listTrash),
    restore: effect(restoreTrash),
  },
  transfers: {
    add: effect(addTransfer),
    addMany: effect(addManyTransfers),
    addTrackers: effect(addTransferTrackers),
    cancel: effect(cancelTransfers),
    clean: effect(cleanTransfers),
    continue: effect(continueTransfers),
    count: effect(countTransfers),
    get: effect(getTransfer),
    getTorrent: effect(getTransferTorrent),
    info: effect(getTransferInfo),
    list: effect(listTransfers satisfies TransferList<ContextualEffectKind>),
    reannounce: effect(reannounceTransfer),
    remove: effect(removeTransfers),
    retry: effect(retryTransfer),
    stopRecording: effect(stopTransferRecording),
  },
  zips: {
    cancel: effect(cancelZip),
    create: effect(createZip),
    get: effect(getZip),
    list: effect(listZips),
  },
} satisfies OperationNamespace;

type SharedOperationTree = typeof sharedOperationTree;

type BoundOperationTree<Kind extends OperationKind> = OperationTreeFor<
  Kind,
  SharedOperationTree,
  SignedOperations<Kind>
>;

const bindOperationTree = <Kind extends OperationKind>(
  provide: ProvideSdkEffect,
): BoundOperationTree<Kind> =>
  // SAFETY: mapOperationTree keeps every key of sharedOperationTree and replaces each entry with its own `run` passed through `provide`, and each caller names the Kind that its `provide` returns.
  mapOperationTree(sharedOperationTree, (entry) => entry.bind(provide)) as BoundOperationTree<Kind>;

const buildLoginUrlFrom =
  (webAppUrl: string | URL) => (options: Parameters<typeof buildAuthLoginUrl>[0]) =>
    buildAuthLoginUrl({ ...options, webAppUrl: options.webAppUrl ?? webAppUrl });

export const createPutioSdkEffectClient = (): EffectOperationTree<SharedOperationTree> =>
  // SAFETY: mapOperationTree keeps every key of sharedOperationTree and replaces each entry with its own `run`.
  mapOperationTree(
    sharedOperationTree,
    (entry) => entry.run,
  ) as EffectOperationTree<SharedOperationTree>;

export type PutioSdkEffectClient = ReturnType<typeof createPutioSdkEffectClient>;

const makePutioSdkService = (
  config: PutioSdkResolvedConfig,
  httpClient: PutioHttpClientService,
) => {
  const context = Context.make(PutioSdkConfig, config).pipe(
    Context.add(PutioHttpClient, httpClient),
  );

  const operations = bindOperationTree<ProvidedEffectKind>((operation) =>
    Effect.provideContext(operation, context),
  );

  return {
    ...operations,
    auth: {
      ...operations.auth,
      buildLoginUrl: buildLoginUrlFrom(config.webAppUrl),
    },
  };
};

export type PutioSdkService = ReturnType<typeof makePutioSdkService>;

export class PutioSdk extends Context.Service<PutioSdk, PutioSdkService>()(
  "@putdotio/sdk/PutioSdk",
) {}

export const makePutioSdkEffectClientLayer = (): Layer.Layer<PutioSdk, never, PutioSdkContext> =>
  Layer.effect(PutioSdk)(
    Effect.gen(function* () {
      return makePutioSdkService(yield* PutioSdkConfig, yield* PutioHttpClient);
    }),
  );

export const makePutioSdkLiveClientLayer = (
  config: PutioSdkOptions,
): Layer.Layer<PutioSdk | PutioSdkContext> =>
  Layer.provideMerge(makePutioSdkEffectClientLayer(), putioSdkLiveLayer(config));

const createPromiseOperations = (state: PutioSdkPromiseState, signal: AbortSignal | undefined) => {
  const runner: PutioSdkPromiseRunner = { signal, state };

  const operations = bindOperationTree<PromiseKind>((operation) => provideSdk(runner, operation));

  return {
    ...operations,
    auth: {
      ...operations.auth,
      buildLoginUrl: buildLoginUrlFrom(state.config.webAppUrl),
    },
    files: {
      ...operations.files,
      createUploadFormData: createFileUploadFormData,
    },
  };
};

export type PutioSdkPromiseOperations = ReturnType<typeof createPromiseOperations>;

export const createPutioSdkPromiseClient = (initialConfig: PutioSdkOptions = {}) => {
  const state: PutioSdkPromiseState = {
    config: normalizePutioSdkOptions({
      ...initialConfig,
      baseUrl: snapshotUrl(initialConfig.baseUrl),
      headers: snapshotHeaders(initialConfig.headers),
      uploadBaseUrl: snapshotUrl(initialConfig.uploadBaseUrl),
      webAppUrl: snapshotUrl(initialConfig.webAppUrl),
    }),
    disposed: false,
    runtime: undefined,
  };

  return {
    dispose: () => disposePromiseClientRuntime(state),
    setAccessToken: (accessToken: PutioSecret | undefined): void => {
      state.config = normalizePutioSdkOptions({ ...state.config, accessToken });
    },
    withSignal: (signal: AbortSignal): PutioSdkPromiseOperations =>
      createPromiseOperations(state, signal),
    ...createPromiseOperations(state, undefined),
  };
};

export type PutioSdkPromiseClient = ReturnType<typeof createPutioSdkPromiseClient>;
