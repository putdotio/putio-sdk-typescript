import { describe, expect, it } from "vite-plus/test";

import { redactSecretValues } from "./agent-secret-values.ts";

describe("redactSecretValues", () => {
  it("redacts short and secondary fixture secrets", () => {
    const result = redactSecretValues("totp=123456 owner=owner-token secondary=secondary-pass", {
      PUTIO_TEST_SECONDARY_PASSWORD: "secondary-pass",
      PUTIO_TEST_TOTP: "123456",
      PUTIO_TOKEN_PAYMENT_OWNER: "owner-token",
    });

    expect(result.output).toBe(
      "totp=[REDACTED:PUTIO_TEST_TOTP] owner=[REDACTED:PUTIO_TOKEN_PAYMENT_OWNER] secondary=[REDACTED:PUTIO_TEST_SECONDARY_PASSWORD]",
    );
    expect(result.leakedKeys).toEqual([
      "PUTIO_TEST_SECONDARY_PASSWORD",
      "PUTIO_TEST_TOTP",
      "PUTIO_TOKEN_PAYMENT_OWNER",
    ]);
  });

  it("does not treat empty values as secrets", () => {
    expect(redactSecretValues("ordinary output", { PUTIO_TEST_TOTP: "" })).toEqual({
      leakedKeys: [],
      output: "ordinary output",
    });
  });
});
