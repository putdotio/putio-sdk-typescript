import {
  assertPresent,
  createClients,
  createLiveHarness,
  isFileUploadFileResult,
} from "../support/harness.js";
import { createStoredZipFile } from "../support/binary-fixtures.ts";
import { requireOwnedVideoFixture } from "../support/media.ts";

const { authClient, client } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  client: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("file-tasks live");
const { assert, assertOperationError, finish, run, sleep } = live;

const waitForExtractionTerminalState = async (id: number) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const extraction = (await client.files.listExtractions()).find((item) => item.id === id);

    if (extraction?.status === "EXTRACTED" || extraction?.status === "ERROR") {
      return extraction;
    }

    await sleep(1_000);
  }

  throw new Error(`timed out waiting for extraction ${id} to reach a terminal state`);
};

await run("files list extractions shape", async () => {
  const extractions = await client.files.listExtractions();

  assert(Array.isArray(extractions), "expected extractions array");

  return {
    count: extractions.length,
    first: extractions[0]
      ? {
          id: extractions[0].id,
          status: extractions[0].status,
        }
      : null,
  };
});

await run("files setWatchStatus roundtrip", async () => {
  const video = await requireOwnedVideoFixture(client);

  try {
    await client.files.setWatchStatus({
      ids: [video.id],
      watched: true,
    });
    await client.files.setWatchStatus({
      ids: [video.id],
      watched: false,
    });
  } finally {
    await client.files.setWatchStatus({
      ids: [video.id],
      watched: false,
    });
  }
});

await run("files start_from roundtrip semantics", async () => {
  const video = await requireOwnedVideoFixture(client);

  const before = await client.files.getStartFrom(video.id);

  try {
    await client.files.setStartFrom({
      file_id: video.id,
      time: 37,
    });

    const updated = await client.files.getStartFrom(video.id);
    assert(updated === 37, "expected updated start_from to roundtrip");

    await client.files.setStartFrom({
      file_id: video.id,
      time: before,
    });

    const restored = await client.files.getStartFrom(video.id);
    assert(restored === before, "expected start_from to be restored");
  } finally {
    await client.files.setStartFrom({
      file_id: video.id,
      time: before,
    });
  }
});

await run("files next-file natural ordering with disposable fixtures", async () => {
  const created: Array<{ readonly id: number; readonly name: string }> = [];
  const suffix = Date.now();
  const folder = await authClient.files.createFolder({
    name: `putio-typescript-sdk-next-file-${suffix}`,
    parent_id: 0,
  });

  try {
    for (const name of [
      `putio-typescript-sdk-episode-1-${suffix}.txt`,
      `putio-typescript-sdk-episode-10-${suffix}.txt`,
      `putio-typescript-sdk-episode-2-${suffix}.txt`,
    ]) {
      const upload = await authClient.files.upload({
        file: new File(["sdk next-file probe\n"], name, {
          type: "text/plain",
        }),
        fileName: name,
        parentId: folder.id,
      });

      if (!isFileUploadFileResult(upload)) {
        throw new Error("expected uploaded next-file probe to be a file");
      }
      created.push(upload.file);
    }

    const episode1 = assertPresent(
      created.find((file) => file.name.includes("-episode-1-")),
      "expected episode 1 fixture",
    );
    const episode2 = assertPresent(
      created.find((file) => file.name.includes("-episode-2-")),
      "expected episode 2 fixture",
    );

    let next = await client.files.findNext(episode1.id, "FILE");

    for (let attempt = 0; next.id !== episode2.id && attempt < 10; attempt += 1) {
      await sleep(500);
      next = await client.files.findNext(episode1.id, "FILE");
    }

    assert(next.id === episode2.id, "expected natural ordering to skip episode 10");
  } finally {
    await authClient.files.delete([folder.id], {
      skipTrash: true,
    });
  }
});

await run("files extract an owned archive", async () => {
  const name = `putio-typescript-sdk-extract-${Date.now()}.zip`;
  const upload = await authClient.files.upload({
    file: createStoredZipFile(name),
    fileName: name,
    parentId: 0,
  });

  if (!isFileUploadFileResult(upload)) {
    throw new Error("expected archive upload to return a file");
  }

  let extractionId: number | undefined;
  const extractedFileIds: number[] = [];

  try {
    const created = await client.files.extract({ ids: [upload.file.id] });
    assert(created.length === 1, "expected one extraction task");
    const extraction = assertPresent(created[0], "expected extraction task");
    extractionId = extraction.id;

    const terminal = await waitForExtractionTerminalState(extraction.id);
    assert(terminal.status === "EXTRACTED", "expected extraction to succeed");
    extractedFileIds.push(...terminal.files);
  } finally {
    if (extractionId !== undefined) {
      await client.files.deleteExtraction(extractionId).catch(() => undefined);
    }
    await authClient.files
      .delete([upload.file.id, ...extractedFileIds], { skipTrash: true })
      .catch(() => undefined);
  }
});

await run("files mp4 status on folder yields typed not-file", async () => {
  const folder = await authClient.files.createFolder({
    name: `putio-typescript-sdk-mp4-status-folder-${Date.now()}`,
    parent_id: 0,
  });

  try {
    await client.files.getMp4Status(folder.id);
    throw new Error("expected folder mp4 status lookup to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "files",
      errorType: "NotFile",
      operation: "mp4",
      statusCode: 400,
    });
  } finally {
    await authClient.files.delete([folder.id], {
      skipTrash: true,
    });
  }
});

finish();
