import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { loadEnvFiles } from "./secrets.ts";

describe("live secret env loading", () => {
  it("keeps process env first, then token cache, .env.local, and .env", () => {
    const dir = mkdtempSync(join(tmpdir(), "putio-sdk-env-"));
    const cachePath = join(dir, ".env.live-tokens");
    const localPath = join(dir, ".env.local");
    const envPath = join(dir, ".env");

    const directKey = "PUTIO_SDK_TEST_DIRECT_PRECEDENCE";
    const cacheKey = "PUTIO_SDK_TEST_CACHE_PRECEDENCE";
    const localKey = "PUTIO_SDK_TEST_LOCAL_PRECEDENCE";
    const envKey = "PUTIO_SDK_TEST_ENV_FALLBACK";
    const originalValues = new Map(
      [directKey, cacheKey, localKey, envKey].map((key) => [key, process.env[key]]),
    );

    try {
      process.env[directKey] = "direct";
      delete process.env[cacheKey];
      delete process.env[localKey];
      delete process.env[envKey];

      writeFileSync(cachePath, `${directKey}=cache\n${cacheKey}=cache\n`);
      writeFileSync(localPath, `${directKey}=local\n${localKey}=local\n`);
      writeFileSync(envPath, `${directKey}=env\n${cacheKey}=env\n${localKey}=env\n${envKey}=env\n`);

      loadEnvFiles([cachePath, localPath, envPath]);

      expect(process.env[directKey]).toBe("direct");
      expect(process.env[cacheKey]).toBe("cache");
      expect(process.env[localKey]).toBe("local");
      expect(process.env[envKey]).toBe("env");
    } finally {
      for (const [key, value] of originalValues) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }

      rmSync(dir, { force: true, recursive: true });
    }
  });
});
