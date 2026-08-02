#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/agent-common.sh"

agent_require_context

if [[ -n "${PUTIO_TOKEN_FIRST_PARTY:-}" && -n "${PUTIO_TOKEN_THIRD_PARTY:-}" ]] || \
  [[ -n "${PUTIO_TEST_USERNAME:-}" && -n "${PUTIO_TEST_PASSWORD:-}" && -n "${PUTIO_CLIENT_ID_FIRST_PARTY:-}" && -n "${PUTIO_CLIENT_SECRET_FIRST_PARTY:-}" ]]; then
  exec ./scripts/agent-live-execute.sh "$@"
fi

missing_identity() {
  echo "Runner live identity is unavailable." >&2
  echo "Inject a live token pair or bootstrap credentials directly, or inject INFISICAL_TOKEN plus this repo's Infisical project and path coordinates." >&2
  return 2
}

missing_infisical_cli() {
  echo "The Infisical CLI is unavailable on this runner." >&2
  echo "Install the runner-managed CLI or inject the live token pair or bootstrap credentials directly." >&2
  return 2
}

if [[ -z "${INFISICAL_TOKEN:-}" || -z "${PUTIO_SDK_TYPESCRIPT_INFISICAL_PROJECT_ID:-}" || -z "${PUTIO_SDK_TYPESCRIPT_INFISICAL_PATH:-}" ]]; then
  AGENT_EXPECTED_FAILURE=1 agent_run_logged live missing-runner-identity runner/missing_identity missing_identity
  exit 2
fi

if ! command -v infisical >/dev/null 2>&1; then
  AGENT_EXPECTED_FAILURE=1 agent_run_logged live missing-infisical-cli runner/missing_tool missing_infisical_cli
  exit 2
fi

run_infisical() {
  node ./scripts/run-infisical.ts "$@"
}

set +e
agent_run_logged live-injection infisical-injection runner/secret_injection_failed run_infisical "$@"
injection_status=$?
set -e

set +e
agent_run_logged live-injection-scan scan-infisical-output artifact/secret_leak \
  node ./scripts/agent-record.ts scan "$AGENT_ATTEMPT_ARTIFACT_DIR/live-injection.log"
scan_status=$?
set -e

if ((scan_status != 0)); then
  exit "$scan_status"
fi

exit "$injection_status"
