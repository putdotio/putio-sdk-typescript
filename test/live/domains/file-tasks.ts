import {
  assertPresent,
  createClients,
  createLiveHarness,
  isFileUploadFileResult,
} from "../support/harness.js";

const { authClient, client } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  client: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("file-tasks live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

const getOwnedVideoCandidate = async () => {
  const search = await client.files.search({
    per_page: 10,
    query: "mp4",
  });

  return (
    search.files.find((file) => file.file_type === "VIDEO" && file.is_shared === false) ?? null
  );
};

const getArchiveCandidate = async () => {
  const search = await client.files.search({
    per_page: 20,
    query: "zip",
  });

  return (
    search.files.find((file) => file.file_type === "ARCHIVE" && file.is_shared === false) ?? null
  );
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
  const video = await getOwnedVideoCandidate();

  if (!video) {
    return {
      checked: false,
      reason: "no owned video candidate found",
    };
  }

  await client.files.setWatchStatus({
    ids: [video.id],
    watched: true,
  });
  await client.files.setWatchStatus({
    ids: [video.id],
    watched: false,
  });

  return {
    checked: true,
    video_id: video.id,
  };
});

await run("files start_from roundtrip semantics", async () => {
  const video = await getOwnedVideoCandidate();

  if (!video) {
    return {
      checked: false,
      reason: "no owned video candidate found",
    };
  }

  const before = await client.files.getStartFrom(video.id);

  await client.files.setStartFrom({
    file_id: video.id,
    time: 37,
  });

  const updated = await client.files.getStartFrom(video.id);
  assert(updated === 37, "expected updated start_from to roundtrip");

  await client.files.resetStartFrom(video.id);

  const reset = await client.files.getStartFrom(video.id);
  assert(reset === 0, "expected reset start_from to be 0");

  return {
    before,
    reset,
    updated,
    video_id: video.id,
  };
});

await run("files next-file natural ordering with disposable fixtures", async () => {
  const created: Array<{ readonly id: number; readonly name: string }> = [];
  const folder = await authClient.files.createFolder({
    name: `codex_sdk_next_file_${Date.now()}`,
    parent_id: 0,
  });

  try {
    for (const name of [
      `codex_sdk_episode_1_${Date.now()}.txt`,
      `codex_sdk_episode_10_${Date.now()}.txt`,
      `codex_sdk_episode_2_${Date.now()}.txt`,
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
      created.find((file) => file.name.includes("_episode_1_")),
      "expected episode 1 fixture",
    );
    const episode2 = assertPresent(
      created.find((file) => file.name.includes("_episode_2_")),
      "expected episode 2 fixture",
    );

    const next = await client.files.findNext(episode1.id, "FILE");

    assert(next.id === episode2.id, "expected natural ordering to skip episode 10");

    return {
      from: episode1.name,
      next: next.name,
      next_id: next.id,
    };
  } finally {
    await authClient.files.delete([folder.id], {
      skipTrash: true,
    });
  }
});

await run("files extract and cleanup", async () => {
  const archive = await getArchiveCandidate();

  if (!archive) {
    return {
      checked: false,
      reason: "no owned archive candidate found",
    };
  }

  const created = await client.files.extract({
    ids: [archive.id],
  });

  assert(Array.isArray(created), "expected extraction result array");

  const listed = await client.files.listExtractions();
  const createdIds = created.map((item) => item.id);

  for (const extractionId of createdIds) {
    await client.files.deleteExtraction(extractionId);
  }

  return {
    archive_id: archive.id,
    created_count: created.length,
    listed_match_count: listed.filter((item) => createdIds.includes(item.id)).length,
  };
});

await run("files mp4 status on folder yields typed not-file", async () => {
  const folder = await authClient.files.createFolder({
    name: `codex_sdk_mp4_status_folder_${Date.now()}`,
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
