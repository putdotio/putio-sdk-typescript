import { Effect } from "effect";
import fc from "fast-check";
import { describe, expect, it } from "vite-plus/test";

import { jsonResponse, provideSdk } from "../../test/support/sdk-test.js";

import { PutioConfigurationError, PutioValidationError } from "./errors.js";
import { OkResponseSchema, buildPutioUrl, requestJson } from "./http.js";

const bases = ["https://api.put.io", "https://upload.put.io", "http://127.0.0.1:8080"] as const;

const prefixes = ["", "/v2/", "/v2/files/"] as const;

const delimiterTokens = [
  "/",
  "\\",
  ".",
  "%2e",
  "%2E",
  "%5c",
  "%2f",
  "%",
  ":",
  "@",
  "?",
  "#",
  " ",
  "\t",
  "\n",
  "\r",
  "\u0000",
  "a",
] as const;

const maxTokens = 4;

const tokenSequences = function* (length: number): Generator<string> {
  if (length === 0) {
    yield "";

    return;
  }

  for (const head of delimiterTokens) {
    for (const tail of tokenSequences(length - 1)) {
      yield head + tail;
    }
  }
};

const confinementViolation = (base: string, prefix: string, path: string): string | undefined => {
  let built: string;

  try {
    built = buildPutioUrl(base, path);
  } catch (error) {
    return error instanceof PutioConfigurationError || error instanceof PutioValidationError
      ? undefined
      : `threw ${String(error)}`;
  }

  const url = new URL(built);
  const expectedOrigin = new URL(base).origin;

  if (url.origin !== expectedOrigin) return `left origin ${expectedOrigin}: ${built}`;

  if (url.username !== "" || url.password !== "") return `added userinfo: ${built}`;

  if (prefix !== "" && !url.pathname.startsWith(prefix)) return `escaped ${prefix}: ${built}`;

  return undefined;
};

const tokenTail = fc
  .array(fc.constantFrom(...delimiterTokens), { maxLength: 8 })
  .map((tokens) => tokens.join(""));

const pathTail = fc.oneof(
  fc.string({ unit: "binary" }),
  tokenTail,
  fc
    .array(
      fc.oneof(fc.constantFrom(...delimiterTokens), fc.string({ unit: "binary", maxLength: 3 })),
    )
    .map((parts) => parts.join("")),
);

describe("request URL confinement", () => {
  it(`keeps every delimiter combination up to ${maxTokens} tokens on the base origin and under its prefix`, () => {
    const violations: Array<string> = [];

    for (const base of bases) {
      for (const prefix of prefixes) {
        for (let length = 0; length <= maxTokens; length++) {
          for (const tail of tokenSequences(length)) {
            const violation = confinementViolation(base, prefix, prefix + tail);

            if (violation) violations.push(`${JSON.stringify(prefix + tail)} ${violation}`);
          }
        }
      }
    }

    expect(violations.slice(0, 10)).toEqual([]);
  }, 30_000);

  it("keeps generated paths on the base origin and under their prefix", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...bases),
        fc.constantFrom(...prefixes),
        pathTail,
        (base, prefix, tail) => {
          expect(confinementViolation(base, prefix, prefix + tail)).toBeUndefined();
        },
      ),
      { numRuns: 5000 },
    );
  });

  it("sends the access token only to the configured origin", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...bases), tokenTail, async (base, tail) => {
        const sent: Array<string> = [];

        await Effect.runPromiseExit(
          provideSdk(
            requestJson(OkResponseSchema, { method: "GET", path: `/${tail}` }),
            (request) => {
              if (request.headers.has("authorization")) sent.push(request.url);

              return jsonResponse({ status: "OK" });
            },
            { accessToken: "token-123", baseUrl: base },
          ),
        );

        for (const url of sent) expect(new URL(url).origin).toBe(new URL(base).origin);
      }),
      { numRuns: 2000 },
    );
  });
});
