import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type RequiredSecretKey =
  | "PUTIO_CLIENT_ID_FIRST_PARTY"
  | "PUTIO_CLIENT_ID_THIRD_PARTY"
  | "PUTIO_CLIENT_SECRET_FIRST_PARTY"
  | "PUTIO_TOKEN_FIRST_PARTY"
  | "PUTIO_TOKEN_THIRD_PARTY"
  | "PUTIO_TEST_PASSWORD"
  | "PUTIO_TEST_USERNAME";

type OptionalSecretKey =
  | "PUTIO_AUTH_TOKEN"
  | "PUTIO_CLIENT_ID"
  | "PUTIO_CLIENT_ID_THIRD_PARTY"
  | "PUTIO_OAUTH_TOKEN"
  | "PUTIO_LIVE_OWNED_VIDEO_FILE_ID"
  | "PUTIO_LIVE_RSS_SOURCE_URL"
  | "PUTIO_TOKEN_PAYMENT_OWNER"
  | "PUTIO_TOKEN_PAYMENT_SUB_ACCOUNT"
  | "PUTIO_TEST_SECONDARY_PASSWORD"
  | "PUTIO_TEST_SECONDARY_TOTP"
  | "PUTIO_TEST_SECONDARY_TOTP_REFERENCE"
  | "PUTIO_TEST_SECONDARY_USERNAME"
  | "PUTIO_TEST_TOTP"
  | "PUTIO_TEST_TOTP_REFERENCE";

const readEnv = (key: string): string | undefined => {
  loadPackageEnvFile();

  const value = process.env[key];

  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

let packageEnvLoaded = false;

export const loadEnvFiles = (envFilePaths: ReadonlyArray<string>): void => {
  if (typeof process.loadEnvFile !== "function") {
    return;
  }

  for (const envFilePath of envFilePaths) {
    try {
      process.loadEnvFile(envFilePath);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }
};

const loadPackageEnvFile = (): void => {
  if (packageEnvLoaded) {
    return;
  }

  packageEnvLoaded = true;

  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  loadEnvFiles([join(packageRoot, ".env.local"), join(packageRoot, ".env")]);
};

export const requireSecret = <TKey extends RequiredSecretKey>(key: TKey): string => {
  const value = readEnv(key);

  if (!value) {
    throw new Error(`Missing required secret environment variable: ${key}`);
  }

  return value;
};

export const readOptionalSecret = <TKey extends OptionalSecretKey>(key: TKey): string | undefined =>
  readEnv(key);

export type PutioLiveTokens = {
  readonly firstPartyToken: string;
  readonly legacyClientId?: string;
  readonly thirdPartyToken: string;
};

export type PutioCredentialFixture = {
  readonly password: string;
  readonly totp?: string;
  readonly totpReference?: string;
  readonly username: string;
};

export type PutioClientCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
};

export type PutioBootstrapSecrets = {
  readonly credentials: PutioCredentialFixture;
  readonly firstPartyClient: PutioClientCredentials;
  readonly thirdPartyClientId?: string;
};

export const readLiveTokens = (): PutioLiveTokens => ({
  firstPartyToken: requireSecret("PUTIO_TOKEN_FIRST_PARTY"),
  legacyClientId: readOptionalSecret("PUTIO_CLIENT_ID"),
  thirdPartyToken: requireSecret("PUTIO_TOKEN_THIRD_PARTY"),
});

export const readCredentialFixture = (): PutioCredentialFixture => ({
  password: requireSecret("PUTIO_TEST_PASSWORD"),
  totp: readOptionalSecret("PUTIO_TEST_TOTP"),
  totpReference: readOptionalSecret("PUTIO_TEST_TOTP_REFERENCE"),
  username: requireSecret("PUTIO_TEST_USERNAME"),
});

export const readSecondaryCredentialFixture = (): PutioCredentialFixture | null => {
  const username = readOptionalSecret("PUTIO_TEST_SECONDARY_USERNAME");
  const password = readOptionalSecret("PUTIO_TEST_SECONDARY_PASSWORD");

  if (!username || !password) {
    return null;
  }

  return {
    password,
    totp: readOptionalSecret("PUTIO_TEST_SECONDARY_TOTP"),
    totpReference: readOptionalSecret("PUTIO_TEST_SECONDARY_TOTP_REFERENCE"),
    username,
  };
};

export const readBootstrapSecrets = (): PutioBootstrapSecrets => ({
  credentials: readCredentialFixture(),
  firstPartyClient: readFirstPartyClientCredentials(),
  thirdPartyClientId: readOptionalSecret("PUTIO_CLIENT_ID_THIRD_PARTY"),
});

export const readFirstPartyClientCredentials = (): PutioClientCredentials => ({
  clientId: requireSecret("PUTIO_CLIENT_ID_FIRST_PARTY"),
  clientSecret: requireSecret("PUTIO_CLIENT_SECRET_FIRST_PARTY"),
});

export const hydrateLiveTokenEnv = (): void => {
  if (process.env.PUTIO_TOKEN_FIRST_PARTY && process.env.PUTIO_TOKEN_THIRD_PARTY) {
    return;
  }

  if (!process.env.PUTIO_TOKEN_FIRST_PARTY) {
    process.env.PUTIO_TOKEN_FIRST_PARTY = readOptionalSecret("PUTIO_AUTH_TOKEN");
  }

  if (!process.env.PUTIO_TOKEN_THIRD_PARTY) {
    process.env.PUTIO_TOKEN_THIRD_PARTY = readOptionalSecret("PUTIO_OAUTH_TOKEN");
  }
};
