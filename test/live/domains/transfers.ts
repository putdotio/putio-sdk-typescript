import { createClients, createLiveHarness } from "../support/harness.js";
import { createTorrentFile } from "../support/binary-fixtures.ts";

const { authClient, client } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  client: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("transfers live");
const { assert, assertErrorTag, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

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

await run("transfers list shape", async () => {
  const result = await client.transfers.list({
    per_page: 5,
  });

  assert(Array.isArray(result.transfers), "expected transfers array");

  return {
    cursor: result.cursor ?? null,
    total: result.total ?? result.transfers.length,
    transfer_count: result.transfers.length,
  };
});

await run("transfers list per_page too large yields typed 400", async () => {
  try {
    await client.transfers.list({
      per_page: 1001,
    });
    throw new Error("expected oversized transfer page size to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "transfers",
      operation: "list",
      statusCode: 400,
    });
  }
});

await run("transfers count", async () => {
  const count = await client.transfers.count();
  assert(typeof count === "number", "expected numeric transfer count");
  return { count };
});

await run("transfers info external analysis", async () => {
  const info = await client.transfers.info(["https://example.invalid/file.iso"]);
  assert(Array.isArray(info.ret), "expected info result array");
  assert(info.ret.length === 1, "expected one analysis result");

  return {
    disk_avail: info.disk_avail,
    first: info.ret[0],
  };
});

await run("transfers addMany envelope shape", async () => {
  const result = await client.transfers.addMany([
    {
      url: `https://example.invalid/codex-transfer-${Date.now()}.iso`,
    },
    {
      url: "not-a-url",
    },
  ]);

  assert(Array.isArray(result.transfers), "expected transfers array");
  assert(Array.isArray(result.errors), "expected per-item errors array");
  assert(result.transfers.length >= 1, "expected at least one created transfer");

  const firstError = result.errors[0];

  for (const transfer of result.transfers) {
    await client.transfers.cancel([transfer.id]).catch(() => undefined);
    await client.transfers.remove({ ids: [transfer.id] }).catch(() => undefined);
    await client.transfers.clean([transfer.id]).catch(() => undefined);
  }

  return {
    behaves_like_partial: result.errors.length > 0,
    first_error_type: firstError?.error_type ?? null,
    first_transfer_id: result.transfers[0]?.id ?? null,
    transfer_count: result.transfers.length,
    error_count: result.errors.length,
  };
});

await run("empty transfer url yields typed error", async () => {
  try {
    await client.transfers.add({
      url: "",
    });
    throw new Error("expected empty transfer url to fail");
  } catch (error) {
    return assertErrorTag(error, { tag: "PutioValidationError" });
  }
});

await run("missing transfer retry yields typed error", async () => {
  try {
    await client.transfers.retry(2147483647);
    throw new Error("expected retry on missing transfer to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "transfers",
      operation: "retry",
      statusCode: 404,
    });
  }
});

await run("missing transfer stop recording yields typed error", async () => {
  try {
    await client.transfers.stopRecording(2147483647);
    throw new Error("expected stopRecording on missing transfer to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "transfers",
      operation: "stopRecording",
      statusCode: 404,
    });
  }
});

await run("non-live transfer stop recording yields typed not-recording", async () => {
  const created = await client.transfers.add({
    url: `https://example.invalid/codex-transfer-${Date.now()}.iso`,
  });

  try {
    await client.transfers.stopRecording(created.id);
    throw new Error("expected stopRecording on non-live transfer to fail");
  } catch (error) {
    return assertOperationError(error, {
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

await run("missing transfer cancel is idempotent", async () => {
  await client.transfers.cancel([2147483647]);

  return {
    ok: true,
  };
});

await run("reannounce currently rejects with typed bad request", async () => {
  try {
    await client.transfers.reannounce(2147483647);
    throw new Error("expected reannounce to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "transfers",
      errorType: "BadRequest",
      operation: "reannounce",
      statusCode: 400,
    });
  }
});

await run("non-torrent reannounce currently falls back to typed bad request", async () => {
  const created = await client.transfers.add({
    url: `https://example.invalid/codex-transfer-${Date.now()}.iso`,
  });

  try {
    await client.transfers.reannounce(created.id);
    throw new Error("expected reannounce on url transfer to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "transfers",
      errorType: "BadRequest",
      operation: "reannounce",
      statusCode: 400,
    });
  } finally {
    await client.transfers.cancel([created.id]).catch(() => undefined);
    await client.transfers.clean([created.id]).catch(() => undefined);
  }
});

await run("transfers disposable lifecycle", async () => {
  const countBefore = await client.transfers.count();

  const created = await client.transfers.add({
    url: `https://example.invalid/codex-transfer-${Date.now()}.iso`,
  });

  try {
    assert(typeof created.id === "number", "expected created transfer id");
    assert(typeof created.save_parent_id === "number", "expected save_parent_id");

    const listed = await client.transfers.list({
      per_page: 20,
    });

    assert(
      listed.transfers.some((transfer) => transfer.id === created.id),
      "expected created transfer in list",
    );

    const errored = await waitForTransferError(created.id);
    assert(typeof errored.error_message === "string", "expected transfer error message");

    const retried = await client.transfers.retry(created.id);
    assert(retried.status !== "ERROR", "expected retry to leave terminal error state");
    const retriedError = await waitForTransferError(created.id);

    const fetched = await client.transfers.get(created.id);
    assert(fetched.id === created.id, "expected get to return created transfer");

    await client.transfers.cancel([created.id]);

    const countAfter = await client.transfers.count();

    return {
      count_after_cancel: countAfter,
      count_before: countBefore,
      created_id: created.id,
      final_status: errored.status,
      retried_status: retried.status,
      retried_terminal_status: retriedError.status,
    };
  } finally {
    await client.transfers.cancel([created.id]).catch(() => undefined);
    await client.transfers.clean([created.id]).catch(() => undefined);
  }
});

await run("uploaded torrent exposes decoded transfer and metainfo bytes", async () => {
  const name = `codex_sdk_torrent_transfer_${Date.now()}`;
  const upload = await authClient.files.upload({
    file: createTorrentFile(name),
    fileName: `${name}.torrent`,
    parentId: 0,
  });

  if (upload.type !== "transfer") {
    throw new Error("expected torrent upload to return a transfer");
  }

  const transferId = upload.transfer.id;

  try {
    const transfer = await waitForTorrentTransfer(transferId);
    const torrent = await authClient.transfers.getTorrent(transferId);
    assert(torrent.byteLength > 20, "expected torrent metainfo bytes");
    assert(torrent[0] === 0x64, "expected bencoded torrent metainfo");

    return {
      status: transfer.status,
      torrent_bytes: torrent.byteLength,
      transfer_id: transferId,
      type: transfer.type,
    };
  } finally {
    await authClient.transfers.cancel([transferId]).catch(() => undefined);
    await authClient.transfers.remove({ ids: [transferId] }).catch(() => undefined);
    await authClient.transfers.clean([transferId]).catch(() => undefined);
  }
});

await run("transfers clean returns deleted ids array", async () => {
  const result = await client.transfers.clean();
  assert(Array.isArray(result.deleted_ids), "expected deleted_ids array");
  return result;
});

finish();
