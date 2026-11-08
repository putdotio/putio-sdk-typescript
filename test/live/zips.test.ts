import { test } from "vite-plus/test";

import {
  assert,
  assertPresent,
  createLiveTokenClients,
  isFileUploadFileResult,
  rejectsWithOperationError,
  sleep,
} from "./support/harness.js";

const { authClient, oauthClient } = createLiveTokenClients();

const findProbeFile = async (
  parentId = 0,
  depth = 0,
): Promise<Awaited<ReturnType<typeof authClient.files.get>> | null> => {
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

  for (const folder of listing.files.filter((item) => item.file_type === "FOLDER")) {
    const nested = await findProbeFile(folder.id, depth + 1);

    if (nested) {
      return nested;
    }
  }

  return null;
};

const findProbeCursor = async (): Promise<{
  readonly cursor: string;
  readonly firstFileId: number;
  readonly folderId: number;
}> => {
  const prefix = `putio-typescript-sdk-zip-cursor-${Date.now()}`;
  const folder = await authClient.files.createFolder({ name: prefix, parent_id: 0 });

  try {
    for (let index = 0; index < 6; index += 1) {
      const name = `${prefix}-${index}.txt`;

      const upload = await authClient.files.upload({
        file: new File([`sdk zip cursor probe ${index}\n`], name, {
          type: "text/plain",
        }),
        fileName: name,
        parentId: folder.id,
      });

      if (!isFileUploadFileResult(upload)) {
        throw new Error("expected cursor zip probe upload to return a file");
      }
    }

    const listing = await authClient.files.list(folder.id, {
      per_page: 5,
      total: 1,
    });

    const cursor = assertPresent(listing.cursor, "expected a probe folder listing cursor");
    const firstFile = assertPresent(listing.files[0], "expected a probe folder listing file");

    return { cursor, firstFileId: firstFile.id, folderId: folder.id };
  } catch (error) {
    await authClient.files.delete([folder.id], { skipTrash: true }).catch(() => undefined);
    throw error;
  }
};

const pollZip = async (zipId: number) => {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const info = await authClient.zips.get(zipId);

    if (info.zip_status === "DONE" || info.zip_status === "ERROR") {
      return info;
    }

    await sleep(1_000);
  }

  throw new Error(`zip ${zipId} did not reach a terminal state in time`);
};

test("zips list works with app token", async () => {
  await oauthClient.zips.list();
});

test("zips create works with app token", async () => {
  const probeFile = assertPresent(
    await findProbeFile(),
    "expected a readable probe file for app-token zip checks",
  );

  const zipId = await oauthClient.zips.create({
    file_ids: [probeFile.id],
  });

  await oauthClient.zips.get(zipId);
});

test("zips get missing id yields typed 410", async () => {
  await rejectsWithOperationError(authClient.zips.get(2147483647), {
    domain: "zips",
    errorType: "LINK_EXPIRED",
    operation: "get",
    statusCode: 410,
  });
});

test("zips cancel missing id yields typed 410", async () => {
  await rejectsWithOperationError(authClient.zips.cancel(2147483647), {
    domain: "zips",
    errorType: "LINK_EXPIRED",
    operation: "cancel",
    statusCode: 410,
  });
});

test("zips cancel missing id works with app token", async () => {
  await rejectsWithOperationError(oauthClient.zips.cancel(2147483647), {
    domain: "zips",
    errorType: "LINK_EXPIRED",
    operation: "cancel",
    statusCode: 410,
  });
});

test("zips create and complete lifecycle", async () => {
  const probeFile = assertPresent(
    await findProbeFile(),
    "expected a readable probe file for zip checks",
  );

  const zipId = await authClient.zips.create({
    file_ids: [probeFile.id],
  });

  await authClient.zips.list();

  const firstInfo = await authClient.zips.get(zipId);

  if (firstInfo.zip_status === "NEW" || firstInfo.zip_status === "PROCESSING") {
    assert(firstInfo.url === null, "expected pending zip info to keep a null url");
  }

  const info = await pollZip(zipId);

  assert(info.zip_status === "DONE", "expected probe zip to complete");
  assert(info.url !== null, "expected zip download url");
  assert("size" in info && "missing_files" in info, "expected completed zip payload details");
});

test("zips create with cursor and exclude_ids completes", async () => {
  const cursorZipProbe = await findProbeCursor();

  try {
    const zipId = await authClient.zips.create({
      cursor: cursorZipProbe.cursor,
      exclude_ids: [cursorZipProbe.firstFileId],
    });

    const info = await pollZip(zipId);

    assert(info.zip_status === "DONE", "expected cursor zip to complete");
    assert(info.url !== null, "expected cursor zip download url");
    assert("missing_files" in info, "expected cursor zip missing_files array");
  } finally {
    await authClient.files
      .delete([cursorZipProbe.folderId], {
        skipTrash: true,
      })
      .catch(() => undefined);
  }
});
