import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import {
  bootstrapFirstPartyToken,
  bootstrapThirdPartyToken,
} from "../test/live/support/bootstrap.ts";
import { readBootstrapSecrets } from "../test/live/support/secrets.ts";

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

const { createPutioSdkPromiseClient } = await import("../dist/index.js");
const clients = new Set<ReturnType<typeof createPutioSdkPromiseClient>>();
const createClient = async (config: Record<string, unknown> = {}) => {
  const client = createPutioSdkPromiseClient(config);
  clients.add(client);
  return client;
};
const secrets = readBootstrapSecrets();
let firstParty: Awaited<ReturnType<typeof bootstrapFirstPartyToken>> | null = null;
let cleanupError: Error | null = null;
let runError: Error | null = null;
let status = 1;

try {
  firstParty = await bootstrapFirstPartyToken(secrets, createClient);
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
  try {
    if (firstParty !== null) {
      if (firstParty.tokenId === null) {
        cleanupError = new Error("Fresh first-party session did not return a token ID");
      } else {
        const cleanupClient = await createClient({ accessToken: firstParty.accessToken });
        await cleanupClient.auth.revokeClient(firstParty.tokenId);
      }
    }
  } catch (error) {
    cleanupError = error instanceof Error ? error : new Error("Unknown token cleanup failure");
  }

  for (const client of clients) {
    try {
      await client.dispose();
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
