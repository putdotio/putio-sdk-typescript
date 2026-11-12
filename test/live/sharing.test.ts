import { test } from "vite-plus/test";

import { createPutioSdkPromiseClient } from "../../dist/index.js";
import { requireLiveFriend, requireLiveFriendWithSharedFiles } from "./support/friends.js";
import {
  assert,
  assertPresent,
  createLiveTokenClients,
  isFileUploadFileResult,
  rejectsWithErrorTag,
  rejectsWithOperationError,
  sleep,
} from "./support/harness.js";
import { requireOwnedVideoFixture } from "./support/media.js";
import { hasSecondaryCredentialFixture } from "./support/secrets.js";

const { authClient, oauthClient } = createLiveTokenClients();

const MISSING_ID = 2147483647;

const secondaryFriendTest = test.skipIf(!hasSecondaryCredentialFixture());

const deleteOwnedFile = async (id: number): Promise<void> => {
  await authClient.files.delete([id], { skipTrash: true }).catch(() => undefined);
};

const createOwnedProbeFile = async (): Promise<number> => {
  const name = `putio-typescript-sdk-public-share-probe-${Date.now()}.txt`;

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

  return upload.file.id;
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

  const folder = listing.files.find((item) => item.file_type === "FOLDER");

  if (depth >= 4 || !folder) {
    return null;
  }

  return findCloneSource(folder.id, depth + 1);
};

test("sharing list shared files decodes", async () => {
  await authClient.sharing.listSharedFiles();
});

test("sharing everyone lifecycle", async () => {
  const folder = await authClient.files.createFolder({
    name: `putio-typescript-sdk-sharing-everyone-${Date.now()}`,
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
  } finally {
    await deleteOwnedFile(folder.id);
  }
});

secondaryFriendTest(
  "sharing specific-friend lifecycle (needs PUTIO_TEST_SECONDARY_USERNAME)",
  async () => {
    const friend = await requireLiveFriend(authClient);

    const folder = await authClient.files.createFolder({
      name: `putio-typescript-sdk-sharing-friend-${Date.now()}`,
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
          (share) => share.user_name.length > 0 && share.user_avatar_url.length > 0,
        ),
        "expected shared-with-v2 friend payload details",
      );

      await authClient.sharing.unshare({
        fileId: folder.id,
        shares: sharedWith.shares.map((share) => share.share_id),
      });

      const after = await authClient.sharing.listSharedFiles();
      assert(!after.some((file) => file.id === folder.id), "expected folder to be unshared");
    } finally {
      await deleteOwnedFile(folder.id);
    }
  },
);

secondaryFriendTest(
  "sharing child of shared parent yields typed already shared (needs PUTIO_TEST_SECONDARY_USERNAME)",
  async () => {
    const friend = await requireLiveFriend(authClient);
    const seed = Date.now();

    const parent = await authClient.files.createFolder({
      name: `putio-typescript-sdk-sharing-parent-${seed}`,
      parent_id: 0,
    });

    try {
      const child = await authClient.files.createFolder({
        name: `putio-typescript-sdk-sharing-child-${seed}`,
        parent_id: parent.id,
      });

      await authClient.sharing.shareFiles({
        ids: [parent.id],
        target: {
          friendNames: [friend.name],
          type: "friends",
        },
      });

      await rejectsWithOperationError(
        authClient.sharing.shareFiles({
          ids: [child.id],
          target: {
            friendNames: [friend.name],
            type: "friends",
          },
        }),
        {
          domain: "sharing",
          errorType: "ALREADY_SHARED",
          operation: "shareFiles",
          statusCode: 400,
        },
      );
    } finally {
      await authClient.sharing.unshare({ fileId: parent.id }).catch(() => undefined);
      await deleteOwnedFile(parent.id);
    }
  },
);

test("sharing unshare missing file yields typed 404", async () => {
  await rejectsWithOperationError(authClient.sharing.unshare({ fileId: MISSING_ID }), {
    domain: "sharing",
    operation: "unshare",
    statusCode: 404,
  });
});

test("sharing shared-with missing file yields typed not found", async () => {
  await rejectsWithOperationError(authClient.sharing.getSharedWith(MISSING_ID), {
    domain: "sharing",
    operation: "getSharedWith",
    statusCode: 404,
  });
});

test("sharing public share lifecycle", async () => {
  const probeId = await createOwnedProbeFile();

  try {
    const publicShare = await authClient.sharing.publicShares.create(probeId);

    try {
      const listed = await authClient.sharing.publicShares.list();
      assert(
        listed.some((share) => share.id === publicShare.id),
        "expected created public share in list",
      );

      const publicClient = createPutioSdkPromiseClient({
        accessToken: publicShare.token,
      });

      const details = await publicClient.sharing.publicAccess.get();
      assert(details.id === publicShare.id, "expected public share details id");

      const files = await publicClient.sharing.publicAccess.listFiles({
        breadcrumbs: 1,
        parent_id: publicShare.user_file.id,
        total: 1,
      });

      assert(Array.isArray(files.breadcrumbs), "expected requested breadcrumbs");

      assert(files.parent?.id === publicShare.user_file.id, "expected public share parent id");

      const url = await publicClient.sharing.publicAccess.getFileUrl(publicShare.user_file.id);
      assert(url.startsWith("https://"), "expected public file url");

      await rejectsWithOperationError(publicClient.sharing.publicAccess.getFileUrl(MISSING_ID), {
        domain: "sharing",
        operation: "getPublicShareFileUrl",
        statusCode: 404,
      });

      await rejectsWithOperationError(
        publicClient.sharing.publicAccess.continueFiles("definitely-invalid-cursor", {
          per_page: 1,
        }),
        {
          domain: "sharing",
          operation: "continuePublicShareFiles",
          statusCode: 400,
        },
      );
    } finally {
      await authClient.sharing.publicShares.delete(publicShare.id);
    }
  } finally {
    await deleteOwnedFile(probeId);
  }
});

test("sharing public share pagination mirrors backend contract", async () => {
  const seed = Date.now();

  const folder = await authClient.files.createFolder({
    name: `putio-typescript-sdk-public-share-pagination-${seed}`,
    parent_id: 0,
  });

  try {
    const childA = await authClient.files.createFolder({
      name: `putio-typescript-sdk-public-share-child-a-${seed}`,
      parent_id: folder.id,
    });

    const childB = await authClient.files.createFolder({
      name: `putio-typescript-sdk-public-share-child-b-${seed}`,
      parent_id: folder.id,
    });

    const publicShare = await authClient.sharing.publicShares.create(folder.id);

    try {
      const publicClient = createPutioSdkPromiseClient({
        accessToken: publicShare.token,
      });

      const firstPage = await publicClient.sharing.publicAccess.listFiles({
        parent_id: publicShare.user_file.id,
        per_page: 1,
        total: 1,
      });

      assert(firstPage.files.length === 1, "expected first public page item");
      assert(firstPage.total === 2, "expected public share total count");

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
    } finally {
      await authClient.sharing.publicShares.delete(publicShare.id);
    }
  } finally {
    await deleteOwnedFile(folder.id);
  }
});

test("sharing public share parent media flags", async () => {
  const probe = await requireOwnedVideoFixture(authClient);
  const publicShare = await authClient.sharing.publicShares.create(probe.id);

  try {
    const publicClient = createPutioSdkPromiseClient({
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
    assert(parent.need_convert !== undefined, "expected public parent need_convert");
  } finally {
    await authClient.sharing.publicShares.delete(publicShare.id);
  }
});

test("sharing public share root create yields typed validation error", async () => {
  await rejectsWithErrorTag(authClient.sharing.publicShares.create(0), {
    tag: "PutioValidationError",
  });
});

test("sharing public share list requires restricted scope for oauth token", async () => {
  await rejectsWithOperationError(oauthClient.sharing.publicShares.list(), {
    domain: "sharing",
    errorType: "invalid_scope",
    operation: "listPublicShares",
    statusCode: 401,
  });
});

test("sharing clone missing task yields typed not found", async () => {
  await rejectsWithOperationError(authClient.sharing.getCloneInfo(MISSING_ID), {
    domain: "sharing",
    errorType: "SHARED_FILE_CLONE_NOT_FOUND",
    operation: "getCloneInfo",
    statusCode: 404,
  });
});

test("sharing clone lifecycle", async () => {
  await requireLiveFriendWithSharedFiles(authClient);

  const sharedRoots = await authClient.files.list("friends", {
    per_page: 10,
  });

  const sharedRoot = assertPresent(sharedRoots.files[0], "expected shared root fixture");

  const source = assertPresent(
    await findCloneSource(sharedRoot.id),
    "expected clone source fixture under shared root",
  );

  const destination = await authClient.files.createFolder({
    name: `putio-typescript-sdk-clone-target-${Date.now()}`,
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
  } finally {
    await deleteOwnedFile(destination.id);
  }
});
