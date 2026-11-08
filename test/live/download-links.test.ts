import { Predicate } from "effect";
import { test } from "vite-plus/test";

import {
  assert,
  assertPresent,
  createLiveTokenClients,
  isFileUploadFileResult,
  rejectsWithOperationError,
  sleep,
} from "./support/harness.js";

const { oauthClient: client } = createLiveTokenClients();

const isRateLimitError = Predicate.isTagged("PutioRateLimitError");

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
    file: new File(
      ["sdk download-links probe\n"],
      `putio-typescript-sdk-download-links-${Date.now()}.txt`,
      {
        type: "text/plain",
      },
    ),
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
    const name = `putio-typescript-sdk-download-links-cursor-${Date.now()}-${index}.txt`;

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

test("download links create and fetch", async () => {
  const probeFile = await findProbeFile();

  try {
    const created = await client.downloadLinks.create({
      ids: [probeFile.id],
    });

    const result = await waitForDone(created.id);
    assert(result.links_status === "DONE", "expected links_status DONE");

    const links = assertPresent(result.links, "expected completed links payload");
    assert(links.download_links.length > 0, "expected download links");
  } finally {
    await cleanupProbeFiles(probeFile.cleanupIds);
  }
});

test("download links repeated create reuses cached task id", async () => {
  const probeFile = await findProbeFile();

  try {
    const first = await client.downloadLinks.create({
      ids: [probeFile.id],
    });

    const second = await client.downloadLinks.create({
      ids: [probeFile.id],
    });

    assert(first.id === second.id, "expected repeated identical request to reuse cached task id");
  } finally {
    await cleanupProbeFiles(probeFile.cleanupIds);
  }
});

test("download links create supports cursor and exclude ids", async () => {
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
  } finally {
    await client.files.delete(cleanupIds, { skipTrash: true }).catch(() => undefined);
  }
});

test("download links invalid file id yields typed bad request", async () => {
  await rejectsWithOperationError(
    retryOnRateLimit(() =>
      client.downloadLinks.create({
        ids: [2147483647],
      }),
    ),
    {
      domain: "downloadLinks",
      errorType: "BadRequest",
      operation: "create",
      statusCode: 400,
    },
  );
});

test("download links missing task yields typed not found", async () => {
  await rejectsWithOperationError(client.downloadLinks.get(2147483647), {
    domain: "downloadLinks",
    errorType: "LINKS_NOT_FOUND",
    operation: "get",
    statusCode: 404,
  });
});
