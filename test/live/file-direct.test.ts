import { test } from "vite-plus/test";

import { assert, createLiveTokenClients, isFileUploadFileResult } from "./support/harness.js";
import { requireOwnedVideoFixture } from "./support/media.js";

const { authClient: client } = createLiveTokenClients();

const { download_token: downloadToken } = await client.account.getInfo({ download_token: 1 });

const createDisposableTextFile = async (label: string) => {
  const name = `putio-typescript-sdk-${label}-${Date.now()}.txt`;

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

test("files api download url redirects", async () => {
  const file = await createDisposableTextFile("download_redirect");

  try {
    const url = await client.files.getApiDownloadUrl(file.id, { downloadToken });
    const response = await fetch(url, { redirect: "manual" });

    assert(response.status === 302, "expected api download route to redirect");
  } finally {
    await client.files.delete([file.id], { skipTrash: true });
  }
});

test("files api content url redirects", async () => {
  const file = await createDisposableTextFile("content_redirect");

  try {
    const url = await client.files.getApiContentUrl(file.id, { downloadToken });
    const response = await fetch(url, { redirect: "manual" });

    assert(response.status === 302, "expected api content route to redirect");
  } finally {
    await client.files.delete([file.id], { skipTrash: true });
  }
});

test("files upload and direct download url roundtrip a disposable file", async () => {
  const file = await createDisposableTextFile("direct_download");

  try {
    const url = await client.files.getDownloadUrl(file.id);
    const response = await fetch(url);
    const body = await response.text();

    assert(response.ok, "expected direct download url to be fetchable");
    assert(body === "sdk live probe\n", "expected direct download body");
  } finally {
    await client.files.delete([file.id], { skipTrash: true });
  }
});

test("files api mp4 download url redirects for owned video", async () => {
  const video = await requireOwnedVideoFixture(client, {
    requireMp4Available: true,
  });

  const url = await client.files.getApiMp4DownloadUrl(video.id, {
    downloadToken,
    name: "putio-typescript-sdk-live.mp4",
  });

  const response = await fetch(url, { redirect: "manual" });

  assert(response.status === 302, "expected api mp4 download route to redirect");
});

test("files XSPF playlist is fetchable for owned video", async () => {
  const video = await requireOwnedVideoFixture(client);
  const url = await client.files.getXspfPlaylistUrl(video.id, { downloadToken });
  const response = await fetch(url);
  const body = await response.text();

  assert(response.ok, "expected XSPF playlist route to be fetchable");
  assert(
    response.headers.get("content-type")?.includes("application/xspf+xml") === true,
    "expected XSPF content type",
  );
  assert(body.includes("<playlist"), "expected XSPF playlist body");
});
