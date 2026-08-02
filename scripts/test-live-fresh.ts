import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import {
  bootstrapFirstPartyToken,
  bootstrapThirdPartyToken,
} from "../test/live/support/bootstrap.ts";
import { readBootstrapSecrets } from "../test/live/support/secrets.ts";

const args = process.argv.slice(2);
const targets = args[0] === "--" ? args.slice(1) : args;

if (targets.length === 0) {
  throw new Error("Pass one or more explicit test/live/*.test.ts files");
}

for (const target of targets) {
  if (!/^test\/live\/[A-Za-z0-9._-]+\.test\.ts$/.test(target) || !existsSync(target)) {
    throw new Error(`Unsupported live test target: ${target}`);
  }
}

const { createPutioSdkPromiseClient } = await import("../dist/index.js");
const createClient = async (config: Record<string, unknown> = {}) =>
  createPutioSdkPromiseClient(config);
const secrets = readBootstrapSecrets();
const firstParty = await bootstrapFirstPartyToken(secrets, createClient);
let cleanupError: Error | null = null;
let runError: Error | null = null;
let status = 1;

try {
  const thirdParty = await bootstrapThirdPartyToken(
    firstParty.accessToken,
    secrets.thirdPartyClientId,
    createClient,
  );
  const result = spawnSync("vp", ["test", "run", "--config", "vitest.live.config.ts", ...targets], {
    env: {
      ...process.env,
      PUTIO_TOKEN_FIRST_PARTY: firstParty.accessToken,
      PUTIO_TOKEN_THIRD_PARTY: thirdParty.accessToken,
    },
    stdio: "inherit",
  });

  runError = result.error ?? null;
  status = result.status ?? 1;
} catch (error) {
  runError = error instanceof Error ? error : new Error("Unknown live test failure");
} finally {
  const cleanupClient = createPutioSdkPromiseClient({ accessToken: firstParty.accessToken });

  try {
    if (firstParty.tokenId === null) {
      cleanupError = new Error("Fresh first-party session did not return a token ID");
    } else {
      await cleanupClient.auth.revokeClient(firstParty.tokenId);
    }
  } catch (error) {
    cleanupError = error instanceof Error ? error : new Error("Unknown token cleanup failure");
  } finally {
    try {
      await cleanupClient.dispose();
    } catch (error) {
      cleanupError ??=
        error instanceof Error ? error : new Error("Unknown client disposal failure");
    }
  }
}

if (runError) {
  console.error(`Live test execution failed: ${runError.message}`);
}

if (cleanupError) {
  console.error(`Fresh token cleanup failed: ${cleanupError.message}`);
  process.exit(1);
}

process.exit(status);
