import { describe, expect, it } from "vite-plus/test";

import * as utilities from "./utilities.js";

describe("utilities subpath entry", () => {
  it("re-exports the utility namespace", () => {
    expect(utilities).toMatchObject({
      FileURLProvider: expect.any(Function),
      LocalizedError: expect.any(Function),
      createLocalizeError: expect.any(Function),
      getFileRenderType: expect.any(Function),
      toHumanFileSize: expect.any(Function),
    });
  });
});
