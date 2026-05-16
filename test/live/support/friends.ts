import { bootstrapFirstPartyTokenWithCredentials } from "./bootstrap.ts";
import {
  readCredentialFixture,
  readFirstPartyClientCredentials,
  readSecondaryCredentialFixture,
} from "./secrets.ts";

type LiveFriend = {
  readonly has_shared_files: boolean;
  readonly name: string;
};

type LiveFriendBase = {
  readonly name: string;
};

type LiveFile = {
  readonly file_type: string;
  readonly id: number;
  readonly name: string;
};

type LiveFileUploadResult =
  | {
      readonly file: LiveFile;
      readonly type: "file";
    }
  | {
      readonly type: string;
    };

type LiveFileListResponse = {
  readonly cursor: string | null;
  readonly files: ReadonlyArray<LiveFile>;
};

type LiveFriendsClient = {
  readonly files: {
    readonly continue: (
      cursor: string,
      query?: {
        readonly per_page?: number;
      },
    ) => Promise<LiveFileListResponse>;
    readonly createFolder: (input: {
      readonly name: string;
      readonly parent_id: number;
    }) => Promise<LiveFile>;
    readonly list: (
      parentId: number,
      query?: {
        readonly per_page?: number;
      },
    ) => Promise<LiveFileListResponse>;
    readonly upload: (input: {
      readonly file: File;
      readonly fileName: string;
      readonly parentId: number;
    }) => Promise<LiveFileUploadResult>;
  };
  readonly friends: {
    readonly approve: (username: string) => Promise<unknown>;
    readonly list: () => Promise<{
      readonly friends: ReadonlyArray<LiveFriend>;
    }>;
    readonly listSentRequests: () => Promise<ReadonlyArray<LiveFriendBase>>;
    readonly listWaitingRequests: () => Promise<ReadonlyArray<LiveFriendBase>>;
    readonly sendRequest: (username: string) => Promise<unknown>;
    readonly sharedFolder: (username: string) => Promise<LiveFile | null>;
  };
  readonly sharing: {
    readonly shareFiles: (input: {
      readonly ids: readonly number[];
      readonly target: {
        readonly friendNames: readonly string[];
        readonly type: "friends";
      };
    }) => Promise<unknown>;
  };
};

type SecondaryClientFactory = (config?: {
  readonly accessToken?: string;
}) => Promise<LiveFriendsClient>;

const SHARED_FRIEND_FIXTURE_FOLDER_NAME = "codex_sdk_shared_friend_fixture";
const SHARED_FRIEND_FIXTURE_FILE_NAME = "codex_sdk_shared_friend_fixture.txt";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let secondaryClientPromise: Promise<LiveFriendsClient> | null = null;

const hasName = (rows: ReadonlyArray<LiveFriendBase>, username: string): boolean =>
  rows.some((row) => row.name === username);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const isAlreadySharedError = (error: unknown): boolean => {
  if (!isRecord(error)) {
    return false;
  }

  if (error._tag !== "PutioOperationError") {
    return false;
  }

  if (error.domain !== "sharing" || error.operation !== "shareFiles" || error.status !== 400) {
    return false;
  }

  const reason = isRecord(error.reason) ? error.reason : {};
  const body = isRecord(error.body) ? error.body : {};

  return reason.errorType === "ALREADY_SHARED" || body.error_type === "ALREADY_SHARED";
};

const readSecondaryFriendFixture = () => {
  const primary = readCredentialFixture();
  const secondary = readSecondaryCredentialFixture();

  if (!secondary) {
    throw new Error(
      "Missing secondary live account fixture. Set PUTIO_TEST_SECONDARY_USERNAME and PUTIO_TEST_SECONDARY_PASSWORD, then run pnpm secrets:setup/bootstrap as needed before friend/share live tests.",
    );
  }

  return {
    primaryUsername: primary.username,
    secondary,
    secondaryUsername: secondary.username,
  };
};

const getSecondaryClient = (createClient: SecondaryClientFactory): Promise<LiveFriendsClient> => {
  secondaryClientPromise ??= bootstrapFirstPartyTokenWithCredentials(
    readSecondaryFriendFixture().secondary,
    readFirstPartyClientCredentials(),
  ).then((token) =>
    createClient({
      accessToken: token.accessToken,
    }),
  );

  return secondaryClientPromise;
};

export const findLiveFriend = async (
  client: LiveFriendsClient,
  predicate: (friend: LiveFriend) => boolean = () => true,
): Promise<LiveFriend | null> => {
  const { friends } = await client.friends.list();
  return friends.find(predicate) ?? null;
};

const waitForLiveFriend = async (
  client: LiveFriendsClient,
  username: string,
  predicate: (friend: LiveFriend) => boolean = () => true,
): Promise<LiveFriend | null> => {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const friend = await findLiveFriend(
      client,
      (candidate) => candidate.name === username && predicate(candidate),
    );

    if (friend) {
      return friend;
    }

    await sleep(1_000);
  }

  return null;
};

const approvePendingFriendship = async (
  primaryClient: LiveFriendsClient,
  secondaryClient: LiveFriendsClient,
  primaryUsername: string,
  secondaryUsername: string,
): Promise<boolean> => {
  const [primaryWaiting, secondaryWaiting] = await Promise.all([
    primaryClient.friends.listWaitingRequests(),
    secondaryClient.friends.listWaitingRequests(),
  ]);

  if (hasName(primaryWaiting, secondaryUsername)) {
    await primaryClient.friends.approve(secondaryUsername);
    return true;
  }

  if (hasName(secondaryWaiting, primaryUsername)) {
    await secondaryClient.friends.approve(primaryUsername);
    return true;
  }

  return false;
};

export const requireLiveFriend = async (
  primaryClient: LiveFriendsClient,
  createClient: SecondaryClientFactory,
): Promise<LiveFriend> => {
  const { primaryUsername, secondaryUsername } = readSecondaryFriendFixture();
  const existing = await findLiveFriend(
    primaryClient,
    (candidate) => candidate.name === secondaryUsername,
  );

  if (existing) {
    return existing;
  }

  const secondaryClient = await getSecondaryClient(createClient);
  await approvePendingFriendship(
    primaryClient,
    secondaryClient,
    primaryUsername,
    secondaryUsername,
  );

  const approved = await waitForLiveFriend(primaryClient, secondaryUsername);

  if (approved) {
    return approved;
  }

  const [primarySent, secondaryWaiting] = await Promise.all([
    primaryClient.friends.listSentRequests(),
    secondaryClient.friends.listWaitingRequests(),
  ]);

  if (!hasName(primarySent, secondaryUsername) && !hasName(secondaryWaiting, primaryUsername)) {
    await primaryClient.friends.sendRequest(secondaryUsername);
  }

  await secondaryClient.friends.approve(primaryUsername);

  const friend = await waitForLiveFriend(primaryClient, secondaryUsername);

  if (!friend) {
    throw new Error(`Secondary live account ${secondaryUsername} did not become a friend in time`);
  }

  return friend;
};

const findOrCreateSecondarySharedFolder = async (
  secondaryClient: LiveFriendsClient,
): Promise<LiveFile> => {
  let page = await secondaryClient.files.list(0, {
    per_page: 100,
  });

  while (true) {
    const existing = page.files.find(
      (file) => file.file_type === "FOLDER" && file.name === SHARED_FRIEND_FIXTURE_FOLDER_NAME,
    );

    if (existing) {
      return existing;
    }

    if (!page.cursor) {
      return secondaryClient.files.createFolder({
        name: SHARED_FRIEND_FIXTURE_FOLDER_NAME,
        parent_id: 0,
      });
    }

    page = await secondaryClient.files.continue(page.cursor, {
      per_page: 100,
    });
  }
};

const ensureSecondarySharedFile = async (
  secondaryClient: LiveFriendsClient,
  parentId: number,
): Promise<void> => {
  let listing = await secondaryClient.files.list(parentId, {
    per_page: 100,
  });

  while (true) {
    const existing = listing.files.find(
      (file) => file.file_type !== "FOLDER" && file.name === SHARED_FRIEND_FIXTURE_FILE_NAME,
    );

    if (existing) {
      return;
    }

    if (!listing.cursor) {
      break;
    }

    listing = await secondaryClient.files.continue(listing.cursor, {
      per_page: 100,
    });
  }

  const upload = await secondaryClient.files.upload({
    file: new File(["sdk shared friend fixture\n"], SHARED_FRIEND_FIXTURE_FILE_NAME, {
      type: "text/plain",
    }),
    fileName: SHARED_FRIEND_FIXTURE_FILE_NAME,
    parentId,
  });

  if (upload.type !== "file") {
    throw new Error("expected secondary shared fixture upload to return a file");
  }
};

const findChildByName = async (
  client: LiveFriendsClient,
  parentId: number,
  name: string,
): Promise<LiveFile | null> => {
  let page = await client.files.list(parentId, {
    per_page: 100,
  });

  while (true) {
    const existing = page.files.find((file) => file.name === name);

    if (existing) {
      return existing;
    }

    if (!page.cursor) {
      return null;
    }

    page = await client.files.continue(page.cursor, {
      per_page: 100,
    });
  }
};

const waitForPrimarySharedFixture = async (
  primaryClient: LiveFriendsClient,
  secondaryUsername: string,
): Promise<void> => {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const primarySharedRoot = await primaryClient.friends.sharedFolder(secondaryUsername);

    if (primarySharedRoot) {
      const sharedFolder = await findChildByName(
        primaryClient,
        primarySharedRoot.id,
        SHARED_FRIEND_FIXTURE_FOLDER_NAME,
      );

      if (sharedFolder) {
        const sharedFile = await findChildByName(
          primaryClient,
          sharedFolder.id,
          SHARED_FRIEND_FIXTURE_FILE_NAME,
        );

        if (sharedFile) {
          return;
        }
      }
    }

    await sleep(1_000);
  }

  throw new Error(
    `Secondary live account ${secondaryUsername} did not expose the shared fixture folder in time`,
  );
};

export const requireLiveFriendWithSharedFiles = async (
  primaryClient: LiveFriendsClient,
  createClient: SecondaryClientFactory,
): Promise<LiveFriend> => {
  const { primaryUsername, secondaryUsername } = readSecondaryFriendFixture();
  const _friend = await requireLiveFriend(primaryClient, createClient);

  const secondaryClient = await getSecondaryClient(createClient);
  const sharedFolder = await findOrCreateSecondarySharedFolder(secondaryClient);
  await ensureSecondarySharedFile(secondaryClient, sharedFolder.id);

  await secondaryClient.sharing
    .shareFiles({
      ids: [sharedFolder.id],
      target: {
        friendNames: [primaryUsername],
        type: "friends",
      },
    })
    .catch(async (error: unknown) => {
      if (!isAlreadySharedError(error)) {
        throw error;
      }

      await waitForPrimarySharedFixture(primaryClient, secondaryUsername);
    });

  await waitForPrimarySharedFixture(primaryClient, secondaryUsername);

  const sharedFriend = await waitForLiveFriend(
    primaryClient,
    secondaryUsername,
    (candidate) => candidate.has_shared_files,
  );

  if (!sharedFriend) {
    throw new Error(
      `Secondary live account ${secondaryUsername} did not expose shared files to ${primaryUsername} in time`,
    );
  }

  return sharedFriend;
};
