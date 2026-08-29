import { spawnSync } from "node:child_process";

import { resolveLiveTestTargets } from "./live-targets.ts";
import { readLiveTokens } from "../test/live/support/secrets.ts";

const args = process.argv.slice(2);
const targets = args[0] === "--" ? args.slice(1) : args;

if (targets.length === 0) {
  throw new Error("Pass one or more explicit test/live/**/*.test.ts files");
}

const resolvedTargets = resolveLiveTestTargets(targets);

const tokens = readLiveTokens();
const result = spawnSync(
  "vp",
  ["test", "run", "--config", "vitest.live.config.ts", ...resolvedTargets],
  {
    env: {
      ...process.env,
      PUTIO_TOKEN_FIRST_PARTY: tokens.firstPartyToken,
      PUTIO_TOKEN_THIRD_PARTY: tokens.thirdPartyToken,
    },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`Live test execution failed: ${result.error.message}`);
}

process.exit(result.status ?? 1);
