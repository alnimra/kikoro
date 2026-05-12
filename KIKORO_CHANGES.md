# Kikoro Fork Changes

This is the canonical list of how kikoro diverges from upstream `getpaseo/paseo`. Use it for fork-vs-upstream debugging triage and to drive the upstream-merge protocol.

## v1 — Initial fork (branding swap only)

### App identity (packages/app/app.config.js)

| Field | Upstream paseo | Kikoro |
|-------|----------------|--------|
| variant `production` name | `"Paseo"` | `"Kikoro"` |
| variant `production` packageId | `"sh.paseo"` | `"com.alnim.kikoro"` |
| variant `development` name | `"Paseo Debug"` | `"Kikoro Debug"` |
| variant `development` packageId | `"sh.paseo.debug"` | `"com.alnim.kikoro.debug"` |
| `expo.slug` | `"voice-mobile"` | `"codex-remote"` (preserves kikoro Expo project linkage) |
| `expo.scheme` | `"paseo"` | `"kikoro"` |
| `expo.updates.url` | `https://u.expo.dev/0e7f65ce-...` | `https://u.expo.dev/e65394bd-...` |
| `expo.extra.eas.projectId` | `"0e7f65ce-..."` | `"e65394bd-110f-4075-9a8b-7366fd6a2f0f"` |
| `expo.owner` | `"getpaseo"` | `"alnim"` |

### Build pipeline (packages/app/eas.json)

- **Added `testflight` build profile** — extends `production`, `channel: staging`, `distribution: store`, iOS-only with `image: latest` and `autoIncrement: true`. (Paseo doesn't ship a testflight profile; kikoro needs one because it ships via TestFlight.)
- **Added `testflight` submit profile** — `ios.ascAppId: 6764368884` (kikoro's App Store Connect app ID).
- **Changed `production` submit ios.ascAppId** — `6758887924` (paseo's) → `6764368884` (kikoro's). User's Apple Developer account doesn't have access to paseo's ASC app, so the production profile would fail without this swap.

### Assets (packages/app/assets/images/)

| File | Source |
|------|--------|
| `icon.png` | Kikoro icon (replaces paseo) |
| `splash-icon.png` | Kikoro splash (replaces paseo) |
| `favicon.png` | Kikoro favicon (replaces paseo) |
| `android-icon-foreground.png` | Kikoro adaptive-icon (replaces paseo) |
| `kikoro-mark.svg`, `kikoro-header-mark.png` | Kikoro brand additions (new files) |

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

## Future v2+ work (not in this fork yet)

The full design doc (in user's `~/.gstack/projects/alnimra-kikoro/`) plans these opinionated features for future sessions:

- Kanban-style issue management with sub-issue spawning (state lives in iCloud Drive JSON, not kikoro-local)
- Codex/Claude usage tracking (current-session counter for v1; historical graph deferred)
- Agent-delegated question answering (rule-table engine, not LLM impersonation)
- Approval gates as new layer of user-defined rules over paseo's bash approvals

Each feature ships independently. When a feature touches paseo's WebSocket protocol (e.g., `source: "delegate"|"user"|"rule"` provenance fields), the protocol fork risk gets evaluated at that point.
