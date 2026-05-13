#!/usr/bin/env bash
# Real-world CodexBarCLI behavior: exits 1 whenever any provider returns an
# error, EVEN IF other providers succeeded with valid JSON on stdout. On a
# typical Mac the user is signed into 2-3 of ~40 probed providers, so this
# is the steady-state output shape. The daemon must parse stdout despite the
# non-zero exit.
set -euo pipefail
if [ "${1:-}" = "--version" ]; then
  echo "CodexBar 0.99.0-fake"
  exit 0
fi
# stdout: codex success + openai error (provider not signed in)
cat <<'JSON'
[
  {
    "provider": "codex",
    "source": "codex-cli",
    "version": "0.130.0",
    "usage": {
      "identity": { "accountEmail": "user@example.com", "loginMethod": "pro", "providerID": "codex" },
      "primary": { "usedPercent": 1, "windowMinutes": 300, "resetsAt": "2026-05-13T19:20:45Z" },
      "secondary": { "usedPercent": 0, "windowMinutes": 10080 },
      "tertiary": null,
      "updatedAt": "2026-05-13T17:14:08Z"
    }
  },
  {
    "provider": "openai",
    "source": "auto",
    "error": { "code": 1, "kind": "provider", "message": "No available fetch strategy for openai." }
  }
]
JSON
# Mimics the real "[codex notify] remoteControl/status/changed" noise on stderr
echo "[codex notify] remoteControl/status/changed" >&2
exit 1
