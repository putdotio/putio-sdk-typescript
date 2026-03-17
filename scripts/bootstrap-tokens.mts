import { spawnSync } from "node:child_process";

import { bootstrapRuntimeTokens } from "../test/live/support/bootstrap.ts";
import { readBootstrapSecrets } from "../test/live/support/secrets.ts";

const packageDir = new URL("..", import.meta.url);

const buildResult = spawnSync("vp", ["pack"], {
  cwd: packageDir,
  stdio: "inherit",
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const secrets = readBootstrapSecrets();
const { createPutioSdkPromiseClient } = await import("../dist/index.js");

const bootstrapped = await bootstrapRuntimeTokens(secrets, async (config = {}) =>
  createPutioSdkPromiseClient(config),
);

console.log(
  JSON.stringify(
    {
      persisted: bootstrapped.persisted,
      first_party: {
        scope: bootstrapped.firstParty.scope,
        token_id: bootstrapped.firstParty.tokenId,
        user_id: bootstrapped.firstParty.userId,
      },
      third_party: {
        app_id: bootstrapped.thirdParty.app.id,
        app_name: bootstrapped.thirdParty.app.name,
        scope: bootstrapped.thirdParty.scope,
        token_id: bootstrapped.thirdParty.tokenId,
        user_id: bootstrapped.thirdParty.userId,
      },
    },
    null,
    2,
  ),
);
