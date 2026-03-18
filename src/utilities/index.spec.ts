import { describe, expect, it } from "vite-plus/test";

import * as utilities from "./index.js";

describe("utility index", () => {
  it("exports the known utility surface", () => {
    expect(utilities).toMatchObject({
      FileURLProvider: expect.any(Function),
      LocalizedError: expect.any(Function),
      createLocalizeError: expect.any(Function),
      daysDiff: expect.any(Function),
      daysDiffFromNow: expect.any(Function),
      dotsToSpaces: expect.any(Function),
      ensureUTC: expect.any(Function),
      formatDate: expect.any(Function),
      getFileRenderType: expect.any(Function),
      getUnixTimestamp: expect.any(Function),
      isErrorLocalizer: expect.any(Function),
      secondsToDuration: expect.any(Function),
      secondsToReadableDuration: expect.any(Function),
      toHumanFileSize: expect.any(Function),
      toTimeAgo: expect.any(Function),
      truncate: expect.any(Function),
      truncateMiddle: expect.any(Function),
    });
  });
});
