import { PutioValidationError } from "../core/errors.js";
import { describe, expect, it } from "vite-plus/test";

import * as podcast from "./podcast.js";
import {
  expectFailure,
  jsonResponse,
  runSdkEffect,
  runSdkExit,
} from "../../test/support/sdk-test.js";

describe("podcast domain", () => {
  it("gets selected podcast feed links", async () => {
    await expect(
      runSdkEffect(
        podcast.getPodcastLinks({ parentId: 42, types: ["all", "mp4"] }),
        (request) => {
          expect(request.method).toBe("GET");
          expect(request.url).toBe(
            "https://api.put.io/v2/podcast/links?parent_id=42&type=all%2Cmp4",
          );
          return jsonResponse({
            links: {
              all: "https://api.put.io/v2/podcast/feed/all",
              mp4: "https://api.put.io/v2/podcast/feed/mp4",
            },
            status: "OK",
            token: "podcast-token",
          });
        },
        { accessToken: "token-123" },
      ),
    ).resolves.toEqual({
      links: {
        all: "https://api.put.io/v2/podcast/feed/all",
        mp4: "https://api.put.io/v2/podcast/feed/mp4",
      },
      token: "podcast-token",
    });
  });

  it("omits the type query when all feed types are requested by default", async () => {
    await expect(
      runSdkEffect(
        podcast.getPodcastLinks({ parentId: 0 }),
        (request) => {
          expect(request.url).toBe("https://api.put.io/v2/podcast/links?parent_id=0");
          return jsonResponse({ links: {}, status: "OK", token: "podcast-token" });
        },
        { accessToken: "token-123" },
      ),
    ).resolves.toEqual({ links: {}, token: "podcast-token" });
  });

  it("rejects invalid podcast link inputs before transport", async () => {
    let requestCount = 0;
    const handler = () => {
      requestCount += 1;
      return jsonResponse({ links: {}, status: "OK", token: "podcast-token" });
    };

    const invalidParentId = expectFailure(
      await runSdkExit(podcast.getPodcastLinks({ parentId: -1 }), handler),
    );
    const emptyTypes = expectFailure(
      await runSdkExit(podcast.getPodcastLinks({ parentId: 0, types: [] }), handler),
    );
    const invalidType = expectFailure(
      await runSdkExit(
        // @ts-expect-error JavaScript callers can still supply unknown feed types.
        podcast.getPodcastLinks({ parentId: 0, types: ["documents"] }),
        handler,
      ),
    );

    expect(invalidParentId).toBeInstanceOf(PutioValidationError);
    expect(emptyTypes).toBeInstanceOf(PutioValidationError);
    expect(invalidType).toBeInstanceOf(PutioValidationError);
    expect(requestCount).toBe(0);
  });
});
