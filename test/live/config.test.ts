import { Schema } from "effect";
import { test } from "vite-plus/test";

import { assert, assertPresent, createLiveTokenClients } from "./support/harness.js";

const { oauthClient } = createLiveTokenClients();

const probeKey = "putio-typescript-sdk-config-probe";

const probeValue = {
  enabled: true,
  tags: ["config", "effect", "sdk"],
  verified_at: new Date().toISOString(),
  version: 1,
};

const ConfigProbeSchema = Schema.Struct({
  tags: Schema.Array(Schema.String),
  version: Schema.Finite,
});

test("config read decodes", async () => {
  await oauthClient.config.read();
});

test("config key roundtrip", async () => {
  await oauthClient.config.setKey(probeKey, probeValue);

  try {
    const roundtrip = await oauthClient.config.getKey(probeKey);

    const roundtripObject = Schema.decodeUnknownSync(ConfigProbeSchema)(
      assertPresent(roundtrip, "expected roundtrip object"),
    );

    assert(roundtripObject.version === probeValue.version, "expected roundtrip version");
  } finally {
    await oauthClient.config.deleteKey(probeKey);
  }
});
