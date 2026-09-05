#!/usr/bin/env bash

set -euo pipefail
umask 077

K6_IMAGE='grafana/k6:2.2.0'
REMOTE_BASE_URL='https://auth-service:13443'
DEFAULT_TARGET_IP='192.168.0.18'
DEFAULT_VUS='300'
DEFAULT_WARMUP_SECONDS='60'
DEFAULT_MEASURE_SECONDS='180'
DEFAULT_SOAK_SECONDS='1800'

usage() {
  cat <<'EOF'
Usage: run-remote-loadgen.sh verify|probe|soak [options]

Options:
  --target-ip IPv4          Private Auth target (default: 192.168.0.18)
  --vus COUNT               Probe/soak VUs (default: 300; maximum: 1000)
  --warmup-seconds SECONDS  Probe/soak warmup (default: 60; maximum: 600)
  --measure-seconds SECONDS Probe measurement (default: 180; maximum: 1800)
  --soak-seconds SECONDS    Soak measurement (default: 1800; maximum: 1800)
EOF
}

fail() {
  printf 'Remote load generation failed: %s\n' "$1" >&2
  exit 1
}

assert_private_ipv4() {
  local address="$1"
  local first second third fourth octet

  if [[ ! "$address" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$ ]]; then
    fail 'target IP must be a private RFC1918 IPv4 address'
  fi

  first="${BASH_REMATCH[1]}"
  second="${BASH_REMATCH[2]}"
  third="${BASH_REMATCH[3]}"
  fourth="${BASH_REMATCH[4]}"
  for octet in "$first" "$second" "$third" "$fourth"; do
    if [ "$octet" != '0' ] && [[ "$octet" = 0* ]]; then
      fail 'target IP must use canonical decimal IPv4 notation'
    fi
    [ "$((10#$octet))" -le 255 ] || \
      fail 'target IP must be a private RFC1918 IPv4 address'
  done

  first="$((10#$first))"
  second="$((10#$second))"
  if [ "$first" -eq 10 ]; then
    return
  fi
  if [ "$first" -eq 172 ] && [ "$second" -ge 16 ] && [ "$second" -le 31 ]; then
    return
  fi
  if [ "$first" -eq 192 ] && [ "$second" -eq 168 ]; then
    return
  fi
  fail 'target IP must be a private RFC1918 IPv4 address'
}

bounded_integer() {
  local value="$1"
  local name="$2"
  local maximum="$3"

  [[ "$value" =~ ^[1-9][0-9]*$ ]] || fail "$name must be a positive integer"
  [ "$value" -le "$maximum" ] 2>/dev/null || \
    fail "$name exceeds its safe maximum"
}

assert_no_symlink_components() {
  local path="$1"
  local current=''
  local component
  local IFS='/'
  local components=()

  read -r -a components <<< "${path#/}"
  for component in "${components[@]}"; do
    current="$current/$component"
    [ ! -L "$current" ] || fail 'a protected path contains a symbolic link'
  done
}

file_mode() {
  stat -f '%Lp' "$1" 2>/dev/null || stat -c '%a' "$1" 2>/dev/null
}

file_owner() {
  stat -f '%u' "$1" 2>/dev/null || stat -c '%u' "$1" 2>/dev/null
}

assert_private_file() {
  local path="$1"
  local description="$2"
  local mode

  [ -f "$path" ] && [ ! -L "$path" ] || fail "$description must be a regular file"
  mode="$(file_mode "$path")" || fail "could not inspect $description permissions"
  [[ "$mode" =~ ^[0-7]{3,4}$ ]] || fail "could not inspect $description permissions"
  [ $((8#$mode & 8#077)) -eq 0 ] || \
    fail "$description must not be group- or world-accessible"
}

read_environment_value() {
  local name="$1"
  local line value=''
  local found='0'

  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    case "$line" in
      "$name="*)
        [ "$found" -eq 0 ] || fail 'runtime environment contains a duplicate required key'
        value="${line#*=}"
        found='1'
        ;;
    esac
  done < "$environment_file"
  [ "$found" -eq 1 ] && [ -n "$value" ] || \
    fail 'runtime environment is missing a required value'
  case "$value" in
    *$'\r'*) fail 'runtime environment contains an invalid value' ;;
  esac
  printf '%s' "$value"
}

validate_existing_results() {
  local path name owner

  shopt -s dotglob
  for path in "$results_directory"/*; do
    [ -e "$path" ] || [ -L "$path" ] || continue
    [ -f "$path" ] && [ ! -L "$path" ] || \
      fail 'remote results must contain only regular summary files'
    name="${path##*/}"
    [[ "$name" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z-(verify|probe|soak)\.json$ ]] || \
      fail 'remote results contain a non-timestamped artifact'
    owner="$(file_owner "$path")" || fail 'could not inspect result ownership'
    [ "$owner" = "$invoking_uid" ] || fail 'remote result is not owned by the invoking user'
  done
  shopt -u dotglob
}

mode=''
target_ip="$DEFAULT_TARGET_IP"
vus="$DEFAULT_VUS"
warmup_seconds="$DEFAULT_WARMUP_SECONDS"
measure_seconds="$DEFAULT_MEASURE_SECONDS"
soak_seconds="$DEFAULT_SOAK_SECONDS"
target_ip_set='false'
vus_set='false'
warmup_set='false'
measure_set='false'
soak_set='false'

[ "$#" -gt 0 ] || fail 'a mode is required'
case "$1" in
  --help)
    usage
    exit 0
    ;;
  verify|probe|soak) mode="$1" ;;
  *) fail 'mode must be one of: verify, probe, soak' ;;
esac
shift

while [ "$#" -gt 0 ]; do
  case "$1" in
    --help)
      usage
      exit 0
      ;;
    --target-ip|--vus|--warmup-seconds|--measure-seconds|--soak-seconds)
      [ "$#" -ge 2 ] || fail 'an option value is missing'
      case "$1" in
        --target-ip)
          [ "$target_ip_set" = 'false' ] || fail 'an option was provided more than once'
          target_ip="$2"
          target_ip_set='true'
          ;;
        --vus)
          [ "$vus_set" = 'false' ] || fail 'an option was provided more than once'
          vus="$2"
          vus_set='true'
          ;;
        --warmup-seconds)
          [ "$warmup_set" = 'false' ] || fail 'an option was provided more than once'
          warmup_seconds="$2"
          warmup_set='true'
          ;;
        --measure-seconds)
          [ "$measure_set" = 'false' ] || fail 'an option was provided more than once'
          measure_seconds="$2"
          measure_set='true'
          ;;
        --soak-seconds)
          [ "$soak_set" = 'false' ] || fail 'an option was provided more than once'
          soak_seconds="$2"
          soak_set='true'
          ;;
      esac
      shift 2
      ;;
    *) fail 'unknown argument' ;;
  esac
done

assert_private_ipv4 "$target_ip"
bounded_integer "$vus" 'VUs' '1000'
bounded_integer "$warmup_seconds" 'warmup seconds' '600'
bounded_integer "$measure_seconds" 'measurement seconds' '1800'
bounded_integer "$soak_seconds" 'soak seconds' '1800'

case "$mode" in
  verify)
    [ "$vus_set" = 'false' ] && [ "$warmup_set" = 'false' ] && \
      [ "$measure_set" = 'false' ] && [ "$soak_set" = 'false' ] || \
      fail 'verify does not accept load controls'
    ;;
  probe)
    [ "$soak_set" = 'false' ] || fail 'probe does not accept --soak-seconds'
    ;;
  soak)
    [ "$measure_set" = 'false' ] || fail 'soak uses --soak-seconds'
    measure_seconds="$soak_seconds"
    ;;
esac

[ "$(uname -s)" = 'Darwin' ] || fail 'this script requires macOS (Darwin)'
[ "$(uname -m)" = 'arm64' ] || fail 'this script requires Apple Silicon (arm64)'
command -v git >/dev/null 2>&1 || fail 'git is required'
command -v docker >/dev/null 2>&1 || fail 'Docker CLI is required'
command -v id >/dev/null 2>&1 || fail 'id is required'

runner_path="$0"
case "$runner_path" in
  /*) ;;
  *) runner_path="$(pwd -P)/$runner_path" ;;
esac
[ ! -L "$runner_path" ] || fail 'runner script must not be a symbolic link'
scripts_directory="$(cd "$(dirname "$runner_path")" && pwd -P)" || \
  fail 'could not resolve the scripts directory'
runner_path="$scripts_directory/$(basename "$runner_path")"
checkout_root="$(git -C "$scripts_directory" rev-parse --show-toplevel 2>/dev/null)" || \
  fail 'runner must execute from a Git checkout'
checkout_root="$(cd "$checkout_root" && pwd -P)" || fail 'could not resolve checkout root'
[ "$runner_path" = "$checkout_root/scripts/run-remote-loadgen.sh" ] || \
  fail 'runner must execute from the expected checkout path'

k6_directory="$checkout_root/load-tests/k6"
environment_file="$checkout_root/load-tests/.remote-k6.env"
client_directory="$checkout_root/load-tests/.remote-tls/client"
results_directory="$checkout_root/load-tests/results/remote"
for protected_path in \
  "$checkout_root/load-tests" \
  "$k6_directory" \
  "$checkout_root/load-tests/.remote-tls" \
  "$client_directory" \
  "$checkout_root/load-tests/results" \
  "$results_directory"; do
  [ -d "$protected_path" ] && [ ! -L "$protected_path" ] || \
    fail 'a required protected directory is missing or unsafe'
  assert_no_symlink_components "$protected_path"
done

for required_script in tls.js smoke.js journey.js; do
  [ -f "$k6_directory/$required_script" ] && [ ! -L "$k6_directory/$required_script" ] || \
    fail 'a required k6 script is missing or unsafe'
done
assert_private_file "$environment_file" 'runtime environment file'
assert_private_file "$client_directory/client.key" 'client private key'
for certificate in ca.crt client.crt; do
  [ -f "$client_directory/$certificate" ] && [ ! -L "$client_directory/$certificate" ] || \
    fail 'a required client certificate file is missing or unsafe'
done

resolved_results="$(cd "$results_directory" && pwd -P)" || \
  fail 'could not resolve remote results directory'
case "$resolved_results" in
  "$checkout_root/load-tests/results/remote") ;;
  *) fail 'remote results must remain at the fixed checkout path' ;;
esac
chmod 0700 "$results_directory" || fail 'could not secure remote results directory'
invoking_uid="$(id -u)" || fail 'could not resolve invoking user ID'
invoking_gid="$(id -g)" || fail 'could not resolve invoking group ID'
[[ "$invoking_uid" =~ ^[0-9]+$ ]] && [[ "$invoking_gid" =~ ^[0-9]+$ ]] || \
  fail 'invoking user identity is invalid'
validate_existing_results

BASE_URL="$(read_environment_value 'BASE_URL')"
[ "$BASE_URL" = "$REMOTE_BASE_URL" ] || \
  fail 'BASE_URL must be exactly https://auth-service:13443'
ADMIN_USERNAME="$(read_environment_value 'ADMIN_USERNAME')"
ADMIN_PASSWORD="$(read_environment_value 'ADMIN_PASSWORD')"
LOAD_USER_PASSWORD="$(read_environment_value 'LOAD_USER_PASSWORD')"
SERVICE_CLIENT_SECRET="$(read_environment_value 'SERVICE_CLIENT_SECRET')"
REMOTE_MTLS='true'
case "$mode" in
  verify) RUN_KIND='smoke' ;;
  probe|soak) RUN_KIND="$mode" ;;
esac
VUS="$vus"
WARMUP_SECONDS="$warmup_seconds"
MEASURE_SECONDS="$measure_seconds"
SOAK_SECONDS="$soak_seconds"
export BASE_URL ADMIN_USERNAME ADMIN_PASSWORD LOAD_USER_PASSWORD
export SERVICE_CLIENT_SECRET REMOTE_MTLS RUN_KIND VUS
export WARMUP_SECONDS MEASURE_SECONDS SOAK_SECONDS

docker --version >/dev/null 2>&1 || fail 'Docker CLI is unavailable'
docker info >/dev/null 2>&1 || fail 'Docker daemon is not reachable'
image_architecture="$(docker image inspect --format '{{.Architecture}}' "$K6_IMAGE" 2>/dev/null)" || \
  fail 'pinned k6 image is unavailable'
[ "$image_architecture" = 'arm64' ] || fail 'pinned k6 image must be arm64'

docker_arguments=(
  run
  --rm
  --user "$invoking_uid:$invoking_gid"
  --add-host "auth-service:$target_ip"
  --volume "$k6_directory:/scripts:ro"
  --volume "$results_directory:/results"
  --volume "$client_directory:/certs:ro"
  --volume "$client_directory/ca.crt:/etc/ssl/certs/ca-certificates.crt:ro"
  --env BASE_URL
  --env REMOTE_MTLS
)
workload_environment=(
  --env ADMIN_USERNAME
  --env ADMIN_PASSWORD
  --env LOAD_USER_PASSWORD
  --env SERVICE_CLIENT_SECRET
  --env RUN_KIND
  --env VUS
  --env WARMUP_SECONDS
  --env MEASURE_SECONDS
  --env SOAK_SECONDS
  --env SUMMARY_PATH
)

health_directory=''
health_script=''
cleanup() {
  if [ -n "$health_script" ]; then
    case "$health_script" in
      "$health_directory"/remote-health.js) rm -f -- "$health_script" 2>/dev/null || true ;;
    esac
  fi
  if [ -n "$health_directory" ]; then
    case "$health_directory" in
      /tmp/auth-remote-health.*) rmdir -- "$health_directory" 2>/dev/null || true ;;
    esac
  fi
}
trap cleanup EXIT HUP INT TERM

if [ "$mode" = 'verify' ]; then
  health_directory="$(mktemp -d '/tmp/auth-remote-health.XXXXXX')" || \
    fail 'could not create the health verification directory'
  [ -d "$health_directory" ] && [ ! -L "$health_directory" ] || \
    fail 'health verification directory is unsafe'
  chmod 0700 "$health_directory" || \
    fail 'could not secure the health verification directory'
  health_script="$health_directory/remote-health.js"
  : > "$health_script" || fail 'could not create the health verification script'
  chmod 0600 "$health_script" || fail 'could not secure the health verification script'
  cat > "$health_script" <<'EOF'
import { check } from 'k6';
import http from 'k6/http';
import { loadTlsOptions } from './tls.js';

export const options = {
  ...loadTlsOptions(__ENV),
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'] },
};

export default function () {
  const response = http.get(`${__ENV.BASE_URL}/health`, {
    redirects: 0,
    responseType: 'none',
    tags: { endpoint: 'remote-mtls-health' },
    timeout: '10s',
  });
  check(response, { 'remote mTLS health accepted': (result) => result.status === 200 });
}
EOF
  docker "${docker_arguments[@]}" \
    --volume "$health_script:/scripts/remote-health.js:ro" \
    "$K6_IMAGE" run /scripts/remote-health.js
  rm -f -- "$health_script" || fail 'could not remove the health verification script'
  health_script=''
  rmdir -- "$health_directory" || fail 'could not remove the health verification directory'
  health_directory=''
fi

timestamp="$(date -u '+%Y-%m-%dT%H-%M-%SZ')" || fail 'could not create result timestamp'
summary_name="$timestamp-$mode.json"
summary_host_path="$results_directory/$summary_name"
[ ! -e "$summary_host_path" ] && [ ! -L "$summary_host_path" ] || \
  fail 'timestamped summary path already exists'
SUMMARY_PATH="/results/$summary_name"
export SUMMARY_PATH

case "$mode" in
  verify) workload_script='/scripts/smoke.js' ;;
  probe|soak) workload_script='/scripts/journey.js' ;;
esac
docker "${docker_arguments[@]}" "${workload_environment[@]}" \
  "$K6_IMAGE" run "$workload_script"

[ -f "$summary_host_path" ] && [ ! -L "$summary_host_path" ] || \
  fail 'k6 did not create a safe timestamped summary'
summary_owner="$(file_owner "$summary_host_path")" || \
  fail 'could not inspect summary ownership'
[ "$summary_owner" = "$invoking_uid" ] || \
  fail 'timestamped summary is not owned by the invoking user'
chmod 0600 "$summary_host_path" || fail 'could not secure timestamped summary'
validate_existing_results
printf 'Remote load result: load-tests/results/remote/%s\n' "$summary_name"
