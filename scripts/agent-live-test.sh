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

if [[ -z "${INFISICAL_TOKEN:-}" || -z "${PUTIO_SDK_TYPESCRIPT_INFISICAL_PROJECT_ID:-}" || -z "${PUTIO_SDK_TYPESCRIPT_INFISICAL_PATH:-}" ]]; then
  AGENT_EXPECTED_FAILURE=1 agent_run_logged live missing-runner-identity runner/missing_identity missing_identity
  exit 2
fi

if ! command -v infisical >/dev/null 2>&1; then
  AGENT_EXPECTED_FAILURE=1 agent_run_logged live missing-infisical-cli runner/missing_tool missing_identity
  exit 2
fi

exec infisical run \
  --silent \
  --domain "${PUTIO_INFISICAL_DOMAIN:-https://eu.infisical.com/api}" \
  --projectId "$PUTIO_SDK_TYPESCRIPT_INFISICAL_PROJECT_ID" \
  --env "${PUTIO_SDK_TYPESCRIPT_INFISICAL_ENV:-dev}" \
  --path "$PUTIO_SDK_TYPESCRIPT_INFISICAL_PATH" \
  -- ./scripts/agent-live-execute.sh "$@"
