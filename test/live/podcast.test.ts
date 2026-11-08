import { afterAll, test } from "vite-plus/test";

import { createPutioSdkPromiseClient } from "../../dist/index.js";
import { bootstrapFirstPartyToken, revokeFirstPartyToken } from "./support/bootstrap.js";
import { assert } from "./support/harness.js";
import { readCredentialFixture } from "./support/secrets.js";

const firstParty = await bootstrapFirstPartyToken(readCredentialFixture());
const authClient = createPutioSdkPromiseClient({ accessToken: firstParty.accessToken });

afterAll(() => revokeFirstPartyToken(firstParty.accessToken));

test("podcast default links cover every feed type", async () => {
  const result = await authClient.podcast.getLinks({ parentId: 0 });

  assert(result.token.length > 0, "expected non-empty podcast token");

  for (const type of ["all", "audio", "video", "mp4"] as const) {
    assert(result.links[type] !== undefined, `expected ${type} podcast link`);
  }
});

test("podcast selected links include the requested types", async () => {
  const result = await authClient.podcast.getLinks({
    parentId: 0,
    types: ["audio", "mp4"],
  });

  assert(result.links.audio !== undefined, "expected audio podcast link");
  assert(result.links.mp4 !== undefined, "expected MP4 podcast link");
});
