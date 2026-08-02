#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/agent-common.sh"

agent_require_context

bootstrap() {
  command -v node >/dev/null 2>&1 || {
    echo "Node.js is a required runner capability. Install the version from .node-version." >&2
    return 2
  }
  command -v pnpm >/dev/null 2>&1 || {
    echo "pnpm is a required runner capability. Install the packageManager version from package.json." >&2
    return 2
  }

  local expected_node
  local actual_node
  local expected_pnpm
  local actual_pnpm
  expected_node="$(tr -d '[:space:]' < .node-version)"
  actual_node="$(node -p 'process.versions.node')"
  expected_pnpm="$(node -p 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")).packageManager.split("@").at(-1)')"
  actual_pnpm="$(pnpm --version)"

  if [[ "$actual_node" != "$expected_node" ]]; then
    echo "Runner Node.js mismatch: expected $expected_node, found $actual_node." >&2
    return 2
  fi

  if [[ "$actual_pnpm" != "$expected_pnpm" ]]; then
    echo "Runner pnpm mismatch: expected $expected_pnpm, found $actual_pnpm." >&2
    return 2
  fi

  pnpm install --frozen-lockfile

  if [[ -z "${CI:-}" && ! -d .repos/effect/.git ]]; then
    echo "Effect source setup did not produce .repos/effect. Rerun pnpm install after checking network access." >&2
    return 1
  fi

  git diff --exit-code -- pnpm-lock.yaml
}

agent_run_logged bootstrap cold-start bootstrap/failed bootstrap
