import { Effect, Predicate, Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { publicContractFixtures } from "../../test/fixtures/public-contracts.js";
import {
  PutioSdk,
  createPutioSdkEffectClient,
  createPutioSdkPromiseClient,
  makePutioSdkEffectClientLayer,
  makePutioSdkLiveClientLayer,
} from "./client.js";
import { PutioAuthError, PutioConfigurationError, PutioOperationError } from "./errors.js";
import { PutioSdkConfig } from "./http.js";

interface ClientSurface {
  readonly [key: string]: ClientSurface | ((...args: never[]) => void);
}

const collectFunctionPaths = (surface: ClientSurface, parentPath = ""): ReadonlyArray<string> =>
  Object.entries(surface).flatMap(([key, member]) => {
    const path = parentPath ? `${parentPath}.${key}` : key;

    return Predicate.isFunction(member) ? [path] : collectFunctionPaths(member, path);
  });

const requestUrl = (input: RequestInfo | URL): URL =>
  new URL(input instanceof Request ? input.url : input);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sdk client factories", () => {
  it("creates the Effect-first SDK client surface", () => {
    const client = createPutioSdkEffectClient();

    expect(client.account.appSpecificPasswords.create).toBeTypeOf("function");
    expect(client.account.getInfo).toBeTypeOf("function");
    expect(client.account.listSubtitleLanguages).toBeTypeOf("function");
    expect(client.auth.getCode).toBeTypeOf("function");
    expect(client.auth.exchangeAuthorizationCode).toBeTypeOf("function");
    expect(client.downloadLinks.create).toBeTypeOf("function");
    expect(client.events.list).toBeTypeOf("function");
    expect(client.files.canWrite).toBeTypeOf("function");
    expect(client.files.getChild).toBeTypeOf("function");
    expect(client.files.list).toBeTypeOf("function");
    expect(client.files.setSort).toBeTypeOf("function");
    expect(client.oauth.buildAuthorizeUrl).toBeTypeOf("function");
    expect(client.podcast.getLinks).toBeTypeOf("function");
    expect(client.transfers.addTrackers).toBeTypeOf("function");
    expect(client.transfers.list).toBeTypeOf("function");
  });

  it("keeps writable Effect client namespaces isolated", () => {
    const first = createPutioSdkEffectClient();
    const second = createPutioSdkEffectClient();
    const clearEvents = first.events.clear;
    const generateTOTP = first.auth.twoFactor.generateTOTP;

    first.events.clear = () => clearEvents();
    first.auth.twoFactor.generateTOTP = () => generateTOTP();

    expect(first.events.clear).not.toBe(clearEvents);
    expect(first.auth.twoFactor.generateTOTP).not.toBe(generateTOTP);
    expect(second.events.clear).toBe(clearEvents);
    expect(second.auth.twoFactor.generateTOTP).toBe(generateTOTP);
  });

  it("provides the Effect client as an Effect service", async () => {
    const program = Effect.gen(function* () {
      return yield* PutioSdk;
    }).pipe(Effect.provide(makePutioSdkEffectClientLayer()));

    await expect(Effect.runPromise(program)).resolves.toMatchObject({
      files: {
        list: expect.any(Function),
      },
    });
  });

  it("provides the Effect client, SDK config, and live transport as one layer", async () => {
    const program = Effect.gen(function* () {
      const client = yield* PutioSdk;
      const config = yield* PutioSdkConfig;

      expect(client.files.list).toBeTypeOf("function");

      return config;
    }).pipe(
      Effect.provide(
        makePutioSdkLiveClientLayer({
          accessToken: "token-123",
        }),
      ),
    );

    await expect(Effect.runPromise(program)).resolves.toMatchObject({
      accessToken: "token-123",
      baseUrl: "https://api.put.io",
    });
  });

  it("sends a snapshot of the configured headers from the Promise client", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ status: "OK" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    vi.stubGlobal("fetch", fetchMock);
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
    const client = createPutioSdkPromiseClient({ accessToken: "token-123", headers });
    headers.set("x-forwarded-for", "198.51.100.1");

    await client.events.clear();

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("x-forwarded-for")).toBe(
      "203.0.113.7",
    );
  });

  it("keeps the Promise client aligned with the Effect client domain surface", () => {
    const effectPaths = collectFunctionPaths(createPutioSdkEffectClient());
    const promisePaths = collectFunctionPaths(createPutioSdkPromiseClient());
    const promisePathSet = new Set(promisePaths);

    expect(effectPaths.filter((path) => !promisePathSet.has(path))).toEqual([]);
    expect(promisePaths.filter((path) => !effectPaths.includes(path)).sort()).toEqual([
      "dispose",
      "files.createUploadFormData",
      "setAccessToken",
      "withSignal",
    ]);
  });

  it("binds the whole Promise operation surface to a signal without the lifecycle methods", () => {
    const client = createPutioSdkPromiseClient();
    const lifecyclePaths = new Set(["dispose", "setAccessToken", "withSignal"]);

    expect(collectFunctionPaths(client.withSignal(new AbortController().signal))).toEqual(
      collectFunctionPaths(client).filter((path) => !lifecyclePaths.has(path)),
    );
  });

  it("aborts the in-flight fetch and rejects with the signal's reason", async () => {
    const fetchSignals: Array<AbortSignal | null | undefined> = [];

    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      fetchSignals.push(init?.signal);

      return new Promise<Response>(() => {});
    });

    vi.stubGlobal("fetch", fetchMock);
    const client = createPutioSdkPromiseClient({ accessToken: "token-123" });
    const controller = new AbortController();
    const bound = client.withSignal(controller.signal);

    const pending = [
      bound.account.getInfo({ download_token: 1 }),
      bound.files.get({ id: 9 }),
      bound.config.getKeyWith("theme", Schema.String),
      bound.transfers.list(),
    ];

    const settled = Promise.allSettled(pending);

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(pending.length);
    });
    expect(fetchSignals.map((signal) => signal?.aborted)).toEqual([false, false, false, false]);

    const reason = new Error("caller gave up");
    controller.abort(reason);

    expect(await settled).toEqual(pending.map(() => ({ reason, status: "rejected" })));
    expect(fetchSignals.map((signal) => signal?.aborted)).toEqual([true, true, true, true]);

    await client.dispose();
  });

  it("rejects with the platform abort and timeout errors when the signal carries no custom reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() => new Promise<Response>(() => {})),
    );
    const client = createPutioSdkPromiseClient({ accessToken: "token-123" });
    const controller = new AbortController();
    const aborted = client.withSignal(controller.signal).transfers.list();
    const timedOut = client.withSignal(AbortSignal.timeout(1)).transfers.list();

    controller.abort();

    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });
    await expect(timedOut).rejects.toMatchObject({ name: "TimeoutError" });

    await client.dispose();
  });

  it("rejects with the reason of an already aborted signal without calling fetch", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));

    vi.stubGlobal("fetch", fetchMock);
    const client = createPutioSdkPromiseClient({ accessToken: "token-123" });
    const reason = new Error("aborted before the call");
    const bound = client.withSignal(AbortSignal.abort(reason));

    await expect(bound.transfers.list()).rejects.toBe(reason);
    await expect(bound.account.getInfo()).rejects.toBe(reason);
    expect(fetchMock).not.toHaveBeenCalled();

    await client.dispose();
  });

  it("keeps the SDK error of a request that failed before the signal aborted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ status: "OK" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    const client = createPutioSdkPromiseClient({ accessToken: "token-123" });
    const controller = new AbortController();
    const bound = client.withSignal(controller.signal);

    await bound.config.deleteKey("warm-up");
    client.setAccessToken(undefined);

    const failed = bound.config.deleteKey("missing-token");
    controller.abort(new Error("caller gave up"));

    await expect(failed).rejects.toBeInstanceOf(PutioConfigurationError);

    await client.dispose();
  });

  it("does not report the signal's reason when the client is disposed mid-request", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));

    vi.stubGlobal("fetch", fetchMock);
    const client = createPutioSdkPromiseClient({ accessToken: "token-123" });
    const pending = client.withSignal(new AbortController().signal).transfers.list();

    const settled = pending.then(
      () => "resolved",
      (error: Error) => error,
    );

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    await client.dispose();

    expect(await settled).toBeInstanceOf(Error);
  });

  it("keeps results, SDK errors, and client state when the signal never aborts", async () => {
    const authorizations: Array<string | null> = [];

    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      authorizations.push(new Headers(init?.headers).get("authorization"));

      return new Response(JSON.stringify({ status: "OK" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);
    const client = createPutioSdkPromiseClient({ accessToken: "initial-token" });
    const controller = new AbortController();
    const bound = client.withSignal(controller.signal);

    await expect(bound.config.deleteKey("initial")).resolves.toEqual({ status: "OK" });
    client.setAccessToken("replacement-token");
    await expect(bound.config.deleteKey("replacement")).resolves.toEqual({ status: "OK" });
    client.setAccessToken(undefined);
    await expect(bound.config.deleteKey("cleared")).rejects.toBeInstanceOf(PutioConfigurationError);
    expect(authorizations).toEqual(["Token initial-token", "Token replacement-token"]);

    controller.abort();
    client.setAccessToken("replacement-token");
    await expect(client.config.deleteKey("unbound")).resolves.toEqual({ status: "OK" });

    await client.dispose();
    await expect(bound.config.deleteKey("disposed")).rejects.toBeInstanceOf(
      PutioConfigurationError,
    );
  });

  it("supports representative Promise-client workflows without live IO", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);

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
        case "/v2/oauth/grants/":
          return new Response(
            JSON.stringify({
              error_message: "invalid scope",
              error_type: "invalid_scope",
              status_code: 401,
            }),
            {
              status: 401,
              headers: { "content-type": "application/json" },
            },
          );
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

    expect(await client.files.getApiDownloadUrl(42, { downloadToken: "download-123" })).toBe(
      "https://api.put.io/v2/files/42/download?oauth_token=download-123",
    );
    expect(await client.files.getApiContentUrl(42, { downloadToken: "download-123" })).toBe(
      "https://api.put.io/v2/files/42/stream?oauth_token=download-123",
    );
    expect(await client.files.getApiMp4DownloadUrl(42, { downloadToken: "download-123" })).toBe(
      "https://api.put.io/v2/files/42/mp4/download?oauth_token=download-123",
    );
    expect(await client.files.getHlsStreamUrl(42, { downloadToken: "download-123" })).toBe(
      "https://api.put.io/v2/files/42/hls/media.m3u8?oauth_token=download-123",
    );
    expect(await client.files.getXspfPlaylistUrl(42, { downloadToken: "download-123" })).toBe(
      "https://api.put.io/v2/files/42/xspf?oauth_token=download-123",
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
    const grants = client.auth.grants();

    await expect(grants).rejects.toBeInstanceOf(PutioOperationError);
    await expect(grants).rejects.toMatchObject({
      body: {
        error_type: "invalid_scope",
        status_code: 401,
      },
      domain: "auth",
      operation: "grants",
      reason: {
        errorType: "invalid_scope",
        kind: "error_type",
      },
      status: 401,
    });

    expect(fetchMock).toHaveBeenCalledTimes(9);
  });

  it("routes the Promise client's typed overload wrappers through their operations", async () => {
    const requests: Array<string> = [];

    const json = (body: Schema.Json, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);

      requests.push(`${url.pathname}${url.search}`);

      switch (url.pathname) {
        case "/v2/files/9":
        case "/v2/files/7/child":
          return json(publicContractFixtures.fileCopy.response);
        case "/v2/config":
          return json({ status: "OK", config: { theme: "dark" } });
        case "/v2/config/theme":
          return json({ status: "OK", value: "dark" });
        default:
          return json({ error_type: "invalid_scope", status_code: 401 }, 401);
      }
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createPutioSdkPromiseClient({ accessToken: "token-123" });

    await expect(client.files.get({ id: 9 })).resolves.toMatchObject({ id: 10 });
    await expect(
      client.files.getChild({ name: "Fixture Copy", parentId: 7 }),
    ).resolves.toMatchObject({ name: "Fixture Copy", parent_id: 7 });
    await expect(client.config.getKeyWith("theme", Schema.String)).resolves.toBe("dark");
    await expect(client.config.readWith(Schema.Struct({ theme: Schema.String }))).resolves.toEqual({
      theme: "dark",
    });
    const accountInfo = client.account.getInfo({ download_token: 1 });

    await expect(accountInfo).rejects.toBeInstanceOf(PutioAuthError);
    await expect(accountInfo).rejects.toMatchObject({ status: 401 });

    expect(requests).toEqual([
      "/v2/files/9",
      "/v2/files/7/child?name=Fixture+Copy",
      "/v2/config/theme",
      "/v2/config",
      "/v2/account/info?download_token=1",
    ]);

    await client.dispose();
  });

  it("updates the Promise access token before and after runtime creation", async () => {
    const authorizations: Array<string | null> = [];

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      authorizations.push(new Headers(init?.headers).get("authorization"));

      return new Response(JSON.stringify({ status: "OK" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const initialConfig = { accessToken: "initial-token" };
    const activeClient = createPutioSdkPromiseClient(initialConfig);

    await expect(activeClient.config.deleteKey("initial")).resolves.toEqual({ status: "OK" });
    activeClient.setAccessToken("replacement-token");
    await expect(activeClient.config.deleteKey("replacement")).resolves.toEqual({ status: "OK" });
    activeClient.setAccessToken(undefined);
    await expect(activeClient.config.deleteKey("cleared")).rejects.toBeInstanceOf(
      PutioConfigurationError,
    );

    const beforeFirstRequestClient = createPutioSdkPromiseClient(initialConfig);
    beforeFirstRequestClient.setAccessToken("before-first-request-token");
    await expect(beforeFirstRequestClient.config.deleteKey("before-first")).resolves.toEqual({
      status: "OK",
    });

    expect(authorizations).toEqual([
      "Token initial-token",
      "Token replacement-token",
      "Token before-first-request-token",
    ]);
    expect(initialConfig).toEqual({ accessToken: "initial-token" });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await activeClient.dispose();
    await beforeFirstRequestClient.dispose();
  });

  it("snapshots caller-owned Promise client URLs", async () => {
    const requestedUrls: Array<string> = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(requestUrl(input).href);

      return new Response(JSON.stringify({ status: "OK" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const baseUrl = new Proxy(new URL("https://api.snapshot.test"), {
      get: (target, key) => (key === "href" ? target.href : undefined),
      getPrototypeOf: () => null,
      set: (target, key, value) => Reflect.set(target, key, value, target),
    });

    const uploadBaseUrl = new URL("https://upload.snapshot.test");
    const webAppUrl = new URL("https://app.snapshot.test");
    expect(baseUrl).not.toBeInstanceOf(URL);

    const client = createPutioSdkPromiseClient({
      accessToken: "token-123",
      baseUrl,
      uploadBaseUrl,
      webAppUrl,
    });

    baseUrl.hostname = "api.mutated.test";
    uploadBaseUrl.hostname = "upload.mutated.test";
    webAppUrl.hostname = "app.mutated.test";

    await expect(client.config.deleteKey("snapshot")).resolves.toEqual({ status: "OK" });

    const uploadRequest = await client.files.createUploadRequest({
      file: new Blob(["snapshot"]),
    });

    const loginUrl = client.auth.buildLoginUrl({
      clientId: 1,
      redirectUri: "https://consumer.test/callback",
      state: "snapshot",
    });

    expect(requestedUrls).toEqual(["https://api.snapshot.test/v2/config/snapshot"]);
    expect(uploadRequest.url).toBe(
      "https://upload.snapshot.test/v2/files/upload?oauth_token=token-123",
    );
    expect(new URL(loginUrl).origin).toBe("https://app.snapshot.test");

    await client.dispose();
  });

  it("snapshots the Promise access token when an operation is invoked", async () => {
    const authorizations = new Map<string, string | null>();
    let markFirstStarted: (() => void) | undefined;
    let releaseFirst: (() => void) | undefined;

    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });

    const firstReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);

      authorizations.set(url.pathname, new Headers(init?.headers).get("authorization"));

      if (url.pathname === "/v2/config/first") {
        markFirstStarted?.();
        await firstReleased;
      }

      return new Response(JSON.stringify({ status: "OK" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createPutioSdkPromiseClient({ accessToken: "first-token" });
    const firstRequest = client.config.deleteKey("first");
    client.setAccessToken("second-token");

    await firstStarted;
    const secondRequest = client.config.deleteKey("second");
    releaseFirst?.();

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      { status: "OK" },
      { status: "OK" },
    ]);
    expect(authorizations).toEqual(
      new Map([
        ["/v2/config/first", "Token first-token"],
        ["/v2/config/second", "Token second-token"],
      ]),
    );

    await client.dispose();
  });

  it("fails fast after the Promise client runtime is disposed", async () => {
    const client = createPutioSdkPromiseClient({
      accessToken: "token-123",
    });

    await client.dispose();

    await expect(client.account.getSettings()).rejects.toBeInstanceOf(PutioConfigurationError);
  });
});
