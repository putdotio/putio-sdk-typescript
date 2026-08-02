import { describe, expect, it } from "vite-plus/test";

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
  runSdkEffect,
} from "../test/support/sdk-test.js";

const accessToken = "fixture-access-token-not-a-credential";

const formEntries = (body: URLSearchParams): Readonly<Record<string, string>> =>
  Object.fromEntries(body.entries());

describe("public contract fixtures", () => {
  it("replays the unauthenticated OAuth exchange fixture", async () => {
    const fixture = publicContractFixtures.authExchange;
    await expect(
      runSdkEffect(
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
    ).resolves.toBe(fixture.result);
  });

  it("replays an authenticated form request and nested file response", async () => {
    const fixture = publicContractFixtures.fileCopy;
    await expect(
      runSdkEffect(
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
    ).resolves.toEqual(fixture.response.file);
  });

  it("replays a query request and selected podcast response", async () => {
    const fixture = publicContractFixtures.podcastLinks;
    await expect(
      runSdkEffect(
        podcast.getPodcastLinks(fixture.input),
        (request) => {
          expect({ method: request.method, url: request.url }).toEqual(fixture.request);
          expect(getAuthorizationHeader(request)).toBe(`Token ${accessToken}`);
          return jsonResponse(fixture.response);
        },
        { accessToken },
      ),
    ).resolves.toEqual(fixture.result);
  });

  it("replays a binary torrent response", async () => {
    const fixture = publicContractFixtures.transferTorrent;
    const result = await runSdkEffect(
      transfers.getTransferTorrent(fixture.input),
      (request) => {
        expect({ method: request.method, url: request.url }).toEqual(fixture.request);
        expect(getAuthorizationHeader(request)).toBe(`Token ${accessToken}`);
        return arrayBufferResponse(fixture.responseBytes);
      },
      { accessToken },
    );

    expect(Array.from(result)).toEqual(fixture.responseBytes);
  });
});
