import { Effect } from "effect";
import { describe, expect, it } from "@effect/vitest";

import * as auth from "./domains/auth.js";
import * as files from "./domains/files.js";
import * as podcast from "./domains/podcast.js";
import * as transfers from "./domains/transfers.js";
import { publicContractFixtures } from "../test/fixtures/public-contracts.js";
import {
  arrayBufferResponse,
  getAuthorizationHeader,
  getFormBody,
  jsonResponse,
  provideSdk,
} from "../test/support/sdk-test.js";

const accessToken = "fixture-access-token-not-a-credential";

const formEntries = (body: URLSearchParams): Readonly<Record<string, string>> =>
  Object.fromEntries(body.entries());

describe("public contract fixtures", () => {
  it.effect("replays the unauthenticated OAuth exchange fixture", () =>
    Effect.gen(function* () {
      const fixture = publicContractFixtures.authExchange;
      expect(
        yield* provideSdk(
          auth.exchangeOAuthAuthorizationCode(fixture.input),
          (request) => {
            expect({ method: request.method, url: request.url }).toEqual({
              method: fixture.request.method,
              url: fixture.request.url,
            });
            expect(getAuthorizationHeader(request)).toBeUndefined();
            expect(formEntries(getFormBody(request))).toEqual(fixture.request.form);

            return jsonResponse(fixture.response);
          },
          { accessToken },
        ),
      ).toBe(fixture.result);
    }),
  );

  it.effect("replays an authenticated form request and nested file response", () =>
    Effect.gen(function* () {
      const fixture = publicContractFixtures.fileCopy;
      expect(
        yield* provideSdk(
          files.copyFile(fixture.input),
          (request) => {
            expect({ method: request.method, url: request.url }).toEqual({
              method: fixture.request.method,
              url: fixture.request.url,
            });
            expect(getAuthorizationHeader(request)).toBe(`Token ${accessToken}`);
            expect(formEntries(getFormBody(request))).toEqual(fixture.request.form);

            return jsonResponse(fixture.response);
          },
          { accessToken },
        ),
      ).toEqual(fixture.response.file);
    }),
  );

  it.effect("replays a query request and selected podcast response", () =>
    Effect.gen(function* () {
      const fixture = publicContractFixtures.podcastLinks;
      expect(
        yield* provideSdk(
          podcast.getPodcastLinks(fixture.input),
          (request) => {
            expect({ method: request.method, url: request.url }).toEqual(fixture.request);
            expect(getAuthorizationHeader(request)).toBe(`Token ${accessToken}`);

            return jsonResponse(fixture.response);
          },
          { accessToken },
        ),
      ).toEqual(fixture.result);
    }),
  );

  it.effect("replays a binary torrent response", () =>
    Effect.gen(function* () {
      const fixture = publicContractFixtures.transferTorrent;

      const result = yield* provideSdk(
        transfers.getTransferTorrent(fixture.input),
        (request) => {
          expect({ method: request.method, url: request.url }).toEqual(fixture.request);
          expect(getAuthorizationHeader(request)).toBe(`Token ${accessToken}`);

          return arrayBufferResponse(fixture.responseBytes);
        },
        { accessToken },
      );

      expect(Array.from(result)).toEqual(fixture.responseBytes);
    }),
  );
});
