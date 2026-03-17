import { createClients, createLiveHarness, expectOperationError } from "../support/harness.js";

const { authClient, oauthClient } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("ifttt live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

await run("ifttt status shape", async () => {
  const status = await authClient.ifttt.getStatus();
  assert(typeof status.enabled === "boolean", "expected boolean IFTTT status");

  return status;
});

await run("ifttt status works with oauth token", async () => {
  const status = await oauthClient.ifttt.getStatus();
  assert(typeof status.enabled === "boolean", "expected boolean IFTTT status");

  return status;
});

await run("ifttt sendEvent negative behavior", async () => {
  const status = await authClient.ifttt.getStatus();

  try {
    await authClient.ifttt.sendEvent({
      eventType: "codex_invalid_event",
      ingredients: {
        file_id: 1,
      },
    });
    throw new Error("expected invalid event type to fail");
  } catch (error) {
    const operationError = expectOperationError(error);
    assert(operationError.domain === "ifttt", "expected ifttt domain");
    assert(operationError.operation === "sendEvent", "expected sendEvent operation");
    assert(
      operationError.status === 400 || operationError.status === 402,
      "expected 400/402 IFTTT failure",
    );
    assert(operationError.reason?.kind === "error_type", "expected typed IFTTT error");
    assert(
      operationError.reason?.errorType === "INVALID_EVENT_TYPE",
      `expected INVALID_EVENT_TYPE, got ${String(operationError.reason?.errorType)}`,
    );

    return {
      enabled: status.enabled,
      error_type: operationError.reason?.errorType,
      status: operationError.status,
    };
  }
});

await run("ifttt sendEvent missing ingredients yields typed 400", async () => {
  try {
    await authClient.ifttt.sendEvent({
      eventType: "playback_started",
      ingredients: {
        file_id: 1,
        file_name: "codex.mp4",
      },
    });
    throw new Error("expected missing ingredients to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "ifttt",
      errorType: "MISSING_INGREDIENTS",
      operation: "sendEvent",
      statusCode: 400,
    });
  }
});

await run("ifttt sendEvent requires restricted scope for oauth token", async () => {
  try {
    await oauthClient.ifttt.sendEvent({
      eventType: "playback_started",
      ingredients: {
        file_id: 1,
        file_name: "codex.mp4",
        file_type: "VIDEO",
      },
    });
    throw new Error("expected app-token ifttt event to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "ifttt",
      errorType: "invalid_scope",
      operation: "sendEvent",
      statusCode: 401,
    });
  }
});

await run("ifttt valid playback event currently succeeds even when disabled", async () => {
  const status = await authClient.ifttt.getStatus();

  await authClient.ifttt.sendEvent({
    eventType: "playback_started",
    ingredients: {
      file_id: 1,
      file_name: "codex.mp4",
      file_type: "VIDEO",
    },
  });

  return {
    enabled: status.enabled,
    sent_event: "playback_started",
  };
});

finish();
