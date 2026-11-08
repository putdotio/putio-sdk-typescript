import { test } from "vite-plus/test";

import { createLiveTokenClients, rejectsWithOperationError } from "./support/harness.js";

const { authClient, oauthClient } = createLiveTokenClients();

test("friend invites list decodes", async () => {
  await authClient.friendInvites.list();
});

test("friend invites list requires restricted scope for oauth token", async () => {
  await rejectsWithOperationError(oauthClient.friendInvites.list(), {
    domain: "friendInvites",
    errorType: "invalid_scope",
    operation: "list",
    statusCode: 401,
  });
});

test("friend invites create requires restricted scope for oauth token", async () => {
  await rejectsWithOperationError(oauthClient.friendInvites.create(), {
    domain: "friendInvites",
    errorType: "invalid_scope",
    operation: "create",
    statusCode: 401,
  });
});
