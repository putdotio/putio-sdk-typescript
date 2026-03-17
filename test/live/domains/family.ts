import { bootstrapFirstPartyTokenWithCredentials } from "../support/bootstrap.ts";
import {
  readFirstPartyClientCredentials,
  readSecondaryCredentialFixture,
} from "../support/secrets.ts";
import {
  createClients,
  createPromiseClient,
  createLiveHarness,
  expectOperationError,
} from "../support/harness.js";

const { authClient, oauthClient } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("family live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

const publicClient = await createPromiseClient();
const secondaryFixture = readSecondaryCredentialFixture();

const isFamilyCreateInviteRestriction = (
  error: unknown,
): error is ReturnType<typeof expectOperationError> & {
  readonly reason: {
    readonly errorType: "FAMILY_SUB_ACCOUNT_LIMIT_EXCEEDED" | "FAMILY_UNUSED_INVITE_LIMIT_EXCEEDED";
    readonly kind: "error_type";
  };
} => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const operationError = error as ReturnType<typeof expectOperationError>;
  return (
    operationError._tag === "PutioOperationError" &&
    operationError.domain === "family" &&
    operationError.operation === "createInvite" &&
    operationError.status === 403 &&
    operationError.reason?.kind === "error_type" &&
    (operationError.reason.errorType === "FAMILY_SUB_ACCOUNT_LIMIT_EXCEEDED" ||
      operationError.reason.errorType === "FAMILY_UNUSED_INVITE_LIMIT_EXCEEDED")
  );
};

await run("family members shape", async () => {
  const members = await authClient.family.listMembers();
  assert(Array.isArray(members), "expected family members array");
  assert(
    members.every(
      (member) =>
        typeof member.id === "number" &&
        typeof member.name === "string" &&
        typeof member.avatar_url === "string" &&
        typeof member.created_at === "string" &&
        typeof member.disk_used === "number" &&
        typeof member.is_owner === "boolean",
    ),
    "expected normalized family member payload",
  );

  return {
    count: members.length,
    owner_count: members.filter((member) => member.is_owner).length,
  };
});

await run("family members require restricted scope for oauth token", async () => {
  try {
    await oauthClient.family.listMembers();
    throw new Error("expected listMembers with app token to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "family",
      errorType: "invalid_scope",
      operation: "listMembers",
      statusCode: 401,
    });
  }
});

await run("family invites shape", async () => {
  const invites = await authClient.family.listInvites();
  assert(Array.isArray(invites.invites), "expected family invites array");
  assert(typeof invites.limit === "number", "expected family invite limit");
  assert(typeof invites.remaining_limit === "number", "expected family remaining limit");
  assert(
    invites.invites.every(
      (invite) =>
        typeof invite.code === "string" &&
        typeof invite.created_at === "string" &&
        (invite.user_id === null || typeof invite.user_id === "number"),
    ),
    "expected normalized family invite payload",
  );

  return {
    claimed_count: invites.invites.filter((invite) => invite.user_id !== null).length,
    count: invites.invites.length,
    limit: invites.limit,
    remaining_limit: invites.remaining_limit,
    unused_count: invites.invites.filter((invite) => invite.user_id === null).length,
  };
});

await run("family invites require restricted scope for oauth token", async () => {
  try {
    await oauthClient.family.listInvites();
    throw new Error("expected listInvites with app token to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "family",
      errorType: "invalid_scope",
      operation: "listInvites",
      statusCode: 401,
    });
  }
});

await run("family create invite requires restricted scope", async () => {
  try {
    await oauthClient.family.createInvite();
    throw new Error("expected createInvite with app token to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "family",
      errorType: "invalid_scope",
      operation: "createInvite",
      statusCode: 401,
    });
  }
});

await run("family create invite reflects current fixture restriction", async () => {
  const invites = await authClient.family.listInvites();

  if (invites.remaining_limit > 0) {
    return {
      remaining_limit: invites.remaining_limit,
      skipped: "family fixture currently still has invite capacity",
    };
  }

  try {
    await authClient.family.createInvite();
    throw new Error("expected createInvite to fail for the current family fixture");
  } catch (error) {
    const operationError = expectOperationError(error);
    assert(operationError.domain === "family", "expected family domain");
    assert(operationError.operation === "createInvite", "expected createInvite operation");
    assert(operationError.status === 403, "expected restricted family createInvite status 403");
    assert(operationError.reason?.kind === "error_type", "expected typed createInvite error");

    const allowed = new Set([
      "FAMILY_SUB_ACCOUNT_LIMIT_EXCEEDED",
      "FAMILY_UNUSED_INVITE_LIMIT_EXCEEDED",
    ]);

    assert(
      allowed.has(String(operationError.reason?.errorType)),
      `expected known family createInvite restriction error, got ${String(operationError.reason?.errorType)}`,
    );

    return {
      error_type: operationError.reason?.errorType,
      remaining_limit: invites.remaining_limit,
      status: operationError.status,
    };
  }
});

await run("family positive invite lookup with secondary fixture when available", async () => {
  if (!secondaryFixture) {
    return {
      skipped: "secondary family fixture is not configured",
    };
  }

  const secondaryToken = await bootstrapFirstPartyTokenWithCredentials(
    secondaryFixture,
    readFirstPartyClientCredentials(),
  );
  const secondaryClient = await createPromiseClient({
    accessToken: secondaryToken.accessToken,
  });

  const invites = await secondaryClient.family.listInvites();

  if (invites.remaining_limit <= 0) {
    return {
      remaining_limit: invites.remaining_limit,
      skipped: "secondary fixture has no remaining family invite capacity",
    };
  }

  try {
    const created = await secondaryClient.family.createInvite();
    const invite = await publicClient.auth.getFamilyInvite(created.code);

    assert(typeof invite.owner === "string" && invite.owner.length > 0, "expected invite owner");
    assert(typeof invite.plan === "string" && invite.plan.length > 0, "expected invite plan");

    return {
      code_length: created.code.length,
      owner: invite.owner,
      plan: invite.plan,
    };
  } catch (error) {
    if (isFamilyCreateInviteRestriction(error)) {
      return {
        error_type: error.reason.errorType,
        skipped: "secondary fixture is also family-invite restricted",
        status: error.status,
      };
    }

    throw error;
  }
});

await run("family remove missing member yields 404", async () => {
  try {
    await authClient.family.removeMember("codex-no-such-family-member");
    throw new Error("expected remove missing family member to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "family",
      operation: "removeMember",
      statusCode: 404,
    });
  }
});

await run("family remove member requires restricted scope for oauth token", async () => {
  try {
    await oauthClient.family.removeMember("codex-no-such-family-member");
    throw new Error("expected app-token removeMember to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "family",
      errorType: "invalid_scope",
      operation: "removeMember",
      statusCode: 401,
    });
  }
});

await run("family join bogus code yields known 403", async () => {
  try {
    await authClient.family.join("codex-invalid-family-code");
    throw new Error("expected join with bogus code to fail");
  } catch (error) {
    const operationError = expectOperationError(error);
    assert(operationError.domain === "family", "expected family domain");
    assert(operationError.operation === "join", "expected join operation");
    assert(operationError.status === 403, "expected join failure status 403");
    assert(operationError.reason?.kind === "error_type", "expected typed join error");

    const allowed = new Set([
      "FAMILY_INVITE_ACTIVE_USER",
      "FAMILY_INVITE_ANOTHER_FAMILY",
      "FAMILY_INVITE_INVALID_CODE",
      "FAMILY_INVITE_OWNER_NOT_FOUND",
      "FAMILY_INVITE_OWNER_NOT_ACTIVE",
      "FAMILY_INVITE_OWNER_NO_LIMIT",
      "FAMILY_LIMIT_EXCEEDED",
    ]);

    assert(
      allowed.has(String(operationError.reason?.errorType)),
      `expected known family join error type, got ${String(operationError.reason?.errorType)}`,
    );

    return {
      error_type: operationError.reason?.errorType,
      status: operationError.status,
    };
  }
});

await run("family join requires restricted scope for oauth token", async () => {
  try {
    await oauthClient.family.join("codex-invalid-family-code");
    throw new Error("expected join with app token to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "family",
      errorType: "invalid_scope",
      operation: "join",
      statusCode: 401,
    });
  }
});

finish();
