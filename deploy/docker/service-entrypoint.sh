#!/bin/sh
set -eu

node dist/cli/migrate.js
exec "$@"
