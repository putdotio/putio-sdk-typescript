import { test } from "vite-plus/test";

import { createTorrentFile } from "./support/binary-fixtures.js";
import {
  assert,
  createLiveTokenClients,
  rejectsWithOperationError,
  sleep,
} from "./support/harness.js";

const { authClient, oauthClient: client } = createLiveTokenClients();

const waitForTransferError = async (id: number) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const transfer = await client.transfers.get(id);

    if (transfer.status === "ERROR") {
      return transfer;
    }

    await sleep(1000);
  }

  throw new Error("timed out waiting for transfer to reach ERROR");
};

const waitForTorrentTransfer = async (id: number) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const transfer = await authClient.transfers.get(id);

    if (transfer.type === "TORRENT") {
      return transfer;
    }

    await sleep(500);
  }

  throw new Error("timed out waiting for uploaded transfer to decode as TORRENT");
};

test("transfers list decodes", async () => {
  const page = await client.transfers.list({
    per_page: 5,
  });

  assert(Number.isFinite(page.total), "expected a total for a paged transfer list");
});

test("transfers list per_page too large yields typed 400", async () => {
  await rejectsWithOperationError(
    client.transfers.list({
      per_page: 1001,
    }),
    {
      domain: "transfers",
      operation: "list",
      statusCode: 400,
    },
  );
});

test("transfers count decodes", async () => {
  await client.transfers.count();
});

test("transfers info external analysis", async () => {
  const info = await client.transfers.info(["https://example.invalid/file.iso"]);

  assert(info.ret.length === 1, "expected one analysis result");
});

test("transfers addMany envelope shape", async () => {
  const result = await client.transfers.addMany([
    {
      url: `https://example.invalid/putio-typescript-sdk-transfer-${Date.now()}.iso`,
    },
    {
      url: "not-a-url",
    },
  ]);

  try {
    assert(result.transfers.length >= 1, "expected at least one created transfer");
    assert(result.errors.length === 1, "expected one invalid URL error");
  } finally {
    for (const transfer of result.transfers) {
      await client.transfers.cancel([transfer.id]).catch(() => undefined);
      await client.transfers.remove({ ids: [transfer.id] }).catch(() => undefined);
      await client.transfers.clean([transfer.id]).catch(() => undefined);
    }
  }
});

test("missing transfer retry yields typed error", async () => {
  await rejectsWithOperationError(client.transfers.retry(2147483647), {
    domain: "transfers",
    operation: "retry",
    statusCode: 404,
  });
});

test("missing transfer stop recording yields typed error", async () => {
  await rejectsWithOperationError(client.transfers.stopRecording(2147483647), {
    domain: "transfers",
    operation: "stopRecording",
    statusCode: 404,
  });
});

test("non-live transfer stop recording yields typed not-recording", async () => {
  const created = await client.transfers.add({
    url: `https://example.invalid/putio-typescript-sdk-transfer-${Date.now()}.iso`,
  });

  try {
    await rejectsWithOperationError(client.transfers.stopRecording(created.id), {
      domain: "transfers",
      errorType: "NOT_RECORDING",
      operation: "stopRecording",
      statusCode: 400,
    });
  } finally {
    await client.transfers.cancel([created.id]).catch(() => undefined);
    await client.transfers.clean([created.id]).catch(() => undefined);
  }
});

test("missing transfer cancel is idempotent", async () => {
  await client.transfers.cancel([2147483647]);
});

test("reannounce on a missing transfer yields typed not found", async () => {
  await rejectsWithOperationError(client.transfers.reannounce(2147483647), {
    domain: "transfers",
    errorType: "TRANSFER_NOT_FOUND",
    operation: "reannounce",
    statusCode: 404,
  });
});

test("non-torrent reannounce yields typed not torrent", async () => {
  const created = await client.transfers.add({
    url: `https://example.invalid/putio-typescript-sdk-transfer-${Date.now()}.iso`,
  });

  try {
    await rejectsWithOperationError(client.transfers.reannounce(created.id), {
      domain: "transfers",
      errorType: "NOT_TORRENT",
      operation: "reannounce",
      statusCode: 400,
    });
  } finally {
    await client.transfers.cancel([created.id]).catch(() => undefined);
    await client.transfers.clean([created.id]).catch(() => undefined);
  }
});

test("failed URL transfer can be retried and cancelled", async () => {
  const created = await client.transfers.add({
    url: `https://example.invalid/putio-typescript-sdk-transfer-${Date.now()}.iso`,
  });

  const transferIds = new Set([created.id]);

  try {
    const listed = await client.transfers.list({
      per_page: 20,
    });

    assert(
      listed.transfers.some((transfer) => transfer.id === created.id),
      "expected created transfer in list",
    );

    const errored = await waitForTransferError(created.id);
    assert(errored.error_message !== null, "expected transfer error message");

    const retried = await client.transfers.retry(created.id);
    transferIds.add(retried.id);
    assert(retried.status !== "ERROR", "expected retry to leave terminal error state");
    await waitForTransferError(retried.id);

    const fetched = await client.transfers.get(retried.id);
    assert(fetched.id === retried.id, "expected get to return retried transfer");

    await client.transfers.cancel([retried.id]);
  } finally {
    for (const id of transferIds) {
      await client.transfers.cancel([id]).catch(() => undefined);
      await client.transfers.clean([id]).catch(() => undefined);
    }
  }
});

test("torrent upload returns a decoded transfer and metainfo", async () => {
  const name = `putio-typescript-sdk-torrent-transfer-${Date.now()}`;

  const upload = await authClient.files.upload({
    file: createTorrentFile(name),
    fileName: `${name}.torrent`,
    parentId: 0,
  });

  if (upload.type === "file") {
    try {
      throw new Error("expected torrent upload to return a transfer");
    } finally {
      await authClient.files.delete([upload.file.id], { skipTrash: true });
    }
  }

  const transferId = upload.transfer.id;

  try {
    await waitForTorrentTransfer(transferId);
    const torrent = await authClient.transfers.getTorrent(transferId);
    assert(torrent.byteLength > 20, "expected torrent metainfo bytes");
    assert(torrent[0] === 0x64, "expected bencoded torrent metainfo");
  } finally {
    await authClient.transfers.cancel([transferId]).catch(() => undefined);
    await authClient.transfers.remove({ ids: [transferId] }).catch(() => undefined);
    await authClient.transfers.clean([transferId]).catch(() => undefined);
  }
});

test("transfers clean decodes", async () => {
  await client.transfers.clean();
});
