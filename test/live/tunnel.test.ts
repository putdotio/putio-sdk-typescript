import { test } from "vite-plus/test";

import { assert, createLiveTokenClients, rejectsWithOperationError } from "./support/harness.js";

const { authClient, oauthClient } = createLiveTokenClients();

test("tunnel routes include default and cdn77", async () => {
  const routes = await authClient.tunnel.listRoutes();

  assert(
    routes.some((route) => route.name === "default"),
    "expected default tunnel route",
  );
  assert(
    routes.some((route) => route.name === "cdn77"),
    "expected cdn77 tunnel route",
  );
});

test("tunnel routes require restricted scope", async () => {
  await rejectsWithOperationError(oauthClient.tunnel.listRoutes(), {
    domain: "tunnel",
    errorType: "invalid_scope",
    operation: "listRoutes",
    statusCode: 401,
  });
});
