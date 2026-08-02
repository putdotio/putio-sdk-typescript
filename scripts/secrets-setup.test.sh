#!/usr/bin/env bash

set -euo pipefail
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/putio-sdk-secrets-test.XXXXXX")"
output=".env.local.sops-test.$$"
cleanup() {
  rm -rf "$tmp_dir"
  rm -f "$output"
}
trap cleanup EXIT

mkdir -p "$tmp_dir/bin"
fake_sops="$tmp_dir/bin/sops"
cat >"$fake_sops" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  filestatus)
    printf '{"encrypted":%s}\n' "${FAKE_SOPS_ENCRYPTED:-true}"
    ;;
  decrypt)
    output=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --output)
          shift
          output="$1"
          ;;
      esac
      shift
    done
    [ -n "$output" ]
    install -m 600 "$FAKE_SOPS_PAYLOAD" "$output"
    ;;
  *)
    exit 2
    ;;
esac
SH
chmod 700 "$fake_sops"

ciphertext="$tmp_dir/payload.sops.env"
payload="$tmp_dir/payload.json"
printf 'ciphertext fixture\n' >"$ciphertext"

write_valid_payload() {
  cat >"$payload" <<'JSON'
{
  "PUTIO_CLIENT_ID": "1",
  "PUTIO_CLIENT_ID_FIRST_PARTY": "2",
  "PUTIO_CLIENT_ID_THIRD_PARTY": "3",
  "PUTIO_CLIENT_SECRET_FIRST_PARTY": "secret with spaces and = signs",
  "PUTIO_TEST_PASSWORD": "test-password",
  "PUTIO_TEST_TOTP_REFERENCE": "op://example/item/field",
  "PUTIO_TEST_USERNAME": "test@example.com",
  "PUTIO_TOKEN_FIRST_PARTY": "first-party-token",
  "PUTIO_TOKEN_THIRD_PARTY": "third-party-token"
}
JSON
}

run_setup() {
  PATH="$tmp_dir/bin:$PATH" \
  FAKE_SOPS_PAYLOAD="$payload" \
  PUTIO_SDK_TYPESCRIPT_SOPS_FILE="$ciphertext" \
  SECRETS_OUTPUT="$output" \
    bash ./scripts/secrets-setup.sh
}

expect_failure() {
  if "$@" >/dev/null 2>&1; then
    printf 'FAILED: command unexpectedly succeeded\n' >&2
    exit 1
  fi
}

write_valid_payload
run_setup >/dev/null
if output_mode="$(stat -c '%a' "$output" 2>/dev/null)"; then
  :
else
  output_mode="$(stat -f '%Lp' "$output")"
fi
[ "$output_mode" = 600 ]
node - "$output" <<'NODE'
const path = process.argv[2]
process.loadEnvFile(path)
const expected = {
  PUTIO_CLIENT_ID: "1",
  PUTIO_CLIENT_ID_FIRST_PARTY: "2",
  PUTIO_CLIENT_ID_THIRD_PARTY: "3",
  PUTIO_CLIENT_SECRET_FIRST_PARTY: "secret with spaces and = signs",
  PUTIO_TEST_PASSWORD: "test-password",
  PUTIO_TEST_TOTP_REFERENCE: "op://example/item/field",
  PUTIO_TEST_USERNAME: "test@example.com",
  PUTIO_TOKEN_FIRST_PARTY: "first-party-token",
  PUTIO_TOKEN_THIRD_PARTY: "third-party-token",
}
for (const [key, value] of Object.entries(expected)) {
  if (process.env[key] !== value) process.exit(1)
}
NODE
rm -f "$output"

jq 'del(.PUTIO_CLIENT_ID)' "$payload" >"$tmp_dir/invalid.json"
mv "$tmp_dir/invalid.json" "$payload"
expect_failure run_setup
[ ! -e "$output" ]

write_valid_payload
jq '.PUTIO_CLIENT_ID = "not-numeric"' "$payload" >"$tmp_dir/invalid.json"
mv "$tmp_dir/invalid.json" "$payload"
expect_failure run_setup
[ ! -e "$output" ]

write_valid_payload
jq '.PUTIO_TEST_PASSWORD = "\"quoted\""' "$payload" >"$tmp_dir/invalid.json"
mv "$tmp_dir/invalid.json" "$payload"
expect_failure run_setup
[ ! -e "$output" ]

write_valid_payload
jq ".PUTIO_TEST_PASSWORD = \"'quoted'\"" "$payload" >"$tmp_dir/invalid.json"
mv "$tmp_dir/invalid.json" "$payload"
expect_failure run_setup
[ ! -e "$output" ]

write_valid_payload
expect_failure env \
  PATH="$tmp_dir/bin:$PATH" \
  FAKE_SOPS_ENCRYPTED=false \
  FAKE_SOPS_PAYLOAD="$payload" \
  PUTIO_SDK_TYPESCRIPT_SOPS_FILE="$ciphertext" \
  SECRETS_OUTPUT="$output" \
  bash ./scripts/secrets-setup.sh
[ ! -e "$output" ]

expect_failure env \
  PATH="$tmp_dir/bin:$PATH" \
  FAKE_SOPS_PAYLOAD="$payload" \
  PUTIO_SDK_TYPESCRIPT_SOPS_FILE="$ciphertext" \
  SECRETS_OUTPUT=README.md \
  bash ./scripts/secrets-setup.sh

symlinked_ciphertext="$tmp_dir/symlinked.sops.env"
ln -s "$ciphertext" "$symlinked_ciphertext"
expect_failure env \
  PATH="$tmp_dir/bin:$PATH" \
  FAKE_SOPS_PAYLOAD="$payload" \
  PUTIO_SDK_TYPESCRIPT_SOPS_FILE="$symlinked_ciphertext" \
  SECRETS_OUTPUT="$output" \
  bash ./scripts/secrets-setup.sh

printf 'ok SOPS setup renders validated ignored output and fails closed\n'
