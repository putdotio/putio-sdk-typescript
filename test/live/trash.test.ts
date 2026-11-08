import { test } from "vite-plus/test";

import {
  assert,
  createLiveTokenClients,
  rejectsWithOperationError,
  sleep,
} from "./support/harness.js";

const { authClient, oauthClient } = createLiveTokenClients();

const withTrashEnabled = async <A>(runTest: () => Promise<A>): Promise<A> => {
  const settings = await authClient.account.getSettings();

  if (!settings.trash_enabled) {
    await authClient.account.saveSettings({
      trash_enabled: true,
    });
  }

  try {
    return await runTest();
  } finally {
    if (!settings.trash_enabled) {
      await authClient.account
        .saveSettings({
          trash_enabled: false,
        })
        .catch(() => undefined);
    }
  }
};

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

const collectTrashFiles = async (perPage: number, targetIds: ReadonlyArray<number> = []) => {
  const first = await authClient.trash.list({
    per_page: perPage,
  });

  const files = [...first.files];

  const hasAllTargets = () =>
    targetIds.every((targetId) => files.some((file) => file.id === targetId));

  let cursor = first.cursor;
  let pages = 1;

  while (cursor && !hasAllTargets()) {
    const next = await authClient.trash.continue(cursor, {
      per_page: perPage,
    });

    files.push(...next.files);
    cursor = next.cursor;
    pages += 1;

    if (pages > 50) {
      throw new Error("trash continuation exceeded 50 pages");
    }
  }

  return files;
};

test("trash list decodes", async () => {
  await authClient.trash.list({
    per_page: 5,
  });
});

test("trash continue invalid cursor yields typed 400", async () => {
  await rejectsWithOperationError(
    authClient.trash.continue("putio-typescript-sdk-invalid-trash-cursor", {
      per_page: 1,
    }),
    {
      domain: "trash",
      operation: "continue",
      statusCode: 400,
    },
  );
});

test("trash list works with app token", async () => {
  await oauthClient.trash.list({
    per_page: 1,
  });
});

test("trash disposable lifecycle", () =>
  withTrashEnabled(async () => {
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
          name: `putio-typescript-sdk-trash-${seed}-${suffix}`,
          parent_id: 0,
        });

        created.push(folder.id);
      }

      await authClient.files.delete(created);
      created.forEach((id) => trashedIds.add(id));

      const listing = await collectTrashFiles(50, created);

      created.forEach((id) => {
        const entry = listing.find((file) => file.id === id);

        assert(entry !== undefined, `expected trashed probe ${id} in trash listing`);
        assert(
          entry?.folder_type === "REGULAR",
          "expected trash folders to keep REGULAR folder_type",
        );
      });

      await authClient.trash.restore({
        file_ids: [created[0]],
      });
      trashedIds.delete(created[0]);

      const restored = await waitForFileReachable(created[0]);

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
  }));

test("trash bulk restore restores multiple top-level entries", () =>
  withTrashEnabled(async () => {
    const seed = Date.now();
    const created: number[] = [];
    const restoredIds = new Set<number>();
    const trashedIds = new Set<number>();

    try {
      for (const suffix of ["bulk_a", "bulk_b"]) {
        const folder = await authClient.files.createFolder({
          name: `putio-typescript-sdk-trash-${seed}-${suffix}`,
          parent_id: 0,
        });

        created.push(folder.id);
      }

      await authClient.files.delete(created);
      created.forEach((id) => trashedIds.add(id));

      const listing = await collectTrashFiles(50, created);

      created.forEach((id) =>
        assert(
          listing.some((file) => file.id === id),
          `expected bulk trashed probe ${id} in trash listing`,
        ),
      );

      await authClient.trash.restore({
        file_ids: created,
      });

      const restored = await Promise.all(created.map((id) => waitForFileReachable(id)));
      restored.forEach((file) => restoredIds.add(file.id));
      created.forEach((id) => trashedIds.delete(id));
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
  }));

test("trash child restore and delete reject non-toplevel entries", () =>
  withTrashEnabled(async () => {
    const seed = Date.now();
    let parentId = undefined;
    let childId = undefined;
    let parentRestored = false;

    try {
      const parent = await authClient.files.createFolder({
        name: `putio-typescript-sdk-trash-${seed}-parent`,
        parent_id: 0,
      });

      parentId = parent.id;

      const child = await authClient.files.createFolder({
        name: `putio-typescript-sdk-trash-${seed}-child`,
        parent_id: parent.id,
      });

      childId = child.id;

      await authClient.files.delete([parent.id]);

      const listing = await collectTrashFiles(10);

      assert(
        listing.some((file) => file.id === parent.id),
        "expected trashed parent in top-level trash listing",
      );
      assert(
        !listing.some((file) => file.id === child.id),
        "expected trashed child to stay hidden from top-level trash listing",
      );

      await rejectsWithOperationError(authClient.trash.restore({ file_ids: [child.id] }), {
        domain: "trash",
        errorType: "TRASH_FILE_NOT_FOUND",
        operation: "restore",
        statusCode: 404,
      });

      await rejectsWithOperationError(authClient.trash.delete({ file_ids: [child.id] }), {
        domain: "trash",
        errorType: "TRASH_FILE_NOT_FOUND",
        operation: "delete",
        statusCode: 404,
      });

      await authClient.trash.restore({
        file_ids: [parent.id],
      });
      parentRestored = true;

      await Promise.all([waitForFileReachable(parent.id), waitForFileReachable(child.id)]);
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
  }));

test("trash restore missing file works with app token", async () => {
  await rejectsWithOperationError(oauthClient.trash.restore({ file_ids: [2147483647] }), {
    domain: "trash",
    errorType: "TRASH_FILE_NOT_FOUND",
    operation: "restore",
    statusCode: 404,
  });
});

test("trash delete missing file works with app token", async () => {
  await rejectsWithOperationError(oauthClient.trash.delete({ file_ids: [2147483647] }), {
    domain: "trash",
    errorType: "TRASH_FILE_NOT_FOUND",
    operation: "delete",
    statusCode: 404,
  });
});
