#!/usr/bin/env bash

set -euo pipefail

K6_IMAGE='grafana/k6:2.2.0'
DEFAULT_REPO='https://github.com/kangjuhyup/auth.git'
DEFAULT_BRANCH='main'

usage() {
  cat <<'EOF'
Usage: setup-remote-loadgen.sh [--repo URL] [--branch NAME] --directory PATH

Prepare an Apple Silicon machine as a k6-only remote load generator.
The destination must not be / or the current user's home directory.
EOF
}

fail() {
  printf 'Remote load-generator setup failed: %s\n' "$1" >&2
  exit 1
}

require_clean_checkout() {
  local checkout_status

  checkout_status="$(git -C "$1" status --porcelain=v1 --untracked-files=all 2>/dev/null)" || \
    fail 'could not inspect existing checkout status'
  [ -z "$checkout_status" ] || \
    fail 'existing checkout has uncommitted or untracked changes'
}

repo="$DEFAULT_REPO"
branch="$DEFAULT_BRANCH"
directory=''

while [ "$#" -gt 0 ]; do
  case "$1" in
    --help)
      usage
      exit 0
      ;;
    --repo|--branch|--directory)
      [ "$#" -ge 2 ] || fail "missing value for $1"
      case "$1" in
        --repo) repo="$2" ;;
        --branch) branch="$2" ;;
        --directory) directory="$2" ;;
      esac
      shift 2
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

[ -n "$repo" ] || fail 'repository URL must not be empty'
[ -n "$branch" ] || fail 'branch must not be empty'
[ -n "$directory" ] || fail '--directory is required'
[ "$directory" != '/' ] || fail 'destination must not be /'
case "$directory" in
  -*) fail 'destination must not begin with -' ;;
esac

[ "$(uname -s)" = 'Darwin' ] || fail 'this script requires macOS (Darwin)'
[ "$(uname -m)" = 'arm64' ] || fail 'this script requires Apple Silicon (arm64)'

command -v git >/dev/null 2>&1 || fail 'git is required'
command -v docker >/dev/null 2>&1 || fail 'Docker CLI is required'
docker --version >/dev/null 2>&1 || fail 'Docker CLI is unavailable'
docker info >/dev/null 2>&1 || fail 'Docker daemon is not reachable'

if [ -e "$directory" ]; then
  [ -d "$directory" ] || fail 'destination exists but is not a directory'
  resolved_directory="$(cd "$directory" && pwd -P)"
else
  destination_parent="$(dirname "$directory")"
  destination_name="$(basename "$directory")"
  [ "$destination_name" != '.' ] && [ "$destination_name" != '..' ] || \
    fail 'destination must name a directory'
  mkdir -p "$destination_parent" || fail 'cannot create destination parent'
  resolved_parent="$(cd "$destination_parent" && pwd -P)" || \
    fail 'cannot resolve destination parent'
  resolved_directory="$resolved_parent/$destination_name"
fi

resolved_home="$(cd "$HOME" && pwd -P)" || fail 'cannot resolve current user home'
[ "$resolved_directory" != '/' ] || fail 'destination must not resolve to /'
[ "$resolved_directory" != "$resolved_home" ] || \
  fail 'destination must not be the current user home directory'

if [ ! -e "$directory" ]; then
  git clone --single-branch --branch "$branch" -- "$repo" "$directory" >/dev/null 2>&1 || \
    fail 'could not clone the selected branch'
else
  git -C "$directory" rev-parse --is-inside-work-tree >/dev/null 2>&1 || \
    fail 'existing destination is not a Git checkout'
  checkout_top_level="$(git -C "$directory" rev-parse --show-toplevel 2>/dev/null)" || \
    fail 'could not resolve existing Git checkout root'
  resolved_checkout_top_level="$(cd "$checkout_top_level" && pwd -P)" || \
    fail 'could not resolve existing Git checkout root'
  [ "$resolved_checkout_top_level" = "$resolved_directory" ] || \
    fail 'existing destination is not the Git checkout root'
  actual_origin="$(git -C "$directory" remote get-url origin 2>/dev/null)" || \
    fail 'existing checkout has no origin remote'
  [ "$actual_origin" = "$repo" ] || fail 'existing checkout origin does not exactly match --repo'
  require_clean_checkout "$directory"
  git -C "$directory" check-ref-format --branch "$branch" >/dev/null 2>&1 || \
    fail 'selected branch name is invalid'
  git -C "$directory" fetch origin "refs/heads/$branch:refs/remotes/origin/$branch" >/dev/null 2>&1 || \
    fail 'could not fetch the selected branch'
  git -C "$directory" show-ref --verify --quiet "refs/remotes/origin/$branch" || \
    fail 'selected branch remote reference is unavailable'
  if ! git -C "$directory" checkout "$branch" >/dev/null 2>&1; then
    git -C "$directory" checkout -b "$branch" "refs/remotes/origin/$branch" >/dev/null 2>&1 || \
      fail 'could not check out the selected branch'
  fi
  git -C "$directory" merge --ff-only "origin/$branch" >/dev/null 2>&1 || \
    fail 'selected branch cannot be fast-forwarded safely'
  require_clean_checkout "$directory"
fi

for expected_asset in \
  'load-tests/k6/journey.js' \
  'load-tests/run-capacity.mjs'; do
  [ -f "$directory/$expected_asset" ] || \
    fail "expected load-test asset is missing: $expected_asset"
done

results_directory="$resolved_directory/load-tests/results/remote"
for results_component in \
  "$resolved_directory/load-tests" \
  "$resolved_directory/load-tests/results" \
  "$results_directory"; do
  [ ! -L "$results_component" ] || \
    fail 'remote results path must not contain a symbolic link'
done
git -C "$resolved_directory" check-ignore -q --no-index 'load-tests/results/remote' || \
  fail 'remote results directory must be gitignored'

docker pull "$K6_IMAGE" >/dev/null 2>&1 || fail "could not pull $K6_IMAGE"
image_architecture="$(docker image inspect --format '{{.Architecture}}' "$K6_IMAGE" 2>/dev/null)" || \
  fail "could not inspect $K6_IMAGE"
[ "$image_architecture" = 'arm64' ] || \
  fail "k6 image architecture must be arm64, got $image_architecture"
docker run --rm "$K6_IMAGE" version >/dev/null 2>&1 || \
  fail 'k6 version command failed'

mkdir -p "$results_directory" || fail 'could not create remote results directory'
for results_component in \
  "$resolved_directory/load-tests" \
  "$resolved_directory/load-tests/results" \
  "$results_directory"; do
  [ ! -L "$results_component" ] || \
    fail 'remote results path must not contain a symbolic link'
done
resolved_results_directory="$(cd "$results_directory" && pwd -P)" || \
  fail 'could not resolve remote results directory'
case "$resolved_results_directory" in
  "$resolved_directory"/*) ;;
  *) fail 'remote results directory must remain inside the Git checkout' ;;
esac
chmod 0700 "$results_directory" || fail 'could not secure remote results directory'

printf 'Repository: %s\n' "$resolved_directory"
printf 'Branch: %s\n' "$branch"
printf 'Image: %s\n' "$K6_IMAGE"
printf 'Architecture: %s\n' "$image_architecture"
printf 'Remote load generator readiness: ready\n'
