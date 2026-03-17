import { createClients, createLiveHarness } from "../support/harness.js";

const { authClient, oauthClient } = await createClients({
  authClient: "PUTIO_TOKEN_FIRST_PARTY",
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const live = createLiveHarness("tunnel live");
const { assert, assertOperationError, finish, run, sleep } = live;

void assertOperationError;
void sleep;

await run("tunnel routes shape", async () => {
  const routes = await authClient.tunnel.listRoutes();
  assert(Array.isArray(routes), "expected tunnel routes array");
  assert(routes.length > 0, "expected at least one tunnel route");
  assert(
    routes.some((route) => route.name === "default"),
    "expected default tunnel route",
  );
  assert(
    routes.some((route) => route.name === "cdn77"),
    "expected cdn77 tunnel route",
  );
  routes.slice(0, 5).forEach((route) => {
    assert(typeof route.description === "string", "expected tunnel route description");
    assert(Array.isArray(route.hosts), "expected tunnel route hosts");
    assert(
      route.hosts.every((host) => typeof host === "string"),
      "expected string tunnel hosts",
    );
  });

  return {
    count: routes.length,
    first_hosts: routes[0]?.hosts.slice(0, 3) ?? [],
    route_names: routes.slice(0, 5).map((route) => route.name),
  };
});

await run("tunnel routes require restricted scope", async () => {
  try {
    await oauthClient.tunnel.listRoutes();
    throw new Error("expected tunnel routes with app token to fail");
  } catch (error) {
    return assertOperationError(error, {
      domain: "tunnel",
      errorType: "invalid_scope",
      operation: "listRoutes",
      statusCode: 401,
    });
  }
});

finish();
