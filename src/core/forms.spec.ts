import { describe, expect, it } from "vite-plus/test";

import { joinCsv, toCursorSelectionForm } from "./forms.js";

describe("sdk core forms", () => {
  it("joins populated CSV values and skips empty selections", () => {
    expect(joinCsv([1, 2, 3])).toBe("1,2,3");
    expect(joinCsv(["a", "b"])).toBe("a,b");
    expect(joinCsv([])).toBeUndefined();
    expect(joinCsv(undefined)).toBeUndefined();
  });

  it("builds cursor-selection form bodies with the default ids field", () => {
    expect(
      toCursorSelectionForm({
        cursor: "abc",
        excludeIds: [1, 2],
        ids: [3, 4],
      }),
    ).toEqual({
      cursor: "abc",
      exclude_ids: "1,2",
      file_ids: "3,4",
    });
  });

  it("supports custom ids field names", () => {
    expect(
      toCursorSelectionForm(
        {
          excludeIds: [1],
          ids: [2, 3],
        },
        "user_file_ids",
      ),
    ).toEqual({
      cursor: undefined,
      exclude_ids: "1",
      user_file_ids: "2,3",
    });
  });
});
