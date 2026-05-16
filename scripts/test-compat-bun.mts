import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createCompatWorkspace, getRootPackageVersion, run, writeJson } from "./compat-support.mts";

const main = async () => {
  const context = await createCompatWorkspace("putio-sdk-compat-bun");

  try {
    const effectVersion = await getRootPackageVersion("dependencies", "effect");
    const sourceDirectory = join(context.workspace, "src");

    await mkdir(sourceDirectory, { recursive: true });
    await writeJson(join(context.workspace, "package.json"), {
      private: true,
      type: "module",
      scripts: {
        runtime: "bun run src/main.ts",
      },
      dependencies: {
        "@putdotio/sdk": `file:${context.packageTarballPath}`,
        effect: effectVersion,
      },
    });
    await writeFile(
      join(sourceDirectory, "main.ts"),
      `import { Effect } from "effect";
import { createPutioSdkEffectClient, createPutioSdkPromiseClient } from "@putdotio/sdk";
import { toHumanFileSize } from "@putdotio/sdk/utilities";

const promiseClient = createPutioSdkPromiseClient({
  accessToken: "compat-token",
});
const authUrl = promiseClient.auth.buildLoginUrl({
  clientId: "external-bun",
  redirectUri: "https://example.com/callback",
  state: "bun-smoke",
});
const authHost = new URL(authUrl).host;
const uploadRequest = await promiseClient.files.createUploadRequest({
  file: new Blob(["hello from bun"]),
  fileName: "bun.txt",
});
await promiseClient.dispose();

const effectClient = createPutioSdkEffectClient();
const effectAuthHost = await Effect.runPromise(
  Effect.succeed(
    new URL(
      effectClient.auth.buildLoginUrl({
        clientId: "external-bun-effect",
        redirectUri: "https://example.com/callback",
        state: "bun-effect-smoke",
      }),
    ).host,
  ),
);

console.log(
  JSON.stringify({
    authHost,
    effectAuthHost,
    uploadMethod: uploadRequest.method,
    uploadBody: uploadRequest.body.constructor.name,
    utility: toHumanFileSize(1_572_864),
  }),
);
`,
    );

    await run("bun", ["install", "--ignore-scripts"], { cwd: context.workspace });
    await run("bun", ["run", "runtime"], { cwd: context.workspace });
  } finally {
    await context.cleanup();
  }
};

await main();
