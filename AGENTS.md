# AGENTS.md — kikoro fork agent guidance

This file is for any AI agent (Claude Code, Codex CLI, Cursor, OpenCode, etc.) working in this repo.

**For full project context, also read [CLAUDE.md](CLAUDE.md)** — paseo's complete project doc. This file only adds kikoro-fork-specific rules that paseo upstream doesn't carry.

---

## Verify before claiming something is missing

Before telling the user "X is not installed" / "X is broken" / "you need to install Y", run a primary-source enumeration probe. Don't trust a single ambiguous error message.

The user runs iOS QA via Codex CLI on this Mac routinely. Their iOS dev environment is fully provisioned and working. If your probe says otherwise, the probe is wrong before the environment is wrong.

Common ambiguous probes that have bitten this rule:

- **`xcrun simctl get_app_container <UDID> <bundle>` returns "No such file or directory"** for BOTH "not installed" and "bundle id typo" (e.g. case mismatch). Always cross-check with `xcrun simctl listapps <UDID>` before declaring an app missing.
- **`which <cmd>` failing** can mean PATH ordering, mise/asdf shadowing, or a renamed binary — not "tool not installed".
- **`curl` to a daemon URL returning non-200** can mean CORS rejection, missing auth, or wrong path — not "daemon down".

If unsure, ask the user "I see X — does that match your expectation?" instead of telling them to install something.

## iOS QA environment facts (this Mac)

- **Simulator:** iPhone 16 Pro, UDID `1718F684-9A49-4792-B482-C46EF89AFD64`, normally kept Booted.
- **Apps installed on the sim:** Expo Go (`host.exp.Exponent` — capital E in "Exponent"), AwareOS (`com.awareos.app`), plus the system apps.
- **Maestro:** 2.5.1 at `~/.maestro/bin/maestro`.
- **Java:** openjdk@17 at `/opt/homebrew/Cellar/openjdk@17/17.0.19/libexec/openjdk.jdk/Contents/Home`. `mise` is on the user's interactive shell PATH but not in non-interactive bash subshells — Maestro invocations must `export JAVA_HOME=…` explicitly.
- **Kikoro repo:** `~/Documents/kikoro-alnimra`. Metro for kikoro dev runs at `exp://127.0.0.1:8081` (started with `npm run dev` or `npx expo start` from that repo).
- **Standard route to load kikoro on the sim:** `xcrun simctl openurl <UDID> exp://127.0.0.1:8081` — the simulator auto-foregrounds, Expo Go auto-launches, project loads.

If a `/ios-qa` (or any other Maestro-driven) run fails on this Mac, the likely root cause is transient state (Metro not running, Expo Go cache stale, simulator shut down), not missing tools. Investigate, don't reinstall.

## Bundle ID casing

iOS bundle IDs are case-sensitive in `simctl` matching but case-preserved in display. **`host.exp.Exponent` ≠ `host.exp.exponent`.** Apple's tools are inconsistent about which form they print. Source of truth is whatever `simctl listapps <UDID>` shows.

## Related skill

`/ios-qa` — Claude Code skill at `~/.claude/skills/ios-qa/`. Drives Maestro flows against the iPhone 16 Pro sim for kikoro. Pre-flight checks named-fail with remediation hints. See `~/.gstack/projects/alnimra-kikoro/homely-kiwi-ios-qa-skill-plan-20260513-222904.md` for the locked v0.1 plan.
