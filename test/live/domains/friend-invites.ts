import { bootstrapFirstPartyTokenWithCredentials } from "../support/bootstrap.ts";
import {
  readFirstPartyClientCredentials,
  readSecondaryCredentialFixture,
} from "../support/secrets.ts";
import { createClients, createPromiseClient, createLiveHarness } from "../support/harness.js";

const { authClient, oauthClient } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("friend invites live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

const publicClient = await createPromiseClient();
const secondaryFixture = readSecondaryCredentialFixture();

const requireSecondaryClient = async () => {
  if (!secondaryFixture) {
    throw new Error(
      "Missing secondary live account fixture. Set PUTIO_TEST_SECONDARY_USERNAME and PUTIO_TEST_SECONDARY_PASSWORD before friend-invite positive lookup tests.",
    );
  }

  return bootstrapFirstPartyTokenWithCredentials(
    secondaryFixture,
    readFirstPartyClientCredentials(),
  ).then((token) =>
    createPromiseClient({
      accessToken: token.accessToken,
    }),
  );
};

await run("friend invites list shape", async () => {
  const result = await authClient.friendInvites.list();
  assert(Array.isArray(result.invites), "expected invites array");
  assert(typeof result.remaining_limit === "number", "expected remaining_limit number");
  assert(
    result.invites.every(
      (invite) =>
        typeof invite.code === "string" &&
        typeof invite.created_at === "string" &&
        (invite.user === null ||
          (typeof invite.user.name === "string" &&
            typeof invite.user.avatar_url === "string" &&
            typeof invite.user.created_at === "string" &&
            (invite.user.earned_amount === null || typeof invite.user.earned_amount === "number") &&
            ["CONVERTED", "IN_TRIAL", "TRIAL_ENDED", "TRIAL_NOT_STARTED", "UNKNOWN"].includes(
              invite.user.status,
            ))),
    ),
    "expected normalized friend invite payload",
  );

  return {
    count: result.invites.length,
    remaining_limit: result.remaining_limit,
    unused_count: result.invites.filter((invite) => invite.user === null).length,
  };
});

await run("friend invites positive lookup with secondary fixture", async () => {
  const secondaryClient = await requireSecondaryClient();
  const before = await secondaryClient.friendInvites.list();
  const existing = before.invites.find((invite) => invite.user === null);

  if (!existing) {
    throw new Error(
      "Missing unused secondary friend-invite fixture. Seed one outside the live test before running friend-invite positive lookup.",
    );
  }

  const code = existing.code;
  const invite = await publicClient.auth.getFriendInvite(code);

  assert(typeof invite.inviter === "string" && invite.inviter.length > 0, "expected inviter");
  assert(typeof invite.plan.code === "string" && invite.plan.code.length > 0, "expected plan");

  return {
    code_length: code.length,
    inviter: invite.inviter,
    plan_code: invite.plan.code,
    source: "existing",
  };
});

await run("friend invites list requires restricted scope for oauth token", async () => {
  try {
    await oauthClient.friendInvites.list();
    throw new Error("expected default-scope invite listing to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "friendInvites",
      errorType: "invalid_scope",
      operation: "list",
      statusCode: 401,
    });
  }
});

await run("friend invites create requires restricted scope for oauth token", async () => {
  try {
    await oauthClient.friendInvites.create();
    throw new Error("expected default-scope invite creation to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "friendInvites",
      errorType: "invalid_scope",
      operation: "create",
      statusCode: 401,
    });
  }
});

finish();
