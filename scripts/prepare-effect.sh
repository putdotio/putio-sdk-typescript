#!/usr/bin/env sh

set -eu

if command -v is-ci >/dev/null 2>&1 && is-ci; then
  exit 0
fi

if [ -n "${CI:-}" ]; then
  exit 0
fi

repo_dir=".repos/effect"
repo_url="https://github.com/Effect-TS/effect"
effect_version=$(node -p "JSON.parse(require('fs').readFileSync('package.json', 'utf8')).dependencies.effect")
repo_ref="effect@$effect_version"

if [ ! -d "$repo_dir/.git" ]; then
  mkdir -p ".repos"
  git clone --filter=blob:none --depth 1 --branch "$repo_ref" "$repo_url" "$repo_dir"
  exit 0
fi

current_url=$(git -C "$repo_dir" remote get-url origin)
if [ "${current_url%.git}" != "$repo_url" ]; then
  if [ -n "$(git -C "$repo_dir" status --porcelain)" ]; then
    echo "Effect source has local changes and an outdated origin: $current_url" >&2
    echo "Commit or discard those changes, then rerun this command." >&2
    exit 1
  fi
  git -C "$repo_dir" remote set-url origin "$repo_url"
fi

if ! git -C "$repo_dir" show-ref --verify --quiet "refs/tags/$repo_ref"; then
  git -C "$repo_dir" fetch --depth 1 origin "refs/tags/$repo_ref:refs/tags/$repo_ref"
fi

expected_commit=$(git -C "$repo_dir" rev-parse "$repo_ref^{commit}")
current_commit=$(git -C "$repo_dir" rev-parse HEAD)

if [ "$current_commit" = "$expected_commit" ]; then
  exit 0
fi

if [ -n "$(git -C "$repo_dir" status --porcelain)" ]; then
  echo "Effect source has local changes and is not at $repo_ref." >&2
  echo "Commit or discard those changes, then rerun this command." >&2
  exit 1
fi

git -C "$repo_dir" checkout --detach "$repo_ref"
