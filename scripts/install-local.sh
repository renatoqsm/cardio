#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo 'Automatic local PostgreSQL setup supports Linux x64. Use an external PostgreSQL on other platforms.' >&2
  exit 1
fi
npm --cache "${NPM_CONFIG_CACHE:-$PWD/.local/npm-cache}" install --prefix "$PWD/.local/tools" --no-audit --no-fund pnpm@12.3.4 @embedded-postgres/linux-x64@17.10.0-beta.17
"$PWD/.local/tools/node_modules/.bin/pnpm" install --frozen-lockfile --store-dir "$PWD/.local/pnpm-store"
