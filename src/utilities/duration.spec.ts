import { describe, expect, it } from "vitest";

import { secondsToDuration, secondsToReadableDuration } from "./duration.js";

describe("utility duration", () => {
  it("formats digital durations", () => {
    expect(secondsToDuration(null)).toBe("00:00");
    expect(secondsToDuration(4)).toBe("00:04");
    expect(secondsToDuration(444)).toBe("07:24");
    expect(secondsToDuration(44_444)).toBe("12:20:44");
    expect(secondsToDuration(444_444)).toBe("05:03:27:24");
    expect(secondsToDuration(86_460)).toBe("01:00:01:00");
    expect(secondsToDuration(2565.568)).toBe("42:45");
  });

  it("formats readable durations", () => {
    expect(secondsToReadableDuration(-500)).toBe("N/A");
    expect(secondsToReadableDuration(null)).toBe("N/A");
    expect(secondsToReadableDuration(4)).toBe("4 s");
    expect(secondsToReadableDuration(44)).toBe("44 s");
    expect(secondsToReadableDuration(444)).toBe("7m 24s");
    expect(secondsToReadableDuration(44_444)).toBe("12h 21m");
    expect(secondsToReadableDuration(86_400)).toBe("1d");
    expect(secondsToReadableDuration(444_444)).toBe("5d 3h");
    expect(secondsToReadableDuration(691_200)).toBe("8d");
    expect(secondsToReadableDuration(2565.568)).toBe("43m");
  });
});
