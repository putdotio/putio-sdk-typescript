import { spawnSync } from "node:child_process";

import { redactSecretValues } from "./agent-secret-values.ts";

const targets = process.argv.slice(2);
const projectId = process.env.PUTIO_SDK_TYPESCRIPT_INFISICAL_PROJECT_ID;
const secretPath = process.env.PUTIO_SDK_TYPESCRIPT_INFISICAL_PATH;

if (!projectId || !secretPath) {
  throw new Error("Expected Infisical project and path coordinates");
}

const result = spawnSync(
  "infisical",
  [
    "run",
    "--silent",
    "--domain",
    process.env.PUTIO_INFISICAL_DOMAIN ?? "https://eu.infisical.com/api",
    "--projectId",
    projectId,
    "--env",
    process.env.PUTIO_SDK_TYPESCRIPT_INFISICAL_ENV ?? "dev",
    "--path",
    secretPath,
    "--",
    "./scripts/agent-live-execute.sh",
    ...targets,
  ],
  {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  },
);
const stdout = redactSecretValues(result.stdout ?? "");
const stderr = redactSecretValues(result.stderr ?? "");
const leakedKeys = [...new Set([...stdout.leakedKeys, ...stderr.leakedKeys])];

process.stdout.write(stdout.output);
process.stderr.write(stderr.output);

if (leakedKeys.length > 0) {
  console.error(`Infisical output attempted to expose injected secrets: ${leakedKeys.join(", ")}`);
  process.exit(1);
}

if (result.error) {
  console.error(`Infisical failed to start or capture output: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
