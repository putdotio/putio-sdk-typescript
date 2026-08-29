import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { resolveLiveTestTargets } from "./live-targets.ts";

describe("resolveLiveTestTargets", () => {
  it("accepts relative and absolute paths under test/live", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "putio-sdk-live-targets-"));
    const target = join(cwd, "test/live/files.test.ts");

    try {
      await mkdir(join(cwd, "test/live"), { recursive: true });
      await writeFile(target, "");

      expect(resolveLiveTestTargets(["./test/live/files.test.ts", target], cwd)).toEqual([
        target,
        target,
      ]);
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });

  it("rejects test files outside test/live", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "putio-sdk-live-targets-"));
    const target = join(cwd, "test/files.test.ts");

    try {
      await mkdir(join(cwd, "test"), { recursive: true });
      await writeFile(target, "");

      expect(() => resolveLiveTestTargets([target], cwd)).toThrow(
        `Unsupported live test target: ${target}`,
      );
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});
