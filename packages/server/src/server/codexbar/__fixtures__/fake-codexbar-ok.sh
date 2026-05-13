#!/usr/bin/env bash
# Emits a valid codexbar cost --format json payload (trimmed real sample).
set -euo pipefail
if [ "${1:-}" = "--version" ]; then
  echo "CodexBar 0.99.0-fake"
  exit 0
fi
# Match the subset the daemon actually parses. Extra fields are passed through
# so the schema's .passthrough() stays exercised.
cat <<'JSON'
[
  {
    "provider": "codex",
    "source": "local",
    "updatedAt": "2026-05-13T05:21:56Z",
    "sessionTokens": 120190126,
    "sessionCostUSD": 49.490366,
    "last30DaysTokens": 7788672189,
    "last30DaysCostUSD": 2944.2519,
    "totals": {
      "totalCost": 2944.2519,
      "totalTokens": 7788672189,
      "inputTokens": 7758792688,
      "outputTokens": 29879501,
      "futureField": "ignored"
    },
    "daily": []
  },
  {
    "provider": "claude",
    "source": "local",
    "updatedAt": "2026-05-13T05:21:57Z",
    "sessionTokens": 96921166,
    "sessionCostUSD": 74.9273759,
    "last30DaysTokens": 2326445082,
    "last30DaysCostUSD": 1404.2982862,
    "totals": {
      "totalCost": 1404.2982862,
      "totalTokens": 2326445082,
      "inputTokens": 55886414,
      "outputTokens": 16810220,
      "cacheReadTokens": 2171085667,
      "cacheCreationTokens": 82662781
    }
  }
]
JSON
