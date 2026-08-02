import { readFileSync, writeFileSync } from "node:fs";

const [payloadPath, outputPath] = process.argv.slice(2);

if (!payloadPath || !outputPath) {
  throw new Error("expected payload and output paths");
}

const expectedKeys = [
  "PUTIO_CLIENT_ID",
  "PUTIO_CLIENT_ID_FIRST_PARTY",
  "PUTIO_CLIENT_ID_THIRD_PARTY",
  "PUTIO_CLIENT_SECRET_FIRST_PARTY",
  "PUTIO_TEST_PASSWORD",
  "PUTIO_TEST_TOTP_REFERENCE",
  "PUTIO_TEST_USERNAME",
  "PUTIO_TOKEN_FIRST_PARTY",
  "PUTIO_TOKEN_THIRD_PARTY",
];

const payload = JSON.parse(readFileSync(payloadPath, "utf8"));

if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
  throw new Error("decrypted payload must be a JSON object");
}

const actualKeys = Object.keys(payload).sort();
if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
  throw new Error("decrypted payload key inventory does not match the SDK contract");
}

for (const value of Object.values(payload)) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("decrypted payload contains an empty or non-string value");
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    throw new Error("decrypted payload contains a quote-wrapped value");
  }

  if (value.includes("\n") || value.includes("\r")) {
    throw new Error("decrypted payload contains a multiline value");
  }
}

for (const key of [
  "PUTIO_CLIENT_ID",
  "PUTIO_CLIENT_ID_FIRST_PARTY",
  "PUTIO_CLIENT_ID_THIRD_PARTY",
]) {
  if (!/^[0-9]+$/.test(payload[key])) {
    throw new Error("decrypted payload contains an invalid numeric identifier");
  }
}

const delimiters = ['"', "'", "`"];
const render = (value) => {
  const delimiter = delimiters.find((candidate) => !value.includes(candidate));
  if (!delimiter) {
    throw new Error("decrypted payload contains a value that cannot be rendered safely");
  }
  return `${delimiter}${value}${delimiter}`;
};

const dotenv = actualKeys.map((key) => `${key}=${render(payload[key])}`).join("\n");
writeFileSync(outputPath, `${dotenv}\n`, { mode: 0o600 });
