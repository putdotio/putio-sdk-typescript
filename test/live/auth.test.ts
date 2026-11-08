import { describe, expect, test } from "vite-plus/test";

import { PutioOperationError } from "../../dist/index.js";
import { createLiveTokenClients } from "./support/harness.js";

describe("auth live", () => {
  const clients = createLiveTokenClients();

  test("oauth token validates", async () => {
    const validation = await clients.oauthClient.auth.validateToken(clients.tokens.thirdPartyToken);

    expect(validation.result).toBe(true);
    expect(validation.user_id).toBeGreaterThan(0);
  });

  test("first-party token validates", async () => {
    const validation = await clients.authClient.auth.validateToken(clients.tokens.firstPartyToken);

    expect(validation.result).toBe(true);
    expect(validation.user_id).toBeGreaterThan(0);
  });

  test("restricted grants and clients lists decode for the first-party token", async () => {
    await clients.authClient.auth.grants();
    await clients.authClient.auth.clients();
  });

  test("restricted grants reject the third-party token with a typed operation error", async () => {
    const failure = clients.oauthClient.auth.grants();

    await expect(failure).rejects.toBeInstanceOf(PutioOperationError);
    await expect(failure).rejects.toMatchObject({
      body: {
        error_type: "invalid_scope",
      },
      domain: "auth",
      operation: "grants",
      reason: {
        errorType: "invalid_scope",
        kind: "error_type",
      },
      status: 401,
    });
  });
});
