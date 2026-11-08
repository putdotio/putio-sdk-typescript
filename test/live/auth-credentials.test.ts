import { test } from "vite-plus/test";

import { bootstrapRuntimeTokens } from "./support/bootstrap.js";
import { assert } from "./support/harness.js";
import { readBootstrapSecrets } from "./support/secrets.js";

test("credentialed bootstrap yields validated first-party and third-party tokens", async () => {
  const bootstrapped = await bootstrapRuntimeTokens(readBootstrapSecrets());

  assert(
    bootstrapped.firstParty.scope !== "two_factor",
    "expected first-party token to be fully verified past the two-factor scope",
  );
  assert(
    bootstrapped.firstParty.userId === bootstrapped.thirdParty.userId,
    "expected first-party and third-party tokens for the same user",
  );
  assert(bootstrapped.thirdParty.app.id > 0, "expected owned third-party app id");
});
