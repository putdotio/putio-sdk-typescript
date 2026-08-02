#!/usr/bin/env bash

set -euo pipefail

finish() {
  local run_status=$?
  local teardown_status=0
  trap - EXIT

  set +e
  AGENT_RUN_STATUS="$run_status" ./scripts/agent-teardown.sh
  teardown_status=$?
  set -e

  if ((run_status != 0)); then
    exit "$run_status"
  fi

  exit "$teardown_status"
}

trap finish EXIT
./scripts/agent-bootstrap.sh
./scripts/agent-verify.sh
