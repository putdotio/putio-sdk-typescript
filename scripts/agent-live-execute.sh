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

if ((has_token_pair == 0 && has_bootstrap_credentials == 0)); then
  echo "Runner secret injection must provide a live token pair or the first-party bootstrap credential set." >&2
  exit 2
fi

if [[ "${AGENT_LIVE_REFRESH_TOKENS:-0}" == "1" && "$has_bootstrap_credentials" != "1" ]]; then
  echo "AGENT_LIVE_REFRESH_TOKENS requires the first-party bootstrap credential set." >&2
  exit 2
fi

if (($# == 0)); then
  echo "Pass one or more explicit test/live/*.test.ts targets. The unattended path has no mutation-heavy default." >&2
  exit 2
fi

for target in "$@"; do
  if [[ ! "$target" =~ ^test/live/[A-Za-z0-9._-]+\.test\.ts$ ]] || [[ ! -f "$target" ]]; then
    echo "Unsupported live target: $target" >&2
    exit 2
  fi
done

live_test() {
  pnpm exec vp pack
  if [[ "${AGENT_LIVE_REFRESH_TOKENS:-0}" == "1" ]]; then
    node ./scripts/run-live-with-fresh-tokens.ts "$@"
  else
    pnpm exec vp test run --config vitest.live.config.ts "$@"
  fi
}

set +e
agent_run_logged live explicit-live-targets live/failed live_test "$@"
live_status=$?
set -e

log_path="$AGENT_ATTEMPT_ARTIFACT_DIR/live.log"
set +e
node ./scripts/agent-record.ts scan "$log_path"
scan_status=$?
set -e

if ((scan_status != 0)); then
  agent_record record live explicit-live-targets failure artifact/secret_leak 0 1 "$log_path"
  exit 1
fi

exit "$live_status"
