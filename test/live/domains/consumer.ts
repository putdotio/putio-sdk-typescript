import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

import { assertPresent, createLiveHarness } from "../support/harness.js";

const live = createLiveHarness("consumer live");
const { assert, finish, run } = live;

const packageDir = process.cwd();
const nodeExecutable = process.execPath;
const npmCliPath = join(
  dirname(nodeExecutable),
  "..",
  "lib",
  "node_modules",
  "npm",
  "bin",
  "npm-cli.js",
);
const typescriptCliPath = join(packageDir, "node_modules", "typescript", "bin", "tsc");

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

const runNodeCommand = (args: readonly string[], cwd: string) =>
  runCommand(nodeExecutable, args, cwd);

const runNpmCommand = (args: readonly string[], cwd: string) =>
  runNodeCommand([npmCliPath, ...args], cwd);

const createPackedTarball = (cwd: string, destination: string): string => {
  const packResult = runNpmCommand(["pack", "--pack-destination", destination], cwd);
  assert(packResult.status === 0, `npm pack failed: ${packResult.stderr || packResult.stdout}`);

  const tarball = assertPresent(
    readdirSync(destination).find((fileName) => fileName.endsWith(".tgz")),
    "expected packed tarball",
  );

  return join(destination, tarball);
};

await run("consumer tarball installs in temp project", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "putio-sdk-consumer-"));

  try {
    const tarball = createPackedTarball(packageDir, tempDir);

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@putdotio/sdk": `file:${tarball}`,
          },
          name: "putio-sdk-consumer-live",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );

    const installResult = runNpmCommand(["install", "--ignore-scripts"], tempDir);
    assert(
      installResult.status === 0,
      `npm install failed: ${installResult.stderr || installResult.stdout}`,
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
    const tarball = createPackedTarball(packageDir, tempDir);

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@putdotio/sdk": `file:${tarball}`,
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
        'import { toHumanFileSize } from "@putdotio/sdk/utilities";',
        "",
        "const promiseClient = createPutioSdkPromiseClient();",
        "const effectClient = createPutioSdkEffectClient();",
        "",
        "void promiseClient.account.getInfo({ download_token: 1 });",
        "void effectClient.files.list(0, { per_page: 10 });",
        "const size = toHumanFileSize(1024);",
        'if (size !== "1 KB") throw new Error("utilities subpath failed");',
        "",
        "const isSdkError = (error: unknown) => error instanceof PutioOperationError;",
        "void isSdkError;",
        "",
      ].join("\n"),
    );

    const installResult = runNpmCommand(["install", "--ignore-scripts"], tempDir);
    assert(
      installResult.status === 0,
      `npm install failed: ${installResult.stderr || installResult.stdout}`,
    );

    const typecheckResult = runNodeCommand(
      [typescriptCliPath, "--project", "tsconfig.json"],
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
    const tarball = createPackedTarball(packageDir, tempDir);

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@putdotio/sdk": `file:${tarball}`,
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
        'import { createPutioSdkEffectClient, createPutioSdkPromiseClient } from "@putdotio/sdk";',
        'import { toHumanFileSize } from "@putdotio/sdk/utilities";',
        "",
        "const promiseClient = createPutioSdkPromiseClient();",
        "const effectClient = createPutioSdkEffectClient();",
        "const formattedSize = toHumanFileSize(1024);",
        "",
        'if (typeof promiseClient.account.getInfo !== "function") throw new Error("missing promise account client");',
        'if (typeof effectClient.files.list !== "function") throw new Error("missing effect files client");',
        'if (formattedSize !== "1 KB") throw new Error("missing utilities subpath");',
        "",
        "console.log(JSON.stringify({ formattedSize, ok: true }));",
      ].join("\n"),
    );

    const installResult = runNpmCommand(["install", "--ignore-scripts"], tempDir);
    assert(
      installResult.status === 0,
      `npm install failed: ${installResult.stderr || installResult.stdout}`,
    );

    const runtimeResult = runNodeCommand(["runtime.mjs"], tempDir);
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
    const tarball = createPackedTarball(packageDir, tempDir);

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@putdotio/sdk": `file:${tarball}`,
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

    const installResult = runNpmCommand(["install", "--ignore-scripts"], tempDir);
    assert(
      installResult.status === 0,
      `npm install failed: ${installResult.stderr || installResult.stdout}`,
    );

    const runtimeResult = runNodeCommand(["internal-path.mjs"], tempDir);
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
