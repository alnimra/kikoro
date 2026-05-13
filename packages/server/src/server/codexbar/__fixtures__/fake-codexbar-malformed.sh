#!/usr/bin/env bash
# Emits unparseable JSON. Daemon should return kind=parse_error and surface error code json_parse_error.
set -euo pipefail
if [ "${1:-}" = "--version" ]; then
  echo "CodexBar 0.99.0-fake"
  exit 0
fi
echo "this is { not json"
