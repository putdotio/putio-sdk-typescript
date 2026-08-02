#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/agent-common.sh"

agent_require_context

bootstrap() {
  command -v node >/dev/null 2>&1 || {
    echo "Node.js is a required runner capability. Install the version from .node-version." >&2
    return 2
  }

  local expected_node
  local actual_node
  local expected_pnpm
  local expected_vp
  expected_node="$(tr -d '[:space:]' < .node-version)"
  actual_node="$(node -p 'process.versions.node')"
  expected_pnpm="$(node -p 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")).packageManager.split("@").at(-1)')"
  expected_vp="$(sed -n 's/^  vite-plus: //p' pnpm-workspace.yaml)"

  if [[ "$actual_node" != "$expected_node" ]]; then
    echo "Runner Node.js mismatch: expected $expected_node, found $actual_node." >&2
    return 2
  fi

  if command -v pnpm >/dev/null 2>&1; then
    local actual_pnpm
    actual_pnpm="$(pnpm --version)"

    if [[ "$actual_pnpm" != "$expected_pnpm" ]]; then
      echo "Runner pnpm mismatch: expected $expected_pnpm, found $actual_pnpm." >&2
      return 2
    fi

    pnpm install --frozen-lockfile
  elif command -v vp >/dev/null 2>&1; then
    local runner_vp
    runner_vp="$(vp --version | sed -n '1s/^vp v//p')"

    if [[ "$runner_vp" != "$expected_vp" ]]; then
      echo "Runner Vite+ mismatch: expected $expected_vp, found ${runner_vp:-unknown}." >&2
      return 2
    fi

    vp install --frozen-lockfile
  else
    echo "The runner needs pnpm $expected_pnpm or Vite+ $expected_vp." >&2
    return 2
  fi

  local installed_vp
  installed_vp="$(agent_vp --version | sed -n '1s/^vp v//p')"

  if [[ "$installed_vp" != "$expected_vp" ]]; then
    echo "Installed Vite+ mismatch: expected $expected_vp, found ${installed_vp:-unknown}." >&2
    return 2
  fi

  if [[ -z "${CI:-}" && ! -d .repos/effect/.git ]]; then
    echo "Effect source setup did not produce .repos/effect. Rerun pnpm install after checking network access." >&2
    return 1
  fi

  git diff --exit-code -- pnpm-lock.yaml
}

agent_run_logged bootstrap cold-start bootstrap/failed bootstrap
