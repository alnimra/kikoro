#!/usr/bin/env bash
# Emits exit 0 with empty stdout (the real codexbar behavior when no enabled
# providers match). Daemon should return kind=ok with empty providers array.
set -euo pipefail
if [ "${1:-}" = "--version" ]; then
  echo "CodexBar 0.99.0-fake"
  exit 0
fi
exit 0
