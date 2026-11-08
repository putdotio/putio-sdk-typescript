import { test } from "vite-plus/test";

import {
  assert,
  createLiveTokenClients,
  expectOperationError,
  rejectsWith,
  rejectsWithOperationError,
} from "./support/harness.js";

const { authClient, oauthClient } = createLiveTokenClients();

const PLAYBACK_EVENT = {
  eventType: "playback_started",
  ingredients: {
    file_id: 1,
    file_name: "putio-typescript-sdk.mp4",
    file_type: "VIDEO",
  },
} as const;

test("ifttt status decodes", async () => {
  await authClient.ifttt.getStatus();
});

test("ifttt status works with oauth token", async () => {
  await oauthClient.ifttt.getStatus();
});

test("ifttt sendEvent rejects an unknown event type", async () => {
  const error = await rejectsWith(
    authClient.ifttt.sendEvent({
      eventType: "putio-typescript-sdk-invalid-event",
      ingredients: {
        file_id: 1,
      },
    }),
    expectOperationError,
  );

  assert(error.domain === "ifttt", "expected ifttt domain");
  assert(error.operation === "sendEvent", "expected sendEvent operation");
  assert(error.status === 400 || error.status === 402, "expected 400/402 IFTTT failure");
  assert(error.reason?.kind === "error_type", "expected typed IFTTT error");
  assert(
    error.reason?.errorType === "INVALID_EVENT_TYPE",
    `expected INVALID_EVENT_TYPE, got ${String(error.reason?.errorType)}`,
  );
});

test("ifttt sendEvent requires restricted scope for oauth token", async () => {
  await rejectsWithOperationError(oauthClient.ifttt.sendEvent(PLAYBACK_EVENT), {
    domain: "ifttt",
    errorType: "invalid_scope",
    operation: "sendEvent",
    statusCode: 401,
  });
});

test("ifttt valid playback event succeeds", async () => {
  await authClient.ifttt.sendEvent(PLAYBACK_EVENT);
});
