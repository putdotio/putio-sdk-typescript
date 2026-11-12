import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type RequiredSecretKey =
  | "PUTIO_CLIENT_ID_FIRST_PARTY"
  | "PUTIO_CLIENT_SECRET_FIRST_PARTY"
  | "PUTIO_TOKEN_FIRST_PARTY"
  | "PUTIO_TOKEN_THIRD_PARTY"
  | "PUTIO_TEST_PASSWORD"
  | "PUTIO_TEST_USERNAME";

type OptionalSecretKey =
  | "PUTIO_CLIENT_ID"
  | "PUTIO_CLIENT_ID_THIRD_PARTY"
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

export const loadEnvFiles = (envFilePaths: ReadonlyArray<string>): void => {
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

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

loadEnvFiles([
  join(packageRoot, ".env.live-tokens"),
  join(packageRoot, ".env.local"),
  join(packageRoot, ".env"),
]);

export const readOptionalSecret = (key: OptionalSecretKey): string | undefined =>
  process.env[key]?.trim() || undefined;

const requireSecret = (key: RequiredSecretKey): string => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`Missing required secret environment variable: ${key}`);
  }

  return value;
};

export type PutioLiveTokens = {
  readonly firstPartyToken: string;
  readonly thirdPartyToken: string;
};

export type PutioCredentialFixture = {
  readonly password: string;
  readonly totp?: string | undefined;
  readonly totpReference?: string | undefined;
  readonly username: string;
};

export type PutioClientCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
};

export type PutioBootstrapSecrets = {
  readonly credentials: PutioCredentialFixture;
  readonly firstPartyClient: PutioClientCredentials;
  readonly thirdPartyClientId?: string | undefined;
};

export const readLiveTokens = (): PutioLiveTokens => ({
  firstPartyToken: requireSecret("PUTIO_TOKEN_FIRST_PARTY"),
  thirdPartyToken: requireSecret("PUTIO_TOKEN_THIRD_PARTY"),
});

export const readCredentialFixture = (): PutioCredentialFixture => ({
  password: requireSecret("PUTIO_TEST_PASSWORD"),
  totp: readOptionalSecret("PUTIO_TEST_TOTP"),
  totpReference: readOptionalSecret("PUTIO_TEST_TOTP_REFERENCE"),
  username: requireSecret("PUTIO_TEST_USERNAME"),
});

export const hasSecondaryCredentialFixture = (): boolean =>
  readOptionalSecret("PUTIO_TEST_SECONDARY_USERNAME") !== undefined &&
  readOptionalSecret("PUTIO_TEST_SECONDARY_PASSWORD") !== undefined;

export const readSecondaryCredentialFixture = (): PutioCredentialFixture => {
  const username = readOptionalSecret("PUTIO_TEST_SECONDARY_USERNAME");
  const password = readOptionalSecret("PUTIO_TEST_SECONDARY_PASSWORD");

  if (!username || !password) {
    throw new Error(
      "Missing secondary live account fixture: set PUTIO_TEST_SECONDARY_USERNAME and PUTIO_TEST_SECONDARY_PASSWORD.",
    );
  }

  return {
    password,
    totp: readOptionalSecret("PUTIO_TEST_SECONDARY_TOTP"),
    totpReference: readOptionalSecret("PUTIO_TEST_SECONDARY_TOTP_REFERENCE"),
    username,
  };
};

export const readFirstPartyClientCredentials = (): PutioClientCredentials => ({
  clientId: requireSecret("PUTIO_CLIENT_ID_FIRST_PARTY"),
  clientSecret: requireSecret("PUTIO_CLIENT_SECRET_FIRST_PARTY"),
});

export const readBootstrapSecrets = (): PutioBootstrapSecrets => ({
  credentials: readCredentialFixture(),
  firstPartyClient: readFirstPartyClientCredentials(),
  thirdPartyClientId: readOptionalSecret("PUTIO_CLIENT_ID_THIRD_PARTY"),
});
