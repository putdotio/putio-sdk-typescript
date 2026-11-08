import { Schema } from "effect";

import type { FileCore, Friend, PutioSdkPromiseClient } from "../../../dist/index.js";
import { getSecondaryClient } from "./bootstrap.ts";
import { readCredentialFixture, readSecondaryCredentialFixture } from "./secrets.ts";

const SHARED_FRIEND_FIXTURE_FOLDER_NAME = "putio-typescript-sdk-shared-friend-fixture";
const SHARED_FRIEND_FIXTURE_FILE_NAME = "putio-typescript-sdk-shared-friend-fixture.txt";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const hasName = (rows: ReadonlyArray<{ readonly name: string }>, username: string): boolean =>
  rows.some((row) => row.name === username);

const shareFilesBadRequestFields = {
  _tag: Schema.Literal("PutioOperationError"),
  domain: Schema.Literal("sharing"),
  operation: Schema.Literal("shareFiles"),
  status: Schema.Literal(400),
};

const AlreadySharedErrorSchema = Schema.Union([
  Schema.Struct({
    ...shareFilesBadRequestFields,
    reason: Schema.Struct({ errorType: Schema.Literal("ALREADY_SHARED") }),
  }),
  Schema.Struct({
    ...shareFilesBadRequestFields,
    body: Schema.Struct({ error_type: Schema.Literal("ALREADY_SHARED") }),
  }),
]);

const isAlreadySharedError = Schema.is(AlreadySharedErrorSchema);

const readFriendUsernames = () => ({
  primaryUsername: readCredentialFixture().username,
  secondaryUsername: readSecondaryCredentialFixture().username,
});

const waitForLiveFriend = async (
  client: PutioSdkPromiseClient,
  username: string,
  predicate: (friend: Friend) => boolean = () => true,
): Promise<Friend | null> => {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const { friends } = await client.friends.list();
    const friend = friends.find((candidate) => candidate.name === username && predicate(candidate));

    if (friend) {
      return friend;
    }

    await sleep(1_000);
  }

  return null;
};

const approvePendingFriendship = async (
  primaryClient: PutioSdkPromiseClient,
  secondaryClient: PutioSdkPromiseClient,
  primaryUsername: string,
  secondaryUsername: string,
): Promise<void> => {
  const [primaryWaiting, secondaryWaiting] = await Promise.all([
    primaryClient.friends.listWaitingRequests(),
    secondaryClient.friends.listWaitingRequests(),
  ]);

  if (hasName(primaryWaiting, secondaryUsername)) {
    await primaryClient.friends.approve(secondaryUsername);
  } else if (hasName(secondaryWaiting, primaryUsername)) {
    await secondaryClient.friends.approve(primaryUsername);
  }
};

export const requireLiveFriend = async (primaryClient: PutioSdkPromiseClient): Promise<Friend> => {
  const { primaryUsername, secondaryUsername } = readFriendUsernames();

  const { friends } = await primaryClient.friends.list();
  const existing = friends.find((candidate) => candidate.name === secondaryUsername);

  if (existing) {
    return existing;
  }

  const secondaryClient = await getSecondaryClient();
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

const findChild = async (
  client: PutioSdkPromiseClient,
  parentId: number,
  predicate: (file: FileCore) => boolean,
): Promise<FileCore | null> => {
  let page: { readonly cursor: string | null; readonly files: ReadonlyArray<FileCore> } =
    await client.files.list(parentId, { per_page: 100 });

  while (true) {
    const existing = page.files.find(predicate);

    if (existing) {
      return existing;
    }

    if (!page.cursor) {
      return null;
    }

    page = await client.files.continue(page.cursor, { per_page: 100 });
  }
};

const ensureSecondarySharedFixture = async (
  secondaryClient: PutioSdkPromiseClient,
): Promise<FileCore> => {
  const folder =
    (await findChild(
      secondaryClient,
      0,
      (file) => file.file_type === "FOLDER" && file.name === SHARED_FRIEND_FIXTURE_FOLDER_NAME,
    )) ??
    (await secondaryClient.files.createFolder({
      name: SHARED_FRIEND_FIXTURE_FOLDER_NAME,
      parent_id: 0,
    }));

  const file = await findChild(
    secondaryClient,
    folder.id,
    (child) => child.file_type !== "FOLDER" && child.name === SHARED_FRIEND_FIXTURE_FILE_NAME,
  );

  if (!file) {
    const upload = await secondaryClient.files.upload({
      file: new File(["sdk shared friend fixture\n"], SHARED_FRIEND_FIXTURE_FILE_NAME, {
        type: "text/plain",
      }),
      fileName: SHARED_FRIEND_FIXTURE_FILE_NAME,
      parentId: folder.id,
    });

    if (upload.type !== "file") {
      throw new Error("expected secondary shared fixture upload to return a file");
    }
  }

  return folder;
};

const waitForPrimarySharedFixture = async (
  primaryClient: PutioSdkPromiseClient,
  secondaryUsername: string,
): Promise<void> => {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const sharedRoot = await primaryClient.friends.sharedFolder(secondaryUsername);

    const sharedFolder =
      sharedRoot &&
      (await findChild(
        primaryClient,
        sharedRoot.id,
        (file) => file.name === SHARED_FRIEND_FIXTURE_FOLDER_NAME,
      ));

    const sharedFile =
      sharedFolder &&
      (await findChild(
        primaryClient,
        sharedFolder.id,
        (file) => file.name === SHARED_FRIEND_FIXTURE_FILE_NAME,
      ));

    if (sharedFile) {
      return;
    }

    await sleep(1_000);
  }

  throw new Error(
    `Secondary live account ${secondaryUsername} did not expose the shared fixture folder in time`,
  );
};

export const requireLiveFriendWithSharedFiles = async (
  primaryClient: PutioSdkPromiseClient,
): Promise<Friend> => {
  const { primaryUsername, secondaryUsername } = readFriendUsernames();
  await requireLiveFriend(primaryClient);

  const secondaryClient = await getSecondaryClient();
  const sharedFolder = await ensureSecondarySharedFixture(secondaryClient);

  try {
    await secondaryClient.sharing.shareFiles({
      ids: [sharedFolder.id],
      target: {
        friendNames: [primaryUsername],
        type: "friends",
      },
    });
  } catch (error) {
    if (!isAlreadySharedError(error)) {
      throw error;
    }
  }

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
