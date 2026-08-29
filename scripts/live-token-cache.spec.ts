import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { hasLiveTokenCache, writeLiveTokenCache } from "./live-token-cache.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("live token cache", () => {
  it("writes ignored dotenv tokens with owner-only permissions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "putio-sdk-live-tokens-"));
    temporaryDirectories.push(directory);
    const url = pathToFileURL(join(directory, ".env.live-tokens"));
    await writeLiveTokenCache(
      {
        firstPartyToken: "first-test-token",
        thirdPartyToken: "third-test-token",
      },
      url,
    );

    expect(await hasLiveTokenCache(url)).toBe(true);
    expect(await readFile(url, "utf8")).toBe(
      'PUTIO_TOKEN_FIRST_PARTY="first-test-token"\n' +
        'PUTIO_TOKEN_THIRD_PARTY="third-test-token"\n',
    );
    expect((await stat(url)).mode & 0o777).toBe(0o600);
  });
});
