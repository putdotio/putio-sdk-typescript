#!/usr/bin/env bash

set -euo pipefail

agent_require_context() {
  : "${AGENT_TASK_ID:?Set AGENT_TASK_ID to a stable task identifier}"
  : "${AGENT_ATTEMPT_ID:?Set AGENT_ATTEMPT_ID to a stable attempt identifier}"

  if [[ ! "$AGENT_TASK_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]]; then
    echo "AGENT_TASK_ID must use 1-128 letters, numbers, dots, underscores, or hyphens." >&2
    return 2
  fi

  if [[ ! "$AGENT_ATTEMPT_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]]; then
    echo "AGENT_ATTEMPT_ID must use 1-128 letters, numbers, dots, underscores, or hyphens." >&2
    return 2
  fi

  export AGENT_ARTIFACTS_DIR="${AGENT_ARTIFACTS_DIR:-.artifacts/agent-readiness}"
  export AGENT_ATTEMPT_ARTIFACT_DIR="$AGENT_ARTIFACTS_DIR/$AGENT_TASK_ID/$AGENT_ATTEMPT_ID"
  umask 077
  mkdir -p "$AGENT_ATTEMPT_ARTIFACT_DIR"
}

agent_record() {
  node ./scripts/agent-record.ts "$@"
}

agent_vp() {
  if [[ -x node_modules/.bin/vp ]]; then
    ./node_modules/.bin/vp "$@"
    return
  fi

  if command -v vp >/dev/null 2>&1; then
    vp "$@"
    return
  fi

  echo "Vite+ is unavailable. Run the agent bootstrap or use the repository's setup action." >&2
  return 2
}

agent_run_logged() {
  local phase="$1"
  local scenario="$2"
  local failure_class="$3"
  shift 3

  local restore_errexit=0
  local started_at=$SECONDS
  local log_path="$AGENT_ATTEMPT_ARTIFACT_DIR/$phase.log"

  if [[ $- == *e* ]]; then
    restore_errexit=1
  fi

  set +e
  "$@" 2>&1 | tee "$log_path"
  local command_status=${PIPESTATUS[0]}

  if ((restore_errexit == 1)); then
    set -e
  fi

  local duration_seconds=$((SECONDS - started_at))
  local result="success"
  local recorded_failure=""

  if ((command_status != 0)); then
    result="failure"
    recorded_failure="$failure_class"
    if [[ "${AGENT_EXPECTED_FAILURE:-0}" == "1" ]]; then
      result="expected_failure"
    fi
  fi

  agent_record record "$phase" "$scenario" "$result" "$recorded_failure" \
    "$duration_seconds" "$command_status" "$log_path"

  return "$command_status"
}
