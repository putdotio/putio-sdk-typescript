import { afterEach, describe, expect, it, vi } from "vitest";

import * as sdk from "../index.js";
import { createPutioSdkEffectClient, createPutioSdkPromiseClient } from "./client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sdk client factories", () => {
  it("creates the Effect-first SDK client surface", () => {
    const client = createPutioSdkEffectClient();

    expect(client.account.getInfo).toBeTypeOf("function");
    expect(client.auth.getCode).toBeTypeOf("function");
    expect(client.downloadLinks.create).toBeTypeOf("function");
    expect(client.events.list).toBeTypeOf("function");
    expect(client.files.list).toBeTypeOf("function");
    expect(client.oauth.buildAuthorizeUrl).toBeTypeOf("function");
    expect(client.transfers.list).toBeTypeOf("function");
  });

  it("creates the Promise-based SDK client surface", () => {
    const client = createPutioSdkPromiseClient({ accessToken: "token-123" });

    expect(client.account.getInfo).toBeTypeOf("function");
    expect(client.auth.getCode).toBeTypeOf("function");
    expect(client.files.createUploadFormData).toBeTypeOf("function");
    expect(client.files.getApiDownloadUrl).toBeTypeOf("function");
    expect(client.payment.changePlan.preview).toBeTypeOf("function");
    expect(client.sharing.publicShares.list).toBeTypeOf("function");
    expect(client.zips.list).toBeTypeOf("function");
  });

  it("re-exports the public SDK entrypoints", () => {
    expect(sdk.createPutioSdkEffectClient).toBe(createPutioSdkEffectClient);
    expect(sdk.createPutioSdkPromiseClient).toBe(createPutioSdkPromiseClient);
    expect(sdk.DEFAULT_PUTIO_API_BASE_URL).toBe("https://api.put.io");
    expect(sdk.buildPutioUrl("https://api.put.io", "/v2/test")).toBe("https://api.put.io/v2/test");
  });

  it("supports representative Promise-client workflows without live IO", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? new URL(input)
          : input instanceof URL
            ? input
            : new URL(input.url);

      switch (url.pathname) {
        case "/v2/oauth2/oob/code":
          return new Response(
            JSON.stringify({
              status: "OK",
              code: "PUTIO1",
              qr_code_url: "https://api.put.io/qrcode/PUTIO1",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        case "/v2/config/theme":
          return new Response(JSON.stringify({ status: "OK", value: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        case "/v2/transfers/clean":
          return new Response(JSON.stringify({ status: "OK", deleted_ids: [1] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        case "/v2/events/1/torrent":
          return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        default:
          return new Response(JSON.stringify({ status: "OK" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
      }
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createPutioSdkPromiseClient({
      accessToken: "token-123",
      baseUrl: "https://api.put.io",
      uploadBaseUrl: "https://upload.put.io",
    });

    expect(await client.auth.getCode({ appId: 8993 })).toEqual({
      code: "PUTIO1",
      qr_code_url: "https://api.put.io/qrcode/PUTIO1",
    });
    expect(await client.config.getKey("theme")).toBe(true);
    expect(await client.config.deleteKey("theme")).toEqual({ status: "OK" });
    expect(await client.auth.revokeAllClients()).toEqual({ status: "OK" });
    expect(await client.events.clear()).toEqual({ status: "OK" });
    expect(await client.transfers.clean([1])).toEqual({ deleted_ids: [1] });
    expect(await client.transfers.stopRecording(1)).toEqual({ status: "OK" });
    expect(Array.from(await client.events.getTorrent(1))).toEqual([1, 2, 3]);

    expect(await client.files.getApiDownloadUrl(42)).toBe(
      "https://api.put.io/v2/files/42/download?oauth_token=token-123",
    );
    expect(await client.files.getApiContentUrl(42)).toBe(
      "https://api.put.io/v2/files/42/stream?oauth_token=token-123",
    );
    expect(await client.files.getApiMp4DownloadUrl(42)).toBe(
      "https://api.put.io/v2/files/42/mp4/download?oauth_token=token-123",
    );
    expect(await client.files.getHlsStreamUrl(42)).toBe(
      "https://api.put.io/v2/files/42/hls/media.m3u8?oauth_token=token-123",
    );
    expect(
      await client.files.createUploadRequest({
        file: new Blob(["hello"], { type: "text/plain" }),
        fileName: "hello.txt",
      }),
    ).toMatchObject({
      method: "POST",
      url: "https://upload.put.io/v2/files/upload?oauth_token=token-123",
    });
    expect(
      client.oauth.buildAuthorizeUrl({
        oauthToken: "token-123",
      }),
    ).toBe("https://api.put.io/v2/oauth2/authorize?oauth_token=token-123");
    expect(
      client.oauth.buildIconUrl({
        id: 5,
        oauthToken: "token-123",
      }),
    ).toBe("https://api.put.io/v2/oauth/apps/5/icon?oauth_token=token-123");

    expect(fetchMock).toHaveBeenCalledTimes(8);
  });
});
