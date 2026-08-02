#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/agent-common.sh"

agent_require_context

verify() {
  pnpm exec vp run verify
  pnpm exec vp run lint:package
}

agent_run_logged verify canonical-gate verification/failed verify
