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

  export AGENT_TASK_CLASS="${AGENT_TASK_CLASS:-implementation}"
  if [[ ! "$AGENT_TASK_CLASS" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]]; then
    echo "AGENT_TASK_CLASS must use 1-128 letters, numbers, dots, underscores, or hyphens." >&2
    return 2
  fi

  export AGENT_ARTIFACTS_DIR="${AGENT_ARTIFACTS_DIR:-.artifacts/agent-readiness}"
  export AGENT_ATTEMPT_ARTIFACT_DIR="$AGENT_ARTIFACTS_DIR/$AGENT_TASK_ID/$AGENT_ATTEMPT_ID"
  umask 077
  mkdir -p "$AGENT_ATTEMPT_ARTIFACT_DIR"
}

agent_record() {
  if command -v node >/dev/null 2>&1; then
    node ./scripts/agent-record.ts "$@"
    return
  fi

  local phase="$2"
  local scenario="$3"
  local result="$4"
  local failure_class="$5"
  local duration_seconds="$6"
  local status_code="$7"
  local captured_at
  local failure_class_json="null"
  local runner
  local source_revision="unknown"

  captured_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  runner="$(uname -s)-$(uname -m)"

  if [[ -n "$failure_class" ]]; then
    failure_class_json="\"$failure_class\""
  fi

  if command -v git >/dev/null 2>&1; then
    source_revision="$(git rev-parse HEAD 2>/dev/null || printf unknown)"
  fi

  printf '{"attempt_id":"%s","captured_at":"%s","duration_seconds":%s,"failure_class":%s,"human_interventions":0,"node_version":null,"phase":"%s","pnpm_version":null,"result":"%s","retries":0,"runner":"%s","scenario":"%s","source_revision":"%s","status_code":%s,"task_class":"%s","task_id":"%s","vite_plus_version":null,"worktree_dirty":null}\n' \
    "$AGENT_ATTEMPT_ID" "$captured_at" "$duration_seconds" "$failure_class_json" "$phase" \
    "$result" "$runner" "$scenario" "$source_revision" "$status_code" "$AGENT_TASK_CLASS" "$AGENT_TASK_ID" \
    > "$AGENT_ATTEMPT_ARTIFACT_DIR/$phase.json"
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
  (set -e; "$@") 2>&1 | tee "$log_path"
  local pipeline_status=("${PIPESTATUS[@]}")
  local command_status=${pipeline_status[0]}
  local tee_status=${pipeline_status[1]}

  local duration_seconds=$((SECONDS - started_at))
  local result="success"
  local recorded_failure=""

  if ((tee_status != 0)); then
    command_status="$tee_status"
    result="failure"
    recorded_failure="artifact/log_write_failed"
  elif ((command_status != 0)); then
    result="failure"
    recorded_failure="$failure_class"
    if [[ "${AGENT_EXPECTED_FAILURE:-0}" == "1" ]]; then
      result="expected_failure"
    fi
  fi

  set +e
  agent_record record "$phase" "$scenario" "$result" "$recorded_failure" \
    "$duration_seconds" "$command_status" "$log_path"
  local record_status=$?

  if ((restore_errexit == 1)); then
    set -e
  fi

  if ((record_status != 0)); then
    echo "Agent evidence recording failed with status $record_status." >&2
    if ((command_status == 0)); then
      return "$record_status"
    fi
  fi

  return "$command_status"
}
