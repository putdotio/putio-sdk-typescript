import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { assertPresent, createLiveHarness } from "../support/harness.js";

const live = createLiveHarness("consumer live");
const { assert, finish, run } = live;

const packageDir = process.cwd();
const runCommand = (
  command: string,
  args: readonly string[],
  cwd: string,
): {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
} => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
  });

  return {
    status: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
};

await run("consumer tarball installs in temp project", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "putio-sdk-consumer-"));

  try {
    const packResult = runCommand("pnpm", ["pack", "--pack-destination", tempDir], packageDir);
    assert(packResult.status === 0, `pnpm pack failed: ${packResult.stderr || packResult.stdout}`);

    const tarball = assertPresent(
      readdirSync(tempDir).find((fileName) => fileName.endsWith(".tgz")),
      "expected packed tarball",
    );

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@putdotio/sdk": `file:${join(tempDir, tarball)}`,
          },
          name: "putio-sdk-consumer-live",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );

    const installResult = runCommand("pnpm", ["install"], tempDir);
    assert(
      installResult.status === 0,
      `pnpm install failed: ${installResult.stderr || installResult.stdout}`,
    );

    return {
      tarball,
    };
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

await run("consumer type exports compile outside workspace", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "putio-sdk-types-"));

  try {
    const packResult = runCommand("pnpm", ["pack", "--pack-destination", tempDir], packageDir);
    assert(packResult.status === 0, `pnpm pack failed: ${packResult.stderr || packResult.stdout}`);

    const tarball = assertPresent(
      readdirSync(tempDir).find((fileName) => fileName.endsWith(".tgz")),
      "expected packed tarball",
    );

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@putdotio/sdk": `file:${join(tempDir, tarball)}`,
          },
          name: "putio-sdk-consumer-types",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );

    writeFileSync(
      join(tempDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            module: "NodeNext",
            moduleResolution: "NodeNext",
            noEmit: true,
            strict: true,
            target: "ES2022",
          },
          include: ["consumer.ts"],
        },
        null,
        2,
      ),
    );

    writeFileSync(
      join(tempDir, "consumer.ts"),
      [
        "import {",
        "  DEFAULT_PUTIO_API_BASE_URL,",
        "  PutioOperationError,",
        "  createPutioSdkEffectClient,",
        "  createPutioSdkPromiseClient,",
        '} from "@putdotio/sdk";',
        "",
        "const promiseClient = createPutioSdkPromiseClient({",
        '  accessToken: "token",',
        "  baseUrl: DEFAULT_PUTIO_API_BASE_URL,",
        "});",
        "const effectClient = createPutioSdkEffectClient();",
        "",
        "void promiseClient.account.getInfo({ download_token: 1 });",
        "void effectClient.files.list(0, { per_page: 10 });",
        "",
        "const isSdkError = (error: unknown) => error instanceof PutioOperationError;",
        "void isSdkError;",
        "",
      ].join("\n"),
    );

    const installResult = runCommand("pnpm", ["install"], tempDir);
    assert(
      installResult.status === 0,
      `pnpm install failed: ${installResult.stderr || installResult.stdout}`,
    );

    const typecheckResult = runCommand(
      "pnpm",
      ["exec", "tsc", "--project", "tsconfig.json"],
      tempDir,
    );
    assert(
      typecheckResult.status === 0,
      `consumer typecheck failed: ${typecheckResult.stderr || typecheckResult.stdout}`,
    );

    return {
      tarball,
    };
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

await run("consumer runtime import works from installed package", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "putio-sdk-runtime-"));

  try {
    const packResult = runCommand("pnpm", ["pack", "--pack-destination", tempDir], packageDir);
    assert(packResult.status === 0, `pnpm pack failed: ${packResult.stderr || packResult.stdout}`);

    const tarball = assertPresent(
      readdirSync(tempDir).find((fileName) => fileName.endsWith(".tgz")),
      "expected packed tarball",
    );

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@putdotio/sdk": `file:${join(tempDir, tarball)}`,
          },
          name: "putio-sdk-consumer-runtime",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );

    writeFileSync(
      join(tempDir, "runtime.mjs"),
      [
        'import { DEFAULT_PUTIO_API_BASE_URL, createPutioSdkEffectClient, createPutioSdkPromiseClient } from "@putdotio/sdk";',
        "",
        'const promiseClient = createPutioSdkPromiseClient({ accessToken: "token", baseUrl: DEFAULT_PUTIO_API_BASE_URL });',
        "const effectClient = createPutioSdkEffectClient();",
        "",
        'if (typeof promiseClient.account.getInfo !== "function") throw new Error("missing promise account client");',
        'if (typeof effectClient.files.list !== "function") throw new Error("missing effect files client");',
        "",
        "console.log(JSON.stringify({ baseUrl: DEFAULT_PUTIO_API_BASE_URL, ok: true }));",
      ].join("\n"),
    );

    const installResult = runCommand("pnpm", ["install"], tempDir);
    assert(
      installResult.status === 0,
      `pnpm install failed: ${installResult.stderr || installResult.stdout}`,
    );

    const runtimeResult = runCommand("node", ["runtime.mjs"], tempDir);
    assert(
      runtimeResult.status === 0,
      `consumer runtime failed: ${runtimeResult.stderr || runtimeResult.stdout}`,
    );

    return JSON.parse(runtimeResult.stdout);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

await run("consumer cannot import internal package paths", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "putio-sdk-exports-"));

  try {
    const packResult = runCommand("pnpm", ["pack", "--pack-destination", tempDir], packageDir);
    assert(packResult.status === 0, `pnpm pack failed: ${packResult.stderr || packResult.stdout}`);

    const tarball = assertPresent(
      readdirSync(tempDir).find((fileName) => fileName.endsWith(".tgz")),
      "expected packed tarball",
    );

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@putdotio/sdk": `file:${join(tempDir, tarball)}`,
          },
          name: "putio-sdk-consumer-exports",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );

    writeFileSync(
      join(tempDir, "internal-path.mjs"),
      [
        'import("@putdotio/sdk/src/index.js")',
        "  .then(() => {",
        '    console.error("expected internal path import to fail");',
        "    process.exit(1);",
        "  })",
        "  .catch((error) => {",
        "    console.log(JSON.stringify({ code: error?.code ?? null, ok: true }));",
        "  });",
      ].join("\n"),
    );

    const installResult = runCommand("pnpm", ["install"], tempDir);
    assert(
      installResult.status === 0,
      `pnpm install failed: ${installResult.stderr || installResult.stdout}`,
    );

    const runtimeResult = runCommand("node", ["internal-path.mjs"], tempDir);
    assert(
      runtimeResult.status === 0,
      `internal export fence check failed: ${runtimeResult.stderr || runtimeResult.stdout}`,
    );

    const parsed = JSON.parse(runtimeResult.stdout);
    assert(parsed.ok === true, "expected internal path probe to report success");
    assert(
      parsed.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
      `expected ERR_PACKAGE_PATH_NOT_EXPORTED, got ${parsed.code}`,
    );

    return parsed;
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

finish();
