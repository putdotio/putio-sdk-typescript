import {
  assertPresent,
  createClients,
  createLiveHarness,
  isFileUploadFileResult,
} from "../support/harness.js";

const { client } = await createClients({
  client: "PUTIO_TOKEN_FIRST_PARTY",
});

const live = createLiveHarness("file-direct live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

const getOwnedFileCandidate = async () => {
  const root = await client.files.list(0, {
    per_page: 20,
    total: 1,
  });

  const candidate = root.files.find((file) => file.file_type !== "FOLDER") ?? root.files[0];
  return assertPresent(candidate, "expected at least one file candidate in root");
};

const getOwnedVideoCandidate = async () => {
  const search = await client.files.search({
    per_page: 10,
    query: "mp4",
  });

  return (
    search.files.find((file) => file.file_type === "VIDEO" && file.is_shared === false) ?? null
  );
};

await run("files api download url redirects", async () => {
  const file = await getOwnedFileCandidate();
  const url = await client.files.getApiDownloadUrl(file.id);
  const response = await fetch(url, {
    redirect: "manual",
  });

  assert(response.status === 302, "expected api download route to redirect");

  return {
    file_id: file.id,
    location_prefix: response.headers.get("location")?.slice(0, 24) ?? null,
    status: response.status,
  };
});

await run("files api content url redirects", async () => {
  const file = await getOwnedFileCandidate();
  const url = await client.files.getApiContentUrl(file.id);
  const response = await fetch(url, {
    redirect: "manual",
  });

  assert(response.status === 302, "expected api content route to redirect");

  return {
    file_id: file.id,
    location_prefix: response.headers.get("location")?.slice(0, 24) ?? null,
    status: response.status,
  };
});

await run("files hls url is tokenized", async () => {
  const video = await getOwnedVideoCandidate();

  if (!video) {
    return {
      checked: false,
      reason: "no owned video candidate found",
    };
  }

  const url = await client.files.getHlsStreamUrl(video.id, {
    maxSubtitleCount: 1,
  });

  assert(url.includes("/hls/media.m3u8"), "expected HLS playlist path");
  assert(url.includes("oauth_token="), "expected tokenized HLS url");

  return {
    checked: true,
    has_token: true,
    video_id: video.id,
  };
});

await run("files upload works through upload.put.io", async () => {
  const name = `codex_sdk_upload_probe_${Date.now()}.txt`;
  const upload = await client.files.upload({
    file: new File(["sdk upload probe\n"], name, {
      type: "text/plain",
    }),
    fileName: name,
    parentId: 0,
  });

  if (!isFileUploadFileResult(upload)) {
    throw new Error("expected file upload result");
  }

  await client.files.delete([upload.file.id], {
    skipTrash: true,
  });

  return {
    file_id: upload.file.id,
    file_name: upload.file.name,
    type: upload.type,
  };
});

finish();
