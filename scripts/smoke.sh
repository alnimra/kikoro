#!/usr/bin/env bash
# Kikoro fork smoke test — run after fork bootstrap and after every upstream merge.
# Verifies kikoro-specific values stayed intact in app.config.js + eas.json + assets.
# Exit 0 = all good. Exit 1 = a kikoro value was overwritten or an asset is missing.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

CONFIG="packages/app/app.config.js"
EAS="packages/app/eas.json"
ASSETS="packages/app/assets/images"

fail() { echo "[smoke] FAIL: $1" >&2; exit 1; }
ok()   { echo "[smoke] OK:   $1"; }

echo "[smoke] checking $CONFIG..."
grep -q '"Kikoro"' "$CONFIG"                                        || fail "app name not 'Kikoro'"
grep -q '"com.alnim.kikoro"' "$CONFIG"                              || fail "iOS bundle ID 'com.alnim.kikoro' missing"
grep -q '"com.alnim.kikoro.debug"' "$CONFIG"                        || fail "debug bundle ID 'com.alnim.kikoro.debug' missing"
grep -q 'e65394bd-110f-4075-9a8b-7366fd6a2f0f' "$CONFIG"            || fail "Expo project ID is not kikoro's"
grep -q '"alnim"' "$CONFIG"                                          || fail "owner is not 'alnim'"
grep -q 'scheme: "kikoro"' "$CONFIG"                                 || fail "scheme is not 'kikoro'"
grep -q 'slug: "codex-remote"' "$CONFIG"                             || fail "slug is not 'codex-remote' (Expo project link)"
ok "$CONFIG kikoro values intact"

echo "[smoke] checking $EAS..."
grep -q '"testflight"' "$EAS"                                        || fail "no testflight profile"
grep -q '6764368884' "$EAS"                                          || fail "ascAppId is not kikoro's (6764368884)"
ok "$EAS kikoro values intact"

echo "[smoke] checking assets..."
test -f "$ASSETS/icon.png"                                           || fail "icon.png missing"
test -f "$ASSETS/splash-icon.png"                                    || fail "splash-icon.png missing"
test -f "$ASSETS/favicon.png"                                        || fail "favicon.png missing"
test -f "$ASSETS/android-icon-foreground.png"                        || fail "android-icon-foreground.png missing"
ok "core assets present"

echo "[smoke] all checks passed."
