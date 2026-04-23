import { assertPresent, createClients, createLiveHarness } from "../support/harness.js";
import { findLiveFriend, liveFriendFixtureSkip } from "../support/friends.js";

const { authClient, oauthClient } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("friends live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

await run("friends list shape", async () => {
  const result = await authClient.friends.list();
  assert(Array.isArray(result.friends), "expected friends array");
  assert(typeof result.total === "number", "expected total number");
  assert(result.total >= result.friends.length, "expected total >= friends length");
  assert(
    result.friends.every(
      (friend) =>
        typeof friend.id === "number" &&
        typeof friend.name === "string" &&
        typeof friend.avatar_url === "string" &&
        typeof friend.has_shared_files === "boolean" &&
        typeof friend.has_received_files === "boolean",
    ),
    "expected normalized friend rows",
  );

  return {
    first_friend: result.friends[0]?.name ?? null,
    total: result.total,
  };
});

await run("friends waiting request list and count agree", async () => {
  const [friends, count] = await Promise.all([
    authClient.friends.listWaitingRequests(),
    authClient.friends.countWaitingRequests(),
  ]);

  assert(Array.isArray(friends), "expected waiting requests array");
  assert(friends.length === count, "expected waiting request count to match list");
  assert(
    friends.every(
      (friend) =>
        typeof friend.id === "number" &&
        typeof friend.name === "string" &&
        typeof friend.avatar_url === "string",
    ),
    "expected normalized waiting request rows",
  );

  return { count };
});

await run("friends sent requests shape", async () => {
  const friends = await authClient.friends.listSentRequests();
  assert(Array.isArray(friends), "expected sent requests array");
  assert(
    friends.every(
      (friend) =>
        typeof friend.id === "number" &&
        typeof friend.name === "string" &&
        typeof friend.avatar_url === "string",
    ),
    "expected normalized sent request rows",
  );
  return { count: friends.length };
});

await run("friends search excludes existing friend", async () => {
  const friend = await findLiveFriend(authClient);

  if (!friend) {
    return liveFriendFixtureSkip("no existing friend fixture available");
  }

  const users = await authClient.friends.search(friend.name);
  assert(Array.isArray(users), "expected search array");
  assert(
    !users.some((user) => user.name === friend.name),
    "expected existing friend to be excluded from search",
  );
  return { count: users.length, friend: friend.name };
});

await run("friends search requires restricted scope for oauth token", async () => {
  const friend = await findLiveFriend(authClient);
  const query = friend?.name ?? "altay";

  try {
    await oauthClient.friends.search(query);
    throw new Error("expected default-scope search to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "friends",
      errorType: "invalid_scope",
      operation: "search",
      statusCode: 401,
    });
  }
});

await run("friends shared folder shape", async () => {
  const friend = await findLiveFriend(authClient, (candidate) => candidate.has_shared_files);

  if (!friend) {
    return liveFriendFixtureSkip("no friend with shared files available");
  }

  const file = assertPresent(
    await authClient.friends.sharedFolder(friend.name),
    "expected shared folder",
  );
  assert(typeof file.id === "number", "expected shared friend root id");
  assert(file.folder_type === "SHARED_FRIEND", "expected shared friend folder");
  return {
    friend: friend.name,
    id: file.id,
    name: file.name,
  };
});

await run("friends missing shared folder yields typed not found", async () => {
  try {
    await authClient.friends.sharedFolder("does-not-exist");
    throw new Error("expected missing friend shared folder to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "friends",
      errorType: "NotFound",
      operation: "sharedFolder",
      statusCode: 404,
    });
  }
});

await run("friends shared folder is readable with oauth token", async () => {
  const friend = await findLiveFriend(authClient, (candidate) => candidate.has_shared_files);

  if (!friend) {
    return liveFriendFixtureSkip("no friend with shared files available");
  }

  const file = assertPresent(
    await oauthClient.friends.sharedFolder(friend.name),
    "expected oauth token shared folder",
  );
  assert(typeof file.id === "number", "expected shared friend root id for oauth token");
  return {
    friend: friend.name,
    id: file.id,
    name: file.name,
  };
});

await run("friends invalid request target yields typed user not found", async () => {
  try {
    await authClient.friends.sendRequest("does-not-exist");
    throw new Error("expected invalid friend request target to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "friends",
      errorType: "USER_NOT_FOUND",
      operation: "sendRequest",
      statusCode: 404,
    });
  }
});

await run("friends invalid approve target yields typed user not found", async () => {
  try {
    await authClient.friends.approve("does-not-exist");
    throw new Error("expected invalid approve target to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "friends",
      errorType: "USER_NOT_FOUND",
      operation: "approve",
      statusCode: 404,
    });
  }
});

await run("friends invalid deny target yields typed user not found", async () => {
  try {
    await authClient.friends.deny("does-not-exist");
    throw new Error("expected invalid deny target to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "friends",
      errorType: "USER_NOT_FOUND",
      operation: "deny",
      statusCode: 404,
    });
  }
});

await run("friends invalid remove target yields typed user not found", async () => {
  try {
    await authClient.friends.remove("does-not-exist");
    throw new Error("expected invalid remove target to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "friends",
      errorType: "USER_NOT_FOUND",
      operation: "remove",
      statusCode: 404,
    });
  }
});

finish();
