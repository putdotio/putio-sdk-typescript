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

  assert(typeof result.token === "string", "expected podcast token");
  assert(result.token.length > 0, "expected non-empty podcast token");
  Object.entries(result.links).forEach(([type, url]) => {
    assert(["all", "audio", "video", "mp4"].includes(type), "expected known feed type");
    assert(typeof url === "string", "expected podcast link URL");
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

  assert(typeof result.links.audio === "string", "expected audio podcast link");
  assert(typeof result.links.mp4 === "string", "expected MP4 podcast link");

  return {
    audio_present: true,
    mp4_present: true,
  };
});

finish();
