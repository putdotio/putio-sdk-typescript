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

const createCursorProbeFiles = async () => {
  const ids: number[] = [];

  for (let index = 0; index < 6; index += 1) {
    const name = `putio-typescript-sdk-zip-cursor-${Date.now()}-${index}.txt`;

    const upload = await authClient.files.upload({
      file: new File([`sdk zip cursor probe ${index}\n`], name, {
        type: "text/plain",
      }),
      fileName: name,
      parentId: 0,
    });

    if (!isFileUploadFileResult(upload)) {
      throw new Error("expected cursor zip probe upload to return a file");
    }

    ids.push(upload.file.id);
  }

  return ids;
};

const findProbeCursor = async (): Promise<{
  readonly cleanupIds: ReadonlyArray<number>;
  readonly cursor: string;
  readonly firstFileId: number;
} | null> => {
  const cleanupIds = await createCursorProbeFiles();

  const listing = await authClient.files.list(0, {
    per_page: 5,
    total: 1,
  });

  if (listing.cursor && listing.files.length > 0) {
    return {
      cleanupIds,
      cursor: listing.cursor,
      firstFileId: listing.files[0].id,
    };
  }

  await authClient.files.delete(cleanupIds, { skipTrash: true }).catch(() => undefined);

  return null;
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
  const cursorZipProbe = assertPresent(
    await findProbeCursor(),
    "expected a root listing cursor for cursor zip checks",
  );

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
      .delete(cursorZipProbe.cleanupIds, {
        skipTrash: true,
      })
      .catch(() => undefined);
  }
});
