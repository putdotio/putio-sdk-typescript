import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const secretKeys = [
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
];

const requireArgument = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
};

const requireIdentifier = (value: string | undefined, name: string): string => {
  const identifier = requireArgument(value, name);

  if (!identifierPattern.test(identifier)) {
    throw new Error(`${name} contains unsupported characters`);
  }

  return identifier;
};

const commandOutput = (command: string, args: readonly string[]): string =>
  execFileSync(command, args, { encoding: "utf8" }).trim();

const getArtifactDirectory = (): string => {
  const taskId = requireIdentifier(process.env.AGENT_TASK_ID, "AGENT_TASK_ID");
  const attemptId = requireIdentifier(process.env.AGENT_ATTEMPT_ID, "AGENT_ATTEMPT_ID");
  const artifactsRoot = process.env.AGENT_ARTIFACTS_DIR ?? ".artifacts/agent-readiness";

  return resolve(artifactsRoot, taskId, attemptId);
};

const record = (args: readonly string[]): void => {
  const [rawPhase, scenario, result, failureClass, rawDuration, rawStatus, rawLogPath] = args;
  const phase = requireIdentifier(rawPhase, "phase");
  const durationSeconds = Number(requireArgument(rawDuration, "duration_seconds"));
  const statusCode = Number(requireArgument(rawStatus, "status_code"));
  const logPath = requireArgument(rawLogPath, "log_path");

  if (!Number.isInteger(durationSeconds) || durationSeconds < 0) {
    throw new Error("duration_seconds must be a non-negative integer");
  }

  if (!Number.isInteger(statusCode) || statusCode < 0) {
    throw new Error("status_code must be a non-negative integer");
  }

  if (result !== "success" && result !== "failure" && result !== "expected_failure") {
    throw new Error("result must be success, failure, or expected_failure");
  }

  const artifactDirectory = getArtifactDirectory();
  mkdirSync(artifactDirectory, { recursive: true });

  const payload = {
    artifact_path: relative(process.cwd(), artifactDirectory),
    attempt_id: requireIdentifier(process.env.AGENT_ATTEMPT_ID, "AGENT_ATTEMPT_ID"),
    captured_at: new Date().toISOString(),
    duration_seconds: durationSeconds,
    evidence_log: relative(process.cwd(), resolve(logPath)),
    failure_class: failureClass || null,
    human_interventions: 0,
    node_version: process.version,
    phase,
    pnpm_version: commandOutput("pnpm", ["--version"]),
    result,
    retries: 0,
    runner: `${process.platform}-${process.arch}`,
    scenario: requireArgument(scenario, "scenario"),
    source_revision: commandOutput("git", ["rev-parse", "HEAD"]),
    status_code: statusCode,
    task_class: process.env.AGENT_TASK_CLASS ?? "implementation",
    task_id: requireIdentifier(process.env.AGENT_TASK_ID, "AGENT_TASK_ID"),
    worktree_dirty: commandOutput("git", ["status", "--porcelain"]).length > 0,
  };

  writeFileSync(
    resolve(artifactDirectory, `${phase}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
    { mode: 0o600 },
  );
};

const scan = (paths: readonly string[]): void => {
  if (paths.length === 0) {
    throw new Error("scan requires at least one artifact path");
  }

  const leaks: string[] = [];

  for (const path of paths) {
    let contents = readFileSync(path, "utf8");

    for (const key of secretKeys) {
      const value = process.env[key];
      if (value && value.length >= 8 && contents.includes(value)) {
        leaks.push(`${path}:${key}`);
        contents = contents.replaceAll(value, `[REDACTED:${key}]`);
      }
    }

    writeFileSync(path, contents, { mode: 0o600 });
  }

  if (leaks.length > 0) {
    throw new Error(`Redacted injected secrets from artifact logs: ${leaks.join(", ")}`);
  }
};

const [command, ...args] = process.argv.slice(2);

if (command === "record") {
  record(args);
} else if (command === "scan") {
  scan(args);
} else {
  throw new Error("Expected record or scan command");
}
