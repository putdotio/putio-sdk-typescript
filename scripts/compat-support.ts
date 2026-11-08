import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { Predicate, Schema } from "effect";

export type CompatWorkspace = {
  readonly httpUrl: string;
  readonly root: string;
  readonly workspace: string;
  readonly packageTarballPath: string;
  readonly cleanup: () => Promise<void>;
};

type RunOptions = {
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
};

const DependencyVersionsSchema = Schema.Record(Schema.String, Schema.String);

const RootPackageJsonSchema = Schema.fromJsonString(
  Schema.Struct({
    dependencies: Schema.optional(DependencyVersionsSchema),
    devDependencies: Schema.optional(DependencyVersionsSchema),
  }),
);

const decodeRootPackageJson = Schema.decodeUnknownSync(RootPackageJsonSchema);

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export const getRepoRoot = () => repoRoot;

export const run = (command: string, args: ReadonlyArray<string>, options: RunOptions) =>
  new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();

        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed${signal ? ` with signal ${signal}` : ` with exit code ${code ?? "unknown"}`}`,
        ),
      );
    });
  });

export const writeJson = async (path: string, value: Schema.Json) => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

export const getRootPackageVersion = async (
  key: "dependencies" | "devDependencies",
  dependencyName: string,
) => {
  const raw = await readFile(join(repoRoot, "package.json"), "utf8");
  const version = decodeRootPackageJson(raw)[key]?.[dependencyName];

  if (!version) {
    throw new Error(`package.json is missing ${key}.${dependencyName}`);
  }

  return version;
};

export const createCompatWorkspace = async (name: string): Promise<CompatWorkspace> => {
  const root = await mkdtemp(join(tmpdir(), `${name}-`));
  const packDirectory = join(root, "pack");
  const workspace = join(root, "workspace");

  await mkdir(packDirectory, { recursive: true });
  await mkdir(workspace, { recursive: true });
  await run("npm", ["pack", "--pack-destination", packDirectory], { cwd: repoRoot });

  const tarballs = (await readdir(packDirectory)).filter((entry) => entry.endsWith(".tgz"));

  if (tarballs.length !== 1) {
    throw new Error(`Expected one packed SDK tarball, found ${tarballs.length}`);
  }

  const server = createServer((request, response) => {
    response.writeHead(request.url === "/error" ? 429 : 200, {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    });
    response.write('{"status":');
    const timeout = setTimeout(() => response.end('"OK"}'), 10_000);
    response.once("close", () => clearTimeout(timeout));
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();

  if (address === null || Predicate.isString(address)) {
    server.close();
    throw new Error("Compatibility HTTP server has no TCP address");
  }

  return {
    httpUrl: `http://127.0.0.1:${address.port}`,
    root,
    workspace,
    packageTarballPath: join(packDirectory, tarballs[0]),
    cleanup: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolveClose, reject) =>
        server.close((error) => (error ? reject(error) : resolveClose())),
      );
      await rm(root, { recursive: true, force: true });
    },
  };
};
