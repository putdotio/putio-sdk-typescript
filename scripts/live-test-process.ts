import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { redactSecretValues, type SecretEnvironmentKey } from "./agent-secret-values.ts";

export type LiveTestProcessResult = {
  readonly error: Error | null;
  readonly leakedKeys: readonly SecretEnvironmentKey[];
  readonly status: number;
};

export const runLiveTestProcess = (
  targets: readonly string[],
  environment: NodeJS.ProcessEnv,
  secretOverrides: Partial<Record<SecretEnvironmentKey, string | undefined>> = {},
): LiveTestProcessResult => {
  const localVitePlus = resolve("node_modules/.bin/vp");
  const vitePlusCommand = existsSync(localVitePlus) ? localVitePlus : "vp";
  const result = spawnSync(
    vitePlusCommand,
    ["test", "run", "--config", "vitest.live.config.ts", ...targets],
    {
      encoding: "utf8",
      env: environment,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  const leakedKeys = new Set<SecretEnvironmentKey>();

  const redact = (output: string): string => {
    const redacted = redactSecretValues(output, secretOverrides);

    for (const key of redacted.leakedKeys) {
      leakedKeys.add(key);
    }

    return redacted.output;
  };

  process.stdout.write(redact(result.stdout ?? ""));
  process.stderr.write(redact(result.stderr ?? ""));

  return {
    error:
      result.error instanceof Error
        ? result.error
        : result.error
          ? new Error("Unknown live test process failure")
          : null,
    leakedKeys: [...leakedKeys],
    status: result.status ?? 1,
  };
};
