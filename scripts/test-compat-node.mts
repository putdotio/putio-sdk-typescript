import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createCompatWorkspace, getRootPackageVersion, run, writeJson } from "./compat-support.mts";

const main = async () => {
  const context = await createCompatWorkspace("putio-sdk-compat-node");

  try {
    const effectVersion = await getRootPackageVersion("dependencies", "effect");
    const typescriptVersion = await getRootPackageVersion("devDependencies", "typescript");
    const sourceDirectory = join(context.workspace, "src");

    await mkdir(sourceDirectory, { recursive: true });
    await writeJson(join(context.workspace, "package.json"), {
      private: true,
      type: "module",
      scripts: {
        check: "tsc --noEmit",
        build: "tsc --project tsconfig.build.json",
        runtime: "node dist/index.js",
      },
      dependencies: {
        "@putdotio/sdk": `file:${context.packageTarballPath}`,
        effect: effectVersion,
      },
      devDependencies: {
        typescript: typescriptVersion,
      },
    });
    await writeJson(join(context.workspace, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2024",
        lib: ["ES2024", "DOM", "DOM.Iterable"],
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        exactOptionalPropertyTypes: true,
        skipLibCheck: false,
        verbatimModuleSyntax: true,
        noUncheckedIndexedAccess: true,
        noEmit: true,
      },
      include: ["src"],
    });
    await writeJson(join(context.workspace, "tsconfig.build.json"), {
      extends: "./tsconfig.json",
      compilerOptions: {
        noEmit: false,
        outDir: "dist",
        rootDir: "src",
        declaration: true,
      },
    });
    await writeFile(
      join(sourceDirectory, "index.ts"),
      `import { Effect } from "effect";
import {
  createPutioSdkEffectClient,
  createPutioSdkPromiseClient,
  type AccountInfoBroad,
  type CreateAppSpecificPasswordError,
  type PutioErrorEnvelope,
  type FileBroad,
  type FileCopyInput,
  type FileTouchInput,
  type PutioSdkPromiseClient,
  type TransferAddTrackersInput,
  type TransferRemoveInput,
} from "@putdotio/sdk";
import { toHumanFileSize } from "@putdotio/sdk/utilities";

const promiseClient: PutioSdkPromiseClient = createPutioSdkPromiseClient({
  accessToken: "compat-token",
});

const compilePublicContracts = async () => {
  const broad: AccountInfoBroad = await promiseClient.account.getInfo();
  const optionalDownloadToken: string | undefined = broad.download_token;
  const optionalFeatures: Readonly<Record<string, boolean>> | undefined = broad.features;
  const optionalIntercomHash: string | undefined = broad.user_hash;
  const optionalPas: { readonly user_hash: string } | undefined = broad.pas;
  const optionalPaddleId: number | string | null | undefined = broad.paddle_user_id;
  const optionalPushToken: string | undefined = broad.push_token;

  const downloadInfo = await promiseClient.account.getInfo({ download_token: 1 });
  const downloadToken: string = downloadInfo.download_token;
  const featuresInfo = await promiseClient.account.getInfo({ features: 1 });
  const features: Readonly<Record<string, boolean>> = featuresInfo.features;
  const intercomInfo = await promiseClient.account.getInfo({ intercom: 1, platform: "ios" });
  const intercomHash: string | undefined = intercomInfo.user_hash;
  const pasInfo = await promiseClient.account.getInfo({ pas: 1 });
  const pasHash: string = pasInfo.pas.user_hash;
  const profitwellInfo = await promiseClient.account.getInfo({ profitwell: 1 });
  const paddleId: number | string | null = profitwellInfo.paddle_user_id;
  const pushInfo = await promiseClient.account.getInfo({ push_token: 1 });
  const pushToken: string = pushInfo.push_token;

  const createdPassword = await promiseClient.account.appSpecificPasswords.create({
    note: "Node contract fixture",
  });
  const plaintextPassword: string = createdPassword.password;
  const listedPasswords = await promiseClient.account.appSpecificPasswords.list();
  const listedNote: string | undefined = listedPasswords[0]?.note;
  await promiseClient.account.appSpecificPasswords.delete(1);
  await promiseClient.account.appSpecificPasswords.deleteAll();

  const errorEnvelope: PutioErrorEnvelope = {
    error_id: null,
    error_uri: "https://api.put.io/errors/example",
    extra: { limit: 10 },
    status: "ERROR",
  };

  Effect.map(effectClient.account.getInfo({ intercom: 1, platform: "web" }), (info) => {
    const hash: string | undefined = info.user_hash;
    return hash;
  });
  Effect.map(effectClient.account.getInfo({ profitwell: 1 }), (info) => {
    const id: number | string | null = info.paddle_user_id;
    return id;
  });
  Effect.map(effectClient.account.appSpecificPasswords.create({ note: "Effect fixture" }), (value) => {
    const password: string = value.password;
    return password;
  });

  // @ts-expect-error Unrequested conditional fields are not guaranteed.
  const requiredDownloadInfo: { readonly download_token: string } = broad;
  // @ts-expect-error Intercom may legitimately omit user_hash.
  const requiredIntercomHash: string = intercomInfo.user_hash;
  // @ts-expect-error Paddle IDs are not string-only.
  const stringOnlyPaddleId: string = profitwellInfo.paddle_user_id;
  // @ts-expect-error Listed metadata never exposes the one-time plaintext password.
  const listedPlaintextPassword = listedPasswords[0]?.password;
  // @ts-expect-error Only web and ios are valid Intercom platforms.
  promiseClient.account.getInfo({ intercom: 1, platform: "android" });
  // @ts-expect-error App-specific-password IDs must be numbers.
  promiseClient.account.appSpecificPasswords.delete("1");

  return {
    downloadToken,
    errorEnvelope,
    features,
    intercomHash,
    listedNote,
    optionalDownloadToken,
    optionalFeatures,
    optionalIntercomHash,
    optionalPaddleId,
    optionalPas,
    optionalPushToken,
    paddleId,
    pasHash,
    plaintextPassword,
    pushToken,
    requiredDownloadInfo,
    requiredIntercomHash,
    stringOnlyPaddleId,
  };
};
void compilePublicContracts;

type SubtitleLanguages = Awaited<
  ReturnType<PutioSdkPromiseClient["account"]["listSubtitleLanguages"]>
>;
const subtitleLanguage: SubtitleLanguages[number] = {
  code: "eng",
  name: "English",
};
type AppSpecificPasswords = Awaited<
  ReturnType<PutioSdkPromiseClient["account"]["appSpecificPasswords"]["list"]>
>;
const appSpecificPassword: AppSpecificPasswords[number] = {
  created_at: "2026-08-01T10:00:00Z",
  id: 42,
  ip_address: "203.0.113.XXX",
  last_used_at: null,
  note: "Laptop",
};
type CreateAppSpecificPasswordOperationError = Extract<
  CreateAppSpecificPasswordError,
  { readonly _tag: "PutioOperationError" }
>;
type CreateAppSpecificPasswordErrorType =
  CreateAppSpecificPasswordOperationError["contract"]["errorType"];
const knownAppSpecificPasswordError: CreateAppSpecificPasswordErrorType =
  "TOO_MANY_APP_SPECIFIC_PASSWORDS";
// @ts-expect-error unknown app-specific-password error literals are not part of the public contract
const unknownAppSpecificPasswordError: CreateAppSpecificPasswordErrorType = "UNKNOWN_ERROR";
const copyInput: FileCopyInput = { fileId: 7, name: "copy.txt", parentId: 0 };
const touchInput: FileTouchInput = { fileIds: [7], updatedAt: new Date() };
const compilePromiseFileUtilities = async () => {
  const child = await promiseClient.files.getChild({
    name: "source.txt",
    parentId: 0,
    query: { stream_url: 1 },
  });
  const copy: FileBroad = await promiseClient.files.copy(copyInput);
  const writableUserId: number = await promiseClient.files.canWrite(copy.id);
  await promiseClient.files.touch(touchInput);
  return { streamUrl: child.stream_url, writableUserId };
};
void compilePromiseFileUtilities;
const trackersInput: TransferAddTrackersInput = {
  trackers: ["udp://tracker.example:80"],
  transferId: 7,
};
const removalInput: TransferRemoveInput = { filter: "completed" };
const compilePromiseTransferUtilities = async () => {
  const torrent: Uint8Array = await promiseClient.transfers.getTorrent(7);
  await promiseClient.transfers.addTrackers(trackersInput);
  await promiseClient.transfers.remove(removalInput);
  return torrent.byteLength;
};
void compilePromiseTransferUtilities;
const promiseAuthUrl = promiseClient.auth.buildLoginUrl({
  clientId: "external-node",
  redirectUri: "https://example.com/callback",
  state: "node-smoke",
});
const promiseAuthHost = new URL(promiseAuthUrl).host;
promiseClient.setAccessToken("rotated-compat-token");
const uploadRequest = await promiseClient.files.createUploadRequest({
  file: new Blob(["hello from node"]),
  fileName: "node.txt",
});
const uploadToken = new URL(uploadRequest.url).searchParams.get("oauth_token");
if (uploadToken !== "rotated-compat-token") {
  throw new Error("Promise access-token replacement did not reach the upload request");
}
promiseClient.setAccessToken(undefined);
await promiseClient.dispose();

const effectClient = createPutioSdkEffectClient();
void effectClient.files.getChild({ name: "source.txt", parentId: 0 });
void effectClient.files.copy(copyInput);
void effectClient.files.canWrite(7);
void effectClient.files.touch(touchInput);
void effectClient.transfers.getTorrent(7);
void effectClient.transfers.addTrackers(trackersInput);
void effectClient.transfers.remove(removalInput);
const effectAuthHost = await Effect.runPromise(
  Effect.succeed(
    new URL(
      effectClient.auth.buildLoginUrl({
        clientId: "external-effect",
        redirectUri: "https://example.com/callback",
        state: "effect-smoke",
      }),
    ).host,
  ),
);

console.log(
  JSON.stringify({
    effectAuthHost,
    knownAppSpecificPasswordError,
    appSpecificPasswordNote: appSpecificPassword.note,
    promiseAuthHost,
    subtitleLanguage: subtitleLanguage.code,
    uploadMethod: uploadRequest.method,
    uploadBody: uploadRequest.body.constructor.name,
    uploadTokenUpdated: true,
    utility: toHumanFileSize(1_572_864),
    unknownAppSpecificPasswordError,
  }),
);
`,
    );

    await run("npm", ["install", "--ignore-scripts", "--no-audit", "--fund=false"], {
      cwd: context.workspace,
    });
    await run("npm", ["run", "check"], { cwd: context.workspace });
    await run("npm", ["run", "build"], { cwd: context.workspace });
    await run("npm", ["run", "runtime"], { cwd: context.workspace });
  } finally {
    await context.cleanup();
  }
};

await main();
