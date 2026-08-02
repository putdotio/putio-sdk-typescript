#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/agent-common.sh"

agent_require_context

run_status="${AGENT_RUN_STATUS:-0}"
result="success"
failure_class=""

if [[ ! "$run_status" =~ ^[0-9]+$ ]]; then
  echo "AGENT_RUN_STATUS must be a non-negative integer." >&2
  exit 2
fi

if ((run_status != 0)); then
  result="failure"
  failure_class="lifecycle/failed"
fi

log_path="$AGENT_ATTEMPT_ARTIFACT_DIR/teardown.log"
printf 'teardown complete\n' > "$log_path"
agent_record record teardown lifecycle "$result" "$failure_class" 0 "$run_status" "$log_path"
