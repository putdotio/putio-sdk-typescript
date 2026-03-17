import { createClients, createLiveHarness } from "../support/harness.js";

const { authClient, oauthClient } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("trash live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;

const deleteNow = async (ids: readonly number[]) => {
  if (ids.length === 0) {
    return;
  }

  await authClient.files.delete(ids, {
    skipTrash: true,
  });
};

const waitForFileReachable = async (id: number) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await authClient.files.get({
        id,
      });
    } catch {
      await sleep(500);
    }
  }

  throw new Error(`expected file ${id} to become reachable`);
};

const collectTrashPages = async (perPage: number) => {
  const first = await authClient.trash.list({
    per_page: perPage,
  });

  const files = [...first.files];
  let cursor = first.cursor;
  let pages = 1;

  while (cursor) {
    const next = await authClient.trash.continue(cursor, {
      per_page: perPage,
    });
    files.push(...next.files);
    cursor = next.cursor;
    pages += 1;

    if (pages > 20) {
      throw new Error("trash continuation exceeded 20 pages");
    }
  }

  return {
    files,
    pages,
    total: first.total,
    trash_size: first.trash_size,
  };
};

await run("trash list shape", async () => {
  const result = await authClient.trash.list({
    per_page: 5,
  });

  assert(Array.isArray(result.files), "expected trash files array");
  assert(typeof result.total === "number", "expected trash total");
  assert(typeof result.trash_size === "number", "expected trash_size");

  return {
    count: result.files.length,
    cursor_present: result.cursor === null || typeof result.cursor === "string",
    total: result.total,
  };
});

await run("trash continue invalid cursor yields typed 400", async () => {
  try {
    await authClient.trash.continue("codex-invalid-trash-cursor", {
      per_page: 1,
    });
    throw new Error("expected invalid trash cursor to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "trash",
      operation: "continue",
      statusCode: 400,
    });
  }
});

await run("trash list works with app token", async () => {
  const result = await oauthClient.trash.list({
    per_page: 1,
  });

  assert(Array.isArray(result.files), "expected app-token trash files array");

  return {
    count: result.files.length,
    total: result.total,
  };
});

await run("trash disposable lifecycle", async () => {
  const baseline = await authClient.trash.list({
    per_page: 1,
  });

  const seed = Date.now();
  const created: number[] = [];
  const restoredIds = new Set<number>();
  const trashedIds = new Set<number>();

  try {
    for (const suffix of ["a", "b", "c"]) {
      const folder = await authClient.files.createFolder({
        name: `codex_sdk_trash_${seed}_${suffix}`,
        parent_id: 0,
      });

      created.push(folder.id);
    }

    await authClient.files.delete(created);
    created.forEach((id) => trashedIds.add(id));

    const listing = await collectTrashPages(1);
    created.forEach((id) =>
      assert(
        listing.files.some((file) => file.id === id),
        `expected trashed probe ${id} in trash listing`,
      ),
    );
    const probeEntries = listing.files.filter((file) => created.includes(file.id));
    assert(
      probeEntries.length === created.length,
      "expected every disposable probe in trash listing",
    );
    probeEntries.forEach((file) => {
      assert(file.folder_type === "REGULAR", "expected trash folders to keep REGULAR folder_type");
      assert(typeof file.deleted_at === "string", "expected deleted_at on trash entries");
      assert(typeof file.expiration_date === "string", "expected expiration_date on trash entries");
      assert(
        file.parent_id === null || typeof file.parent_id === "number",
        "expected parent_id to stay nullable-number shaped on trash entries",
      );
    });
    assert(listing.pages >= 2, "expected cursor continuation pages for disposable trash probes");

    await authClient.trash.restore({
      file_ids: [created[0]],
    });
    trashedIds.delete(created[0]);

    const restored = await waitForFileReachable(created[0]);
    assert(restored, "expected restored folder to become reachable after restore starts");
    assert(restored.id === created[0], "expected restored folder to be reachable again");
    restoredIds.add(created[0]);

    await authClient.trash.delete({
      file_ids: [created[1]],
    });
    trashedIds.delete(created[1]);

    if (baseline.total === 0) {
      await authClient.trash.empty();
      trashedIds.clear();

      const afterEmpty = await authClient.trash.list({
        per_page: 5,
      });
      assert(afterEmpty.total === 0, "expected empty trash after disposable cleanup");
    } else {
      await authClient.trash.delete({
        file_ids: [created[2]],
      });
      trashedIds.delete(created[2]);
    }

    return {
      baseline_total: baseline.total,
      continuation_pages: listing.pages,
      restored_id: created[0],
      used_empty: baseline.total === 0,
    };
  } finally {
    if (trashedIds.size > 0) {
      await authClient.trash
        .delete({
          file_ids: [...trashedIds],
        })
        .catch(() => undefined);
    }

    if (restoredIds.size > 0) {
      await deleteNow([...restoredIds]).catch(() => undefined);
    }
  }
});

await run("trash bulk restore restores multiple top-level entries", async () => {
  const seed = Date.now();
  const created: number[] = [];
  const restoredIds = new Set<number>();
  const trashedIds = new Set<number>();

  try {
    for (const suffix of ["bulk_a", "bulk_b"]) {
      const folder = await authClient.files.createFolder({
        name: `codex_sdk_trash_${seed}_${suffix}`,
        parent_id: 0,
      });

      created.push(folder.id);
    }

    await authClient.files.delete(created);
    created.forEach((id) => trashedIds.add(id));

    const listing = await collectTrashPages(10);
    created.forEach((id) =>
      assert(
        listing.files.some((file) => file.id === id),
        `expected bulk trashed probe ${id} in trash listing`,
      ),
    );

    await authClient.trash.restore({
      file_ids: created,
    });

    const restored = await Promise.all(created.map((id) => waitForFileReachable(id)));
    restored.forEach((file) => restoredIds.add(file.id));
    created.forEach((id) => trashedIds.delete(id));

    return {
      restored_ids: restored.map((file) => file.id),
    };
  } finally {
    if (trashedIds.size > 0) {
      await authClient.trash
        .delete({
          file_ids: [...trashedIds],
        })
        .catch(() => undefined);
    }

    if (restoredIds.size > 0) {
      await deleteNow([...restoredIds]).catch(() => undefined);
    }
  }
});

await run("trash child restore and delete reject non-toplevel entries", async () => {
  const seed = Date.now();
  let parentId = undefined;
  let childId = undefined;
  let parentRestored = false;

  try {
    const parent = await authClient.files.createFolder({
      name: `codex_sdk_trash_${seed}_parent`,
      parent_id: 0,
    });
    parentId = parent.id;

    const child = await authClient.files.createFolder({
      name: `codex_sdk_trash_${seed}_child`,
      parent_id: parent.id,
    });
    childId = child.id;

    await authClient.files.delete([parent.id]);

    const listing = await collectTrashPages(10);
    assert(
      listing.files.some((file) => file.id === parent.id),
      "expected trashed parent in top-level trash listing",
    );
    assert(
      !listing.files.some((file) => file.id === child.id),
      "expected trashed child to stay hidden from top-level trash listing",
    );

    try {
      await authClient.trash.restore({
        file_ids: [child.id],
      });
      throw new Error("expected child restore to fail");
    } catch (error) {
      assertOperationError(error, {
        domain: "trash",
        errorType: "TRASH_FILE_NOT_FOUND",
        operation: "restore",
        statusCode: 404,
      });
    }

    try {
      await authClient.trash.delete({
        file_ids: [child.id],
      });
      throw new Error("expected child delete to fail");
    } catch (error) {
      assertOperationError(error, {
        domain: "trash",
        errorType: "TRASH_FILE_NOT_FOUND",
        operation: "delete",
        statusCode: 404,
      });
    }

    await authClient.trash.restore({
      file_ids: [parent.id],
    });
    parentRestored = true;

    const [restoredParent, restoredChild] = await Promise.all([
      waitForFileReachable(parent.id),
      waitForFileReachable(child.id),
    ]);

    return {
      restored_child_id: restoredChild.id,
      restored_parent_id: restoredParent.id,
    };
  } finally {
    if (parentRestored && parentId !== undefined) {
      await deleteNow([parentId]).catch(() => undefined);
    } else if (parentId !== undefined) {
      await authClient.trash
        .delete({
          file_ids: [parentId],
        })
        .catch(() => undefined);
    }

    if (childId !== undefined && parentRestored) {
      await deleteNow([childId]).catch(() => undefined);
    }
  }
});

await run("trash restore missing file yields typed 404", async () => {
  try {
    await authClient.trash.restore({
      file_ids: [2147483647],
    });
    throw new Error("expected restore missing file to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "trash",
      errorType: "TRASH_FILE_NOT_FOUND",
      operation: "restore",
      statusCode: 404,
    });
  }
});

await run("trash restore missing file works with app token", async () => {
  try {
    await oauthClient.trash.restore({
      file_ids: [2147483647],
    });
    throw new Error("expected app-token restore missing file to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "trash",
      errorType: "TRASH_FILE_NOT_FOUND",
      operation: "restore",
      statusCode: 404,
    });
  }
});

await run("trash delete missing file yields typed 404", async () => {
  try {
    await authClient.trash.delete({
      file_ids: [2147483647],
    });
    throw new Error("expected delete missing file to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "trash",
      errorType: "TRASH_FILE_NOT_FOUND",
      operation: "delete",
      statusCode: 404,
    });
  }
});

await run("trash delete missing file works with app token", async () => {
  try {
    await oauthClient.trash.delete({
      file_ids: [2147483647],
    });
    throw new Error("expected app-token delete missing file to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "trash",
      errorType: "TRASH_FILE_NOT_FOUND",
      operation: "delete",
      statusCode: 404,
    });
  }
});

finish();
