#!/usr/bin/env bash

set -euo pipefail
umask 077

fail() {
  printf 'FAILED: %s\n' "$1" >&2
  exit 1
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

ciphertext="${PUTIO_SDK_TYPESCRIPT_SOPS_FILE:?Set PUTIO_SDK_TYPESCRIPT_SOPS_FILE to the SDK ciphertext file}"
output="${SECRETS_OUTPUT:-.env.local}"

command -v sops >/dev/null 2>&1 || fail "sops is required"

[ -f "$ciphertext" ] || fail "ciphertext input must be one regular file"
[ ! -L "$ciphertext" ] || fail "ciphertext input must not be a symlink"
case "$output" in
  /*|..|../*|*/../*) fail "SECRETS_OUTPUT must be a repository-relative ignored path" ;;
esac
git check-ignore -q -- "$output" || fail "output path is not gitignored: $output"
[ ! -L "$output" ] || fail "output path must not be a symlink: $output"
[ ! -e "$output" ] || [ -f "$output" ] || fail "output path must be a regular file: $output"

status="$(sops filestatus --input-type dotenv "$ciphertext" 2>/dev/null)" \
  || fail "SOPS 3.10 or newer could not inspect the dotenv ciphertext input"
printf '%s\n' "$status" | node -e '
  let input = ""
  process.stdin.setEncoding("utf8")
  process.stdin.on("data", (chunk) => { input += chunk })
  process.stdin.on("end", () => {
    try {
      if (JSON.parse(input).encrypted !== true) process.exitCode = 1
    } catch {
      process.exitCode = 1
    }
  })
' \
  || fail "ciphertext input is not encrypted"

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/putio-sdk-secrets.XXXXXX")"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

payload_json="$tmp_dir/payload.json"
rendered_env="$tmp_dir/rendered.env"
sops decrypt --output-type json --output "$payload_json" "$ciphertext" \
  || fail "could not decrypt ciphertext input"
chmod 600 "$payload_json"

node ./scripts/secrets-render.mjs "$payload_json" "$rendered_env" \
  || fail "decrypted payload failed validation or safe dotenv rendering"
install -m 600 "$rendered_env" "$output"
printf 'ok wrote %s\n' "$output"
