import { spawnSync } from "node:child_process";

import type {
  PutioBootstrapSecrets,
  PutioClientCredentials,
  PutioCredentialFixture,
} from "./secrets.ts";

type PutioSdkPromiseClientFactory = typeof import("./client.ts").createPromiseClient;
type PutioSdkPromiseClient = Awaited<ReturnType<PutioSdkPromiseClientFactory>>;
type CreatePromiseClient = (config?: Record<string, unknown>) => Promise<PutioSdkPromiseClient>;

const createSourcePromiseClient: CreatePromiseClient = async (config = {}) => {
  const { createPromiseClient } = await import("./client.ts");
  return createPromiseClient(config);
};

type TokenScope =
  | "default"
  | "files_download"
  | "files_public_access"
  | "token_validate"
  | "two_factor"
  | null;

type TaggedOperationError = {
  readonly _tag?: string;
  readonly body?: {
    readonly error_type?: string;
  };
};

export type BootstrappedToken = {
  readonly accessToken: string;
  readonly scope: TokenScope;
  readonly tokenId: number | null;
  readonly userId: number | null;
};

export type OAuthAppIdentity = {
  readonly id: number;
  readonly name: string;
};

export type BootstrappedTokens = {
  readonly firstParty: BootstrappedToken;
  readonly persisted: boolean;
  readonly thirdParty: BootstrappedToken & {
    readonly app: OAuthAppIdentity;
  };
};

const THIRD_PARTY_BOOTSTRAP_APP_NAME = "Codex SDK Live App";
const THIRD_PARTY_BOOTSTRAP_CALLBACK = "https://example.com/codex-sdk-live/callback";
const THIRD_PARTY_BOOTSTRAP_WEBSITE = "https://example.com/codex-sdk-live";
const RUNTIME_ITEM_TITLE = "putio-sdk-testing";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const parseOpReference = (
  reference: string,
): {
  readonly item: string;
  readonly vault: string;
} | null => {
  if (!reference.startsWith("op://")) {
    return null;
  }

  const [vault, item] = reference.slice("op://".length).split("/", 3);

  if (!vault || !item) {
    return null;
  }

  return {
    item,
    vault,
  };
};

const readFreshTotp = (secrets: PutioBootstrapSecrets): string => {
  const reference = secrets.credentials.totpReference;

  if (reference && process.env.OP_SERVICE_ACCOUNT_TOKEN) {
    const parsedReference = parseOpReference(reference);
    const result = parsedReference
      ? spawnSync(
          "op",
          ["item", "get", parsedReference.item, "--vault", parsedReference.vault, "--otp"],
          {
            env: process.env,
            stdio: "pipe",
            encoding: "utf8",
          },
        )
      : spawnSync("op", ["read", reference], {
          env: process.env,
          stdio: "pipe",
          encoding: "utf8",
        });

    if (result.status !== 0) {
      throw new Error(`Failed to refresh TOTP code: ${result.stderr || result.stdout}`);
    }

    const code = result.stdout.trim();

    if (!code) {
      throw new Error("Refreshed TOTP code was empty");
    }

    return code;
  }

  if (!secrets.credentials.totp) {
    throw new Error(
      "Missing TOTP input. Set PUTIO_TEST_TOTP or PUTIO_TEST_TOTP_REFERENCE for two-factor bootstrap flows.",
    );
  }

  return secrets.credentials.totp;
};

const isCodeNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as TaggedOperationError;

  return (
    candidate._tag === "PutioOperationError" && candidate.body?.error_type === "code_not_found"
  );
};

const verifyTwoFactorToken = async (
  accessToken: string,
  secrets: PutioBootstrapSecrets,
  createClient: CreatePromiseClient,
): Promise<string> => {
  const sdk = await createClient();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const verified = await sdk.auth.twoFactor.verifyTOTP(accessToken, readFreshTotp(secrets));
      return verified.token;
    } catch (error) {
      if (!isCodeNotFoundError(error) || attempt === 2) {
        throw error;
      }

      await sleep(2000);
    }
  }

  throw new Error("unreachable");
};

export const bootstrapFirstPartyToken = async (
  secrets: PutioBootstrapSecrets,
  createClient: CreatePromiseClient = createSourcePromiseClient,
): Promise<BootstrappedToken> => {
  const sdk = await createClient();
  return bootstrapFirstPartyTokenWithCredentials(
    secrets.credentials,
    secrets.firstPartyClient,
    sdk,
    createClient,
  );
};

export const bootstrapFirstPartyTokenWithCredentials = async (
  credentials: PutioCredentialFixture,
  firstPartyClient: PutioClientCredentials,
  sdk?: PutioSdkPromiseClient,
  createClient: CreatePromiseClient = createSourcePromiseClient,
): Promise<BootstrappedToken> => {
  const resolvedSdk = sdk ?? (await createClient());

  const loginResult = await resolvedSdk.auth.login({
    clientId: firstPartyClient.clientId,
    clientSecret: firstPartyClient.clientSecret,
    password: credentials.password,
    username: credentials.username,
  });

  let accessToken = loginResult.access_token;
  let validation = await resolvedSdk.auth.validateToken(accessToken);

  if (validation.token_scope === "two_factor") {
    accessToken = await verifyTwoFactorToken(
      accessToken,
      {
        credentials,
        firstPartyClient,
      } as PutioBootstrapSecrets,
      createClient,
    );
    validation = await resolvedSdk.auth.validateToken(accessToken);
  }

  if (validation.result !== true) {
    throw new Error("first-party token validation did not succeed");
  }

  return {
    accessToken,
    scope: validation.token_scope,
    tokenId: validation.token_id,
    userId: validation.user_id,
  };
};

export const bootstrapThirdPartyToken = async (
  firstPartyAccessToken: string,
  appId?: string,
  createClient: CreatePromiseClient = createSourcePromiseClient,
): Promise<BootstrappedToken & { readonly app: OAuthAppIdentity }> => {
  const sdk = await createClient();
  const authedSdk = await createClient({
    accessToken: firstPartyAccessToken,
  });

  const existingApps = await authedSdk.oauth.query();

  const resolvedApp =
    (appId ? existingApps.find((app) => app.id === Number(appId)) : undefined) ??
    existingApps.find((app) => app.name === THIRD_PARTY_BOOTSTRAP_APP_NAME);

  const app =
    resolvedApp ??
    (
      await authedSdk.oauth.create({
        callback: THIRD_PARTY_BOOTSTRAP_CALLBACK,
        description: "SDK live-test and fixture bootstrap app",
        hidden: true,
        name: THIRD_PARTY_BOOTSTRAP_APP_NAME,
        website: THIRD_PARTY_BOOTSTRAP_WEBSITE,
      })
    ).app;

  const appDetail = await authedSdk.oauth.get(app.id, {
    edit: true,
  });

  const accessToken =
    typeof appDetail.token === "string" && appDetail.token.length > 0
      ? appDetail.token
      : await authedSdk.oauth.regenerateToken(app.id);

  const validation = await sdk.auth.validateToken(accessToken);

  if (validation.result !== true) {
    throw new Error("third-party token validation did not succeed");
  }

  return {
    accessToken,
    app: {
      id: app.id,
      name: app.name,
    },
    scope: validation.token_scope,
    tokenId: validation.token_id,
    userId: validation.user_id,
  };
};

export const persistRuntimeTokens = (
  secrets: PutioBootstrapSecrets,
  payload: {
    readonly firstParty: BootstrappedToken;
    readonly thirdParty: BootstrappedToken & {
      readonly app: OAuthAppIdentity;
    };
  },
): boolean => {
  if (!process.env.OP_SERVICE_ACCOUNT_TOKEN || !secrets.runtimeItemId) {
    return false;
  }

  const editResult = spawnSync(
    "op",
    [
      "item",
      "edit",
      secrets.runtimeItemId,
      "--vault",
      secrets.runtimeItemVault ??
        (() => {
          throw new Error(
            "Missing PUTIO_1PASSWORD_RUNTIME_VAULT. Set it explicitly when persisting runtime tokens to 1Password.",
          );
        })(),
      "--title",
      RUNTIME_ITEM_TITLE,
      `meta.updated_at=${new Date().toISOString()}`,
      `first_party.access_token[concealed]=${payload.firstParty.accessToken}`,
      `first_party.scope=${payload.firstParty.scope ?? ""}`,
      `first_party.token_id=${payload.firstParty.tokenId ?? ""}`,
      `first_party.user_id=${payload.firstParty.userId ?? ""}`,
      `third_party.access_token[concealed]=${payload.thirdParty.accessToken}`,
      `third_party.scope=${payload.thirdParty.scope ?? ""}`,
      `third_party.token_id=${payload.thirdParty.tokenId ?? ""}`,
      `third_party.user_id=${payload.thirdParty.userId ?? ""}`,
      `third_party.app_id=${payload.thirdParty.app.id}`,
      `third_party.app_name=${payload.thirdParty.app.name}`,
      "third_party_app_id[delete]",
      "notesPlain=",
    ],
    {
      env: process.env,
      stdio: "pipe",
      encoding: "utf8",
    },
  );

  if (editResult.status !== 0) {
    throw new Error(`Failed to persist runtime tokens: ${editResult.stderr || editResult.stdout}`);
  }

  return true;
};

export const bootstrapRuntimeTokens = async (
  secrets: PutioBootstrapSecrets,
  createClient: CreatePromiseClient = createSourcePromiseClient,
): Promise<BootstrappedTokens> => {
  const firstParty = await bootstrapFirstPartyToken(secrets, createClient);
  const thirdParty = await bootstrapThirdPartyToken(
    firstParty.accessToken,
    secrets.thirdPartyClientId,
    createClient,
  );
  const persisted = persistRuntimeTokens(secrets, {
    firstParty,
    thirdParty,
  });

  return {
    firstParty,
    persisted,
    thirdParty,
  };
};
