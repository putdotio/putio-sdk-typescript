export const secretEnvironmentKeys = [
  "INFISICAL_TOKEN",
  "PUTIO_CLIENT_SECRET_FIRST_PARTY",
  "PUTIO_TEST_PASSWORD",
  "PUTIO_TEST_SECONDARY_PASSWORD",
  "PUTIO_TEST_TOTP",
  "PUTIO_TEST_TOTP_REFERENCE",
  "PUTIO_TEST_SECONDARY_TOTP",
  "PUTIO_TEST_SECONDARY_TOTP_REFERENCE",
  "PUTIO_TOKEN_FIRST_PARTY",
  "PUTIO_TOKEN_PAYMENT_OWNER",
  "PUTIO_TOKEN_PAYMENT_SUB_ACCOUNT",
  "PUTIO_TOKEN_THIRD_PARTY",
] as const;

export type SecretEnvironmentKey = (typeof secretEnvironmentKeys)[number];

export const collectSecretValues = (
  overrides: Partial<Record<SecretEnvironmentKey, string | undefined>> = {},
): ReadonlyArray<readonly [SecretEnvironmentKey, string]> =>
  secretEnvironmentKeys.flatMap((key) => {
    const value = overrides[key] ?? process.env[key];
    return typeof value === "string" && value.length > 0 ? [[key, value]] : [];
  });

export const redactSecretValues = (
  output: string,
  overrides: Partial<Record<SecretEnvironmentKey, string | undefined>> = {},
): { readonly leakedKeys: readonly SecretEnvironmentKey[]; readonly output: string } => {
  let redacted = output;
  const leakedKeys: SecretEnvironmentKey[] = [];

  for (const [key, value] of collectSecretValues(overrides)) {
    if (redacted.includes(value)) {
      redacted = redacted.replaceAll(value, `[REDACTED:${key}]`);
      leakedKeys.push(key);
    }
  }

  return {
    leakedKeys,
    output: redacted,
  };
};
