import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import { liveTokenCacheUrl, writeLiveTokenCache } from "./live-token-cache.ts";
import { readBootstrapSecrets } from "../test/live/support/secrets.ts";

const refresh = process.argv.slice(2).includes("--refresh");

if (existsSync(liveTokenCacheUrl) && !refresh) {
  throw new Error(
    "Live tokens are already cached; use test:live or pass --refresh to replace expired tokens",
  );
}

const buildResult = spawnSync("vp", ["pack"], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const { bootstrapRuntimeTokens } = await import("../test/live/support/bootstrap.ts");
const bootstrapped = await bootstrapRuntimeTokens(readBootstrapSecrets());

await writeLiveTokenCache(liveTokenCacheUrl, {
  firstPartyToken: bootstrapped.firstParty.accessToken,
  thirdPartyToken: bootstrapped.thirdParty.accessToken,
});

console.log(
  JSON.stringify(
    {
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
