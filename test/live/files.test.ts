import { test } from "vite-plus/test";

import {
  assert,
  assertPresent,
  createLiveTokenClients,
  rejectsWithOperationError,
  sleep,
} from "./support/harness.js";
import { requireOwnedVideoFixture } from "./support/media.js";

const { authClient, oauthClient } = createLiveTokenClients();

const createTextFile = async (parentId: number, name: string): Promise<number> => {
  const upload = await authClient.files.upload({
    file: new File([`sdk files cursor probe ${name}\n`], name, {
      type: "text/plain",
    }),
    fileName: name,
    parentId,
  });

  if (upload.type !== "file") {
    throw new Error("expected files cursor probe upload to return a file");
  }

  return upload.file.id;
};

type CursorProbeFolder = {
  readonly cleanupIds: readonly number[];
  readonly folderId: number;
};

const createCursorProbeFolder = async (name: string, fileCount = 3): Promise<CursorProbeFolder> => {
  const folder = await authClient.files.createFolder({
    name,
    parent_id: 0,
  });

  const childIds: number[] = [];

  try {
    for (let index = 1; index <= fileCount; index += 1) {
      childIds.push(await createTextFile(folder.id, `${name}_${index}.txt`));
    }
  } catch (error) {
    await authClient.files
      .delete([folder.id, ...childIds], { skipTrash: true })
      .catch(() => undefined);
    throw error;
  }

  return {
    cleanupIds: [folder.id, ...childIds],
    folderId: folder.id,
  };
};

const waitForSearchCursor = async (query: string) => {
  const deadline = Date.now() + 20_000;
  let lastTotal = 0;

  while (Date.now() < deadline) {
    const search = await oauthClient.files.search({
      per_page: 2,
      query,
    });

    lastTotal = search.total;

    if (search.cursor !== null) {
      return search;
    }

    await sleep(1_500);
  }

  throw new Error(`expected files search cursor for probe query; last total was ${lastTotal}`);
};

test("files root list shape", async () => {
  const result = await oauthClient.files.list(0, {
    per_page: 3,
    total: 1,
  });

  assert(result.parent?.id === 0, "expected root parent id");
  assert(result.total !== undefined, "expected total");
});

test("files list continue", async () => {
  const probe = await createCursorProbeFolder(
    `putio-typescript-sdk-files-list-cursor-${Date.now()}`,
  );

  try {
    const firstPage = await oauthClient.files.list(probe.folderId, {
      per_page: 2,
      total: 1,
    });

    const firstCursor = assertPresent(firstPage.cursor, "expected files list cursor");
    assert(firstPage.files.length === 2, "expected first page to respect per_page");

    const nextPage = await oauthClient.files.continue(firstCursor, {
      per_page: 2,
    });

    assert(nextPage.files.length === 1, "expected final cursor page");
  } finally {
    await authClient.files.delete(probe.cleanupIds, { skipTrash: true }).catch(() => undefined);
  }
});

test("files shared-with-you list", async () => {
  const result = await oauthClient.files.list("friends", {
    per_page: 2,
    total: 1,
  });

  assert(result.parent?.id === -2, "expected shared-with-you synthetic parent");
});

test("files search and continue", async () => {
  const query = `putio-typescript-sdk-files-search-cursor-${Date.now()}`;
  const probe = await createCursorProbeFolder(query, 6);

  try {
    const search = await waitForSearchCursor(query);

    assert(search.files.length === 2, "expected first search page to respect per_page");

    const searchCursor = assertPresent(search.cursor, "expected files search cursor");

    const nextPage = await oauthClient.files.continueSearch(searchCursor, {
      per_page: 2,
    });

    assert(nextPage.files.length > 0, "expected continued search page items");
  } finally {
    await authClient.files.delete(probe.cleanupIds, { skipTrash: true }).catch(() => undefined);
  }
});

test("files mp4 search decodes", async () => {
  await oauthClient.files.search({
    per_page: 2,
    query: "mp4",
  });
});

test("files search too long query yields typed 400", async () => {
  await rejectsWithOperationError(
    oauthClient.files.search({
      per_page: 2,
      query: "x".repeat(300),
    }),
    {
      domain: "files",
      errorType: "SEARCH_TOO_LONG_QUERY",
      operation: "search",
      statusCode: 400,
    },
  );
});

test("files get with conditional media fields", async () => {
  const video = await requireOwnedVideoFixture(authClient);

  const file = await oauthClient.files.get({
    id: video.id,
    query: {
      codecs: 1,
      media_info: 1,
      mp4_status: 1,
      mp4_stream_url: 1,
      stream_url: 1,
      video_metadata: 1,
    },
  });

  assert("stream_url" in file, "expected stream_url");
  assert("content_type_and_codecs" in file, "expected content_type_and_codecs");
  assert("need_convert" in file, "expected need_convert");
  assert("media_info" in file, "expected media_info");
  assert("video_metadata" in file, "expected video_metadata");
});

test("files parent media flags from query(list by file id)", async () => {
  const video = await requireOwnedVideoFixture(authClient);

  const result = await oauthClient.files.list(video.id, {
    breadcrumbs: 1,
    codecs_parent: 1,
    media_info_parent: 1,
    mp4_status_parent: 1,
    mp4_stream_url_parent: 1,
    stream_url_parent: 1,
    total: 1,
    video_metadata_parent: 1,
  });

  const parent = assertPresent(result.parent, "expected queried file as parent");

  assert(parent.id === video.id, "expected queried file as parent");
  assert("stream_url" in parent, "expected parent stream_url");
  assert("video_metadata" in parent, "expected parent video_metadata");
  assert("content_type_and_codecs" in parent, "expected parent codecs");
  assert("media_info" in parent, "expected parent media_info");
  assert("need_convert" in parent, "expected parent need_convert");
  assert(
    !parent.is_mp4_available || "mp4_stream_url" in parent,
    "expected parent mp4_stream_url when mp4 is available",
  );
});

test("files list child media flags", async () => {
  const video = await requireOwnedVideoFixture(authClient);

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

  assert("stream_url" in child, "expected child stream_url");
  assert("media_metadata" in child, "expected child media_metadata");
});

test("files mp4 status decodes", async () => {
  const video = await requireOwnedVideoFixture(authClient);

  await oauthClient.files.getMp4Status(video.id);
});

test("files subtitles envelope decodes", async () => {
  const video = await requireOwnedVideoFixture(authClient);

  await oauthClient.files.listSubtitles(video.id);
});

test("files start_from roundtrip", async () => {
  const video = await requireOwnedVideoFixture(authClient);
  const original = await authClient.files.getStartFrom(video.id);
  const probe = original === 0 ? 5 : 0;

  try {
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
  } finally {
    await authClient.files.setStartFrom({
      file_id: video.id,
      time: original,
    });
  }
});

test("files next-file and next-video decode", async () => {
  const video = await requireOwnedVideoFixture(authClient);

  await oauthClient.files.findNext(video.id, "VIDEO");
  await oauthClient.files.findNextVideo(video.id);
});

test("files folder lifecycle", async () => {
  const suffix = Date.now();
  const folderAName = `putio-typescript-sdk-files-a-${suffix}`;
  const folderBName = `putio-typescript-sdk-files-b-${suffix}`;
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
  } finally {
    await authClient.files
      .delete([folderA.id, folderB.id], {
        ignoreFileOwner: true,
        skipTrash: true,
      })
      .catch(() => undefined);
  }
});

test("missing file yields typed error", async () => {
  await rejectsWithOperationError(oauthClient.files.get({ id: 2147483647 }), {
    domain: "files",
    operation: "get",
    statusCode: 404,
  });
});

test("empty folder name yields typed error", async () => {
  await rejectsWithOperationError(authClient.files.createFolder({ name: "", parent_id: 0 }), {
    domain: "files",
    errorType: "EMPTY_NAME",
    operation: "createFolder",
    statusCode: 400,
  });
});

test("folder mp4 status yields typed error", async () => {
  const folder = await authClient.files.createFolder({
    name: `putio-typescript-sdk-mp4-status-folder-${Date.now()}`,
    parent_id: 0,
  });

  try {
    await rejectsWithOperationError(oauthClient.files.getMp4Status(folder.id), {
      domain: "files",
      errorType: "NotFile",
      operation: "mp4",
      statusCode: 400,
    });
  } finally {
    await authClient.files.delete([folder.id], { skipTrash: true }).catch(() => undefined);
  }
});
