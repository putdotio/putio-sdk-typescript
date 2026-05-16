import { createServer, type Server } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { chromium, firefox, webkit } from "playwright";
import { build } from "vite";

import { createCompatWorkspace, getRootPackageVersion, run, writeJson } from "./compat-support.mts";

type BrowserName = "chromium" | "firefox" | "webkit";

type BrowserCompatResult = {
  readonly authHost: string;
  readonly effectAuthHost: string;
  readonly uploadFileName: string;
  readonly utility: string;
};

type StaticServer = {
  readonly server: Server;
  readonly url: string;
};

declare global {
  interface Window {
    __PUTIO_COMPAT_ERROR__?: string;
    __PUTIO_COMPAT_RESULT__?: BrowserCompatResult;
  }
}

const allBrowserNames: ReadonlyArray<BrowserName> = ["chromium", "firefox", "webkit"];

const isBrowserName = (value: string): value is BrowserName =>
  value === "chromium" || value === "firefox" || value === "webkit";

const browserNamesFromEnvironment = (): ReadonlyArray<BrowserName> => {
  const requested = process.env.PUTIO_COMPAT_BROWSERS;

  if (!requested) {
    return allBrowserNames;
  }

  const names = requested
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const invalid: Array<string> = [];
  const selected: Array<BrowserName> = [];

  for (const name of names) {
    if (isBrowserName(name)) {
      selected.push(name);
    } else {
      invalid.push(name);
    }
  }

  if (invalid.length > 0) {
    throw new Error(`Unsupported browser target(s): ${invalid.join(", ")}`);
  }

  return selected;
};

const launchBrowser = (browserName: BrowserName) => {
  switch (browserName) {
    case "chromium":
      return chromium.launch();
    case "firefox":
      return firefox.launch();
    case "webkit":
      return webkit.launch();
  }
};

const contentTypeFor = (filePath: string) => {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  return "application/octet-stream";
};

const isPathInsideDirectory = (directory: string, filePath: string) => {
  const relativePath = relative(directory, filePath);

  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

const serveDirectory = (directory: string) =>
  new Promise<StaticServer>((resolveServer, reject) => {
    const root = resolve(directory);
    const server = createServer(async (request, response) => {
      try {
        const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
        const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
        const filePath = resolve(root, `.${decodeURIComponent(pathname)}`);

        if (!isPathInsideDirectory(root, filePath)) {
          response.writeHead(403);
          response.end("Forbidden");
          return;
        }

        const body = await readFile(filePath);
        response.writeHead(200, {
          "content-type": contentTypeFor(filePath),
        });
        response.end(body);
      } catch (error) {
        response.writeHead(404);
        response.end(error instanceof Error ? error.message : "Not found");
      }
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (typeof address === "object" && address !== null) {
        resolveServer({
          server,
          url: `http://127.0.0.1:${address.port}`,
        });
        return;
      }

      reject(new Error("Static server did not expose a TCP address"));
    });
  });

const closeServer = (server: Server) =>
  new Promise<void>((resolveClose, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolveClose();
    });
  });

const runBrowserTarget = async (browserName: BrowserName, url: string) => {
  const browser = await launchBrowser(browserName);
  const page = await browser.newPage();
  const pageErrors: Array<string> = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      pageErrors.push(message.text());
    }
  });

  try {
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(
      () =>
        window.__PUTIO_COMPAT_RESULT__ !== undefined || window.__PUTIO_COMPAT_ERROR__ !== undefined,
    );

    const browserError = await page.evaluate(() => window.__PUTIO_COMPAT_ERROR__);

    if (browserError) {
      throw new Error(`${browserName} compatibility smoke failed in page: ${browserError}`);
    }

    const result = await page.evaluate(() => window.__PUTIO_COMPAT_RESULT__);

    if (!result) {
      throw new Error(`${browserName} compatibility smoke did not publish a result`);
    }

    if (result.authHost !== "app.put.io" || result.effectAuthHost !== "app.put.io") {
      throw new Error(`${browserName} produced unexpected auth hosts: ${JSON.stringify(result)}`);
    }

    console.log(`${browserName}: ${JSON.stringify(result)}`);
  } finally {
    await page.close();
    await browser.close();
  }

  if (pageErrors.length > 0) {
    throw new Error(`${browserName} emitted page errors: ${pageErrors.join("; ")}`);
  }
};

const main = async () => {
  const context = await createCompatWorkspace("putio-sdk-compat-browser");
  let staticServer: StaticServer | undefined;

  try {
    const effectVersion = await getRootPackageVersion("dependencies", "effect");
    const sourceDirectory = join(context.workspace, "src");

    await mkdir(sourceDirectory, { recursive: true });
    await writeJson(join(context.workspace, "package.json"), {
      private: true,
      type: "module",
      dependencies: {
        "@putdotio/sdk": `file:${context.packageTarballPath}`,
        effect: effectVersion,
      },
      devDependencies: {},
    });
    await writeJson(join(context.workspace, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        exactOptionalPropertyTypes: true,
        skipLibCheck: false,
        verbatimModuleSyntax: true,
      },
      include: ["src"],
    });
    await writeFile(
      join(context.workspace, "index.html"),
      `<div id="root"></div><script type="module" src="/src/main.ts"></script>\n`,
    );
    await writeFile(
      join(sourceDirectory, "main.ts"),
      `import { Effect } from "effect";
import { createPutioSdkEffectClient, createPutioSdkPromiseClient } from "@putdotio/sdk";
import { toHumanFileSize } from "@putdotio/sdk/utilities";

type BrowserCompatResult = {
  readonly authHost: string;
  readonly effectAuthHost: string;
  readonly uploadFileName: string;
  readonly utility: string;
};

declare global {
  interface Window {
    __PUTIO_COMPAT_ERROR__?: string;
    __PUTIO_COMPAT_RESULT__?: BrowserCompatResult;
  }
}

const run = async () => {
  const promiseClient = createPutioSdkPromiseClient({
    accessToken: "compat-token",
  });
  const authUrl = promiseClient.auth.buildLoginUrl({
    clientId: "external-browser",
    redirectUri: "https://example.com/callback",
    state: "browser-smoke",
  });
  const authHost = new URL(authUrl).host;
  const uploadForm = promiseClient.files.createUploadFormData({
    file: new Blob(["hello from browser"]),
    fileName: "browser.txt",
  });
  const uploadedFile = uploadForm.get("file");
  await promiseClient.dispose();

  const effectClient = createPutioSdkEffectClient();
  const effectAuthHost = await Effect.runPromise(
    Effect.succeed(
      new URL(
        effectClient.auth.buildLoginUrl({
          clientId: "external-browser-effect",
          redirectUri: "https://example.com/callback",
          state: "browser-effect-smoke",
        }),
      ).host,
    ),
  );

  window.__PUTIO_COMPAT_RESULT__ = {
    authHost,
    effectAuthHost,
    uploadFileName: uploadedFile instanceof File ? uploadedFile.name : "missing",
    utility: toHumanFileSize(1_572_864),
  };
};

run().catch((error: unknown) => {
  window.__PUTIO_COMPAT_ERROR__ = error instanceof Error ? error.message : String(error);
});
`,
    );

    await run("npm", ["install", "--ignore-scripts", "--no-audit", "--fund=false"], {
      cwd: context.workspace,
    });
    const previousCwd = process.cwd();
    process.chdir(context.workspace);
    try {
      await build();
    } finally {
      process.chdir(previousCwd);
    }

    staticServer = await serveDirectory(join(context.workspace, "dist"));

    for (const browserName of browserNamesFromEnvironment()) {
      await runBrowserTarget(browserName, staticServer.url);
    }
  } finally {
    if (staticServer) {
      await closeServer(staticServer.server);
    }

    await context.cleanup();
  }
};

await main();
