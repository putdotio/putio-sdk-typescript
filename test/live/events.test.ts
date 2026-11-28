import { test } from "vite-plus/test";

import {
  assert,
  assertPresent,
  createLiveTokenClients,
  rejectsWithOperationError,
} from "./support/harness.js";

const { authClient, oauthClient } = createLiveTokenClients();

test("events list decodes known variants", async () => {
  await oauthClient.events.list({
    per_page: 20,
  });
});

test("events list before pagination", async () => {
  const firstPage = await oauthClient.events.list({
    per_page: 3,
  });

  const before = assertPresent(firstPage.events.at(-1), "expected at least one event").id;

  const nextPage = await oauthClient.events.list({
    before,
    per_page: 2,
  });

  assert(
    nextPage.events.every((event) => event.id < before),
    "expected older events",
  );
});

test("events delete requires write scope for oauth token", async () => {
  await rejectsWithOperationError(oauthClient.events.delete(2_147_483_647), {
    domain: "events",
    errorType: "invalid_scope",
    operation: "delete",
    statusCode: 401,
  });
});

test("events clear requires write scope for oauth token", async () => {
  await rejectsWithOperationError(oauthClient.events.clear(), {
    domain: "events",
    errorType: "invalid_scope",
    operation: "clear",
    statusCode: 401,
  });
});

test("events delete missing id is harmless with auth token", async () => {
  const response = await authClient.events.delete(2_147_483_647);

  assert(response.status === "OK", "expected OK delete response");
});

test("events torrent missing id yields typed error", async () => {
  await rejectsWithOperationError(oauthClient.events.getTorrent(2_147_483_647), {
    domain: "events",
    operation: "getTorrent",
    statusCode: 404,
  });
});
