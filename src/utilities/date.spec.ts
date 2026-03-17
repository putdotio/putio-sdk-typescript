import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  daysDiff,
  daysDiffFromNow,
  ensureUTC,
  formatDate,
  getUnixTimestamp,
  toTimeAgo,
} from "./date.js";

describe("utility date", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2023-06-04T09:39:03.488Z"));
  });

  it("normalizes utc timestamps", () => {
    expect(ensureUTC()).toBe("2023-06-04T09:39:03.488Z");
    expect(ensureUTC(new Date("2023-06-03T18:30:03.488Z"))).toBe("2023-06-03T18:30:03.488Z");
    expect(ensureUTC("2023-06-03T18:30:03")).toBe("2023-06-03T18:30:03.000Z");
    expect(ensureUTC("2023-06-03T18:30:03Z")).toBe("2023-06-03T18:30:03.000Z");
    expect(ensureUTC("2023-06-03")).toBe("2023-06-03T00:00:00.000Z");
  });

  it("formats relative and absolute dates", () => {
    expect(toTimeAgo()).toBe("N/A");
    expect(toTimeAgo("2023-06-04T09:38:33Z")).toBe("30 seconds ago");
    expect(toTimeAgo("2023-06-04T09:09:03Z")).toBe("30 minutes ago");
    expect(toTimeAgo("2023-06-03T18:30:03Z")).toBe("15 hours ago");
    expect(toTimeAgo("2023-05-01T09:39:03Z")).toBe("1 month ago");
    expect(toTimeAgo("2022-06-04T09:39:03Z")).toBe("1 year ago");
    expect(formatDate()).toBe("N/A");
    expect(formatDate("2023-06-03T18:30:03Z")).toBe("June 3, 2023");
    expect(
      formatDate("2023-06-03T18:30:03Z", {
        month: "short",
        year: "numeric",
      }),
    ).toBe("Jun 2023");
  });

  it("calculates day differences", () => {
    vi.setSystemTime(new Date("2020-02-05T00:00:00.000Z"));
    expect(daysDiff("2020-02-05", "2020-02-04")).toBe(1);
    expect(daysDiffFromNow("2020-02-05T16:13:28")).toBe(0);
    expect(daysDiffFromNow("2020-02-04T06:51:43")).toBe(1);
    expect(daysDiffFromNow("2020-02-06T16:13:28")).toBe(1);
    expect(daysDiffFromNow()).toBe(0);
  });

  it("returns unix timestamps", () => {
    expect(getUnixTimestamp("2023-06-03T18:30:03Z")).toBe(1685817003);
  });
});
