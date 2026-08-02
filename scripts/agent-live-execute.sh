#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/agent-common.sh"

agent_require_context

has_token_pair=0
has_bootstrap_credentials=0

if [[ -n "${PUTIO_TOKEN_FIRST_PARTY:-}" && -n "${PUTIO_TOKEN_THIRD_PARTY:-}" ]]; then
  has_token_pair=1
fi

if [[ -n "${PUTIO_TEST_USERNAME:-}" && -n "${PUTIO_TEST_PASSWORD:-}" && -n "${PUTIO_CLIENT_ID_FIRST_PARTY:-}" && -n "${PUTIO_CLIENT_SECRET_FIRST_PARTY:-}" ]]; then
  has_bootstrap_credentials=1
fi

validate_live_invocation() {
  if ((has_token_pair == 0 && has_bootstrap_credentials == 0)); then
    echo "Runner secret injection must provide a live token pair or the first-party bootstrap credential set." >&2
    return 2
  fi

  if [[ "${AGENT_LIVE_REFRESH_TOKENS:-0}" == "1" && "$has_bootstrap_credentials" != "1" ]]; then
    echo "AGENT_LIVE_REFRESH_TOKENS requires the first-party bootstrap credential set." >&2
    return 2
  fi

  if (($# == 0)); then
    echo "Pass one or more explicit test/live/*.test.ts targets. The unattended path has no mutation-heavy default." >&2
    return 2
  fi

  for target in "$@"; do
    if [[ ! "$target" =~ ^test/live/[A-Za-z0-9._-]+\.test\.ts$ ]] || [[ ! -f "$target" ]]; then
      echo "Unsupported live target: $target" >&2
      return 2
    fi
  done
}

set +e
AGENT_EXPECTED_FAILURE=1 agent_run_logged live-input validate-live-invocation input/invalid validate_live_invocation "$@"
input_status=$?
set -e

if ((input_status != 0)); then
  exit "$input_status"
fi

live_test() {
  agent_vp pack
  if [[ "${AGENT_LIVE_REFRESH_TOKENS:-0}" == "1" ]]; then
    node ./scripts/run-live-with-fresh-tokens.ts "$@"
  else
    node ./scripts/run-live-tests.ts "$@"
  fi
}

set +e
agent_run_logged live explicit-live-targets live/failed live_test "$@"
live_status=$?
set -e

set +e
agent_run_logged live-scan scan-live-output artifact/secret_leak \
  node ./scripts/agent-record.ts scan "$AGENT_ATTEMPT_ARTIFACT_DIR/live.log"
scan_status=$?
set -e

if ((scan_status != 0)); then
  exit "$scan_status"
fi

exit "$live_status"
