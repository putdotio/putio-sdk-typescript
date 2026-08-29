import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vite-plus/test";

import { writeLiveTokenCache } from "./live-token-cache.ts";

describe("live token cache", () => {
  it("writes dotenv tokens with 0600 permissions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "putio-sdk-live-tokens-"));
    try {
      const url = pathToFileURL(join(directory, ".env.live-tokens"));
      await writeLiveTokenCache(url, {
        firstPartyToken: "first-test-token",
        thirdPartyToken: "third-test-token",
      });

      expect(await readFile(url, "utf8")).toBe(
        'PUTIO_TOKEN_FIRST_PARTY="first-test-token"\n' +
          'PUTIO_TOKEN_THIRD_PARTY="third-test-token"\n',
      );
      expect((await stat(url)).mode & 0o777).toBe(0o600);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
