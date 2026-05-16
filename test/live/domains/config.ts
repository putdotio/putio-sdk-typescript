import { assertPresent, createClients, createLiveHarness } from "../support/harness.js";

const { oauthClient } = await createClients({
  oauthClient: "PUTIO_TOKEN_THIRD_PARTY",
});

const now = new Date().toISOString();
const probeKey = "codex_sdk_config_probe";
const probeValue = {
  enabled: true,
  tags: ["config", "effect", "sdk"],
  verified_at: now,
  version: 1,
};

const live = createLiveHarness("config live");
const { assert, finish, run } = live;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

await run("config read returns JSON object", async () => {
  const config = await oauthClient.config.read();

  assert(typeof config === "object" && config !== null, "expected config object");

  return {
    keys: Object.keys(config),
  };
});

await run("config key roundtrip", async () => {
  await oauthClient.config.setKey(probeKey, probeValue);
  const roundtrip = await oauthClient.config.getKey(probeKey);
  await oauthClient.config.deleteKey(probeKey);

  const roundtripValue = assertPresent(roundtrip, "expected roundtrip object");
  if (!isRecord(roundtripValue)) {
    throw new Error("expected roundtrip record");
  }

  const roundtripObject = roundtripValue;
  assert("version" in roundtripObject, "expected roundtrip version");
  assert(roundtripObject.version === probeValue.version, "expected roundtrip version");
  assert("tags" in roundtripObject, "expected roundtrip tags");
  assert(Array.isArray(roundtripObject.tags), "expected roundtrip tags");

  return {
    roundtrip: roundtripObject,
  };
});

finish();
