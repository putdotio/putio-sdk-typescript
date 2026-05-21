#!/usr/bin/env bash

set -euo pipefail
umask 077

output="${SECRETS_OUTPUT:-.env.local}"
infisical_domain="${INFISICAL_API_URL:-https://eu.infisical.com/api}"
infisical_project_id="${INFISICAL_PROJECT_ID:-b2fcfbd7-19e0-4b87-a797-93d125c432ce}"
infisical_env="${INFISICAL_ENV:-dev}"
infisical_path="${INFISICAL_PATH:-/sdk-typescript}"

if ! command -v infisical >/dev/null 2>&1; then
  echo "Infisical CLI is required. Install it with: brew install infisical" >&2
  exit 1
fi

infisical export \
  --domain "$infisical_domain" \
  --projectId "$infisical_project_id" \
  --env "$infisical_env" \
  --path "$infisical_path" \
  --format dotenv \
  --output-file "$output"
chmod 600 "$output"
