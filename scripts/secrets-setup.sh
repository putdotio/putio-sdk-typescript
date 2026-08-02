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

command -v jq >/dev/null 2>&1 || fail "jq is required"
command -v sops >/dev/null 2>&1 || fail "sops is required"

[ -f "$ciphertext" ] || fail "ciphertext input must be one regular file"
[ ! -L "$ciphertext" ] || fail "ciphertext input must not be a symlink"
case "$output" in
  /*|..|../*|*/../*) fail "SECRETS_OUTPUT must be a repository-relative ignored path" ;;
esac
git check-ignore -q -- "$output" || fail "output path is not gitignored: $output"
[ ! -L "$output" ] || fail "output path must not be a symlink: $output"
[ ! -e "$output" ] || [ -f "$output" ] || fail "output path must be a regular file: $output"

status="$(sops filestatus "$ciphertext" 2>/dev/null)" \
  || fail "SOPS could not inspect ciphertext input"
printf '%s\n' "$status" | jq -e '.encrypted == true' >/dev/null 2>&1 \
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

expected_keys="$(printf '%s\n' \
  PUTIO_CLIENT_ID \
  PUTIO_CLIENT_ID_FIRST_PARTY \
  PUTIO_CLIENT_ID_THIRD_PARTY \
  PUTIO_CLIENT_SECRET_FIRST_PARTY \
  PUTIO_TEST_PASSWORD \
  PUTIO_TEST_TOTP_REFERENCE \
  PUTIO_TEST_USERNAME \
  PUTIO_TOKEN_FIRST_PARTY \
  PUTIO_TOKEN_THIRD_PARTY | sort)"
actual_keys="$(jq -r 'keys[]' "$payload_json" 2>/dev/null | sort)" \
  || fail "decrypted payload must be a JSON object"
[ "$actual_keys" = "$expected_keys" ] \
  || fail "decrypted payload key inventory does not match the SDK contract"

jq -e '
  all(.[];
    type == "string" and
    length > 0 and
    (((startswith("\"") and endswith("\"")) or
      (startswith("\u0027") and endswith("\u0027"))) | not)
  )
' "$payload_json" >/dev/null || fail "decrypted payload contains an invalid string value"

for key in PUTIO_CLIENT_ID PUTIO_CLIENT_ID_FIRST_PARTY PUTIO_CLIENT_ID_THIRD_PARTY; do
  jq -e --arg key "$key" '.[$key] | test("^[0-9]+$")' "$payload_json" >/dev/null \
    || fail "decrypted payload contains an invalid numeric identifier"
done

jq -r '
  to_entries
  | sort_by(.key)[]
  | "\(.key)=\(.value | @json)"
' "$payload_json" >"$rendered_env"
install -m 600 "$rendered_env" "$output"
printf 'ok wrote %s\n' "$output"
