import { assertPresent, createClients, createLiveHarness } from "../support/harness.js";

const { client } = await createClients({
  client: "PUTIO_TOKEN_THIRD_PARTY",
});
const probeFileId = 1165541233;

const live = createLiveHarness("download-links live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

const waitForDone = async (id: number) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await client.downloadLinks.get(id);

    if (result.links_status === "DONE" || result.links_status === "ERROR") {
      return result;
    }

    await sleep(1000);
  }

  throw new Error("timed out waiting for download links task to settle");
};

await run("download links create and fetch", async () => {
  const created = await client.downloadLinks.create({
    ids: [probeFileId],
  });

  assert(typeof created.id === "number", "expected download links task id");

  const first = await client.downloadLinks.get(created.id);
  if (first.links_status === "NEW" || first.links_status === "PROCESSING") {
    assert(first.links === null, "expected pending download links payload to keep links null");
  } else if (first.links_status === "DONE") {
    assert(Array.isArray(first.links.download_links), "expected DONE download links array");
  } else {
    assert(
      typeof first.error_msg === "string",
      "expected error message for errored download links",
    );
  }

  const result = await waitForDone(created.id);
  assert(result.links_status === "DONE", "expected links_status DONE");
  const links = assertPresent(result.links, "expected completed links payload");
  assert(links.download_links.length > 0, "expected download links");
  assert(
    links.download_links.every((url) => typeof url === "string"),
    "expected string download links",
  );
  assert(
    links.media_links.every((url) => typeof url === "string"),
    "expected string media links",
  );
  assert(
    links.mp4_links.every((url) => typeof url === "string"),
    "expected string mp4 links",
  );

  return {
    download_count: links.download_links.length,
    first_status: first.links_status,
    id: created.id,
    media_count: links.media_links.length,
    mp4_count: links.mp4_links.length,
  };
});

await run("download links repeated create reuses cached task id", async () => {
  const first = await client.downloadLinks.create({
    ids: [probeFileId],
  });
  const second = await client.downloadLinks.create({
    ids: [probeFileId],
  });

  assert(first.id === second.id, "expected repeated identical request to reuse cached task id");

  return {
    id: first.id,
  };
});

await run("download links create supports cursor and exclude ids", async () => {
  const listing = await client.files.list(0, {
    per_page: 1,
  });

  if (!listing.cursor || listing.files.length === 0) {
    return { skipped: true, reason: "no cursor-capable root listing available" };
  }

  const created = await client.downloadLinks.create({
    cursor: listing.cursor,
    excludeIds: [listing.files[0].id],
  });

  const result = await waitForDone(created.id);
  assert(result.links_status === "DONE", "expected cursor download links task to finish");
  const links = assertPresent(result.links, "expected cursor links payload");
  assert(Array.isArray(links.download_links), "expected download links from cursor task");

  return {
    excluded_id: listing.files[0].id,
    id: created.id,
    link_count: links.download_links.length,
  };
});

await run("download links empty request yields typed bad request", async () => {
  try {
    await client.downloadLinks.create();
    throw new Error("expected empty create request to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "downloadLinks",
      errorType: "BadRequest",
      operation: "create",
      statusCode: 400,
    });
  }
});

await run("download links invalid file id yields typed bad request", async () => {
  try {
    await client.downloadLinks.create({
      ids: [2147483647],
    });
    throw new Error("expected invalid file id create request to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "downloadLinks",
      errorType: "BadRequest",
      operation: "create",
      statusCode: 400,
    });
  }
});

await run("download links missing task yields typed not found", async () => {
  try {
    await client.downloadLinks.get(2147483647);
    throw new Error("expected missing links task to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "downloadLinks",
      errorType: "LINKS_NOT_FOUND",
      operation: "get",
      statusCode: 404,
    });
  }
});

finish();
