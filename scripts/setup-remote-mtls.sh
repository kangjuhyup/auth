#!/usr/bin/env bash

set -euo pipefail
umask 077

usage() {
  cat <<'EOF'
Usage: setup-remote-mtls.sh --target-ip IPv4 [--output-directory PATH]

Create a test-only CA, server certificate, and M1 client bundle.
The output must remain beneath this checkout's load-tests/.remote-tls path.
EOF
}

fail() {
  printf 'Remote mTLS certificate setup failed: %s\n' "$1" >&2
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

assert_safe_path_syntax() {
  case "$1" in
    *//*|*/./*|*/.|*/../*|*/..)
      fail 'output path contains an unsafe component'
      ;;
  esac
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
    [ ! -L "$current" ] || fail 'output path contains a symbolic link'
  done
}

ensure_secure_parent() {
  local parent="$1"
  local current="$checkout_root/load-tests"
  local relative component
  local IFS='/'
  local components=()

  if [ "$parent" = "$current" ]; then
    return
  fi
  relative="${parent#"$current"/}"
  read -r -a components <<< "$relative"
  for component in "${components[@]}"; do
    current="$current/$component"
    [ ! -L "$current" ] || fail 'output path contains a symbolic link'
    if [ ! -e "$current" ]; then
      mkdir -- "$current" || fail 'could not create output parent'
    fi
    [ -d "$current" ] || fail 'output parent is not a directory'
    [ ! -L "$current" ] || fail 'output path contains a symbolic link'
    chmod 0700 "$current" || fail 'could not secure output parent'
  done
}

directory_is_empty() {
  [ -z "$(find "$1" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]
}

staging_directory=''
lock_directory=''
cleanup() {
  if [ -n "$staging_directory" ]; then
    case "$staging_directory" in
      "$destination_parent"/.remote-tls.tmp.*)
        rm -rf -- "$staging_directory"
        ;;
    esac
  fi
  if [ -n "$lock_directory" ]; then
    rmdir -- "$lock_directory" 2>/dev/null || true
  fi
}
trap cleanup EXIT HUP INT TERM

target_ip=''
output_directory=''

while [ "$#" -gt 0 ]; do
  case "$1" in
    --help)
      usage
      exit 0
      ;;
    --target-ip|--output-directory)
      [ "$#" -ge 2 ] || fail 'an option value is missing'
      case "$1" in
        --target-ip) target_ip="$2" ;;
        --output-directory) output_directory="$2" ;;
      esac
      shift 2
      ;;
    *)
      fail 'unknown argument'
      ;;
  esac
done

[ -n "$target_ip" ] || fail '--target-ip is required'
assert_private_ipv4 "$target_ip"
command -v git >/dev/null 2>&1 || fail 'git is required'
command -v openssl >/dev/null 2>&1 || fail 'OpenSSL is required'

checkout_root="$(git rev-parse --show-toplevel 2>/dev/null)" || \
  fail 'current directory must be inside a Git checkout'
checkout_root="$(cd "$checkout_root" && pwd -P)" || \
  fail 'could not resolve the Git checkout root'
[ -d "$checkout_root/load-tests" ] || fail 'checkout is missing load-tests'
[ ! -L "$checkout_root/load-tests" ] || \
  fail 'output path contains a symbolic link'

tls_root="$checkout_root/load-tests/.remote-tls"
if [ -z "$output_directory" ]; then
  resolved_output="$tls_root"
else
  case "$output_directory" in
    /*) resolved_output="$output_directory" ;;
    *) resolved_output="$(pwd -P)/$output_directory" ;;
  esac
fi
assert_safe_path_syntax "$resolved_output"
case "$resolved_output" in
  "$tls_root"|"$tls_root"/*) ;;
  *) fail 'output directory must remain beneath load-tests/.remote-tls' ;;
esac
assert_no_symlink_components "$resolved_output"
git -C "$checkout_root" check-ignore -q --no-index \
  'load-tests/.remote-tls/.ignore-check' || \
  fail 'load-tests/.remote-tls must be gitignored'

destination_parent="${resolved_output%/*}"
destination_name="${resolved_output##*/}"
[ -n "$destination_name" ] || fail 'output directory must name a directory'
ensure_secure_parent "$destination_parent"
assert_no_symlink_components "$resolved_output"

candidate_lock_directory="$destination_parent/.${destination_name}.remote-mtls.lock"
mkdir -- "$candidate_lock_directory" 2>/dev/null || \
  fail 'another setup is using the output directory'
lock_directory="$candidate_lock_directory"
chmod 0700 "$lock_directory" || fail 'could not secure setup lock'

if [ -e "$resolved_output" ]; then
  [ ! -L "$resolved_output" ] || fail 'output path contains a symbolic link'
  [ -d "$resolved_output" ] || fail 'output destination is not a directory'
  directory_is_empty "$resolved_output" || \
    fail 'output destination must be absent or empty'
fi

staging_directory="$(mktemp -d "$destination_parent/.remote-tls.tmp.XXXXXX")" || \
  fail 'could not create staging directory'
chmod 0700 "$staging_directory" || fail 'could not secure staging directory'
mkdir -- \
  "$staging_directory/ca" \
  "$staging_directory/server" \
  "$staging_directory/client" || fail 'could not create certificate directories'
chmod 0700 \
  "$staging_directory/ca" \
  "$staging_directory/server" \
  "$staging_directory/client" || fail 'could not secure certificate directories'

cat > "$staging_directory/ca.ext" <<'EOF'
[req]
distinguished_name = distinguished_name
x509_extensions = ca_extensions
prompt = no

[distinguished_name]
CN = Auth Remote Load Test CA

[ca_extensions]
basicConstraints = critical,CA:TRUE,pathlen:0
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
EOF

cat > "$staging_directory/server.ext" <<EOF
[server_extensions]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
subjectAltName = @server_names

[server_names]
DNS.1 = auth-service
IP.1 = $target_ip
EOF

cat > "$staging_directory/client.ext" <<'EOF'
[client_extensions]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature
extendedKeyUsage = clientAuth
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
EOF

openssl genpkey -algorithm RSA \
  -pkeyopt rsa_keygen_bits:3072 \
  -out "$staging_directory/ca/ca.key" >/dev/null 2>&1 || \
  fail 'could not generate CA private key'
ca_serial="$(openssl rand -hex 16 2>/dev/null)" || \
  fail 'could not generate CA serial'
openssl req -new -x509 -sha256 -days 30 \
  -key "$staging_directory/ca/ca.key" \
  -set_serial "0x$ca_serial" \
  -config "$staging_directory/ca.ext" \
  -out "$staging_directory/ca/ca.crt" >/dev/null 2>&1 || \
  fail 'could not create CA certificate'

openssl genpkey -algorithm RSA \
  -pkeyopt rsa_keygen_bits:3072 \
  -out "$staging_directory/server/server.key" >/dev/null 2>&1 || \
  fail 'could not generate server private key'
openssl req -new -sha256 \
  -key "$staging_directory/server/server.key" \
  -subj '/CN=auth-service' \
  -out "$staging_directory/server.csr" >/dev/null 2>&1 || \
  fail 'could not create server certificate request'
server_serial="$(openssl rand -hex 16 2>/dev/null)" || \
  fail 'could not generate server serial'
openssl x509 -req -sha256 -days 30 \
  -in "$staging_directory/server.csr" \
  -CA "$staging_directory/ca/ca.crt" \
  -CAkey "$staging_directory/ca/ca.key" \
  -set_serial "0x$server_serial" \
  -extfile "$staging_directory/server.ext" \
  -extensions server_extensions \
  -out "$staging_directory/server/server.crt" >/dev/null 2>&1 || \
  fail 'could not sign server certificate'

openssl genpkey -algorithm RSA \
  -pkeyopt rsa_keygen_bits:3072 \
  -out "$staging_directory/client/client.key" >/dev/null 2>&1 || \
  fail 'could not generate client private key'
openssl req -new -sha256 \
  -key "$staging_directory/client/client.key" \
  -subj '/CN=M1 Remote Load Generator' \
  -out "$staging_directory/client.csr" >/dev/null 2>&1 || \
  fail 'could not create client certificate request'
client_serial="$(openssl rand -hex 16 2>/dev/null)" || \
  fail 'could not generate client serial'
openssl x509 -req -sha256 -days 30 \
  -in "$staging_directory/client.csr" \
  -CA "$staging_directory/ca/ca.crt" \
  -CAkey "$staging_directory/ca/ca.key" \
  -set_serial "0x$client_serial" \
  -extfile "$staging_directory/client.ext" \
  -extensions client_extensions \
  -out "$staging_directory/client/client.crt" >/dev/null 2>&1 || \
  fail 'could not sign client certificate'

cp -- "$staging_directory/ca/ca.crt" "$staging_directory/client/ca.crt" || \
  fail 'could not create client CA bundle'
chmod 0600 \
  "$staging_directory/ca/ca.key" \
  "$staging_directory/server/server.key" \
  "$staging_directory/client/client.key" || fail 'could not secure private keys'
chmod 0600 \
  "$staging_directory/ca/ca.crt" \
  "$staging_directory/server/server.crt" \
  "$staging_directory/client/ca.crt" \
  "$staging_directory/client/client.crt" || fail 'could not secure certificates'
rm -f -- \
  "$staging_directory/ca.ext" \
  "$staging_directory/server.ext" \
  "$staging_directory/client.ext" \
  "$staging_directory/server.csr" \
  "$staging_directory/client.csr"

assert_no_symlink_components "$resolved_output"
if [ -e "$resolved_output" ]; then
  [ -d "$resolved_output" ] && [ ! -L "$resolved_output" ] || \
    fail 'output destination changed during setup'
  directory_is_empty "$resolved_output" || \
    fail 'output destination changed during setup'
  rmdir -- "$resolved_output" || fail 'could not prepare empty destination'
fi
[ ! -e "$resolved_output" ] && [ ! -L "$resolved_output" ] || \
  fail 'output destination changed during setup'
mv -- "$staging_directory" "$resolved_output" || \
  fail 'could not publish generated certificates'
staging_directory=''
chmod 0700 \
  "$resolved_output" \
  "$resolved_output/ca" \
  "$resolved_output/server" \
  "$resolved_output/client" || fail 'could not secure output directories'

printf 'Remote mTLS certificate setup: ready\n'
