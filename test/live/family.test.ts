import { test } from "vite-plus/test";

import {
  assert,
  createLiveTokenClients,
  expectOperationError,
  rejectsWith,
  rejectsWithOperationError,
} from "./support/harness.js";

const { authClient, oauthClient } = createLiveTokenClients();

const KNOWN_JOIN_ERROR_TYPES = new Set([
  "FAMILY_INVITE_ACTIVE_USER",
  "FAMILY_INVITE_ANOTHER_FAMILY",
  "FAMILY_INVITE_INVALID_CODE",
  "FAMILY_INVITE_OWNER_NOT_FOUND",
  "FAMILY_INVITE_OWNER_NOT_ACTIVE",
  "FAMILY_INVITE_OWNER_NO_LIMIT",
  "FAMILY_LIMIT_EXCEEDED",
]);

test("family members decode", async () => {
  await authClient.family.listMembers();
});

test("family members require restricted scope for oauth token", async () => {
  await rejectsWithOperationError(oauthClient.family.listMembers(), {
    domain: "family",
    errorType: "invalid_scope",
    operation: "listMembers",
    statusCode: 401,
  });
});

test("family invites decode", async () => {
  await authClient.family.listInvites();
});

test("family invites require restricted scope for oauth token", async () => {
  await rejectsWithOperationError(oauthClient.family.listInvites(), {
    domain: "family",
    errorType: "invalid_scope",
    operation: "listInvites",
    statusCode: 401,
  });
});

test("family create invite requires restricted scope", async () => {
  await rejectsWithOperationError(oauthClient.family.createInvite(), {
    domain: "family",
    errorType: "invalid_scope",
    operation: "createInvite",
    statusCode: 401,
  });
});

test("family remove missing member yields 404", async () => {
  await rejectsWithOperationError(
    authClient.family.removeMember("putio-typescript-sdk-no-such-family-member"),
    {
      domain: "family",
      operation: "removeMember",
      statusCode: 404,
    },
  );
});

test("family remove member requires restricted scope for oauth token", async () => {
  await rejectsWithOperationError(
    oauthClient.family.removeMember("putio-typescript-sdk-no-such-family-member"),
    {
      domain: "family",
      errorType: "invalid_scope",
      operation: "removeMember",
      statusCode: 401,
    },
  );
});

test("family join bogus code yields known 403", async () => {
  const error = await rejectsWith(
    authClient.family.join("putio-typescript-sdk-invalid-family-code"),
    expectOperationError,
  );

  assert(error.domain === "family", "expected family domain");
  assert(error.operation === "join", "expected join operation");
  assert(error.status === 403, "expected join failure status 403");
  assert(error.reason?.kind === "error_type", "expected typed join error");
  assert(
    KNOWN_JOIN_ERROR_TYPES.has(String(error.reason?.errorType)),
    `expected known family join error type, got ${String(error.reason?.errorType)}`,
  );
});

test("family join requires restricted scope for oauth token", async () => {
  await rejectsWithOperationError(
    oauthClient.family.join("putio-typescript-sdk-invalid-family-code"),
    {
      domain: "family",
      errorType: "invalid_scope",
      operation: "join",
      statusCode: 401,
    },
  );
});
