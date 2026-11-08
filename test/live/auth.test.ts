import { beforeAll, describe, expect, test } from "vite-plus/test";

import { PutioOperationError } from "../../dist/index.js";
import { createLiveTokenClients, type LiveTokenClients } from "./support/helpers.js";

describe("auth live", () => {
  let clients: LiveTokenClients;

  beforeAll(() => {
    clients = createLiveTokenClients();
  });

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

  test("restricted grants list succeeds for the first-party token", async () => {
    const grants = await clients.authClient.auth.grants();

    expect(Array.isArray(grants)).toBe(true);
  });

  test("restricted clients list succeeds for the first-party token", async () => {
    const clientsList = await clients.authClient.auth.clients();

    expect(Array.isArray(clientsList)).toBe(true);
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
