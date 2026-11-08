import { test } from "vite-plus/test";

import { createStoredZipFile } from "./support/binary-fixtures.js";
import {
  assert,
  assertPresent,
  createLiveTokenClients,
  isFileUploadFileResult,
  sleep,
} from "./support/harness.js";
import { requireOwnedVideoFixture } from "./support/media.js";

const { authClient, oauthClient: client } = createLiveTokenClients();

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

test("files list extractions decodes", async () => {
  await client.files.listExtractions();
});

test("files setWatchStatus roundtrip", async () => {
  const video = await requireOwnedVideoFixture(client);

  try {
    await client.files.setWatchStatus({
      ids: [video.id],
      watched: true,
    });
  } finally {
    await client.files.setWatchStatus({
      ids: [video.id],
      watched: false,
    });
  }
});

test("files next-file natural ordering with disposable fixtures", async () => {
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

test("files extract an owned archive", async () => {
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
