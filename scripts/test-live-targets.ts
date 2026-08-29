import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import { formatLiveError } from "./live-error.ts";
import { readLiveTokens } from "../test/live/support/secrets.ts";

const args = process.argv.slice(2);
const targets = args[0] === "--" ? args.slice(1) : args;

if (targets.length === 0) {
  throw new Error("Pass one or more explicit test/live/**/*.test.ts files");
}

const liveRoot = resolve("test/live");

for (const target of targets) {
  const relativeTarget = relative(liveRoot, resolve(target));
  const isLiveTest =
    target.startsWith("test/live/") &&
    target.endsWith(".test.ts") &&
    relativeTarget !== ".." &&
    !relativeTarget.startsWith(`..${sep}`);

  if (!isLiveTest || !existsSync(target)) {
    throw new Error(`Unsupported live test target: ${target}`);
  }
}

const tokens = readLiveTokens();
const result = spawnSync("vp", ["test", "run", "--config", "vitest.live.config.ts", ...targets], {
  env: {
    ...process.env,
    PUTIO_TOKEN_FIRST_PARTY: tokens.firstPartyToken,
    PUTIO_TOKEN_THIRD_PARTY: tokens.thirdPartyToken,
  },
  stdio: "inherit",
});

if (result.error) {
  console.error(`Live test execution failed: ${formatLiveError(result.error)}`);
}

process.exit(result.status ?? 1);
