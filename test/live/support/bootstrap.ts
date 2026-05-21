import { createHmac } from "node:crypto";

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
  readonly thirdParty: BootstrappedToken & {
    readonly app: OAuthAppIdentity;
  };
};

const THIRD_PARTY_BOOTSTRAP_APP_NAME = "Codex SDK Live App";
const THIRD_PARTY_BOOTSTRAP_CALLBACK = "https://example.com/codex-sdk-live/callback";
const THIRD_PARTY_BOOTSTRAP_WEBSITE = "https://example.com/codex-sdk-live";
const TOTP_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const decodeBase32 = (value: string): Buffer => {
  const normalized = value.replace(/[\s-]/g, "").replace(/=+$/g, "").toUpperCase();
  const bytes: number[] = [];
  let accumulator = 0;
  let bits = 0;

  for (const character of normalized) {
    const digit = TOTP_ALPHABET.indexOf(character);

    if (digit < 0) {
      throw new Error("Invalid TOTP secret encoding");
    }

    accumulator = (accumulator << 5) | digit;
    bits += 5;

    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

const generateTotpCode = (secret: string, now = Date.now()): string => {
  const counter = Math.floor(now / 30_000);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    (((digest[offset] & 0x7f) << 24) |
      (digest[offset + 1] << 16) |
      (digest[offset + 2] << 8) |
      digest[offset + 3]) %
    1_000_000;

  return String(code).padStart(6, "0");
};

const readFreshTotp = (secrets: PutioBootstrapSecrets): string => {
  const reference = secrets.credentials.totpReference;

  if (reference) {
    return generateTotpCode(reference);
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

  return {
    firstParty,
    thirdParty,
  };
};
