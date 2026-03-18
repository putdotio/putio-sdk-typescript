import { describe, expect, it } from "vite-plus/test";

import { dotsToSpaces, truncate, truncateMiddle } from "./string.js";

describe("utility string", () => {
  it("replaces dots with spaces", () => {
    expect(dotsToSpaces("a.b.c")).toBe("a b c");
  });

  it("truncates strings at the end", () => {
    expect(truncate("abcdef", { length: 6 })).toBe("abcdef");
    expect(truncate("abcdef", { length: 3 })).toBe("abc...");
    expect(truncate("abcdef", { ellipsis: "-", length: 3 })).toBe("abc-");
  });

  it("truncates strings in the middle", () => {
    expect(truncateMiddle("abcdef", { backLength: 1, frontLength: 1 })).toBe("a...f");
  });
});
