#!/usr/bin/env bash

set -euo pipefail
umask 077

input=".env.1password"
output=".env.local"
op_account="${OP_ACCOUNT:-putdotio.1password.com}"

if [ ! -f "$input" ]; then
  echo "Missing $input. Create it from private maintainer docs before running secrets:setup." >&2
  exit 1
fi

OP_ACCOUNT="$op_account" op whoami >/dev/null
OP_ACCOUNT="$op_account" op inject -f -i "$input" -o "$output"
chmod 600 "$output"
