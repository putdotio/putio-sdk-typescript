import { bootstrapRuntimeTokens } from "../support/bootstrap.ts";
import { readBootstrapSecrets } from "../support/secrets.ts";
import { createLiveHarness } from "../support/harness.js";

const live = createLiveHarness("auth credentials live");
const { assert, finish, run } = live;

await run(
  "credentialed bootstrap yields validated first-party and third-party tokens",
  async () => {
    let secrets;

    try {
      secrets = readBootstrapSecrets();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Missing required secret environment variable:")
      ) {
        return {
          reason: error.message,
          skipped: true,
        };
      }

      throw error;
    }

    const bootstrapped = await bootstrapRuntimeTokens(secrets);

    assert(
      bootstrapped.firstParty.scope !== "two_factor",
      "expected first-party token to be fully verified past the two-factor scope",
    );
    assert(
      bootstrapped.firstParty.userId === bootstrapped.thirdParty.userId,
      "expected first-party and third-party tokens for the same user",
    );
    assert(
      typeof bootstrapped.thirdParty.app.id === "number" && bootstrapped.thirdParty.app.id > 0,
      "expected owned third-party app id",
    );

    return {
      persisted: bootstrapped.persisted,
      first_party_scope: bootstrapped.firstParty.scope,
      third_party_app_id: bootstrapped.thirdParty.app.id,
      third_party_scope: bootstrapped.thirdParty.scope,
      user_id: bootstrapped.firstParty.userId,
    };
  },
);

finish();
