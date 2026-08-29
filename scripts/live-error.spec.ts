import { describe, expect, it } from "vite-plus/test";

import { formatLiveError } from "./live-error.ts";

describe("formatLiveError", () => {
  it("formats normal errors", () => {
    expect(formatLiveError(new Error("network unavailable"))).toBe("Error: network unavailable");
  });

  it("formats tagged SDK errors without relying on their empty message", () => {
    const error = Object.assign(new Error(), {
      _tag: "PutioAuthError",
      body: {
        error_type: "TooManyRequests",
      },
      retryAfter: "12",
      status: 429,
    });

    expect(formatLiveError(error)).toBe("PutioAuthError status=429 TooManyRequests retryAfter=12");
  });

  it("does not serialize unknown payload fields", () => {
    expect(
      formatLiveError({
        _tag: "PutioValidationError",
        password: "do-not-print",
      }),
    ).toBe("PutioValidationError");
  });
});
