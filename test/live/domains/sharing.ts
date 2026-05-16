import {
  assertPresent,
  createClients,
  createPromiseClient,
  createLiveHarness,
  isFileUploadFileResult,
} from "../support/harness.js";
import { requireLiveFriend, requireLiveFriendWithSharedFiles } from "../support/friends.ts";
import { requireOwnedVideoFixture } from "../support/media.ts";

const { authClient, oauthClient } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("sharing live");
const { assert, assertErrorTag, assertOperationError, finish, run, sleep } = live;

void sleep;

type OwnedProbeFile = {
  readonly cleanupIds: readonly number[];
  readonly id: number;
};

const cleanupOwnedProbeFiles = async (ids: readonly number[]): Promise<void> => {
  if (ids.length === 0) {
    return;
  }

  await authClient.files.delete(ids, { skipTrash: true }).catch(() => undefined);
};

const createOwnedProbeFile = async (): Promise<OwnedProbeFile> => {
  const name = `codex_sdk_public_share_probe_${Date.now()}.txt`;
  const upload = await authClient.files.upload({
    file: new File(["sdk public share probe\n"], name, {
      type: "text/plain",
    }),
    fileName: name,
    parentId: 0,
  });

  if (!isFileUploadFileResult(upload)) {
    throw new Error("expected public sharing probe upload to return a file");
  }

  return { cleanupIds: [upload.file.id], id: upload.file.id };
};

const pollClone = async (cloneId: number) => {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const info = await authClient.sharing.getCloneInfo(cloneId);

    if (info.shared_file_clone_status === "DONE" || info.shared_file_clone_status === "ERROR") {
      return info;
    }

    await sleep(1_500);
  }

  throw new Error(`clone task ${cloneId} did not reach a terminal state in time`);
};

const findCloneSource = async (parentId: number, depth = 0) => {
  const listing = await authClient.files.list(parentId, {
    per_page: 20,
  });

  const file = listing.files.find((item) => item.file_type !== "FOLDER");

  if (file) {
    return file;
  }

  if (depth >= 4) {
    return null;
  }

  const folder = listing.files.find((item) => item.file_type === "FOLDER");

  if (!folder) {
    return null;
  }

  return findCloneSource(folder.id, depth + 1);
};

const createDisposablePublicShare = (fileId: number) =>
  authClient.sharing.publicShares.create(fileId);

await run("sharing list shared files shape", async () => {
  const sharedFiles = await authClient.sharing.listSharedFiles();
  assert(Array.isArray(sharedFiles), "expected shared files array");
  return { count: sharedFiles.length };
});

await run("sharing everyone lifecycle", async () => {
  const seed = Date.now();
  const folder = await authClient.files.createFolder({
    name: `codex_sdk_sharing_everyone_${seed}`,
    parent_id: 0,
  });

  try {
    await authClient.sharing.shareFiles({
      ids: [folder.id],
      target: { type: "everyone" },
    });

    const sharedFiles = await authClient.sharing.listSharedFiles();
    const shared = sharedFiles.find((file) => file.id === folder.id);
    assert(shared?.shared_with === "everyone", "expected folder to be shared with everyone");

    const sharedWith = await authClient.sharing.getSharedWith(folder.id);
    assert(sharedWith.share_type === "everyone", "expected everyone share type");

    await authClient.sharing.unshare({
      fileId: folder.id,
    });

    const after = await authClient.sharing.listSharedFiles();
    assert(!after.some((file) => file.id === folder.id), "expected folder to be unshared");

    return {
      file_id: folder.id,
      share_type: sharedWith.share_type,
    };
  } finally {
    await authClient.files.delete([folder.id], { skipTrash: true }).catch(() => undefined);
  }
});

await run("sharing specific-friend lifecycle", async () => {
  const friend = await requireLiveFriend(authClient, createPromiseClient);

  const seed = Date.now();
  const folder = await authClient.files.createFolder({
    name: `codex_sdk_sharing_friend_${seed}`,
    parent_id: 0,
  });

  try {
    await authClient.sharing.shareFiles({
      ids: [folder.id],
      target: {
        friendNames: [friend.name],
        type: "friends",
      },
    });

    const sharedWith = await authClient.sharing.getSharedWith(folder.id);
    if (sharedWith.share_type !== "friends") {
      throw new Error("expected friend share type");
    }
    assert(sharedWith.shares.length > 0, "expected at least one friend share");
    assert(
      sharedWith.shares.every(
        (share) =>
          typeof share.share_id === "number" &&
          typeof share.user_name === "string" &&
          share.user_name.length > 0 &&
          typeof share.user_avatar_url === "string" &&
          share.user_avatar_url.length > 0,
      ),
      "expected shared-with-v2 friend payload details",
    );

    await authClient.sharing.unshare({
      fileId: folder.id,
      shares: sharedWith.shares.map((share) => share.share_id),
    });

    const after = await authClient.sharing.listSharedFiles();
    assert(!after.some((file) => file.id === folder.id), "expected folder to be unshared");

    return {
      friend: friend.name,
      file_id: folder.id,
      share_count: sharedWith.shares.length,
    };
  } finally {
    await authClient.files.delete([folder.id], { skipTrash: true }).catch(() => undefined);
  }
});

await run("sharing child of shared parent yields typed already shared", async () => {
  const friend = await requireLiveFriend(authClient, createPromiseClient);

  const seed = Date.now();
  const parent = await authClient.files.createFolder({
    name: `codex_sdk_sharing_parent_${seed}`,
    parent_id: 0,
  });
  const child = await authClient.files.createFolder({
    name: `codex_sdk_sharing_child_${seed}`,
    parent_id: parent.id,
  });

  try {
    await authClient.sharing.shareFiles({
      ids: [parent.id],
      target: {
        friendNames: [friend.name],
        type: "friends",
      },
    });

    try {
      await authClient.sharing.shareFiles({
        ids: [child.id],
        target: {
          friendNames: [friend.name],
          type: "friends",
        },
      });
      throw new Error("expected child of shared parent to fail");
    } catch (error) {
      return assertOperationError(error, {
        domain: "sharing",
        errorType: "ALREADY_SHARED",
        operation: "shareFiles",
        statusCode: 400,
      });
    }
  } finally {
    await authClient.sharing
      .unshare({
        fileId: parent.id,
      })
      .catch(() => undefined);
    await authClient.files.delete([parent.id], { skipTrash: true }).catch(() => undefined);
  }
});

await run("sharing unshare missing file yields typed 404", async () => {
  try {
    await authClient.sharing.unshare({
      fileId: 2147483647,
    });
    throw new Error("expected missing file to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "sharing",
      operation: "unshare",
      statusCode: 404,
    });
  }
});

await run("sharing shared-with missing file currently yields generic 500", async () => {
  try {
    await authClient.sharing.getSharedWith(2147483647);
    throw new Error("expected missing shared-with lookup to fail");
  } catch (error) {
    return assertErrorTag(error, {
      status: 500,
      tag: "PutioApiError",
    });
  }
});

await run("sharing public share lifecycle", async () => {
  const probe = await createOwnedProbeFile();

  try {
    const publicShare = await createDisposablePublicShare(probe.id);

    try {
      const listed = await authClient.sharing.publicShares.list();
      assert(
        listed.some((share) => share.id === publicShare.id),
        "expected created public share in list",
      );

      const publicClient = await createPromiseClient({
        accessToken: publicShare.token,
      });

      const details = await publicClient.sharing.publicAccess.get();
      assert(details.id === publicShare.id, "expected public share details id");

      const files = await publicClient.sharing.publicAccess.listFiles({
        parent_id: publicShare.user_file.id,
        total: 1,
      });
      assert(files.parent?.id === publicShare.user_file.id, "expected public share parent id");

      const url = await publicClient.sharing.publicAccess.getFileUrl(publicShare.user_file.id);
      assert(url.startsWith("https://"), "expected public file url");

      let missingFileStatus = 0;
      try {
        await publicClient.sharing.publicAccess.getFileUrl(2147483647);
        throw new Error("expected missing public-share file url to fail");
      } catch (error) {
        missingFileStatus = assertOperationError(error, {
          domain: "sharing",
          operation: "getPublicShareFileUrl",
          statusCode: 404,
        }).status;
      }

      let invalidCursorStatus = 0;
      try {
        await publicClient.sharing.publicAccess.continueFiles("definitely-invalid-cursor", {
          per_page: 1,
        });
        throw new Error("expected invalid public-share cursor to fail");
      } catch (error) {
        invalidCursorStatus = assertOperationError(error, {
          domain: "sharing",
          operation: "continuePublicShareFiles",
          statusCode: 400,
        }).status;
      }

      return {
        id: publicShare.id,
        invalid_cursor_status: invalidCursorStatus,
        missing_file_status: missingFileStatus,
        public_file_id: publicShare.user_file.id,
      };
    } finally {
      await authClient.sharing.publicShares.delete(publicShare.id);
    }
  } finally {
    await cleanupOwnedProbeFiles(probe.cleanupIds);
  }
});

await run("sharing public share access without token yields configuration error", async () => {
  const publicClient = await createPromiseClient();

  try {
    await publicClient.sharing.publicAccess.get();
    throw new Error("expected public share bootstrap without token to fail");
  } catch (error) {
    return assertErrorTag(error, {
      tag: "PutioConfigurationError",
    });
  }
});

await run("sharing public share pagination mirrors backend contract", async () => {
  const seed = Date.now();
  const folder = await authClient.files.createFolder({
    name: `codex_sdk_public_share_pagination_${seed}`,
    parent_id: 0,
  });

  try {
    const childA = await authClient.files.createFolder({
      name: `codex_sdk_public_share_child_a_${seed}`,
      parent_id: folder.id,
    });
    const childB = await authClient.files.createFolder({
      name: `codex_sdk_public_share_child_b_${seed}`,
      parent_id: folder.id,
    });

    const publicShare = await createDisposablePublicShare(folder.id);

    try {
      const publicClient = await createPromiseClient({
        accessToken: publicShare.token,
      });

      const firstPage = await publicClient.sharing.publicAccess.listFiles({
        parent_id: publicShare.user_file.id,
        per_page: 1,
        total: 1,
      });

      assert(firstPage.files.length === 1, "expected first public page item");
      assert(firstPage.total === 2, "expected public share total count");
      assert(typeof firstPage.cursor === "string", "expected pagination cursor");

      const secondPage = await publicClient.sharing.publicAccess.continueFiles(
        assertPresent(firstPage.cursor, "expected pagination cursor"),
        {
          per_page: 1,
        },
      );

      assert(secondPage.files.length === 1, "expected second public page item");
      assert(secondPage.cursor === null, "expected no cursor after second page");

      const seenIds = [...firstPage.files, ...secondPage.files].map((file) => file.id);
      assert(
        seenIds.includes(childA.id) && seenIds.includes(childB.id),
        "expected paginated public share results to contain both children",
      );

      return {
        public_share_id: publicShare.id,
        total: firstPage.total,
      };
    } finally {
      await authClient.sharing.publicShares.delete(publicShare.id);
    }
  } finally {
    await authClient.files.delete([folder.id], { skipTrash: true }).catch(() => undefined);
  }
});

await run("sharing public share parent media flags", async () => {
  const probe = await requireOwnedVideoFixture(authClient);

  const publicShare = await createDisposablePublicShare(probe.id);

  try {
    const publicClient = await createPromiseClient({
      accessToken: publicShare.token,
    });

    const files = await publicClient.sharing.publicAccess.listFiles({
      media_info_parent: 1,
      mp4_status_parent: 1,
      parent_id: publicShare.user_file.id,
      stream_url_parent: 1,
      total: 1,
      video_metadata_parent: 1,
    });

    const parent = assertPresent(files.parent, "expected public share parent");
    assert(parent.id === publicShare.user_file.id, "expected public share parent id");
    assert("stream_url" in parent, "expected public parent stream_url");
    assert("video_metadata" in parent, "expected public parent video_metadata");
    assert("media_info" in parent, "expected public parent media_info");
    assert(typeof parent.need_convert === "boolean", "expected public parent need_convert");

    return {
      parent_id: parent.id,
      public_share_id: publicShare.id,
      total: files.total ?? null,
    };
  } finally {
    await authClient.sharing.publicShares.delete(publicShare.id);
  }
});

await run("sharing public share root create yields typed error", async () => {
  try {
    await authClient.sharing.publicShares.create(0);
    throw new Error("expected root public share create to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "sharing",
      errorType: "PUBLIC_SHARE_FOLDER_ROOT_NOT_ALLOWED",
      operation: "createPublicShare",
      statusCode: 400,
    });
  }
});

await run("sharing public share list requires restricted scope for oauth token", async () => {
  try {
    await oauthClient.sharing.publicShares.list();
    throw new Error("expected default-scope public share list to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "sharing",
      errorType: "invalid_scope",
      operation: "listPublicShares",
      statusCode: 401,
    });
  }
});

await run("sharing clone missing task yields typed not found", async () => {
  try {
    await authClient.sharing.getCloneInfo(2147483647);
    throw new Error("expected missing clone task to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "sharing",
      errorType: "SHARED_FILE_CLONE_NOT_FOUND",
      operation: "getCloneInfo",
      statusCode: 404,
    });
  }
});

await run("sharing clone lifecycle", async () => {
  await requireLiveFriendWithSharedFiles(authClient, createPromiseClient);

  const sharedRoots = await authClient.files.list("friends", {
    per_page: 10,
  });
  const sharedRoot = assertPresent(sharedRoots.files[0], "expected shared root fixture");

  const source = assertPresent(
    await findCloneSource(sharedRoot.id),
    "expected clone source fixture under shared root",
  );

  const destination = await authClient.files.createFolder({
    name: `codex_sdk_clone_target_${Date.now()}`,
    parent_id: 0,
  });

  try {
    const clone = await authClient.sharing.clone({
      ids: [source.id],
      parentId: destination.id,
    });

    const info = await pollClone(clone.id);
    assert(info.shared_file_clone_status === "DONE", "expected clone to complete successfully");

    const destinationContents = await authClient.files.list(destination.id, {
      per_page: 20,
    });
    assert(destinationContents.files.length > 0, "expected cloned content in destination");

    return {
      clone_id: clone.id,
      destination_id: destination.id,
      source_id: source.id,
    };
  } finally {
    await authClient.files.delete([destination.id], { skipTrash: true }).catch(() => undefined);
  }
});

finish();
