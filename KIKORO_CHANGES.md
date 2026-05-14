# Kikoro Fork Changes

This is the canonical list of how kikoro diverges from upstream `getpaseo/paseo`. Use it for fork-vs-upstream debugging triage and to drive the upstream-merge protocol.

## v1 — Initial fork (branding swap only)

### App identity (packages/app/app.config.js)

| Field                           | Upstream paseo                    | Kikoro                                                   |
| ------------------------------- | --------------------------------- | -------------------------------------------------------- |
| variant `production` name       | `"Paseo"`                         | `"Kikoro"`                                               |
| variant `production` packageId  | `"sh.paseo"`                      | `"com.alnim.kikoro"`                                     |
| variant `development` name      | `"Paseo Debug"`                   | `"Kikoro Debug"`                                         |
| variant `development` packageId | `"sh.paseo.debug"`                | `"com.alnim.kikoro.debug"`                               |
| `expo.slug`                     | `"voice-mobile"`                  | `"codex-remote"` (preserves kikoro Expo project linkage) |
| `expo.scheme`                   | `"paseo"`                         | `"kikoro"`                                               |
| `expo.updates.url`              | `https://u.expo.dev/0e7f65ce-...` | `https://u.expo.dev/e65394bd-...`                        |
| `expo.extra.eas.projectId`      | `"0e7f65ce-..."`                  | `"e65394bd-110f-4075-9a8b-7366fd6a2f0f"`                 |
| `expo.owner`                    | `"getpaseo"`                      | `"alnim"`                                                |

### Build pipeline (packages/app/eas.json)

- **Added `testflight` build profile** — extends `production`, `channel: staging`, `distribution: store`, iOS-only with `image: latest` and `autoIncrement: true`. (Paseo doesn't ship a testflight profile; kikoro needs one because it ships via TestFlight.)
- **Added `testflight` submit profile** — `ios.ascAppId: 6764368884` (kikoro's App Store Connect app ID).
- **Changed `production` submit ios.ascAppId** — `6758887924` (paseo's) → `6764368884` (kikoro's). User's Apple Developer account doesn't have access to paseo's ASC app, so the production profile would fail without this swap.

### Versioning (packages/app/package.json `version` field)

Paseo and kikoro ride independent version lines. Paseo's is `0.x.y` (currently `0.1.75`); kikoro continues the old kikoro `1.x.y` line (started at `1.0.0`, currently `1.0.1`). The version shown in TestFlight + App Store comes from `packages/app/package.json` via `app.config.js`'s `version: pkg.version` line; `eas.json` stores only the build number remotely (`appVersionSource: "remote"`).

**Upstream-merge gotcha:** `packages/app/package.json` is NOT in `.gitattributes` `merge=ours` — we want to inherit paseo's dependency updates from this file (`react-native`, `expo-router`, etc.). The downside: a paseo version bump will overwrite kikoro's `version` field on merge. The smoke script (`scripts/smoke.sh`) catches this — it fails loudly if the version isn't on the `1.x` line. After every upstream merge, re-bump the version manually if smoke complains.

### EAS Workflow trigger surface

**Added `packages/app/.eas/workflows/testflight-on-main.yml`** — fires on every push to `main` that touches the iOS app or its workspace deps (path-filtered). Builds with the `testflight` profile, then auto-submits to TestFlight via the `submit_ios` job. Matches the old kikoro CI pattern of "push to main → TestFlight build queued."

To skip a build: push to a feature branch instead of main; merge later when you do want a build. Manual override: `workflow_dispatch` from EAS dashboard.

**Inherited paseo workflows that are NOT relevant to a personal kikoro fork** (will fire if you push their tags; `release-mobile.yml` builds for production+App Store Review submission, `deploy-app.yml` deploys to paseo's Cloudflare with paseo's npm scope and will fail):

- `.github/workflows/release-mobile.yml` — fires on `v*` tags (production build + App Store Review). Avoid pushing `v*` tags casually.
- `.github/workflows/deploy-app.yml` — fires on `v*` or `app-v*` tags (Cloudflare web deploy). Will fail on fork (uses paseo's `@boudra` npm scope and paseo's Cloudflare account).
- `.github/workflows/deploy-relay.yml`, `desktop-release.yml`, `desktop-rollout.yml`, `deploy-website.yml` — paseo's other deploy targets, mostly inert on the fork unless triggered.

These are kept as inherited code (no merge cost). They're inert until you push a matching tag. If they become annoying we can delete them in a future commit.

### Assets (packages/app/assets/images/)

| File                                        | Source                                |
| ------------------------------------------- | ------------------------------------- |
| `icon.png`                                  | Kikoro icon (replaces paseo)          |
| `splash-icon.png`                           | Kikoro splash (replaces paseo)        |
| `favicon.png`                               | Kikoro favicon (replaces paseo)       |
| `android-icon-foreground.png`               | Kikoro adaptive-icon (replaces paseo) |
| `kikoro-mark.svg`, `kikoro-header-mark.png` | Kikoro brand additions (new files)    |

The paseo favicon variants (`favicon-dark-attention.png`, etc.) are kept as-is since kikoro doesn't have equivalents yet.

The paseo `notification-icon.png` is kept as-is — you'll see paseo's icon in iOS notifications until kikoro ships its own. Tracked here for future replacement.

### Git protections (.gitattributes)

`merge=ours` is set on the kikoro-specific files so `git merge upstream/main` does not overwrite kikoro values during upstream pulls:

```
packages/app/app.config.js merge=ours
packages/app/eas.json merge=ours
packages/app/assets/images/icon.png merge=ours
packages/app/assets/images/splash-icon.png merge=ours
packages/app/assets/images/favicon.png merge=ours
packages/app/assets/images/android-icon-foreground.png merge=ours
KIKORO.md merge=ours
KIKORO_CHANGES.md merge=ours
scripts/smoke.sh merge=ours
.gitattributes merge=ours
```

Note: `merge=ours` requires `git config merge.ours.driver true` to be set on the local clone. The smoke script (`scripts/smoke.sh`) verifies kikoro values stayed intact after a merge.

## Upstream merge protocol

1. Pin paseo to a known-good version monthly rather than merging head weekly.
2. Before pinning: read paseo's CHANGELOG since last pin, check `getpaseo/paseo` security advisories.
3. Pin: `git fetch upstream && git merge --no-ff upstream/<sha>` (use a specific sha, not `upstream/main`).
4. Run `bash scripts/smoke.sh` to verify kikoro values stayed intact.
5. Test build: `eas build -p ios --profile testflight` (this catches protocol mismatches and EAS regressions).
6. If clean: push merge to `alnimra/kikoro` `origin/main`.
7. If a paseo CVE drops between pins: out-of-cycle override — re-pin to upstream HEAD, run smoke + test build, ship hotfix EAS Update via `eas update`.

## v2 — Codex/Claude subscription usage tracking (kikoro 1.1.0)

**Superseded by v3 (kikoro 1.2.0).** First opinionated feature shipping beyond the v1 branding swap. Originally shipped with dollar-totals UI; replaced in 1.2.0 with codexbar-style quota windows. See v3 for current shape. v1.1.0 daemons remain wire-compatible with v1.2.0 daemons (additive schema; deprecated dollar fields kept `.optional()` until 2026-11).

### What ships

- New daemon module `packages/server/src/server/codexbar/` that polls `codexbar cost --format json` on a 60s loop and broadcasts a normalized snapshot to every connected client over the existing WebSocket. Daemon-mediated, no separate transport — works over paseo's encrypted relay when iPhone is off-LAN.
- New protocol payload `subscription_usage_updated` plus capability gate `server_info.features.codexbarUsage` (all additive, passthrough Zod). Old clients ignore the new payload; clients hide the screen when the flag is absent.
- iOS `SubscriptionsSection` reachable from Settings sidebar. State-explicit copy for 8 conditions (loading, cli_missing, cli_error, parse_error, timeout, stale, empty, ok). Polls daemon broadcast plus a 60s tick for "Updated Xm ago".
- Atomic last-known-good cache at `$PASEO_HOME/codexbar/last-good.json` replayed on daemon start.
- Fake codexbar shim fixtures under `packages/server/src/server/codexbar/__fixtures__/` for the test suite.

### Why the daemon-mediated design (vs a separate Mac sidecar process)

A separate bridge can't reach iOS over paseo's encrypted relay — the `ConnectionOfferV2` pair-link schema is single-channel. A bridge bound to `127.0.0.1` is unreachable from the iPhone; bound to LAN, it's dead off-LAN. The daemon-mediated approach was the user-challenge resolution at /autoplan's final gate, accepting that this is the first per-feature departure from the "backend stays vanilla paseo" doctrine. Mitigated by being additive, capability-gated, and plausibly upstreamable to paseo as a separate workstream.

### Pivot from the /autoplan plan

Plan assumed `codexbar usage --format json` (quota windows + reset countdowns). Real testing on the user's Mac showed `usage` requires CodexBar.app running with browser cookies / OAuth set up; on a fresh shell it returns empty. `cost` is local JSONL parsing and returns useful totals immediately, and matches the user's stated need ("my total on both Claude and codex"). Trivial to add `usage` later via the same poll+broadcast plumbing.

### Files touched

| Layer            | Path                                                                                    | Lines          |
| ---------------- | --------------------------------------------------------------------------------------- | -------------- |
| Schema           | `packages/server/src/shared/messages.ts`                                                | +56 (additive) |
| Daemon           | `packages/server/src/server/codexbar/{schemas,cli,cache,service}.ts` + tests + fixtures | +500           |
| Daemon wiring    | `packages/server/src/server/{bootstrap,websocket-server}.ts`                            | +50            |
| iOS protocol     | `packages/app/src/contexts/session-context.tsx`                                         | +12            |
| iOS state        | `packages/app/src/stores/session-store.ts`                                              | +30            |
| iOS UI           | `packages/app/src/screens/settings/subscriptions-section.tsx`                           | +266 (new)     |
| iOS routing      | `packages/app/src/utils/host-routes.ts` + `screens/settings-screen.tsx`                 | +7             |
| Hooks            | `packages/app/src/hooks/use-subscription-usage.ts`                                      | +28            |
| Util + test      | `packages/app/src/utils/format-relative-time*`                                          | +48            |
| Regression smoke | `scripts/back-compat-smoke.mjs`                                                         | +69            |

### Future v3+ work (not in this fork yet)

The full design doc (in user's `~/.gstack/projects/alnimra-kikoro/`) plans these opinionated features for future sessions:

- Kanban-style issue management with sub-issue spawning (state lives in iCloud Drive JSON, not kikoro-local)
- Agent-delegated question answering (rule-table engine, not LLM impersonation)
- Approval gates as new layer of user-defined rules over paseo's bash approvals
- Subscription quota windows (`codexbar usage` path — same plumbing, just a second CLI invocation)
- Home Screen widget for ambient subscription awareness (explicit follow-on from the autoplan design review)

Each feature ships independently. When a feature touches paseo's WebSocket protocol (e.g., `source: "delegate"|"user"|"rule"` provenance fields), the protocol fork risk gets evaluated at that point.

## v3 — Subscription usage redesign: quota windows, not dollars (kikoro 1.2.0)

**Replaces v2's dollar-totals UI with codexbar-style quota windows + always-visible header indicator.** Same daemon-mediated transport, same capability gate, much better data.

### What changed and why

v1.1.0 (v2) shipped `codexbar cost --format json` → "Codex $49 today / $2944 30d, Claude $75 / $1404". The user's actual need was _"how much of my plan is left?"_ — visibility into quota consumption, not a dollar bill. v1.1.0 was wrong-product-but-right-plumbing.

v1.2.0 swaps the CLI invocation to `codexbar usage --format json --provider all` (already documented by CodexBarCLI 0.25.1+) and renders Session / Weekly / extra-window bars per provider with `% left` + reset countdowns + plan tier + account. No dollar amounts anywhere on the screen.

### Implementation

- **Daemon (`packages/server/src/server/codexbar/`):**
  - `cli.ts`: `fetchCodexbarCost` → `fetchCodexbarUsage`. Args `["usage", "--format", "json", "--provider", "all"]`. Timeout 30s → 60s (cold codexbar.app + remote API roundtrips for codex/claude).
  - `schemas.ts`: new `CodexbarUsageProviderRawSchema` matching the actual `usage` JSON (primary/secondary/tertiary windows, extraRateWindows, identity, credits, per-provider error). Old `CodexbarCostProviderRawSchema` kept exported for any straggler import.
  - `service.ts`: new `normalizeProvider` maps raw `usage` shape → broadcast shape. Pass-through per-provider error (`No available fetch strategy for openai`-style) preserved as `providerError` field. Dollar fields no longer populated.
- **Protocol (`shared/messages.ts`):** Additive. `SubscriptionProviderCostSchema` gains `identity`, `primary`, `secondary`, `tertiary`, `extraWindows`, `credits`, `providerError`, `cliVersion`. Old dollar fields stay `.optional()` and are explicitly marked deprecated in the COMPAT comment. Capability flag `codexbarUsage` unchanged. Old v1.1.0 clients on a v1.2.0 daemon see empty cells in their dollar table — graceful degradation per the `CLAUDE.md` "no fallback paths" rule.
- **iOS (`packages/app/src/screens/settings/subscriptions-section.tsx`):** Full UI rewrite. Per-provider card with Session/Weekly/extra bars (color-coded green ≥50%, yellow 20-49%, red <20%), reset countdown, plan tier, account. `assertNotVisible: "$"` in the QA flow enforces the no-dollars rule.
- **iOS header indicator (`packages/app/src/components/headers/header-subscription-indicator.tsx`):** NEW. Small color-coded chip showing the lowest `% left` across all tracked quota windows for the active host. Self-resolves serverId from the pathname. Tap → navigates to Subscriptions. Mounted as the default `rightContent` slot in `MenuHeader`, so it appears across every screen using that header without per-caller plumbing changes.

### Why no new capability flag

v1.1.0's `codexbarUsage` flag means "this daemon supports subscription tracking via codexbar." The feature is unchanged in essence; only the data shape evolved within a back-compat-clean schema. Adding a `codexbarUsageV2` flag would split the wire surface unnecessarily — old daemons stop being relevant once the user updates the Mac daemon, and the protocol's degraded-empty-table behavior is acceptable.

### Files touched

| Layer            | Path                                                                                                   | Lines (net)                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Schema           | `packages/server/src/shared/messages.ts`                                                               | +60                                                                            |
| Daemon raw       | `packages/server/src/server/codexbar/schemas.ts`                                                       | +80 (rewrite)                                                                  |
| Daemon CLI       | `packages/server/src/server/codexbar/cli.ts`                                                           | +25 -10 (rename + args)                                                        |
| Daemon service   | `packages/server/src/server/codexbar/service.ts`                                                       | +45 -20 (new mapping)                                                          |
| Daemon tests     | `packages/server/src/server/codexbar/{cli,service,cache}.test.ts` + `__fixtures__/fake-codexbar-ok.sh` | +200 -100 (new fixtures + 3rd-entry openai-error case + extraRateWindows case) |
| iOS UI           | `packages/app/src/screens/settings/subscriptions-section.tsx`                                          | +330 -200 (rewrite)                                                            |
| iOS header chip  | `packages/app/src/components/headers/header-subscription-indicator.tsx`                                | +110 (new)                                                                     |
| iOS header mount | `packages/app/src/components/headers/menu-header.tsx`                                                  | +6                                                                             |
| iOS store test   | `packages/app/src/stores/session-store.subscription-usage.test.ts`                                     | +8                                                                             |
| QA flow          | `~/.claude/skills/ios-qa/flows/kikoro/02-subscriptions-tab.yaml`                                       | +50 (new)                                                                      |
| Version          | `packages/app/package.json`                                                                            | 1.1.0 → 1.2.0                                                                  |
| KIKORO_CHANGES   | This file                                                                                              | +this section                                                                  |

### Post-ship hotfixes (PR #3, #4, #5 — same-day after #2 merge)

The 1.2.0 redesign shipped with three follow-up fixes that landed the same day to get the feature actually working on a real iPhone. None of these required a version bump (still kikoro 1.2.0); they shipped as JS via EAS Update on the staging channel.

- **PR #3 `a5072caf` — `cli.ts` partial-success.** Discovered during on-phone verification: `CodexBarCLI usage --format json --provider all` exits non-zero on a typical Mac because 35+ providers report "not signed in" errors even when Codex + Claude succeed. The daemon's CLI wrapper was discarding stdout on non-zero exits, throwing away valid JSON. Fix: treat the run as a partial success when stdout parses as a JSON array of provider entries, regardless of exit code. Otherwise the screen would have stayed empty after the daemon swap.
- **PR #4 `e7fadce1` — iOS serverId fallback.** Discovered when the user installed TestFlight build #16 and saw the header chip working (62%) but Settings → Subscriptions showing "Connect to a host" empty state. Root cause: `settings-screen.tsx` passed `serverId={localServerId}` where `useLocalDaemonServerId()` only returns a value in the Electron desktop app — on iOS/web it's always null. Fix: fall back to `anyOnlineServerId` (already computed in the same component for other sections). One line in `packages/app/src/screens/settings-screen.tsx`.
- **PR #5 `6f891bdc` — `--source cli` flag.** Originally framed as a fix for the macOS keychain ACL prompt that blocks CodexBarCLI on every daemon poll. On verification, `--source cli` does NOT avoid the keychain access — CodexBarCLI touches Chrome Safe Storage on startup regardless of the source flag. The PR is still correct (CLI source is the right default for the daemon — no browser cookies required, more deterministic), but the keychain unblock had to come from the user's side.

### Required one-time keychain ACL setup per Mac

CodexBarCLI reads Chrome's encrypted cookie storage from the macOS keychain (`Chrome Safe Storage` entry). Out of the box, every daemon poll triggers a keychain prompt that interactively blocks the helper; "Always Allow" usually doesn't stick because the daemon respawns the helper as a different process. The reliable fix is per-Mac, one-time:

1. Open Keychain Access.
2. Search for "Chrome Safe Storage".
3. Double-click the entry → Access Control tab.
4. Tick **"Allow all applications to access this item"** (simplest), OR click **+** and add `/Applications/CodexBar.app/Contents/Helpers/CodexBarCLI` specifically (use ⌘⇧G in the file picker to navigate into the .app bundle).
5. Save (re-enter login password).

Without this, the Subscriptions screen will show "CodexBar timed out. Try again in a moment." instead of real quota bars. The daemon-side fix can't bypass this; it's a macOS-level trust grant.

### v3+ work still on the slate

- Push notifications when a quota window drops below threshold (deferred from this redesign — explicit "just a glance" feature shape).
- Time-series history / consumption graph.
- Removing the deprecated dollar fields from `SubscriptionProviderCostSchema` (target: 2026-11, once floor pins kikoro >= 1.2.0).
- Home Screen widget for ambient quota awareness.
- **Bundle CodexBar's quota-fetching logic into `packages/desktop` (Electron)** — eliminates the dual-app requirement (kikoro Mac app + CodexBar.app menubar app). Codexbar is open source; port the relevant logic. Pros: one Mac app to run; auth surface stays on Mac. Cons: real implementation work, ChatGPT/Anthropic web cookie handling moves into kikoro. Tracked in `~/.gstack/projects/alnimra-kikoro/main-kikoro-subscriptions-redesign-followup-20260513-225500.md`.
