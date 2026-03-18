import { beforeAll, describe, expect, test } from "vite-plus/test";

import { createLiveTokenClients, type LiveTokenClients } from "./support/helpers.js";

describe.sequential("auth live", () => {
  let clients: LiveTokenClients;

  beforeAll(() => {
    clients = createLiveTokenClients();
  });

  test("oauth token validates", async () => {
    const validation = await clients.oauthClient.auth.validateToken(clients.tokens.thirdPartyToken);

    expect(validation.result).toBe(true);
    expect(validation.user_id).toBeGreaterThan(0);
    expect(typeof validation.token_scope === "string" || validation.token_scope === null).toBe(
      true,
    );
  });

  test("first-party token validates", async () => {
    const validation = await clients.authClient.auth.validateToken(clients.tokens.firstPartyToken);

    expect(validation.result).toBe(true);
    expect(validation.user_id).toBeGreaterThan(0);
    expect(typeof validation.token_scope === "string" || validation.token_scope === null).toBe(
      true,
    );
  });

  test("restricted grants list succeeds for the first-party token", async () => {
    const grants = await clients.authClient.auth.grants();

    expect(Array.isArray(grants)).toBe(true);
    expect(
      grants.every(
        (grant) =>
          typeof grant.id === "number" &&
          typeof grant.name === "string" &&
          typeof grant.description === "string" &&
          typeof grant.website === "string" &&
          (typeof grant.has_icon === "boolean" || grant.has_icon === null),
      ),
    ).toBe(true);
  });

  test("restricted clients list succeeds for the first-party token", async () => {
    const clientsList = await clients.authClient.auth.clients();

    expect(Array.isArray(clientsList)).toBe(true);
    expect(
      clientsList.every(
        (client) =>
          typeof client.app_id === "number" &&
          typeof client.client_name === "string" &&
          (client.app_name === undefined || typeof client.app_name === "string"),
      ),
    ).toBe(true);
  });

  test("restricted grants reject the third-party token with a typed operation error", async () => {
    await expect(clients.oauthClient.auth.grants()).rejects.toMatchObject({
      _tag: "PutioOperationError",
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
