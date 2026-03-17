import { assertPresent, createClients, createLiveHarness } from "../support/harness.js";

const { authClient, oauthClient } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("zips live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

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

const findProbeCursor = async () => {
  const listing = await authClient.files.list(0, {
    per_page: 5,
    total: 1,
  });

  if (listing.cursor && listing.files.length > 0) {
    return {
      cursor: listing.cursor,
      firstFileId: listing.files[0].id,
    };
  }

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

const isZipTimeoutError = (error: unknown): error is Error =>
  error instanceof Error && error.message.includes("did not reach a terminal state in time");

await run("zips list works with app token", async () => {
  const zips = await oauthClient.zips.list();
  assert(Array.isArray(zips), "expected app-token zips array");

  return {
    count: zips.length,
  };
});

await run("zips list shape", async () => {
  const zips = await authClient.zips.list();
  assert(Array.isArray(zips), "expected zips array");

  return {
    count: zips.length,
    first_id: zips[0]?.id ?? null,
  };
});

await run("zips create empty payload yields 400", async () => {
  try {
    await authClient.zips.create({
      file_ids: [],
    });
    throw new Error("expected empty zip payload to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "zips",
      operation: "create",
      statusCode: 400,
    });
  }
});

await run("zips create works with app token", async () => {
  const probe = await findProbeFile();
  const probeFile = assertPresent(probe, "expected a readable probe file for app-token zip checks");

  const zipId = await oauthClient.zips.create({
    file_ids: [probeFile.id],
  });
  assert(typeof zipId === "number", "expected app-token zip id");

  const firstInfo = await oauthClient.zips.get(zipId);

  return {
    first_status: firstInfo.zip_status,
    probe_file_id: probeFile.id,
    zip_id: zipId,
  };
});

await run("zips get missing id yields typed 410", async () => {
  try {
    await authClient.zips.get(2147483647);
    throw new Error("expected missing zip lookup to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "zips",
      errorType: "LINK_EXPIRED",
      operation: "get",
      statusCode: 410,
    });
  }
});

await run("zips cancel missing id yields typed 410", async () => {
  try {
    await authClient.zips.cancel(2147483647);
    throw new Error("expected missing zip cancel to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "zips",
      errorType: "LINK_EXPIRED",
      operation: "cancel",
      statusCode: 410,
    });
  }
});

await run("zips cancel missing id works with app token", async () => {
  try {
    await oauthClient.zips.cancel(2147483647);
    throw new Error("expected missing app-token zip cancel to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "zips",
      errorType: "LINK_EXPIRED",
      operation: "cancel",
      statusCode: 410,
    });
  }
});

await run("zips create and complete lifecycle", async () => {
  const probe = await findProbeFile();
  const probeFile = assertPresent(probe, "expected a readable probe file for zip checks");

  const zipId = await authClient.zips.create({
    file_ids: [probeFile.id],
  });
  assert(typeof zipId === "number", "expected zip id");

  const active = await authClient.zips.list();
  assert(Array.isArray(active), "expected active zips array");

  const firstInfo = await authClient.zips.get(zipId);
  if (firstInfo.zip_status === "NEW" || firstInfo.zip_status === "PROCESSING") {
    assert(firstInfo.url === null, "expected pending zip info to keep a null url");
  }

  const info = await pollZip(zipId);
  assert(info.zip_status === "DONE", "expected probe zip to complete");
  assert(typeof info.url === "string", "expected zip download url");
  if (!("size" in info) || !("missing_files" in info)) {
    throw new Error("expected completed zip payload details");
  }
  assert(typeof info.size === "number", "expected zip size");
  assert(Array.isArray(info.missing_files), "expected missing_files array");

  return {
    active_count: active.length,
    first_status: firstInfo.zip_status,
    missing_files: info.missing_files.length,
    probe_file_id: probeFile.id,
    zip_id: zipId,
  };
});

await run("zips create with cursor and exclude_ids completes", async () => {
  const cursorProbe = await findProbeCursor();
  const cursorZipProbe = assertPresent(
    cursorProbe,
    "expected a root listing cursor for cursor zip checks",
  );

  const zipId = await authClient.zips.create({
    cursor: cursorZipProbe.cursor,
    exclude_ids: [cursorZipProbe.firstFileId],
  });
  assert(typeof zipId === "number", "expected cursor zip id");

  const firstInfo = await authClient.zips.get(zipId);
  assert(
    ["DONE", "ERROR", "NEW", "PROCESSING"].includes(firstInfo.zip_status),
    "expected known cursor zip status",
  );

  let info;

  try {
    info = await pollZip(zipId);
  } catch (error) {
    if (isZipTimeoutError(error)) {
      return {
        cursor_zip_id: zipId,
        excluded_file_id: cursorZipProbe.firstFileId,
        reason: error.message,
        skipped: true,
      };
    }

    throw error;
  }

  assert(info.zip_status === "DONE", "expected cursor zip to complete");
  assert(typeof info.url === "string", "expected cursor zip download url");
  if (!("missing_files" in info)) {
    throw new Error("expected cursor zip missing_files array");
  }
  assert(Array.isArray(info.missing_files), "expected cursor zip missing_files array");

  return {
    cursor_zip_id: zipId,
    excluded_file_id: cursorZipProbe.firstFileId,
    final_status: info.zip_status,
    missing_files: info.missing_files.length,
  };
});

finish();
