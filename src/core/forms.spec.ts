import { describe, expect, it } from "vite-plus/test";

import { joinCsv } from "./forms.js";

describe("sdk core forms", () => {
  it("joins populated CSV values and skips empty selections", () => {
    expect(joinCsv([1, 2, 3])).toBe("1,2,3");
    expect(joinCsv(["a", "b"])).toBe("a,b");
    expect(joinCsv([])).toBeUndefined();
    expect(joinCsv(undefined)).toBeUndefined();
  });
});
