#!/usr/bin/env bash

set -euo pipefail
umask 077

output="${SECRETS_OUTPUT:-.env.local}"
infisical_domain="${PUTIO_INFISICAL_DOMAIN:-https://eu.infisical.com/api}"
infisical_project_id="${PUTIO_SDK_TYPESCRIPT_INFISICAL_PROJECT_ID:?Set PUTIO_SDK_TYPESCRIPT_INFISICAL_PROJECT_ID for this repo}"
infisical_env="${PUTIO_SDK_TYPESCRIPT_INFISICAL_ENV:-dev}"
infisical_path="${PUTIO_SDK_TYPESCRIPT_INFISICAL_PATH:?Set PUTIO_SDK_TYPESCRIPT_INFISICAL_PATH for this repo}"

if ! command -v infisical >/dev/null 2>&1; then
  echo "Infisical CLI is required. Install it with: brew install infisical" >&2
  exit 1
fi

tmp_env="$(mktemp)"
cleanup() {
  rm -f "$tmp_env"
}
trap cleanup EXIT

infisical export \
  --silent \
  --domain "$infisical_domain" \
  --projectId "$infisical_project_id" \
  --env "$infisical_env" \
  --path "$infisical_path" \
  --format dotenv \
  --output-file "$tmp_env"
install -m 600 "$tmp_env" "$output"
