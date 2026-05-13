#!/usr/bin/env bash
# Emits a valid codexbar usage --format json --provider all payload
# (trimmed real sample from CodexBar 0.25.1 on 2026-05-13).
set -euo pipefail
if [ "${1:-}" = "--version" ]; then
  echo "CodexBar 0.99.0-fake"
  exit 0
fi
# Match the subset the daemon actually parses. Extra fields are passed through
# so the schema's .passthrough() stays exercised. Includes per-provider error
# (openai) and Claude's extraRateWindows so both code paths are covered.
cat <<'JSON'
[
  {
    "provider": "codex",
    "source": "codex-cli",
    "version": "0.130.0",
    "credits": {
      "events": [],
      "remaining": 0,
      "updatedAt": "2026-05-13T15:54:26Z"
    },
    "usage": {
      "accountEmail": "m@ray.vin",
      "identity": {
        "accountEmail": "m@ray.vin",
        "loginMethod": "pro",
        "providerID": "codex"
      },
      "loginMethod": "pro",
      "primary": {
        "resetDescription": "04:20",
        "resetsAt": "2026-05-13T19:20:45Z",
        "usedPercent": 0,
        "windowMinutes": 300
      },
      "secondary": {
        "resetDescription": "May 19, 2026 at 12:27",
        "resetsAt": "2026-05-19T03:27:28Z",
        "usedPercent": 0,
        "windowMinutes": 10080
      },
      "tertiary": null,
      "updatedAt": "2026-05-13T15:54:26Z",
      "futureField": "ignored"
    }
  },
  {
    "provider": "openai",
    "source": "auto",
    "error": {
      "code": 1,
      "kind": "provider",
      "message": "No available fetch strategy for openai."
    }
  },
  {
    "provider": "claude",
    "source": "oauth",
    "version": "2.1.139",
    "usage": {
      "extraRateWindows": [
        {
          "id": "claude-design",
          "title": "Designs",
          "window": {
            "usedPercent": 0,
            "windowMinutes": 10080
          }
        },
        {
          "id": "claude-routines",
          "title": "Daily Routines",
          "window": {
            "usedPercent": 0,
            "windowMinutes": 10080
          }
        }
      ],
      "identity": {
        "loginMethod": "Claude Max",
        "providerID": "claude"
      },
      "loginMethod": "Claude Max",
      "primary": {
        "resetDescription": "May 14 at 1:09AM",
        "resetsAt": "2026-05-13T16:09:59Z",
        "usedPercent": 51,
        "windowMinutes": 300
      },
      "secondary": {
        "resetDescription": "May 16 at 4:00PM",
        "resetsAt": "2026-05-16T07:00:00Z",
        "usedPercent": 33,
        "windowMinutes": 10080
      },
      "tertiary": null,
      "updatedAt": "2026-05-13T15:54:27Z"
    }
  }
]
JSON
