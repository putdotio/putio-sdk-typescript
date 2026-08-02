import { runLiveTestProcess } from "./live-test-process.ts";

const targets = process.argv.slice(2);

if (targets.length === 0) {
  throw new Error("Expected at least one live test target");
}

const result = runLiveTestProcess(targets, process.env);

if (result.leakedKeys.length > 0) {
  console.error(
    `Live test output attempted to expose injected secrets: ${result.leakedKeys.join(", ")}`,
  );
  process.exit(1);
}

if (result.error) {
  console.error(`Live test process failed to start or capture output: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status);
