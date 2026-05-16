import {
  assertPresent,
  createClients,
  createLiveHarness,
  isFileUploadFileResult,
} from "../support/harness.js";

const { client } = await createClients({
  client: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("download-links live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

const isRateLimitError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "PutioRateLimitError";

const retryOnRateLimit = async <T>(operation: () => Promise<T>): Promise<T> => {
  let rateLimitError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRateLimitError(error)) {
        throw error;
      }

      rateLimitError = error;
      await sleep(2_000 * (attempt + 1));
    }
  }

  throw rateLimitError;
};

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

type ProbeFile = {
  readonly cleanupIds: readonly number[];
  readonly id: number;
};

const cleanupProbeFiles = async (ids: readonly number[]): Promise<void> => {
  if (ids.length === 0) {
    return;
  }

  await client.files.delete(ids, { skipTrash: true }).catch(() => undefined);
};

const findProbeFile = async (): Promise<ProbeFile> => {
  const root = await client.files.list(0, {
    per_page: 20,
  });
  const owned = root.files.find((file) => file.file_type !== "FOLDER");

  if (owned) {
    return { cleanupIds: [], id: owned.id };
  }

  const shared = await client.files.list("friends", {
    per_page: 20,
  });
  const sharedFile = shared.files.find((file) => file.file_type !== "FOLDER");

  if (sharedFile) {
    return { cleanupIds: [], id: sharedFile.id };
  }

  const upload = await client.files.upload({
    file: new File(["sdk download-links probe\n"], `codex_sdk_download_links_${Date.now()}.txt`, {
      type: "text/plain",
    }),
    parentId: 0,
  });

  if (!isFileUploadFileResult(upload)) {
    throw new Error("expected download-links probe upload to return a file");
  }

  return { cleanupIds: [upload.file.id], id: upload.file.id };
};

const createCursorProbeFiles = async () => {
  const ids: number[] = [];

  for (let index = 0; index < 2; index += 1) {
    const name = `codex_sdk_download_links_cursor_${Date.now()}_${index}.txt`;
    const upload = await client.files.upload({
      file: new File([`sdk download-links cursor probe ${index}\n`], name, {
        type: "text/plain",
      }),
      fileName: name,
      parentId: 0,
    });

    if (!isFileUploadFileResult(upload)) {
      throw new Error("expected download-links cursor probe upload to return a file");
    }

    ids.push(upload.file.id);
  }

  return ids;
};

await run("download links create and fetch", async () => {
  const probeFile = await findProbeFile();

  try {
    const created = await client.downloadLinks.create({
      ids: [probeFile.id],
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
  } finally {
    await cleanupProbeFiles(probeFile.cleanupIds);
  }
});

await run("download links repeated create reuses cached task id", async () => {
  const probeFile = await findProbeFile();

  try {
    const first = await client.downloadLinks.create({
      ids: [probeFile.id],
    });
    const second = await client.downloadLinks.create({
      ids: [probeFile.id],
    });

    assert(first.id === second.id, "expected repeated identical request to reuse cached task id");

    return {
      id: first.id,
    };
  } finally {
    await cleanupProbeFiles(probeFile.cleanupIds);
  }
});

await run("download links create supports cursor and exclude ids", async () => {
  const cleanupIds = await createCursorProbeFiles();

  try {
    const listing = await client.files.list(0, {
      per_page: 1,
    });

    if (!listing.cursor || listing.files.length === 0) {
      throw new Error("expected cursor-capable root listing");
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
  } finally {
    await client.files.delete(cleanupIds, { skipTrash: true }).catch(() => undefined);
  }
});

await run("download links empty request yields typed bad request", async () => {
  try {
    await retryOnRateLimit(() => client.downloadLinks.create());
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
    await retryOnRateLimit(() =>
      client.downloadLinks.create({
        ids: [2147483647],
      }),
    );
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
