import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createCompatWorkspace, getRootPackageVersion, run, writeJson } from "./compat-support.mts";

const main = async () => {
  const context = await createCompatWorkspace("putio-sdk-compat-node");

  try {
    const effectVersion = await getRootPackageVersion("dependencies", "effect");
    const typescriptVersion = await getRootPackageVersion("devDependencies", "typescript");
    const sourceDirectory = join(context.workspace, "src");

    await mkdir(sourceDirectory, { recursive: true });
    await writeJson(join(context.workspace, "package.json"), {
      private: true,
      type: "module",
      scripts: {
        check: "tsc --noEmit",
        build: "tsc --project tsconfig.build.json",
        runtime: "node dist/index.js",
      },
      dependencies: {
        "@putdotio/sdk": `file:${context.packageTarballPath}`,
        effect: effectVersion,
      },
      devDependencies: {
        typescript: typescriptVersion,
      },
    });
    await writeJson(join(context.workspace, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2024",
        lib: ["ES2024", "DOM", "DOM.Iterable"],
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        exactOptionalPropertyTypes: true,
        skipLibCheck: false,
        verbatimModuleSyntax: true,
        noUncheckedIndexedAccess: true,
        noEmit: true,
      },
      include: ["src"],
    });
    await writeJson(join(context.workspace, "tsconfig.build.json"), {
      extends: "./tsconfig.json",
      compilerOptions: {
        noEmit: false,
        outDir: "dist",
        rootDir: "src",
        declaration: true,
      },
    });
    await writeFile(
      join(sourceDirectory, "index.ts"),
      `import { Effect } from "effect";
import {
  createPutioSdkEffectClient,
  createPutioSdkPromiseClient,
  type PutioSdkPromiseClient,
} from "@putdotio/sdk";
import { toHumanFileSize } from "@putdotio/sdk/utilities";

const promiseClient: PutioSdkPromiseClient = createPutioSdkPromiseClient({
  accessToken: "compat-token",
});
const promiseAuthUrl = promiseClient.auth.buildLoginUrl({
  clientId: "external-node",
  redirectUri: "https://example.com/callback",
  state: "node-smoke",
});
const promiseAuthHost = new URL(promiseAuthUrl).host;
const uploadRequest = await promiseClient.files.createUploadRequest({
  file: new Blob(["hello from node"]),
  fileName: "node.txt",
});
await promiseClient.dispose();

const effectClient = createPutioSdkEffectClient();
const effectAuthHost = await Effect.runPromise(
  Effect.succeed(
    new URL(
      effectClient.auth.buildLoginUrl({
        clientId: "external-effect",
        redirectUri: "https://example.com/callback",
        state: "effect-smoke",
      }),
    ).host,
  ),
);

console.log(
  JSON.stringify({
    effectAuthHost,
    promiseAuthHost,
    uploadMethod: uploadRequest.method,
    uploadBody: uploadRequest.body.constructor.name,
    utility: toHumanFileSize(1_572_864),
  }),
);
`,
    );

    await run("npm", ["install", "--ignore-scripts", "--no-audit", "--fund=false"], {
      cwd: context.workspace,
    });
    await run("npm", ["run", "check"], { cwd: context.workspace });
    await run("npm", ["run", "build"], { cwd: context.workspace });
    await run("npm", ["run", "runtime"], { cwd: context.workspace });
  } finally {
    await context.cleanup();
  }
};

await main();
