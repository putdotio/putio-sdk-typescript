#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/agent-common.sh"

agent_require_context

verify() {
  agent_vp run verify
  agent_vp run lint:package
}

agent_run_logged verify canonical-gate verification/failed verify
