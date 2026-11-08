import { createHmac } from "node:crypto";

import { Schema } from "effect";

import { createPutioSdkPromiseClient, type PutioSdkPromiseClient } from "../../../dist/index.js";
import {
  readFirstPartyClientCredentials,
  readSecondaryCredentialFixture,
  type PutioBootstrapSecrets,
  type PutioClientCredentials,
  type PutioCredentialFixture,
} from "./secrets.ts";

type TokenValidation = Awaited<ReturnType<PutioSdkPromiseClient["auth"]["validateToken"]>>;

type BootstrappedToken = {
  readonly accessToken: string;
  readonly scope: TokenValidation["token_scope"];
  readonly tokenId: number | null;
  readonly userId: number | null;
};

const CodeNotFoundErrorSchema = Schema.Struct({
  _tag: Schema.Literal("PutioOperationError"),
  body: Schema.Struct({
    error_type: Schema.Literal("code_not_found"),
  }),
});

const isCodeNotFoundError = Schema.is(CodeNotFoundErrorSchema);

const THIRD_PARTY_BOOTSTRAP_APP_NAME = "put.io TypeScript SDK Live App";
const THIRD_PARTY_BOOTSTRAP_CALLBACK = "https://example.com/putio-typescript-sdk-live/callback";
const THIRD_PARTY_BOOTSTRAP_WEBSITE = "https://example.com/putio-typescript-sdk-live";
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

const readFreshTotp = (credentials: PutioCredentialFixture): string => {
  if (credentials.totpReference) {
    return generateTotpCode(credentials.totpReference);
  }

  if (!credentials.totp) {
    throw new Error(
      "Missing TOTP input. Set PUTIO_TEST_TOTP or PUTIO_TEST_TOTP_REFERENCE for two-factor bootstrap flows.",
    );
  }

  return credentials.totp;
};

const verifyTwoFactorToken = async (
  sdk: PutioSdkPromiseClient,
  accessToken: string,
  credentials: PutioCredentialFixture,
): Promise<string> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const verified = await sdk.auth.twoFactor.verifyTOTP(accessToken, readFreshTotp(credentials));

      return verified.token;
    } catch (error) {
      if (!isCodeNotFoundError(error) || attempt === 3) {
        throw error;
      }

      await sleep(2000);
    }
  }
};

export const bootstrapFirstPartyToken = async (
  credentials: PutioCredentialFixture,
  firstPartyClient: PutioClientCredentials = readFirstPartyClientCredentials(),
): Promise<BootstrappedToken> => {
  const sdk = createPutioSdkPromiseClient();

  const loginResult = await sdk.auth.login({
    clientId: firstPartyClient.clientId,
    clientSecret: firstPartyClient.clientSecret,
    password: credentials.password,
    username: credentials.username,
  });

  let accessToken = loginResult.access_token;

  try {
    let validation = await sdk.auth.validateToken(accessToken);

    if (validation.token_scope === "two_factor") {
      accessToken = await verifyTwoFactorToken(sdk, accessToken, credentials);
      validation = await sdk.auth.validateToken(accessToken);
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
  } catch (error) {
    sdk.setAccessToken(accessToken);

    try {
      await sdk.auth.logout();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "First-party token bootstrap failed and its session could not be revoked",
      );
    }

    throw error;
  }
};

export const revokeFirstPartyToken = async (accessToken: string): Promise<void> => {
  await createPutioSdkPromiseClient({ accessToken }).auth.logout();
};

const bootstrapThirdPartyToken = async (firstPartyAccessToken: string, appId?: string) => {
  const sdk = createPutioSdkPromiseClient();
  const authedSdk = createPutioSdkPromiseClient({ accessToken: firstPartyAccessToken });

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

  const appDetail = await authedSdk.oauth.get(app.id, { edit: true });

  const accessToken =
    appDetail.token !== null && appDetail.token.length > 0
      ? appDetail.token
      : await authedSdk.oauth.regenerateToken(app.id);

  const validation = await sdk.auth.validateToken(accessToken);

  if (validation.result !== true) {
    throw new Error("third-party token validation did not succeed");
  }

  return {
    accessToken,
    app: { id: app.id, name: app.name },
    scope: validation.token_scope,
    tokenId: validation.token_id,
    userId: validation.user_id,
  };
};

export const bootstrapRuntimeTokens = async (secrets: PutioBootstrapSecrets) => {
  const firstParty = await bootstrapFirstPartyToken(secrets.credentials, secrets.firstPartyClient);

  const thirdParty = await bootstrapThirdPartyToken(
    firstParty.accessToken,
    secrets.thirdPartyClientId,
  );

  return { firstParty, thirdParty };
};

let secondaryClient: Promise<PutioSdkPromiseClient> | undefined;

export const getSecondaryClient = (): Promise<PutioSdkPromiseClient> => {
  secondaryClient ??= bootstrapFirstPartyToken(readSecondaryCredentialFixture()).then((token) =>
    createPutioSdkPromiseClient({ accessToken: token.accessToken }),
  );

  return secondaryClient;
};
