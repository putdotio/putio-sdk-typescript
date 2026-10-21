import { describe, expect, it } from "vite-plus/test";

import * as sdk from "./index.js";

describe("sdk root entry", () => {
  it("exports the expected top-level public surface", () => {
    expect(Object.keys(sdk).sort()).toMatchSnapshot();
  });
});
