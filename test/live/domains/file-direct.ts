import { createClients, createLiveHarness, isFileUploadFileResult } from "../support/harness.js";
import { requireOwnedVideoFixture } from "../support/media.ts";

const { client } = await createClients({
  client: "PUTIO_TOKEN_FIRST_PARTY",
});

const live = createLiveHarness("file-direct live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

const createDisposableTextFile = async (label: string) => {
  const name = `codex_sdk_${label}_${Date.now()}.txt`;
  const upload = await client.files.upload({
    file: new File(["sdk live probe\n"], name, {
      type: "text/plain",
    }),
    fileName: name,
    parentId: 0,
  });

  if (!isFileUploadFileResult(upload)) {
    throw new Error("expected file upload result");
  }

  return upload.file;
};

await run("files api download url redirects", async () => {
  const file = await createDisposableTextFile("download_redirect");

  try {
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
  } finally {
    await client.files.delete([file.id], {
      skipTrash: true,
    });
  }
});

await run("files api content url redirects", async () => {
  const file = await createDisposableTextFile("content_redirect");

  try {
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
  } finally {
    await client.files.delete([file.id], {
      skipTrash: true,
    });
  }
});

await run("files direct download url fetches disposable file", async () => {
  const file = await createDisposableTextFile("direct_download");

  try {
    const url = await client.files.getDownloadUrl(file.id);
    const response = await fetch(url);
    const body = await response.text();

    assert(response.ok, "expected direct download url to be fetchable");
    assert(body === "sdk live probe\n", "expected direct download body");

    return {
      file_id: file.id,
      status: response.status,
    };
  } finally {
    await client.files.delete([file.id], {
      skipTrash: true,
    });
  }
});

await run("files api mp4 download url redirects for owned video", async () => {
  const video = await requireOwnedVideoFixture(client, {
    requireMp4Available: true,
  });

  const url = await client.files.getApiMp4DownloadUrl(video.id, {
    name: "codex-sdk-live.mp4",
  });
  const response = await fetch(url, {
    redirect: "manual",
  });

  assert(response.status === 302, "expected api mp4 download route to redirect");

  return {
    location_prefix: response.headers.get("location")?.slice(0, 24) ?? null,
    status: response.status,
    video_id: video.id,
  };
});

await run("files hls url is tokenized", async () => {
  const video = await requireOwnedVideoFixture(client);

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
