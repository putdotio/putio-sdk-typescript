import { test } from "vite-plus/test";

import { assert, createLiveTokenClients, rejectsWithOperationError } from "./support/harness.js";
import { readOptionalSecret } from "./support/secrets.js";

const { authClient, oauthClient } = createLiveTokenClients();

const MISSING_ID = 2147483647;

const requireRssSourceUrl = (): string => {
  const rssSourceUrl = readOptionalSecret("PUTIO_LIVE_RSS_SOURCE_URL");

  if (!rssSourceUrl) {
    throw new Error(
      "Missing required RSS live fixture: PUTIO_LIVE_RSS_SOURCE_URL must point to a known-good fetchable RSS feed.",
    );
  }

  return rssSourceUrl;
};

test("rss list decodes for first-party and oauth tokens", async () => {
  await authClient.rss.list();
  await oauthClient.rss.list();
});

test("rss create update lifecycle", async () => {
  const seed = Date.now();
  const rssSourceUrl = requireRssSourceUrl();

  const created = await authClient.rss.create({
    delete_old_files: false,
    dont_process_whole_feed: true,
    keyword: "",
    parent_dir_id: 0,
    rss_source_url: rssSourceUrl,
    title: `putio-typescript-sdk rss ${seed}`,
    unwanted_keywords: "",
  });

  try {
    assert(created.title.includes(String(seed)), "expected created feed title");

    const fetched = await authClient.rss.get(created.id);
    assert(fetched.id === created.id, "expected fetched feed id");

    const updatedTitle = `putio-typescript-sdk rss updated ${seed}`;

    await authClient.rss.update(created.id, {
      delete_old_files: true,
      dont_process_whole_feed: false,
      keyword: "typescript",
      parent_dir_id: 0,
      rss_source_url: rssSourceUrl,
      title: updatedTitle,
      unwanted_keywords: "ignore-me",
    });

    const updated = await authClient.rss.get(created.id);
    assert(updated.title === updatedTitle, "expected updated title");
    assert(updated.keyword === "typescript", "expected updated keyword");

    const logs = await authClient.rss.listItems(created.id);
    assert(logs.feed.id === created.id, "expected logs feed");

    await authClient.rss.pause(created.id);
    const paused = await authClient.rss.get(created.id);
    assert(paused.paused === true, "expected paused feed");
    assert(paused.paused_at !== null, "expected paused_at timestamp after pause");

    await authClient.rss.resume(created.id);
    const resumed = await authClient.rss.get(created.id);
    assert(resumed.paused === false, "expected resumed feed");
    assert(resumed.paused_at === null, "expected paused_at to clear after resume");

    await authClient.rss.clearLogs(created.id);
    await authClient.rss.retryAll(created.id);
  } finally {
    await authClient.rss.delete(created.id).catch(() => undefined);
  }
});

test("rss create is writable with oauth token", async () => {
  const created = await oauthClient.rss.create({
    rss_source_url: requireRssSourceUrl(),
    title: `putio-typescript-sdk oauth rss ${Date.now()}`,
  });

  await oauthClient.rss.delete(created.id);
});

test("rss invalid url yields typed error", async () => {
  await rejectsWithOperationError(
    authClient.rss.create({
      rss_source_url: "not-a-url",
      title: "putio-typescript-sdk invalid rss",
    }),
    {
      domain: "rss",
      errorType: "URL_NOT_VALID",
      operation: "create",
      statusCode: 400,
    },
  );
});

test.each([
  ["get", () => authClient.rss.get(MISSING_ID)],
  ["retryItem", () => authClient.rss.retryItem(MISSING_ID, MISSING_ID)],
  ["retryAll", () => authClient.rss.retryAll(MISSING_ID)],
  ["clearLogs", () => authClient.rss.clearLogs(MISSING_ID)],
  ["listItems", () => authClient.rss.listItems(MISSING_ID)],
  ["pause", () => authClient.rss.pause(MISSING_ID)],
  ["resume", () => authClient.rss.resume(MISSING_ID)],
  [
    "update",
    () =>
      authClient.rss.update(MISSING_ID, {
        rss_source_url: requireRssSourceUrl(),
        title: "putio-typescript-sdk missing rss",
      }),
  ],
  ["delete", () => authClient.rss.delete(MISSING_ID)],
] as const)("rss %s on a missing feed yields typed not found", async (operation, call) => {
  await rejectsWithOperationError(call(), {
    domain: "rss",
    errorType: "NotFound",
    operation,
    statusCode: 404,
  });
});
