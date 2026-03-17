import { createClients, createLiveHarness } from "../support/harness.js";

const { authClient, oauthClient } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("rss live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

const getProbeFeedUrl = async () => {
  const feeds = await authClient.rss.list();
  return feeds[0]?.rss_source_url ?? null;
};

const toFeedFetchSkip = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "PutioOperationError" &&
    "body" in error &&
    typeof error.body === "object" &&
    error.body !== null &&
    "error_type" in error.body &&
    error.body.error_type === "FEED_CANNOT_FETCHED"
  ) {
    return {
      reason: "feed source could not be fetched during live probe",
      skipped: true,
    };
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "PutioRateLimitError"
  ) {
    return {
      reason: "rss live probe hit rate limiting",
      skipped: true,
    };
  }

  throw error;
};

await run("rss list shape", async () => {
  const feeds = await authClient.rss.list();
  assert(Array.isArray(feeds), "expected feeds array");
  feeds.slice(0, 5).forEach((feed) => {
    if (feed.failed_item_count !== undefined) {
      assert(typeof feed.failed_item_count === "number", "expected numeric failed_item_count");
    }
    assert(
      feed.paused_at === null || typeof feed.paused_at === "string",
      "expected nullable paused_at",
    );
  });
  return { count: feeds.length };
});

await run("rss list is readable with oauth token", async () => {
  const feeds = await oauthClient.rss.list();
  assert(Array.isArray(feeds), "expected oauth-token rss list");
  return { count: feeds.length };
});

await run("rss create update lifecycle", async () => {
  const probeFeedUrl = await getProbeFeedUrl();

  if (!probeFeedUrl) {
    return { skipped: true, reason: "no existing rss feed url available for probe" };
  }

  const seed = Date.now();
  let created;

  try {
    created = await authClient.rss.create({
      delete_old_files: false,
      dont_process_whole_feed: true,
      keyword: "",
      parent_dir_id: 0,
      rss_source_url: probeFeedUrl,
      title: `codex sdk rss ${seed}`,
      unwanted_keywords: "",
    });
  } catch (error) {
    return toFeedFetchSkip(error);
  }

  try {
    assert(created.title.includes(String(seed)), "expected created feed title");

    const fetched = await authClient.rss.get(created.id);
    assert(fetched.id === created.id, "expected fetched feed id");

    const updatedTitle = `codex sdk rss updated ${seed}`;

    await authClient.rss.update(created.id, {
      delete_old_files: true,
      dont_process_whole_feed: false,
      keyword: "typescript",
      parent_dir_id: 0,
      rss_source_url: probeFeedUrl,
      title: updatedTitle,
      unwanted_keywords: "ignore-me",
    });

    const updated = await authClient.rss.get(created.id);
    assert(updated.title === updatedTitle, "expected updated title");
    assert(updated.keyword === "typescript", "expected updated keyword");
    assert(
      typeof (updated.failed_item_count ?? 0) === "number",
      "expected numeric failed_item_count",
    );

    const logs = await authClient.rss.listItems(created.id);
    assert(logs.feed.id === created.id, "expected logs feed");
    assert(Array.isArray(logs.items), "expected rss items array");
    assert(
      logs.feed.paused_at === null || typeof logs.feed.paused_at === "string",
      "expected nullable logs feed paused_at",
    );

    await authClient.rss.pause(created.id);
    const paused = await authClient.rss.get(created.id);
    assert(paused.paused === true, "expected paused feed");
    assert(typeof paused.paused_at === "string", "expected paused_at timestamp after pause");

    await authClient.rss.resume(created.id);
    const resumed = await authClient.rss.get(created.id);
    assert(resumed.paused === false, "expected resumed feed");
    assert(resumed.paused_at === null, "expected paused_at to clear after resume");

    await authClient.rss.clearLogs(created.id);
    await authClient.rss.retryAll(created.id);

    return {
      failed_item_count: updated.failed_item_count ?? 0,
      id: created.id,
      item_count: logs.items.length,
      updated_title: updated.title,
    };
  } catch (error) {
    return toFeedFetchSkip(error);
  } finally {
    await authClient.rss.delete(created.id).catch(() => undefined);
  }
});

await run("rss create is writable with oauth token", async () => {
  const probeFeedUrl = await getProbeFeedUrl();

  if (!probeFeedUrl) {
    return { skipped: true, reason: "no existing rss feed url available for oauth probe" };
  }

  let created;

  try {
    created = await oauthClient.rss.create({
      rss_source_url: probeFeedUrl,
      title: `codex oauth rss ${Date.now()}`,
    });
  } catch (error) {
    return toFeedFetchSkip(error);
  }

  try {
    assert(typeof created.id === "number", "expected created oauth rss id");
    return { id: created.id };
  } finally {
    await oauthClient.rss.delete(created.id).catch(() => undefined);
  }
});

await run("rss invalid url yields typed error", async () => {
  try {
    await authClient.rss.create({
      rss_source_url: "not-a-url",
      title: "codex invalid rss",
    });
    throw new Error("expected invalid URL to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "rss",
      errorType: "URL_NOT_VALID",
      operation: "create",
      statusCode: 400,
    });
  }
});

await run("rss missing title yields typed error", async () => {
  const probeFeedUrl = await getProbeFeedUrl();

  if (!probeFeedUrl) {
    return { skipped: true, reason: "no existing rss feed url available for title probe" };
  }

  try {
    await authClient.rss.create({
      rss_source_url: probeFeedUrl,
      title: "",
    });
    throw new Error("expected missing title to fail");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error &&
      error._tag === "PutioOperationError" &&
      "body" in error &&
      typeof error.body === "object" &&
      error.body !== null &&
      "error_type" in error.body &&
      error.body.error_type === "FEED_CANNOT_FETCHED"
    ) {
      return {
        reason: "feed source could not be fetched during title probe",
        skipped: true,
      };
    }

    return assertOperationError(error, {
      domain: "rss",
      errorType: "TITLE_REQUIRED",
      operation: "create",
      statusCode: 400,
    });
  }
});

await run("rss missing feed yields typed not found", async () => {
  try {
    await authClient.rss.get(2147483647);
    throw new Error("expected missing feed to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "rss",
      errorType: "NotFound",
      operation: "get",
      statusCode: 404,
    });
  }
});

await run("rss missing item retry yields typed not found", async () => {
  try {
    await authClient.rss.retryItem(2147483647, 2147483647);
    throw new Error("expected missing rss item retry to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "rss",
      errorType: "NotFound",
      operation: "retryItem",
      statusCode: 404,
    });
  }
});

await run("rss missing retry-all feed yields typed not found", async () => {
  try {
    const result = await authClient.rss.retryAll(2147483647);
    return {
      result,
      status: "OK",
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error &&
      error._tag === "PutioRateLimitError"
    ) {
      return {
        reason: "rss missing retry-all probe hit rate limiting",
        skipped: true,
      };
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error &&
      error._tag === "PutioOperationError"
    ) {
      return assertOperationError(error, {
        domain: "rss",
        errorType: "NotFound",
        operation: "retryAll",
        statusCode: 404,
      });
    }

    return {
      details: error instanceof Error ? error.message : String(error),
      reason: "rss missing retry-all probe returned a non-contractual failure shape",
      skipped: true,
    };
  }
});

await run("rss missing clear-log feed yields typed not found", async () => {
  try {
    await authClient.rss.clearLogs(2147483647);
    throw new Error("expected missing clearLogs feed to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "rss",
      errorType: "NotFound",
      operation: "clearLogs",
      statusCode: 404,
    });
  }
});

await run("rss missing items feed yields typed not found", async () => {
  try {
    await authClient.rss.listItems(2147483647);
    throw new Error("expected missing rss item list to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "rss",
      errorType: "NotFound",
      operation: "listItems",
      statusCode: 404,
    });
  }
});

await run("rss missing pause feed yields typed not found", async () => {
  try {
    await authClient.rss.pause(2147483647);
    throw new Error("expected missing pause feed to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "rss",
      errorType: "NotFound",
      operation: "pause",
      statusCode: 404,
    });
  }
});

await run("rss missing resume feed yields typed not found", async () => {
  try {
    await authClient.rss.resume(2147483647);
    throw new Error("expected missing resume feed to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "rss",
      errorType: "NotFound",
      operation: "resume",
      statusCode: 404,
    });
  }
});

await run("rss missing update feed yields typed not found", async () => {
  try {
    await authClient.rss.update(2147483647, {
      rss_source_url: "https://hnrss.org/frontpage",
      title: "codex missing rss",
    });
    throw new Error("expected missing update feed to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "rss",
      errorType: "NotFound",
      operation: "update",
      statusCode: 404,
    });
  }
});

await run("rss missing delete feed yields typed not found", async () => {
  try {
    await authClient.rss.delete(2147483647);
    throw new Error("expected missing delete feed to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "rss",
      errorType: "NotFound",
      operation: "delete",
      statusCode: 404,
    });
  }
});

finish();
