#!/usr/bin/env bash
# Hangs for 60s, used to exercise the daemon's CLI timeout.
if [ "${1:-}" = "--version" ]; then
  echo "CodexBar 0.99.0-fake"
  exit 0
fi
sleep 60
echo "should never print"
