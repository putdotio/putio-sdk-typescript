import { test } from "vite-plus/test";

import { requireLiveFriend, requireLiveFriendWithSharedFiles } from "./support/friends.js";
import {
  assert,
  assertPresent,
  createLiveTokenClients,
  rejectsWithOperationError,
} from "./support/harness.js";

const { authClient, oauthClient } = createLiveTokenClients();

test("friends list total covers the returned friends", async () => {
  const result = await authClient.friends.list();

  assert(result.total >= result.friends.length, "expected total >= friends length");
});

test("friends waiting request list and count agree", async () => {
  const [friends, count] = await Promise.all([
    authClient.friends.listWaitingRequests(),
    authClient.friends.countWaitingRequests(),
  ]);

  assert(friends.length === count, "expected waiting request count to match list");
});

test("friends sent requests decode", async () => {
  await authClient.friends.listSentRequests();
});

test("friends search excludes existing friend", async () => {
  const friend = await requireLiveFriend(authClient);
  const users = await authClient.friends.search(friend.name);

  assert(
    !users.some((user) => user.name === friend.name),
    "expected existing friend to be excluded from search",
  );
});

test("friends search requires restricted scope for oauth token", async () => {
  const friend = await requireLiveFriend(authClient);

  await rejectsWithOperationError(oauthClient.friends.search(friend.name), {
    domain: "friends",
    errorType: "invalid_scope",
    operation: "search",
    statusCode: 401,
  });
});

test("friends shared folder is a shared friend folder", async () => {
  const friend = await requireLiveFriendWithSharedFiles(authClient);

  const file = assertPresent(
    await authClient.friends.sharedFolder(friend.name),
    "expected shared folder",
  );

  assert(file.folder_type === "SHARED_FRIEND", "expected shared friend folder");
});

test("friends missing shared folder yields typed not found", async () => {
  await rejectsWithOperationError(authClient.friends.sharedFolder("does-not-exist"), {
    domain: "friends",
    errorType: "NotFound",
    operation: "sharedFolder",
    statusCode: 404,
  });
});

test("friends shared folder is readable with oauth token", async () => {
  const friend = await requireLiveFriendWithSharedFiles(authClient);

  assertPresent(
    await oauthClient.friends.sharedFolder(friend.name),
    "expected oauth token shared folder",
  );
});

test("friends invalid request target yields typed user not found", async () => {
  await rejectsWithOperationError(authClient.friends.sendRequest("does-not-exist"), {
    domain: "friends",
    errorType: "USER_NOT_FOUND",
    operation: "sendRequest",
    statusCode: 404,
  });
});

test("friends invalid approve target yields typed user not found", async () => {
  await rejectsWithOperationError(authClient.friends.approve("does-not-exist"), {
    domain: "friends",
    errorType: "USER_NOT_FOUND",
    operation: "approve",
    statusCode: 404,
  });
});

test("friends invalid deny target yields typed user not found", async () => {
  await rejectsWithOperationError(authClient.friends.deny("does-not-exist"), {
    domain: "friends",
    errorType: "USER_NOT_FOUND",
    operation: "deny",
    statusCode: 404,
  });
});

test("friends invalid remove target yields typed user not found", async () => {
  await rejectsWithOperationError(authClient.friends.remove("does-not-exist"), {
    domain: "friends",
    errorType: "USER_NOT_FOUND",
    operation: "remove",
    statusCode: 404,
  });
});
