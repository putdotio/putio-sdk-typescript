#!/usr/bin/env sh

set -eu

if command -v is-ci >/dev/null 2>&1 && is-ci; then
  exit 0
fi

if [ -n "${CI:-}" ]; then
  exit 0
fi

repo_dir=".repos/effect"
repo_url="https://github.com/Effect-TS/effect-smol"

if [ -d "$repo_dir/.git" ]; then
  exit 0
fi

mkdir -p ".repos"
git clone "$repo_url" "$repo_dir"
