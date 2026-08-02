import { createPutioSdkPromiseClient } from "../dist/index.js";
import { bootstrapRuntimeTokens } from "../test/live/support/bootstrap.ts";
import { readBootstrapSecrets } from "../test/live/support/secrets.ts";
import { runLiveTestProcess } from "./live-test-process.ts";

const targets = process.argv.slice(2);

if (targets.length === 0) {
  throw new Error("Expected at least one live test target");
}

const bootstrapped = await bootstrapRuntimeTokens(readBootstrapSecrets(), async (config = {}) =>
  createPutioSdkPromiseClient(config),
);

const liveEnvironment = {
  ...process.env,
  PUTIO_TOKEN_FIRST_PARTY: bootstrapped.firstParty.accessToken,
  PUTIO_TOKEN_THIRD_PARTY: bootstrapped.thirdParty.accessToken,
};
const result = runLiveTestProcess(targets, liveEnvironment, {
  PUTIO_TOKEN_FIRST_PARTY: bootstrapped.firstParty.accessToken,
  PUTIO_TOKEN_THIRD_PARTY: bootstrapped.thirdParty.accessToken,
});

let cleanupError: Error | null = null;
const cleanupClient = createPutioSdkPromiseClient({
  accessToken: bootstrapped.firstParty.accessToken,
});

try {
  if (bootstrapped.firstParty.tokenId === null) {
    throw new Error("Ephemeral first-party token did not return a token ID for cleanup");
  }

  await cleanupClient.auth.revokeClient(bootstrapped.firstParty.tokenId);
} catch (error) {
  cleanupError = error instanceof Error ? error : new Error("Unknown token cleanup failure");
} finally {
  try {
    await cleanupClient.dispose();
  } catch (error) {
    cleanupError ??=
      error instanceof Error ? error : new Error("Unknown cleanup client disposal failure");
  }
}

if (result.leakedKeys.length > 0) {
  console.error(
    `Live test output attempted to expose injected secrets: ${result.leakedKeys.join(", ")}`,
  );
  process.exit(1);
}

if (result.error) {
  console.error(`Live test process failed to start or capture output: ${result.error.message}`);
  process.exit(1);
}

if (cleanupError) {
  console.error(`Failed to revoke the ephemeral first-party token: ${cleanupError.message}`);
  process.exit(1);
}

process.exit(result.status);
