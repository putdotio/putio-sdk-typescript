import { readOptionalSecret } from "./secrets.ts";

import type { FileCore, PutioSdkPromiseClient } from "../../../dist/index.js";

const SAFE_OWNED_VIDEO_FIXTURE_NAMES = new Set([
  "Big Buck Bunny.mp4",
  "Cosmos Laundromat.mp4",
  "Mario1_507_512kb.mp4",
  "Mario1_507_HQ_512kb.mp4",
  "Sintel.mp4",
]);
const SAFE_OWNED_VIDEO_FIXTURE_PREFIXES = ["codex_sdk_", "codex-sdk-"];

const isSafeOwnedVideoFixtureName = (name: string): boolean =>
  SAFE_OWNED_VIDEO_FIXTURE_NAMES.has(name) ||
  SAFE_OWNED_VIDEO_FIXTURE_PREFIXES.some((prefix) => name.startsWith(prefix));

const parseConfiguredVideoFileId = (): number | null => {
  const raw = readOptionalSecret("PUTIO_LIVE_OWNED_VIDEO_FILE_ID");

  if (!raw) {
    return null;
  }

  const fileId = Number(raw);

  if (!Number.isSafeInteger(fileId) || fileId <= 0) {
    throw new Error("PUTIO_LIVE_OWNED_VIDEO_FILE_ID must be a positive integer.");
  }

  return fileId;
};

const assertSafeOwnedVideoFixture = (
  file: FileCore,
  source: "configured-id" | "safe-name",
  requireMp4Available: boolean,
): FileCore => {
  if (file.file_type !== "VIDEO") {
    throw new Error(`Owned video fixture ${file.id} must be a VIDEO file.`);
  }

  if (file.is_shared) {
    throw new Error(`Owned video fixture ${file.id} must not be a shared file.`);
  }

  if (source === "safe-name" && !isSafeOwnedVideoFixtureName(file.name)) {
    throw new Error(
      "Owned video fixture must use PUTIO_LIVE_OWNED_VIDEO_FILE_ID or a safe fixture name/prefix.",
    );
  }

  if (requireMp4Available && !file.is_mp4_available) {
    throw new Error(`Owned video fixture ${file.id} must have an available MP4.`);
  }

  return file;
};

export const requireOwnedVideoFixture = async (
  client: PutioSdkPromiseClient,
  options: {
    readonly requireMp4Available?: boolean;
  } = {},
): Promise<FileCore> => {
  const requireMp4Available = options.requireMp4Available === true;
  const configuredFileId = parseConfiguredVideoFileId();

  if (configuredFileId !== null) {
    const file = await client.files.get({
      id: configuredFileId,
      query: requireMp4Available ? { mp4_status: 1 } : {},
    });

    return assertSafeOwnedVideoFixture(file, "configured-id", requireMp4Available);
  }

  const search = await client.files.search({
    per_page: 100,
    query: "mp4",
  });
  const candidates = search.files.filter(
    (file) =>
      file.file_type === "VIDEO" &&
      file.is_shared === false &&
      isSafeOwnedVideoFixtureName(file.name),
  );

  for (const candidate of candidates) {
    const file = await client.files.get({
      id: candidate.id,
      query: requireMp4Available ? { mp4_status: 1 } : {},
    });

    if (!requireMp4Available || file.is_mp4_available) {
      return assertSafeOwnedVideoFixture(file, "safe-name", requireMp4Available);
    }
  }

  throw new Error(
    "Missing safe owned MP4 fixture. Set PUTIO_LIVE_OWNED_VIDEO_FILE_ID or upload an unshared codex_sdk_*/codex-sdk-* MP4 fixture.",
  );
};
