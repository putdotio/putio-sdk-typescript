import { bootstrapFirstPartyToken } from "../support/bootstrap.js";
import { createLiveHarness, createPromiseClient } from "../support/harness.js";
import { readBootstrapSecrets } from "../support/secrets.js";

const firstParty = await bootstrapFirstPartyToken(readBootstrapSecrets());

const authClient = await createPromiseClient({
  accessToken: firstParty.accessToken,
});

const live = createLiveHarness("podcast live");
const { assert, finish, run } = live;

await run("podcast default links shape", async () => {
  const result = await authClient.podcast.getLinks({ parentId: 0 });

  assert(result.token.length > 0, "expected non-empty podcast token");
  (["all", "audio", "video", "mp4"] as const).forEach((type) => {
    assert(result.links[type] !== undefined, `expected ${type} podcast link`);
  });

  return {
    link_types: Object.keys(result.links),
    token_present: result.token.length > 0,
  };
});

await run("podcast selected links shape", async () => {
  const result = await authClient.podcast.getLinks({
    parentId: 0,
    types: ["audio", "mp4"],
  });

  assert(result.links.audio !== undefined, "expected audio podcast link");
  assert(result.links.mp4 !== undefined, "expected MP4 podcast link");

  return {
    audio_present: true,
    mp4_present: true,
  };
});

finish();
