import { bootstrapFirstPartyTokenWithCredentials } from "../support/bootstrap.ts";
import {
  readFirstPartyClientCredentials,
  readSecondaryCredentialFixture,
} from "../support/secrets.ts";
import {
  assertPresent,
  createClients,
  createPromiseClient,
  createLiveHarness,
  expectOperationError,
} from "../support/harness.js";

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

const isFriendInviteRestriction = (
  error: unknown,
): error is ReturnType<typeof expectOperationError> & {
  readonly reason: {
    readonly errorType: "FRIEND_INVITATION_NOT_ALLOWED";
    readonly kind: "error_type";
  };
} => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const operationError = error as ReturnType<typeof expectOperationError>;
  return (
    operationError._tag === "PutioOperationError" &&
    operationError.domain === "friendInvites" &&
    operationError.operation === "create" &&
    operationError.reason?.kind === "error_type" &&
    operationError.reason.errorType === "FRIEND_INVITATION_NOT_ALLOWED" &&
    operationError.status === 403
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

await run("friend invites create reflects current fixture restriction", async () => {
  const before = await authClient.friendInvites.list();

  assert(before.remaining_limit > 0, "expected remaining friend invite capacity");

  try {
    const created = await authClient.friendInvites.create();
    assert(typeof created.code === "string" && created.code.length > 0, "expected invite code");

    const after = await authClient.friendInvites.list();
    const createdInvite = assertPresent(
      after.invites.find((invite) => invite.code === created.code),
      "expected created invite to appear in friend invite listing",
    );
    assert(createdInvite.user === null, "expected reusable friend invite to remain unused");
    assert(
      after.remaining_limit === before.remaining_limit - 1,
      "expected remaining friend invite limit to decrement after create",
    );

    return {
      code_length: created.code.length,
      mode: "created",
      remaining_limit: after.remaining_limit,
    };
  } catch (error) {
    return assertOperationError(error, {
      domain: "friendInvites",
      errorType: "FRIEND_INVITATION_NOT_ALLOWED",
      operation: "create",
      statusCode: 403,
    });
  }
});

await run("friend invites positive lookup with secondary fixture when available", async () => {
  if (!secondaryFixture) {
    return {
      skipped: "secondary friend-invite fixture is not configured",
    };
  }

  const secondaryToken = await bootstrapFirstPartyTokenWithCredentials(
    secondaryFixture,
    readFirstPartyClientCredentials(),
  );
  const secondaryClient = await createPromiseClient({
    accessToken: secondaryToken.accessToken,
  });

  const before = await secondaryClient.friendInvites.list();

  if (before.remaining_limit <= 0) {
    return {
      remaining_limit: before.remaining_limit,
      skipped: "secondary fixture has no remaining friend invite capacity",
    };
  }

  try {
    const created = await secondaryClient.friendInvites.create();
    const invite = await publicClient.auth.getFriendInvite(created.code);

    assert(typeof invite.inviter === "string" && invite.inviter.length > 0, "expected inviter");
    assert(typeof invite.plan.code === "string" && invite.plan.code.length > 0, "expected plan");

    return {
      code_length: created.code.length,
      inviter: invite.inviter,
      plan_code: invite.plan.code,
    };
  } catch (error) {
    if (isFriendInviteRestriction(error)) {
      return {
        error_type: error.reason.errorType,
        skipped: "secondary fixture is also invite-restricted",
        status: error.status,
      };
    }

    throw error;
  }
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
