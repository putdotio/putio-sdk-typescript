import { assertPresent, createClients, createLiveHarness } from "../support/harness.js";

const { authClient, oauthClient } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("files live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

const getOwnedVideo = async () => {
  const search = await oauthClient.files.search({
    per_page: 10,
    query: "mp4",
  });

  const video = search.files.find((file) => file.file_type === "VIDEO" && file.is_shared === false);
  return assertPresent(video, "expected at least one owned video result");
};

await run("files root list shape", async () => {
  const result = await oauthClient.files.list(0, {
    per_page: 3,
    total: 1,
  });

  assert(result.parent?.id === 0, "expected root parent id");
  assert(Array.isArray(result.files), "expected files array");
  assert(typeof result.total === "number", "expected total");

  return {
    cursor_present: result.cursor === null || typeof result.cursor === "string",
    first_names: result.files.map((file) => file.name),
    total: result.total,
  };
});

await run("files list continue", async () => {
  const firstPage = await oauthClient.files.list(0, {
    per_page: 2,
    total: 1,
  });

  if (!firstPage.cursor) {
    return {
      continued: false,
    };
  }

  const nextPage = await oauthClient.files.continue(firstPage.cursor, {
    per_page: 2,
  });

  assert(Array.isArray(nextPage.files), "expected continued files array");

  return {
    continued: true,
    next_count: nextPage.files.length,
  };
});

await run("files shared-with-you list", async () => {
  const result = await oauthClient.files.list("friends", {
    per_page: 2,
    total: 1,
  });

  assert(result.parent?.id === -2, "expected shared-with-you synthetic parent");

  return {
    count: result.files.length,
    parent_name: result.parent?.name,
  };
});

await run("files search and continue", async () => {
  const search = await oauthClient.files.search({
    per_page: 2,
    query: "mp4",
  });

  assert(Array.isArray(search.files), "expected search files array");
  assert(typeof search.total === "number", "expected search total");

  if (!search.cursor) {
    return {
      continued: false,
      total: search.total,
    };
  }

  const nextPage = await oauthClient.files.continueSearch(search.cursor, {
    per_page: 2,
  });

  assert(Array.isArray(nextPage.files), "expected continued search files array");

  return {
    continued: true,
    first_page: search.files.length,
    next_page: nextPage.files.length,
    total: search.total,
  };
});

await run("files search too long query yields typed 400", async () => {
  try {
    await oauthClient.files.search({
      query: "x".repeat(300),
    });
    throw new Error("expected long search query to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "files",
      errorType: "SEARCH_TOO_LONG_QUERY",
      operation: "search",
      statusCode: 400,
    });
  }
});

await run("files get with conditional media fields", async () => {
  const video = await getOwnedVideo();
  const mediaQuery = {
    codecs: 1,
    media_info: 1,
    mp4_status: 1,
    mp4_stream_url: 1,
    stream_url: 1,
    video_metadata: 1,
  } as const;
  const file = await oauthClient.files.get({
    id: video.id,
    query: mediaQuery,
  });

  if (!("stream_url" in file)) {
    throw new Error("expected stream_url");
  }
  if (!("content_type_and_codecs" in file)) {
    throw new Error("expected content_type_and_codecs");
  }
  if (!("need_convert" in file)) {
    throw new Error("expected need_convert");
  }
  if (!("media_info" in file)) {
    throw new Error("expected media_info");
  }
  if (!("video_metadata" in file)) {
    throw new Error("expected video_metadata");
  }

  return {
    id: file.id,
    is_mp4_available: file.is_mp4_available,
    mp4_stream_url_present:
      "mp4_stream_url" in file
        ? file.mp4_stream_url === null || typeof file.mp4_stream_url === "string"
        : null,
    name: file.name,
  };
});

await run("files parent media flags from query(list by file id)", async () => {
  const video = await getOwnedVideo();
  const parentQuery = {
    breadcrumbs: 1,
    codecs_parent: 1,
    media_info_parent: 1,
    mp4_status_parent: 1,
    mp4_stream_url_parent: 1,
    stream_url_parent: 1,
    total: 1,
    video_metadata_parent: 1,
  } as const;
  const result = await oauthClient.files.list(video.id, {
    ...parentQuery,
  });

  const parent = assertPresent(result.parent, "expected queried file as parent");
  assert(parent.id === video.id, "expected queried file as parent");
  assert(Array.isArray(result.files), "expected child files array");
  if (!("stream_url" in parent)) {
    throw new Error("expected parent stream_url");
  }
  if (!("video_metadata" in parent)) {
    throw new Error("expected parent video_metadata");
  }
  if (!("content_type_and_codecs" in parent)) {
    throw new Error("expected parent codecs");
  }
  if (!("media_info" in parent)) {
    throw new Error("expected parent media_info");
  }
  if (!("need_convert" in parent)) {
    throw new Error("expected parent need_convert");
  }

  if (parent.is_mp4_available) {
    if (!("mp4_stream_url" in parent)) {
      throw new Error("expected parent mp4_stream_url when mp4 is available");
    }
  }

  return {
    child_count: result.files.length,
    has_breadcrumbs: Array.isArray(result.breadcrumbs),
    parent_id: parent.id,
    parent_mp4_available: parent.is_mp4_available,
  };
});

await run("files list child media flags", async () => {
  const video = await getOwnedVideo();
  const list = await oauthClient.files.list(assertPresent(video.parent_id, "expected parent id"), {
    media_metadata: 1,
    per_page: 100,
    stream_url: 1,
    total: 1,
  });

  const child = assertPresent(
    list.files.find((file) => file.id === video.id),
    "expected owned video to be in parent listing",
  );
  if (!("stream_url" in child)) {
    throw new Error("expected child stream_url");
  }
  if (!("media_metadata" in child)) {
    throw new Error("expected child media_metadata");
  }

  return {
    child_id: child.id,
    child_name: child.name,
    total: list.total,
  };
});

await run("files mp4 status", async () => {
  const video = await getOwnedVideo();
  const status = await oauthClient.files.getMp4Status(video.id);

  assert(typeof status.status === "string", "expected mp4 status");

  return status;
});

await run("files subtitles envelope shape", async () => {
  const video = await getOwnedVideo();
  const result = await oauthClient.files.listSubtitles(video.id);

  assert(Array.isArray(result.subtitles), "expected subtitles array");
  assert(
    result.default === null || typeof result.default === "string",
    "expected default subtitle key",
  );

  return {
    count: result.subtitles.length,
    default: result.default,
    first_source: result.subtitles[0]?.source ?? null,
  };
});

await run("files start_from roundtrip", async () => {
  const video = await getOwnedVideo();
  const original = await authClient.files.getStartFrom(video.id);
  const probe = original === 0 ? 5 : 0;

  await authClient.files.setStartFrom({
    file_id: video.id,
    time: probe,
  });

  const afterSet = await authClient.files.getStartFrom(video.id);
  assert(afterSet === probe, "expected start_from to update");

  await authClient.files.setStartFrom({
    file_id: video.id,
    time: original,
  });

  const restored = await authClient.files.getStartFrom(video.id);
  assert(restored === original, "expected start_from to be restored");

  return {
    original,
    probe,
    restored,
  };
});

await run("files next-file and next-video", async () => {
  const video = await getOwnedVideo();
  const nextFile = await oauthClient.files.findNext(video.id, "VIDEO");
  const nextVideo = await oauthClient.files.findNextVideo(video.id);

  assert(typeof nextFile.id === "number", "expected next_file id");
  assert(typeof nextVideo.id === "number", "expected next_video id");

  return {
    next_file_id: nextFile.id,
    next_video_id: nextVideo.id,
  };
});

await run("files folder lifecycle", async () => {
  const suffix = Date.now();
  const folderAName = `codex_sdk_files_a_${suffix}`;
  const folderBName = `codex_sdk_files_b_${suffix}`;
  const folderARenamed = `${folderAName}_renamed`;

  const folderA = await authClient.files.createFolder({
    name: folderAName,
    parent_id: 0,
  });

  const folderB = await authClient.files.createFolder({
    name: folderBName,
    parent_id: 0,
  });

  try {
    await authClient.files.rename({
      file_id: folderA.id,
      name: folderARenamed,
    });

    const moveErrors = await authClient.files.move([folderA.id], folderB.id);
    assert(moveErrors.length === 0, "expected move without per-item errors");

    const folderContents = await authClient.files.list(folderB.id, {
      per_page: 10,
      total: 1,
    });

    assert(
      folderContents.files.some((file) => file.name === folderARenamed),
      "expected moved renamed child in destination folder",
    );

    return {
      destination_id: folderB.id,
      moved_child_name: folderARenamed,
      moved_count: folderContents.files.length,
    };
  } finally {
    await authClient.files
      .delete([folderA.id, folderB.id], {
        ignoreFileOwner: true,
        skipTrash: true,
      })
      .catch(() => undefined);
  }
});

await run("missing file yields typed error", async () => {
  try {
    await oauthClient.files.get({
      id: 2147483647,
    });
    throw new Error("expected missing file lookup to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "files",
      operation: "get",
      statusCode: 404,
    });
  }
});

await run("too long search yields typed error", async () => {
  try {
    await oauthClient.files.search({
      per_page: 2,
      query: "x".repeat(300),
    });
    throw new Error("expected long search query to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "files",
      errorType: "SEARCH_TOO_LONG_QUERY",
      operation: "search",
      statusCode: 400,
    });
  }
});

await run("empty folder name yields typed error", async () => {
  try {
    await authClient.files.createFolder({
      name: "",
      parent_id: 0,
    });
    throw new Error("expected empty folder name to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "files",
      errorType: "EMPTY_NAME",
      operation: "createFolder",
      statusCode: 400,
    });
  }
});

await run("folder mp4 status yields typed error", async () => {
  const root = await oauthClient.files.list(0, {
    per_page: 10,
    total: 1,
  });
  const folder = assertPresent(
    root.files.find((file) => file.file_type === "FOLDER"),
    "expected at least one folder",
  );

  try {
    await oauthClient.files.getMp4Status(folder.id);
    throw new Error("expected folder mp4 status to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "files",
      errorType: "NotFile",
      operation: "mp4",
      statusCode: 400,
    });
  }
});

finish();
