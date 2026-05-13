#!/usr/bin/env bash
# Exits nonzero with stderr (e.g. codexbar arg parse failure).
if [ "${1:-}" = "--version" ]; then
  echo "CodexBar 0.99.0-fake"
  exit 0
fi
echo "codexbar: provider 'bogus' is not enabled" >&2
exit 2
