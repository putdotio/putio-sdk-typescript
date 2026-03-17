import { assertPresent, createClients, createLiveHarness } from "../support/harness.js";

const { authClient, oauthClient } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("events live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

await run("events list shape", async () => {
  const result = await oauthClient.events.list({
    per_page: 5,
  });

  assert(Array.isArray(result.events), "expected events array");
  assert(typeof result.has_more === "boolean", "expected has_more boolean");

  return {
    count: result.events.length,
    first_type: result.events[0]?.type ?? null,
    has_more: result.has_more,
  };
});

await run("events known variant payloads stay typed", async () => {
  const result = await oauthClient.events.list({
    per_page: 20,
  });

  const fileShared = result.events.find((event) => event.type === "file_shared");
  if (fileShared) {
    assert("file_id" in fileShared, "expected file_shared.file_id");
    assert("sharing_user_name" in fileShared, "expected file_shared.sharing_user_name");
  }

  const upload = result.events.find((event) => event.type === "upload");
  if (upload) {
    assert("file_id" in upload, "expected upload.file_id");
    assert("file_name" in upload, "expected upload.file_name");
  }

  const transferCompleted = result.events.find((event) => event.type === "transfer_completed");
  if (transferCompleted) {
    assert("transfer_size" in transferCompleted, "expected transfer_completed.transfer_size");
    assert("source" in transferCompleted, "expected transfer_completed.source");
  }

  const zipCreated = result.events.find((event) => event.type === "zip_created");
  if (zipCreated) {
    assert("zip_id" in zipCreated, "expected zip_created.zip_id");
    assert("zip_size" in zipCreated, "expected zip_created.zip_size");
  }

  return {
    has_file_shared: Boolean(fileShared),
    has_transfer_completed: Boolean(transferCompleted),
    has_upload: Boolean(upload),
    has_zip_created: Boolean(zipCreated),
  };
});

await run("events list before pagination", async () => {
  const firstPage = await oauthClient.events.list({
    per_page: 3,
  });

  assert(firstPage.events.length > 0, "expected at least one event");

  const before = firstPage.events[firstPage.events.length - 1].id;
  const nextPage = await oauthClient.events.list({
    before,
    per_page: 2,
  });

  assert(Array.isArray(nextPage.events), "expected next page events");
  assert(
    nextPage.events.every((event) => event.id < before),
    "expected older events",
  );

  return {
    before,
    first_page: firstPage.events.length,
    next_page: nextPage.events.length,
  };
});

await run("events list invalid per_page yields typed error", async () => {
  try {
    await oauthClient.events.list({
      per_page: 0,
    });
    throw new Error("expected invalid per_page to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "events",
      errorType: "INVALID_PER_PAGE",
      operation: "list",
      statusCode: 400,
    });
  }
});

await run("events delete requires write scope for oauth token", async () => {
  try {
    await oauthClient.events.delete(2147483647);
    throw new Error("expected default-scope delete to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "events",
      errorType: "invalid_scope",
      operation: "delete",
      statusCode: 401,
    });
  }
});

await run("events clear requires write scope for oauth token", async () => {
  try {
    await oauthClient.events.clear();
    throw new Error("expected default-scope clear to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "events",
      errorType: "invalid_scope",
      operation: "clear",
      statusCode: 401,
    });
  }
});

await run("events delete missing id is harmless with auth token", async () => {
  const response = await authClient.events.delete(2147483647);
  assert(response.status === "OK", "expected OK delete response");
  return response;
});

await run("events torrent missing id yields typed error", async () => {
  try {
    await oauthClient.events.getTorrent(2147483647);
    throw new Error("expected missing torrent event to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "events",
      operation: "getTorrent",
      statusCode: 404,
    });
  }
});

await run("events torrent for non-upload event currently yields 404", async () => {
  const result = await oauthClient.events.list({
    per_page: 20,
  });
  const nonUpload = assertPresent(
    result.events.find((event) => event.type !== "upload"),
    "expected at least one non-upload event for torrent probe",
  );

  try {
    await oauthClient.events.getTorrent(nonUpload.id);
    throw new Error("expected non-upload torrent lookup to fail");
  } catch (error) {
    return {
      event_type: nonUpload.type,
      id: nonUpload.id,
      ...assertOperationError(error, {
        domain: "events",
        operation: "getTorrent",
        statusCode: 404,
      }),
    };
  }
});

finish();
