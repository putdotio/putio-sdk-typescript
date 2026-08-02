import { spawnSync } from "node:child_process";

import { createPutioSdkPromiseClient } from "../dist/index.js";
import { bootstrapRuntimeTokens } from "../test/live/support/bootstrap.ts";
import { readBootstrapSecrets } from "../test/live/support/secrets.ts";

const targets = process.argv.slice(2);

if (targets.length === 0) {
  throw new Error("Expected at least one live test target");
}

const bootstrapped = await bootstrapRuntimeTokens(readBootstrapSecrets(), async (config = {}) =>
  createPutioSdkPromiseClient(config),
);

const result = spawnSync(
  "pnpm",
  ["exec", "vp", "test", "run", "--config", "vitest.live.config.ts", ...targets],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      PUTIO_TOKEN_FIRST_PARTY: bootstrapped.firstParty.accessToken,
      PUTIO_TOKEN_THIRD_PARTY: bootstrapped.thirdParty.accessToken,
    },
    maxBuffer: 20 * 1024 * 1024,
  },
);

if (result.error) {
  throw result.error;
}

let cleanupError: Error | null = null;

try {
  if (bootstrapped.firstParty.tokenId === null) {
    throw new Error("Ephemeral first-party token did not return a token ID for cleanup");
  }

  const cleanupClient = createPutioSdkPromiseClient({
    accessToken: bootstrapped.firstParty.accessToken,
  });
  await cleanupClient.auth.revokeClient(bootstrapped.firstParty.tokenId);
  await cleanupClient.dispose();
} catch (error) {
  cleanupError = error instanceof Error ? error : new Error("Unknown token cleanup failure");
}

const secretValues = [
  ["PUTIO_TOKEN_FIRST_PARTY", bootstrapped.firstParty.accessToken],
  ["PUTIO_TOKEN_THIRD_PARTY", bootstrapped.thirdParty.accessToken],
  ["PUTIO_CLIENT_SECRET_FIRST_PARTY", process.env.PUTIO_CLIENT_SECRET_FIRST_PARTY],
  ["PUTIO_TEST_PASSWORD", process.env.PUTIO_TEST_PASSWORD],
  ["PUTIO_TEST_TOTP", process.env.PUTIO_TEST_TOTP],
  ["PUTIO_TEST_TOTP_REFERENCE", process.env.PUTIO_TEST_TOTP_REFERENCE],
].filter(
  (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length >= 8,
);

const redact = (output: string): { readonly output: string; readonly redactedKeys: string[] } => {
  let redacted = output;
  const redactedKeys: string[] = [];

  for (const [key, value] of secretValues) {
    if (redacted.includes(value)) {
      redacted = redacted.replaceAll(value, `[REDACTED:${key}]`);
      redactedKeys.push(key);
    }
  }

  return {
    output: redacted,
    redactedKeys,
  };
};

const stdout = redact(result.stdout ?? "");
const stderr = redact(result.stderr ?? "");
process.stdout.write(stdout.output);
process.stderr.write(stderr.output);

const leakedKeys = [...new Set([...stdout.redactedKeys, ...stderr.redactedKeys])];

if (leakedKeys.length > 0) {
  console.error(`Live test output attempted to expose injected secrets: ${leakedKeys.join(", ")}`);
  process.exit(1);
}

if (cleanupError) {
  console.error(`Failed to revoke the ephemeral first-party token: ${cleanupError.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
