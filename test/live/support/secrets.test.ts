import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { loadEnvFiles } from "./secrets.ts";

describe("live secret env loading", () => {
  it("keeps process env first, then .env.local, then .env", () => {
    const dir = mkdtempSync(join(tmpdir(), "putio-sdk-env-"));
    const localPath = join(dir, ".env.local");
    const envPath = join(dir, ".env");

    const directKey = "PUTIO_SDK_TEST_DIRECT_PRECEDENCE";
    const localKey = "PUTIO_SDK_TEST_LOCAL_PRECEDENCE";
    const envKey = "PUTIO_SDK_TEST_ENV_FALLBACK";

    try {
      process.env[directKey] = "direct";
      delete process.env[localKey];
      delete process.env[envKey];

      writeFileSync(localPath, `${directKey}=local\n${localKey}=local\n`);
      writeFileSync(envPath, `${directKey}=env\n${localKey}=env\n${envKey}=env\n`);

      loadEnvFiles([localPath, envPath]);

      expect(process.env[directKey]).toBe("direct");
      expect(process.env[localKey]).toBe("local");
      expect(process.env[envKey]).toBe("env");
    } finally {
      delete process.env[directKey];
      delete process.env[localKey];
      delete process.env[envKey];
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
