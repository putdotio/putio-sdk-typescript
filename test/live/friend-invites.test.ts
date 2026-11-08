import { test } from "vite-plus/test";

import { createPutioSdkPromiseClient } from "../../dist/index.js";
import { getSecondaryClient } from "./support/bootstrap.js";
import { assert, createLiveTokenClients, rejectsWithOperationError } from "./support/harness.js";

const { authClient, oauthClient } = createLiveTokenClients();
const publicClient = createPutioSdkPromiseClient();

test("friend invites list decodes", async () => {
  await authClient.friendInvites.list();
});

test("friend invites positive lookup with secondary fixture", async () => {
  const secondaryClient = await getSecondaryClient();
  const before = await secondaryClient.friendInvites.list();
  const existing = before.invites.find((invite) => invite.user === null);

  if (!existing) {
    throw new Error(
      "Missing unused secondary friend-invite fixture. Seed one outside the live test before running friend-invite positive lookup.",
    );
  }

  const invite = await publicClient.auth.getFriendInvite(existing.code);

  assert(invite.inviter.length > 0, "expected inviter");
  assert(invite.plan.code.length > 0, "expected plan");
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
